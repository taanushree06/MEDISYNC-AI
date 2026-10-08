"""
MediSync AI — ML Shortage Prediction Module
Uses linear regression on recent stock observations to predict
depletion rate and time-to-shortage.

Model: linear-depletion-v1
"""

import logging
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sklearn.linear_model import LinearRegression
from app.db import get_database
from app.schemas import Prediction, ModelEvaluation

logger = logging.getLogger(__name__)

MODEL_VERSION = "linear-depletion-v1"
DEFAULT_WINDOW_SIZE = 20  # Number of recent readings to use


def predict_for_hospital(
    hospital_id: str,
    window_size: int = DEFAULT_WINDOW_SIZE,
    save: bool = True,
) -> Optional[Prediction]:
    """
    Predict time-to-shortage for a single hospital using linear regression
    on recent stock observations.

    Returns None if insufficient data.
    """
    db = get_database()
    hospital = db.hospitals.find_one({"hospital_id": hospital_id})
    if not hospital:
        return None

    # Fetch recent readings
    readings = list(
        db.resource_readings.find(
            {"hospital_id": hospital_id}
        ).sort("timestamp", -1).limit(window_size)
    )

    if len(readings) < 3:
        # Not enough data for regression
        return _fallback_prediction(hospital, save)

    # Prepare features: time in hours from first reading, stock levels
    readings.reverse()  # oldest first
    base_time = readings[0]["timestamp"]
    X = []
    y = []
    for r in readings:
        hours = (r["timestamp"] - base_time).total_seconds() / 3600.0
        X.append([hours])
        y.append(r["stock_level"])

    X_arr = np.array(X)
    y_arr = np.array(y)

    # Fit linear regression
    model = LinearRegression()
    model.fit(X_arr, y_arr)

    # Depletion rate (negative slope = consuming)
    depletion_rate_per_hour = -model.coef_[0]  # positive if consuming
    current_stock = hospital["current_stock"]
    safety_stock = hospital["minimum_safety_stock"]

    # Calculate R² for confidence metadata
    y_pred_train = model.predict(X_arr)
    ss_res = np.sum((y_arr - y_pred_train) ** 2)
    ss_tot = np.sum((y_arr - np.mean(y_arr)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # Residual std for uncertainty
    residuals = y_arr - y_pred_train
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 0.0

    # Calculate time to shortage
    hours_to_shortage = None
    predicted_shortage_time = None

    if depletion_rate_per_hour > 0.01:  # Meaningful positive depletion
        stock_above_safety = current_stock - safety_stock
        if stock_above_safety > 0:
            hours_to_shortage = stock_above_safety / depletion_rate_per_hour
            predicted_shortage_time = datetime.utcnow() + timedelta(hours=hours_to_shortage)
        else:
            # Already below safety
            hours_to_shortage = 0.0
            predicted_shortage_time = datetime.utcnow()
    # If depletion_rate <= 0, stock is stable or growing — no shortage

    # Generate forecast points (next 12 simulated hours)
    last_hours = X_arr[-1][0]
    forecast_points = []
    for h in range(0, 13):
        future_hours = last_hours + h
        pred_stock = max(0, model.predict([[future_hours]])[0])
        forecast_points.append({
            "hours_ahead": h,
            "predicted_stock": round(float(pred_stock), 2),
        })

    prediction = Prediction(
        hospital_id=hospital_id,
        predicted_shortage_time=predicted_shortage_time,
        hours_to_shortage=round(hours_to_shortage, 2) if hours_to_shortage is not None else None,
        predicted_consumption_rate=round(float(depletion_rate_per_hour), 4),
        confidence_metadata={
            "r_squared": round(float(r_squared), 4),
            "residual_std": round(residual_std, 4),
            "sample_count": len(readings),
            "data_quality": _data_quality_label(r_squared, len(readings)),
            "forecast_points": forecast_points,
        },
        model_version=MODEL_VERSION,
    )

    if save:
        db.predictions.insert_one(prediction.model_dump())

    return prediction


def _fallback_prediction(hospital: dict, save: bool = True) -> Prediction:
    """Simple fallback when not enough historical data."""
    current_stock = hospital["current_stock"]
    safety_stock = hospital["minimum_safety_stock"]
    rate = hospital["consumption_rate"]

    hours_to_shortage = None
    predicted_shortage_time = None

    if rate > 0:
        stock_above_safety = current_stock - safety_stock
        if stock_above_safety > 0:
            hours_to_shortage = stock_above_safety / rate
            predicted_shortage_time = datetime.utcnow() + timedelta(hours=hours_to_shortage)
        else:
            hours_to_shortage = 0.0
            predicted_shortage_time = datetime.utcnow()

    prediction = Prediction(
        hospital_id=hospital["hospital_id"],
        predicted_shortage_time=predicted_shortage_time,
        hours_to_shortage=round(hours_to_shortage, 2) if hours_to_shortage is not None else None,
        predicted_consumption_rate=rate,
        confidence_metadata={
            "data_quality": "insufficient_data",
            "sample_count": 0,
            "note": "Using current consumption rate as fallback",
        },
        model_version=f"{MODEL_VERSION}-fallback",
    )

    if save:
        db = get_database()
        db.predictions.insert_one(prediction.model_dump())

    return prediction


def _data_quality_label(r_squared: float, sample_count: int) -> str:
    """Provide a quality indicator instead of fake confidence scores."""
    if sample_count < 5:
        return "limited_data"
    if r_squared > 0.9:
        return "strong_fit"
    if r_squared > 0.7:
        return "moderate_fit"
    if r_squared > 0.4:
        return "weak_fit"
    return "poor_fit"


def predict_all_hospitals(save: bool = True) -> List[Prediction]:
    """Generate predictions for all hospitals."""
    db = get_database()
    hospitals = list(db.hospitals.find())
    predictions = []
    for h in hospitals:
        pred = predict_for_hospital(h["hospital_id"], save=save)
        if pred:
            predictions.append(pred)
    return predictions


def evaluate_model(simulation_run_id: str = "default") -> Optional[ModelEvaluation]:
    """
    Evaluate prediction accuracy against actual observed stock levels.
    Uses held-out recent observations vs. predictions made earlier.
    """
    db = get_database()
    hospitals = list(db.hospitals.find())

    all_errors = []
    hospital_details = {}

    for h in hospitals:
        hid = h["hospital_id"]

        # Get predictions made for this hospital
        preds = list(
            db.predictions.find({"hospital_id": hid}).sort("created_at", -1).limit(10)
        )
        if not preds:
            continue

        # Get actual readings after prediction was made
        for pred in preds:
            pred_time = pred.get("created_at", datetime.utcnow())
            actual_readings = list(
                db.resource_readings.find({
                    "hospital_id": hid,
                    "timestamp": {"$gt": pred_time}
                }).sort("timestamp", 1).limit(5)
            )

            if not actual_readings:
                continue

            pred_rate = pred.get("predicted_consumption_rate", 0)
            forecast_points = pred.get("confidence_metadata", {}).get("forecast_points", [])

            for reading in actual_readings:
                actual_stock = reading["stock_level"]
                # Estimate what our model predicted for this timestamp
                hours_since_pred = (reading["timestamp"] - pred_time).total_seconds() / 3600.0
                # Predict stock: start from stock at prediction time minus predicted depletion
                pred_stocks = [fp for fp in forecast_points
                               if abs(fp.get("hours_ahead", -1) - hours_since_pred) < 1.0]
                if pred_stocks:
                    predicted_stock = pred_stocks[0]["predicted_stock"]
                else:
                    # Use linear estimate
                    pred_start_readings = list(
                        db.resource_readings.find({
                            "hospital_id": hid,
                            "timestamp": {"$lte": pred_time}
                        }).sort("timestamp", -1).limit(1)
                    )
                    if pred_start_readings:
                        predicted_stock = max(
                            0,
                            pred_start_readings[0]["stock_level"] - pred_rate * hours_since_pred
                        )
                    else:
                        continue

                error = abs(actual_stock - predicted_stock)
                all_errors.append(error)

        hospital_details[hid] = {
            "name": h["name"],
            "predictions_evaluated": len(preds),
        }

    if not all_errors:
        return None

    errors_arr = np.array(all_errors)
    mae = float(np.mean(errors_arr))
    rmse = float(np.sqrt(np.mean(errors_arr ** 2)))

    evaluation = ModelEvaluation(
        simulation_run_id=simulation_run_id,
        model_version=MODEL_VERSION,
        mae=round(mae, 4),
        rmse=round(rmse, 4),
        sample_count=len(all_errors),
        details={
            "hospital_details": hospital_details,
            "min_error": round(float(np.min(errors_arr)), 4),
            "max_error": round(float(np.max(errors_arr)), 4),
            "median_error": round(float(np.median(errors_arr)), 4),
        },
    )

    db.model_evaluations.insert_one(evaluation.model_dump())
    return evaluation
