"""
MediSync AI — Pydantic Schemas
All data models for MongoDB documents and API responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


def gen_id() -> str:
    return str(uuid.uuid4())[:12]


# ─── Hospital ───────────────────────────────────────────────────────────
class Hospital(BaseModel):
    hospital_id: str = Field(default_factory=gen_id)
    name: str
    latitude: float
    longitude: float
    location: str
    total_capacity: int
    minimum_safety_stock: int
    current_stock: float
    consumption_rate: float  # cylinders per simulated hour
    incoming_replenishment: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HospitalResponse(Hospital):
    status: str = "normal"  # normal, warning, critical
    stock_trend: str = "stable"  # stable, declining, rising
    hours_to_shortage: Optional[float] = None


# ─── Resource Readings ─────────────────────────────────────────────────
class ResourceReading(BaseModel):
    reading_id: str = Field(default_factory=gen_id)
    hospital_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    stock_level: float
    consumption_rate: float
    simulation_run_id: str = "default"


# ─── Predictions ────────────────────────────────────────────────────────
class Prediction(BaseModel):
    prediction_id: str = Field(default_factory=gen_id)
    hospital_id: str
    predicted_shortage_time: Optional[datetime] = None
    hours_to_shortage: Optional[float] = None
    predicted_consumption_rate: float = 0.0
    confidence_metadata: Dict[str, Any] = Field(default_factory=dict)
    model_version: str = "linear-depletion-v1"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PredictionResponse(Prediction):
    hospital_name: str = ""
    current_stock: float = 0.0
    safety_stock: int = 0
    forecast_points: List[Dict[str, Any]] = Field(default_factory=list)


# ─── Transfer Recommendations ──────────────────────────────────────────
class TransferRecommendation(BaseModel):
    recommendation_id: str = Field(default_factory=gen_id)
    source_hospital_id: str
    destination_hospital_id: str
    quantity: int
    estimated_transport_minutes: float
    required_arrival_time: Optional[datetime] = None
    priority: int = 1  # 1 = highest
    explanation: str = ""
    status: str = "proposed"  # proposed, approved, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecommendationResponse(TransferRecommendation):
    source_hospital_name: str = ""
    destination_hospital_name: str = ""
    source_current_stock: float = 0.0
    destination_current_stock: float = 0.0
    destination_hours_to_shortage: Optional[float] = None
    safety_check_passed: bool = True


# ─── Transfers ──────────────────────────────────────────────────────────
class Transfer(BaseModel):
    transfer_id: str = Field(default_factory=gen_id)
    recommendation_id: str
    source_hospital_id: str
    destination_hospital_id: str
    quantity: int
    status: str = "approved"  # approved, in_transit, completed, cancelled
    approved_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TransferResponse(Transfer):
    source_hospital_name: str = ""
    destination_hospital_name: str = ""


# ─── Simulation Events ─────────────────────────────────────────────────
class SimulationEvent(BaseModel):
    event_id: str = Field(default_factory=gen_id)
    simulation_run_id: str = "default"
    hospital_id: str = ""
    event_type: str  # start, pause, resume, reset, emergency_surge, return_normal
    parameter_changes: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ─── Model Evaluations ─────────────────────────────────────────────────
class ModelEvaluation(BaseModel):
    evaluation_id: str = Field(default_factory=gen_id)
    simulation_run_id: str = "default"
    model_version: str = "linear-depletion-v1"
    mae: float = 0.0
    rmse: float = 0.0
    sample_count: int = 0
    evaluation_timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Dict[str, Any] = Field(default_factory=dict)


# ─── API Response Wrappers ─────────────────────────────────────────────
class SimulationStatus(BaseModel):
    running: bool = False
    paused: bool = False
    simulation_run_id: str = "default"
    simulation_time: Optional[datetime] = None
    real_start_time: Optional[datetime] = None
    tick_seconds: float = 3.0
    minutes_per_real_second: float = 1.0
    emergency_active: bool = False
    emergency_hospital_id: Optional[str] = None


class AnalyticsResponse(BaseModel):
    total_hospitals: int = 6
    total_stock: float = 0.0
    hospitals_at_risk: int = 0
    active_recommendations: int = 0
    predicted_shortages: int = 0
    total_transfers_completed: int = 0
    total_transfers_active: int = 0
    evaluation: Optional[ModelEvaluation] = None
    hospital_summaries: List[Dict[str, Any]] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "ok"
    mongodb: bool = False
    simulation_running: bool = False
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
