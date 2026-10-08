"""
MediSync AI — API Routes
All versioned REST endpoints and WebSocket handler.
"""

import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query, Header
from pydantic import BaseModel
from app.db import get_database, check_connection
from app.schemas import (
    HealthResponse, HospitalResponse, SimulationStatus,
    AnalyticsResponse, PredictionResponse, RecommendationResponse,
    TransferResponse, ModelEvaluation,
)
from app.simulation import get_simulator
from app.ml import predict_all_hospitals, predict_for_hospital, evaluate_model
from app.services import (
    generate_recommendations, get_recommendations,
    approve_recommendation, cancel_recommendation,
    dispatch_transfer, complete_transfer, get_transfers,
)
from app.services.gemini_service import (
    generate_explanation, generate_emergency_explanation, clear_cache,
)
from app.core import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Auth Helper ──────────────────────────────────────────────────────
def verify_operator(token: Optional[str] = None):
    """Simple demo operator auth. In production, use proper auth."""
    if settings.app_env == "development":
        return True
    if not token or token != settings.demo_operator_token:
        raise HTTPException(status_code=403, detail="Invalid operator token")
    return True


# ─── Health ───────────────────────────────────────────────────────────
@router.get("/api/health", response_model=HealthResponse)
async def health():
    sim = get_simulator()
    return HealthResponse(
        status="ok",
        mongodb=check_connection(),
        simulation_running=sim.running,
        version="1.0.0",
    )


# ─── Hospitals ────────────────────────────────────────────────────────
@router.get("/api/v1/hospitals")
async def get_hospitals():
    db = get_database()
    hospitals = list(db.hospitals.find())
    sim = get_simulator()

    results = []
    for h in hospitals:
        h.pop("_id", None)

        # Get latest prediction for status
        pred = db.predictions.find_one(
            {"hospital_id": h["hospital_id"]},
            sort=[("created_at", -1)]
        )

        hours = None
        if pred and pred.get("hours_to_shortage") is not None:
            hours = pred["hours_to_shortage"]

        # Determine status
        safety = h["minimum_safety_stock"]
        stock = h["current_stock"]
        if stock <= safety * 0.5:
            status = "critical"
        elif stock <= safety * 1.2 or (hours is not None and hours < 3):
            status = "warning"
        else:
            status = "normal"

        # Determine trend
        readings = list(db.resource_readings.find(
            {"hospital_id": h["hospital_id"]}
        ).sort("timestamp", -1).limit(5))
        if len(readings) >= 2:
            if readings[0]["stock_level"] < readings[-1]["stock_level"]:
                trend = "declining"
            elif readings[0]["stock_level"] > readings[-1]["stock_level"]:
                trend = "rising"
            else:
                trend = "stable"
        else:
            trend = "stable"

        resp = HospitalResponse(
            **h,
            status=status,
            stock_trend=trend,
            hours_to_shortage=hours,
        )
        results.append(resp.model_dump())

    return results


@router.get("/api/v1/hospitals/{hospital_id}")
async def get_hospital(hospital_id: str):
    db = get_database()
    h = db.hospitals.find_one({"hospital_id": hospital_id})
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    h.pop("_id", None)
    return h


@router.get("/api/v1/hospitals/{hospital_id}/history")
async def get_hospital_history(hospital_id: str, limit: int = Query(default=100, le=500)):
    db = get_database()
    readings = list(
        db.resource_readings.find(
            {"hospital_id": hospital_id}
        ).sort("timestamp", -1).limit(limit)
    )
    for r in readings:
        r.pop("_id", None)
    readings.reverse()
    return readings


# ─── Predictions ──────────────────────────────────────────────────────
@router.get("/api/v1/predictions")
async def get_predictions():
    predictions = predict_all_hospitals(save=True)
    db = get_database()
    hospital_map = {h["hospital_id"]: h for h in db.hospitals.find()}

    results = []
    for p in predictions:
        h = hospital_map.get(p.hospital_id, {})
        resp = PredictionResponse(
            **p.model_dump(),
            hospital_name=h.get("name", ""),
            current_stock=h.get("current_stock", 0),
            safety_stock=h.get("minimum_safety_stock", 0),
            forecast_points=p.confidence_metadata.get("forecast_points", []),
        )
        results.append(resp.model_dump())
    return results


# ─── Recommendations ─────────────────────────────────────────────────
@router.get("/api/v1/recommendations")
async def list_recommendations():
    recs = get_recommendations()
    return [r.model_dump() for r in recs]


@router.post("/api/v1/recommendations/generate")
async def trigger_generate_recommendations(
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    recs = generate_recommendations()

    # Enrich with Gemini explanations
    db = get_database()
    for rec in recs:
        src = db.hospitals.find_one({"hospital_id": rec.source_hospital_id})
        dst = db.hospitals.find_one({"hospital_id": rec.destination_hospital_id})

        explanation_data = {
            "source_hospital_name": rec.source_hospital_name,
            "destination_hospital_name": rec.destination_hospital_name,
            "quantity": rec.quantity,
            "estimated_transport_minutes": rec.estimated_transport_minutes,
            "hours_to_shortage": rec.destination_hours_to_shortage,
            "source_current_stock": rec.source_current_stock,
            "destination_current_stock": rec.destination_current_stock,
            "source_safety_stock": src.get("minimum_safety_stock", 0) if src else 0,
            "destination_safety_stock": dst.get("minimum_safety_stock", 0) if dst else 0,
        }
        gemini_explanation = generate_explanation(explanation_data)
        if gemini_explanation:
            rec.explanation = gemini_explanation
            db.transfer_recommendations.update_one(
                {"recommendation_id": rec.recommendation_id},
                {"$set": {"explanation": gemini_explanation}}
            )

    return [r.model_dump() for r in recs]


@router.post("/api/v1/recommendations/{recommendation_id}/approve")
async def approve_rec(
    recommendation_id: str,
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    try:
        transfer = approve_recommendation(recommendation_id)
        if transfer:
            sim = get_simulator()
            await sim.broadcast({
                "type": "transfer_approved",
                "transfer_id": transfer.transfer_id,
                "recommendation_id": recommendation_id,
            })
            return transfer.model_dump()
        raise HTTPException(status_code=500, detail="Failed to create transfer")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v1/recommendations/{recommendation_id}/cancel")
async def cancel_rec(
    recommendation_id: str,
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    success = cancel_recommendation(recommendation_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel recommendation")
    return {"status": "cancelled"}


# ─── Transfers ────────────────────────────────────────────────────────
@router.get("/api/v1/transfers")
async def list_transfers():
    return get_transfers()


@router.post("/api/v1/transfers/{transfer_id}/dispatch")
async def dispatch_xfer(
    transfer_id: str,
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    try:
        transfer = dispatch_transfer(transfer_id)
        if transfer:
            sim = get_simulator()
            await sim.broadcast({
                "type": "transfer_dispatched",
                "transfer_id": transfer_id,
            })
            return transfer.model_dump()
        raise HTTPException(status_code=500, detail="Failed to dispatch")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v1/transfers/{transfer_id}/complete")
async def complete_xfer(
    transfer_id: str,
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    try:
        transfer = complete_transfer(transfer_id)
        if transfer:
            sim = get_simulator()
            await sim.broadcast({
                "type": "transfer_completed",
                "transfer_id": transfer_id,
            })
            return transfer.model_dump()
        raise HTTPException(status_code=500, detail="Failed to complete")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Analytics ────────────────────────────────────────────────────────
@router.get("/api/v1/analytics")
async def get_analytics():
    db = get_database()
    hospitals = list(db.hospitals.find())
    sim = get_simulator()

    total_stock = sum(h["current_stock"] for h in hospitals)

    # Count at-risk hospitals
    at_risk = 0
    predicted_shortages = 0
    summaries = []
    for h in hospitals:
        safety = h["minimum_safety_stock"]
        pred = db.predictions.find_one(
            {"hospital_id": h["hospital_id"]},
            sort=[("created_at", -1)]
        )
        hours = pred.get("hours_to_shortage") if pred else None

        if h["current_stock"] <= safety * 1.2 or (hours is not None and hours < 4):
            at_risk += 1
        if hours is not None and hours < 8:
            predicted_shortages += 1

        summaries.append({
            "hospital_id": h["hospital_id"],
            "name": h["name"],
            "current_stock": round(h["current_stock"], 1),
            "safety_stock": safety,
            "consumption_rate": h["consumption_rate"],
            "hours_to_shortage": round(hours, 1) if hours else None,
            "status": "critical" if h["current_stock"] <= safety * 0.5
                     else "warning" if h["current_stock"] <= safety * 1.2
                     else "normal",
        })

    active_recs = db.transfer_recommendations.count_documents(
        {"status": {"$in": ["proposed", "approved"]}}
    )
    completed = db.transfers.count_documents({"status": "completed"})
    active_transfers = db.transfers.count_documents(
        {"status": {"$in": ["approved", "in_transit"]}}
    )

    # Get latest evaluation
    eval_doc = db.model_evaluations.find_one(sort=[("evaluation_timestamp", -1)])
    evaluation = None
    if eval_doc:
        eval_doc.pop("_id", None)
        evaluation = ModelEvaluation(**eval_doc)

    return AnalyticsResponse(
        total_hospitals=len(hospitals),
        total_stock=round(total_stock, 1),
        hospitals_at_risk=at_risk,
        active_recommendations=active_recs,
        predicted_shortages=predicted_shortages,
        total_transfers_completed=completed,
        total_transfers_active=active_transfers,
        evaluation=evaluation,
        hospital_summaries=summaries,
    ).model_dump()


@router.get("/api/v1/evaluation")
async def get_evaluation():
    sim = get_simulator()
    evaluation = evaluate_model(sim.simulation_run_id)
    if evaluation:
        return evaluation.model_dump()
    return {"message": "Insufficient data for evaluation. Run simulation longer.", "evaluation": None}


# ─── Simulation Control ──────────────────────────────────────────────
@router.get("/api/v1/simulation/status")
async def simulation_status():
    sim = get_simulator()
    return sim.get_status().model_dump()


@router.post("/api/v1/simulation/start")
async def simulation_start(x_operator_token: Optional[str] = Header(None)):
    verify_operator(x_operator_token)
    sim = get_simulator()
    status = await sim.start()
    return status.model_dump()


@router.post("/api/v1/simulation/pause")
async def simulation_pause(x_operator_token: Optional[str] = Header(None)):
    verify_operator(x_operator_token)
    sim = get_simulator()
    status = await sim.pause()
    return status.model_dump()


@router.post("/api/v1/simulation/resume")
async def simulation_resume(x_operator_token: Optional[str] = Header(None)):
    verify_operator(x_operator_token)
    sim = get_simulator()
    status = await sim.resume()
    return status.model_dump()


@router.post("/api/v1/simulation/reset")
async def simulation_reset(x_operator_token: Optional[str] = Header(None)):
    verify_operator(x_operator_token)
    sim = get_simulator()
    clear_cache()
    status = await sim.reset()
    return status.model_dump()


class EmergencyRequest(BaseModel):
    hospital_id: str
    multiplier: float = 3.0


@router.post("/api/v1/simulation/emergency")
async def simulation_emergency(
    req: EmergencyRequest,
    x_operator_token: Optional[str] = Header(None),
):
    verify_operator(x_operator_token)
    sim = get_simulator()
    db = get_database()

    # Get hospital info before surge
    hospital = db.hospitals.find_one({"hospital_id": req.hospital_id})
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    old_rate = hospital["consumption_rate"]
    status = await sim.emergency_surge(req.hospital_id, req.multiplier)

    # Generate recommendations
    recs = generate_recommendations()

    # Generate Gemini explanation for the emergency
    new_rate = old_rate * req.multiplier
    explanation = generate_emergency_explanation(hospital["name"], old_rate, new_rate)

    # Enrich recommendations with Gemini explanations
    for rec in recs:
        src = db.hospitals.find_one({"hospital_id": rec.source_hospital_id})
        dst = db.hospitals.find_one({"hospital_id": rec.destination_hospital_id})
        explanation_data = {
            "source_hospital_name": rec.source_hospital_name,
            "destination_hospital_name": rec.destination_hospital_name,
            "quantity": rec.quantity,
            "estimated_transport_minutes": rec.estimated_transport_minutes,
            "hours_to_shortage": rec.destination_hours_to_shortage,
            "source_current_stock": rec.source_current_stock,
            "destination_current_stock": rec.destination_current_stock,
            "source_safety_stock": src.get("minimum_safety_stock", 0) if src else 0,
            "destination_safety_stock": dst.get("minimum_safety_stock", 0) if dst else 0,
        }
        gemini_exp = generate_explanation(explanation_data)
        if gemini_exp:
            rec.explanation = gemini_exp
            db.transfer_recommendations.update_one(
                {"recommendation_id": rec.recommendation_id},
                {"$set": {"explanation": gemini_exp}}
            )

    await sim.broadcast({
        "type": "emergency_update",
        "hospital_id": req.hospital_id,
        "explanation": explanation,
        "recommendations_count": len(recs),
    })

    return {
        "status": status.model_dump(),
        "explanation": explanation,
        "recommendations": [r.model_dump() for r in recs],
    }


# ─── Recent Events ───────────────────────────────────────────────────
@router.get("/api/v1/events")
async def get_events(limit: int = Query(default=20, le=100)):
    db = get_database()
    events = list(db.simulation_events.find().sort("timestamp", -1).limit(limit))
    for e in events:
        e.pop("_id", None)
    return events


# ─── WebSocket ────────────────────────────────────────────────────────
@router.websocket("/api/v1/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    sim = get_simulator()
    sim.register_ws(websocket)
    logger.info("WebSocket client connected")
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        sim.unregister_ws(websocket)
        logger.info("WebSocket client disconnected")
    except Exception:
        sim.unregister_ws(websocket)
