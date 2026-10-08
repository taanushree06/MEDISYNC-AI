"""
MediSync AI — Smart Resource Redistribution Engine
Deterministic greedy allocation algorithm that:
1. Identifies hospitals at risk (projected below safety stock)
2. Identifies donors with transferable surplus
3. Matches donors to recipients based on urgency, feasibility, and safety
4. Generates ranked transfer recommendations
5. Manages full transfer lifecycle with idempotency checks

NOTE ON TRANSACTIONS:
MongoDB single-document operations are atomic. For multi-document atomicity
(e.g., simultaneous donor deduction + recipient addition), MongoDB replica set
transactions are required. For the hackathon demo with a single-node MongoDB,
we use sequential updates with consistency checks. In production, use a
replica set with proper transactions.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from app.db import get_database
from app.schemas import TransferRecommendation, Transfer, RecommendationResponse
from app.simulation import get_transport_time, get_simulator
from app.ml import predict_all_hospitals

logger = logging.getLogger(__name__)


def calculate_transferable_surplus(hospital: dict, committed_qty: int = 0) -> int:
    """
    Calculate how many cylinders a donor can safely transfer.
    Protects safety stock + expected consumption for 2 simulated hours.
    Subtracts already committed (approved/in-transit) quantities.
    """
    current = hospital["current_stock"]
    safety = hospital["minimum_safety_stock"]
    rate = hospital["consumption_rate"]

    # Reserve for 2 hours of consumption + safety stock
    reserved = safety + (rate * 2)
    surplus = current - reserved - committed_qty
    return max(0, int(surplus))


def get_committed_outbound(hospital_id: str) -> int:
    """Get total quantity already committed in approved/in-transit transfers from this hospital."""
    db = get_database()
    pipeline = [
        {"$match": {
            "source_hospital_id": hospital_id,
            "status": {"$in": ["approved", "in_transit"]}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
    ]
    result = list(db.transfers.aggregate(pipeline))
    if result:
        return result[0]["total"]

    # Also check recommendations that are still proposed (not yet transferred)
    pipeline2 = [
        {"$match": {
            "source_hospital_id": hospital_id,
            "status": "approved"
        }},
        {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
    ]
    result2 = list(db.transfer_recommendations.aggregate(pipeline2))
    return result2[0]["total"] if result2 else 0


def generate_recommendations() -> List[RecommendationResponse]:
    """
    Core optimization: match donors to recipients.
    Greedy algorithm sorted by recipient urgency.
    """
    db = get_database()
    hospitals = list(db.hospitals.find())
    hospital_map = {h["hospital_id"]: h for h in hospitals}

    # Generate fresh predictions
    predictions = predict_all_hospitals(save=True)
    pred_map = {p.hospital_id: p for p in predictions}

    # Classify hospitals
    recipients = []  # Need stock
    donors = []  # Have surplus

    for h in hospitals:
        hid = h["hospital_id"]
        pred = pred_map.get(hid)
        hours_left = pred.hours_to_shortage if pred and pred.hours_to_shortage is not None else None

        committed = get_committed_outbound(hid)
        surplus = calculate_transferable_surplus(h, committed)

        if hours_left is not None and hours_left < 8.0:
            # At risk — needs stock
            deficit = h["minimum_safety_stock"] - h["current_stock"]
            needed = max(
                int(h["minimum_safety_stock"] * 0.5),  # At least half safety stock
                int(h["consumption_rate"] * 3)  # 3 hours of consumption
            )
            if h["current_stock"] < h["minimum_safety_stock"] * 1.5:
                needed = max(needed, int(h["minimum_safety_stock"] - h["current_stock"] + h["consumption_rate"] * 2))

            recipients.append({
                "hospital": h,
                "hours_to_shortage": hours_left,
                "quantity_needed": max(1, needed),
                "prediction": pred,
            })
        elif surplus > 5:
            donors.append({
                "hospital": h,
                "surplus": surplus,
                "committed": committed,
            })

    # Sort recipients by urgency (least time to shortage first)
    recipients.sort(key=lambda r: r["hours_to_shortage"] if r["hours_to_shortage"] is not None else 999)

    # Cancel old proposed recommendations
    db.transfer_recommendations.update_many(
        {"status": "proposed"},
        {"$set": {"status": "cancelled"}}
    )

    recommendations = []
    # Track remaining donor surplus during allocation
    donor_remaining = {d["hospital"]["hospital_id"]: d["surplus"] for d in donors}

    priority = 1
    for recipient in recipients:
        r_hospital = recipient["hospital"]
        r_id = r_hospital["hospital_id"]
        needed = recipient["quantity_needed"]

        # Find best donor for this recipient
        best_donors = sorted(
            donors,
            key=lambda d: (
                -donor_remaining.get(d["hospital"]["hospital_id"], 0),  # Most surplus first
                get_transport_time(d["hospital"]["hospital_id"], r_id),  # Shortest travel
            )
        )

        for donor in best_donors:
            d_id = donor["hospital"]["hospital_id"]
            available = donor_remaining.get(d_id, 0)

            if available <= 0:
                continue

            # Calculate transfer quantity
            transfer_qty = min(needed, available)
            if transfer_qty < 3:  # Minimum viable transfer
                continue

            transport_minutes = get_transport_time(d_id, r_id)
            hours_to_shortage = recipient["hours_to_shortage"] or 4.0

            # Check if transfer can arrive before shortage
            transport_hours = transport_minutes / 60.0
            if transport_hours > hours_to_shortage * 0.9:
                continue  # Won't arrive in time

            sim = get_simulator()
            sim_time = sim.simulation_time or datetime.utcnow()
            required_arrival = sim_time + timedelta(hours=hours_to_shortage * 0.8)

            rec = TransferRecommendation(
                source_hospital_id=d_id,
                destination_hospital_id=r_id,
                quantity=transfer_qty,
                estimated_transport_minutes=transport_minutes,
                required_arrival_time=required_arrival,
                priority=priority,
                explanation="",  # Will be filled by Gemini or fallback
                status="proposed",
            )

            # Generate deterministic fallback explanation
            d_name = donor["hospital"]["name"]
            r_name = r_hospital["name"]
            rec.explanation = (
                f"Transfer {transfer_qty} oxygen cylinders from {d_name} to {r_name}. "
                f"{r_name} is projected to reach safety threshold in {hours_to_shortage:.1f} simulated hours. "
                f"{d_name} has {available} surplus cylinders after maintaining its safety reserve. "
                f"Estimated transport time: {transport_minutes:.0f} minutes."
            )

            db.transfer_recommendations.insert_one(rec.model_dump())

            # Build response
            resp = RecommendationResponse(
                **rec.model_dump(),
                source_hospital_name=d_name,
                destination_hospital_name=r_name,
                source_current_stock=donor["hospital"]["current_stock"],
                destination_current_stock=r_hospital["current_stock"],
                destination_hours_to_shortage=hours_to_shortage,
                safety_check_passed=True,
            )
            recommendations.append(resp)

            # Update tracking
            donor_remaining[d_id] -= transfer_qty
            needed -= transfer_qty
            priority += 1

            if needed <= 0:
                break

    logger.info(f"Generated {len(recommendations)} transfer recommendations")
    return recommendations


def get_recommendations() -> List[RecommendationResponse]:
    """Fetch current proposed/approved recommendations."""
    db = get_database()
    recs = list(db.transfer_recommendations.find(
        {"status": {"$in": ["proposed", "approved"]}}
    ).sort("priority", 1))

    hospital_map = {
        h["hospital_id"]: h
        for h in db.hospitals.find()
    }

    results = []
    for r in recs:
        src = hospital_map.get(r["source_hospital_id"], {})
        dst = hospital_map.get(r["destination_hospital_id"], {})
        resp = RecommendationResponse(
            recommendation_id=r["recommendation_id"],
            source_hospital_id=r["source_hospital_id"],
            destination_hospital_id=r["destination_hospital_id"],
            quantity=r["quantity"],
            estimated_transport_minutes=r["estimated_transport_minutes"],
            required_arrival_time=r.get("required_arrival_time"),
            priority=r["priority"],
            explanation=r.get("explanation", ""),
            status=r["status"],
            created_at=r.get("created_at", datetime.utcnow()),
            source_hospital_name=src.get("name", ""),
            destination_hospital_name=dst.get("name", ""),
            source_current_stock=src.get("current_stock", 0),
            destination_current_stock=dst.get("current_stock", 0),
        )
        results.append(resp)
    return results


def approve_recommendation(recommendation_id: str) -> Optional[Transfer]:
    """
    Approve a recommendation: validate donor stock, create transfer record.
    Idempotent — returns existing transfer if already approved.
    """
    db = get_database()
    rec = db.transfer_recommendations.find_one({"recommendation_id": recommendation_id})

    if not rec:
        raise ValueError(f"Recommendation {recommendation_id} not found")

    if rec["status"] == "approved":
        # Idempotent: check if transfer already exists
        existing = db.transfers.find_one({"recommendation_id": recommendation_id})
        if existing:
            return Transfer(**{k: existing[k] for k in Transfer.model_fields if k in existing})
        raise ValueError("Recommendation already approved but no transfer found")

    if rec["status"] != "proposed":
        raise ValueError(f"Cannot approve recommendation with status '{rec['status']}'")

    # Revalidate donor stock
    donor = db.hospitals.find_one({"hospital_id": rec["source_hospital_id"]})
    if not donor:
        raise ValueError("Donor hospital not found")

    committed = get_committed_outbound(rec["source_hospital_id"])
    available = calculate_transferable_surplus(donor, committed)

    if available < rec["quantity"]:
        raise ValueError(
            f"Donor has insufficient surplus. Available: {available}, Requested: {rec['quantity']}"
        )

    # Update recommendation status
    db.transfer_recommendations.update_one(
        {"recommendation_id": recommendation_id, "status": "proposed"},
        {"$set": {"status": "approved"}}
    )

    # Create transfer record
    transfer = Transfer(
        recommendation_id=recommendation_id,
        source_hospital_id=rec["source_hospital_id"],
        destination_hospital_id=rec["destination_hospital_id"],
        quantity=rec["quantity"],
        status="approved",
        approved_at=datetime.utcnow(),
    )
    db.transfers.insert_one(transfer.model_dump())

    logger.info(f"Approved recommendation {recommendation_id}, transfer {transfer.transfer_id}")
    return transfer


def cancel_recommendation(recommendation_id: str) -> bool:
    """Cancel a proposed recommendation."""
    db = get_database()
    result = db.transfer_recommendations.update_one(
        {"recommendation_id": recommendation_id, "status": "proposed"},
        {"$set": {"status": "cancelled"}}
    )
    return result.modified_count > 0


def dispatch_transfer(transfer_id: str) -> Optional[Transfer]:
    """
    Dispatch an approved transfer. Deducts stock from donor ONCE.
    """
    db = get_database()
    transfer = db.transfers.find_one({"transfer_id": transfer_id})

    if not transfer:
        raise ValueError(f"Transfer {transfer_id} not found")

    if transfer["status"] == "in_transit":
        # Idempotent
        return Transfer(**{k: transfer[k] for k in Transfer.model_fields if k in transfer})

    if transfer["status"] != "approved":
        raise ValueError(f"Cannot dispatch transfer with status '{transfer['status']}'")

    # Deduct from donor (exactly once via status check)
    result = db.transfers.update_one(
        {"transfer_id": transfer_id, "status": "approved"},
        {"$set": {"status": "in_transit", "dispatched_at": datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise ValueError("Transfer was already dispatched or status changed")

    # Deduct from donor stock
    db.hospitals.update_one(
        {"hospital_id": transfer["source_hospital_id"]},
        {"$inc": {"current_stock": -transfer["quantity"]}}
    )

    logger.info(f"Dispatched transfer {transfer_id}: {transfer['quantity']} units from {transfer['source_hospital_id']}")

    updated = db.transfers.find_one({"transfer_id": transfer_id})
    return Transfer(**{k: updated[k] for k in Transfer.model_fields if k in updated})


def complete_transfer(transfer_id: str) -> Optional[Transfer]:
    """
    Complete an in-transit transfer. Adds stock to recipient ONCE.
    """
    db = get_database()
    transfer = db.transfers.find_one({"transfer_id": transfer_id})

    if not transfer:
        raise ValueError(f"Transfer {transfer_id} not found")

    if transfer["status"] == "completed":
        # Idempotent
        return Transfer(**{k: transfer[k] for k in Transfer.model_fields if k in transfer})

    if transfer["status"] != "in_transit":
        raise ValueError(f"Cannot complete transfer with status '{transfer['status']}'")

    # Mark completed (exactly once)
    result = db.transfers.update_one(
        {"transfer_id": transfer_id, "status": "in_transit"},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise ValueError("Transfer was already completed or status changed")

    # Add to recipient stock
    db.hospitals.update_one(
        {"hospital_id": transfer["destination_hospital_id"]},
        {"$inc": {"current_stock": transfer["quantity"]}}
    )

    # Also update recommendation status
    db.transfer_recommendations.update_one(
        {"recommendation_id": transfer["recommendation_id"]},
        {"$set": {"status": "completed"}}
    )

    logger.info(f"Completed transfer {transfer_id}: {transfer['quantity']} units to {transfer['destination_hospital_id']}")

    updated = db.transfers.find_one({"transfer_id": transfer_id})
    return Transfer(**{k: updated[k] for k in Transfer.model_fields if k in updated})


def get_transfers() -> List[dict]:
    """Get all transfers with hospital names."""
    db = get_database()
    transfers = list(db.transfers.find().sort("approved_at", -1))
    hospital_map = {h["hospital_id"]: h["name"] for h in db.hospitals.find()}

    results = []
    for t in transfers:
        t["source_hospital_name"] = hospital_map.get(t["source_hospital_id"], "")
        t["destination_hospital_name"] = hospital_map.get(t["destination_hospital_id"], "")
        t.pop("_id", None)
        results.append(t)
    return results
