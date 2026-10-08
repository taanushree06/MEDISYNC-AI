"""
MediSync AI — Hospital Simulation Engine
Manages accelerated-time simulation of oxygen cylinder consumption
across six fictional hospitals. Single-process, thread-safe.

LIMITATION: This is a single-process simulator suitable for hackathon demos.
Running multiple backend workers will create duplicate simulation loops.
Use a single uvicorn worker for the demo.
"""

import asyncio
import logging
import threading
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.db import get_database
from app.core import settings
from app.schemas import (
    Hospital, ResourceReading, SimulationEvent, SimulationStatus
)
from app.services.ledger_service import record_ledger_event

logger = logging.getLogger(__name__)

# ─── Default Hospital Seed Data (DEMO/SIMULATED) ───────────────────────
SEED_HOSPITALS: List[Dict] = [
    {
        "hospital_id": "hosp-001",
        "name": "Metro General Hospital",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location": "Central Delhi",
        "total_capacity": 200,
        "minimum_safety_stock": 30,
        "current_stock": 180,
        "consumption_rate": 8.0,  # cylinders per simulated hour
        "incoming_replenishment": 0,
    },
    {
        "hospital_id": "hosp-002",
        "name": "Sunrise Medical Center",
        "latitude": 28.6329,
        "longitude": 77.2195,
        "location": "North Delhi",
        "total_capacity": 150,
        "minimum_safety_stock": 25,
        "current_stock": 140,
        "consumption_rate": 6.0,
        "incoming_replenishment": 0,
    },
    {
        "hospital_id": "hosp-003",
        "name": "City Care Hospital",
        "latitude": 28.5672,
        "longitude": 77.2100,
        "location": "South Delhi",
        "total_capacity": 180,
        "minimum_safety_stock": 28,
        "current_stock": 90,
        "consumption_rate": 12.0,  # Higher consumption — likely needs help
        "incoming_replenishment": 0,
    },
    {
        "hospital_id": "hosp-004",
        "name": "Green Valley Medical",
        "latitude": 28.6508,
        "longitude": 77.2334,
        "location": "East Delhi",
        "total_capacity": 160,
        "minimum_safety_stock": 25,
        "current_stock": 155,
        "consumption_rate": 5.0,  # Low consumption — good donor
        "incoming_replenishment": 0,
    },
    {
        "hospital_id": "hosp-005",
        "name": "Unity Health Institute",
        "latitude": 28.5921,
        "longitude": 77.1742,
        "location": "West Delhi",
        "total_capacity": 170,
        "minimum_safety_stock": 27,
        "current_stock": 165,
        "consumption_rate": 7.0,
        "incoming_replenishment": 0,
    },
    {
        "hospital_id": "hosp-006",
        "name": "Lakeside General",
        "latitude": 28.6280,
        "longitude": 77.1890,
        "location": "Northwest Delhi",
        "total_capacity": 140,
        "minimum_safety_stock": 22,
        "current_stock": 130,
        "consumption_rate": 9.0,
        "incoming_replenishment": 0,
    },
]


# Pre-computed pairwise transport times in minutes (symmetric)
TRANSPORT_TIMES: Dict[str, Dict[str, float]] = {}


def _compute_transport_times():
    """Compute approximate transport times based on coordinate distance."""
    for h1 in SEED_HOSPITALS:
        TRANSPORT_TIMES[h1["hospital_id"]] = {}
        for h2 in SEED_HOSPITALS:
            if h1["hospital_id"] == h2["hospital_id"]:
                TRANSPORT_TIMES[h1["hospital_id"]][h2["hospital_id"]] = 0
            else:
                # Simple Euclidean approximation → scale to ~15-45 minutes
                dlat = h1["latitude"] - h2["latitude"]
                dlon = h1["longitude"] - h2["longitude"]
                dist = math.sqrt(dlat ** 2 + dlon ** 2)
                minutes = max(15, min(45, dist * 500))
                TRANSPORT_TIMES[h1["hospital_id"]][h2["hospital_id"]] = round(minutes, 1)


_compute_transport_times()


def get_transport_time(src_id: str, dst_id: str) -> float:
    """Get estimated transport time in minutes between two hospitals."""
    return TRANSPORT_TIMES.get(src_id, {}).get(dst_id, 30.0)


class SimulationEngine:
    """
    Authoritative simulation clock and stock consumption engine.
    Uses asyncio for the tick loop and a lock to prevent duplicate loops.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self.running = False
        self.paused = False
        self.simulation_run_id = "demo-run-001"
        self.simulation_time: Optional[datetime] = None
        self.real_start_time: Optional[datetime] = None
        self.tick_seconds = settings.simulation_tick_seconds
        self.minutes_per_real_second = settings.simulation_minutes_per_real_second
        self._task: Optional[asyncio.Task] = None
        self._emergency_hospital_id: Optional[str] = None
        self._original_rates: Dict[str, float] = {}
        self._notified_breaches: set = set()
        self._ws_clients: List = []
        self._loop_lock = asyncio.Lock() if False else None  # Set in async context

    # ─── WebSocket broadcast ──────────────────────────────────────────
    def register_ws(self, ws):
        if ws not in self._ws_clients:
            self._ws_clients.append(ws)

    def unregister_ws(self, ws):
        if ws in self._ws_clients:
            self._ws_clients.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self._ws_clients:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.remove(ws)

    # ─── Seed Data ────────────────────────────────────────────────────
    def seed_hospitals(self, reset: bool = False):
        """Insert missing hospitals; overwrite inventory only on explicit reset."""
        db = get_database()
        for h_data in SEED_HOSPITALS:
            h_data_copy = dict(h_data)
            h_data_copy["updated_at"] = datetime.utcnow()
            db.hospitals.update_one(
                {"hospital_id": h_data_copy["hospital_id"]},
                {"$set" if reset else "$setOnInsert": h_data_copy},
                upsert=True,
            )
            self._original_rates[h_data_copy["hospital_id"]] = h_data_copy["consumption_rate"]
        logger.info("Ensured 6 demo hospitals (reset=%s)", reset)

    # ─── Status ───────────────────────────────────────────────────────
    def get_status(self) -> SimulationStatus:
        return SimulationStatus(
            running=self.running,
            paused=self.paused,
            simulation_run_id=self.simulation_run_id,
            simulation_time=self.simulation_time,
            real_start_time=self.real_start_time,
            tick_seconds=self.tick_seconds,
            minutes_per_real_second=self.minutes_per_real_second,
            emergency_active=self._emergency_hospital_id is not None,
            emergency_hospital_id=self._emergency_hospital_id,
        )

    # ─── Control ──────────────────────────────────────────────────────
    async def start(self):
        if self.running:
            return self.get_status()

        self.seed_hospitals()
        self.running = True
        self.paused = False
        self.real_start_time = datetime.utcnow()
        self.simulation_time = datetime.utcnow()

        # Record start event
        record_ledger_event(
            event_type="simulation_started",
            hospital_name="Regional Command Center",
            details={"message": "Simulation started. Real-time telemetry consumption active."},
            simulation_run_id=self.simulation_run_id,
        )

        # Start the tick loop
        self._task = asyncio.create_task(self._tick_loop())
        logger.info("Simulation started")
        return self.get_status()

    async def pause(self):
        self.paused = True
        record_ledger_event(
            event_type="simulation_paused",
            hospital_name="Regional Command Center",
            details={"message": "Simulation paused by operator."},
            simulation_run_id=self.simulation_run_id,
        )
        return self.get_status()

    async def resume(self):
        self.paused = False
        record_ledger_event(
            event_type="simulation_resumed",
            hospital_name="Regional Command Center",
            details={"message": "Simulation resumed."},
            simulation_run_id=self.simulation_run_id,
        )
        return self.get_status()

    async def stop(self):
        """Stop the tick loop without deleting data or changing inventory."""
        self.running = False
        self.paused = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def reset(self):
        """Reset to deterministic initial demo state."""
        self.running = False
        self.paused = False
        self._emergency_hospital_id = None
        self._notified_breaches.clear()

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        # Reset database state for this simulation run
        db = get_database()
        db.resource_readings.delete_many({"simulation_run_id": self.simulation_run_id})
        db.predictions.delete_many({})
        db.transfer_recommendations.delete_many({})
        db.transfers.delete_many({})

        # Re-seed hospitals
        self.seed_hospitals(reset=True)

        # Record reset event
        self.simulation_run_id = f"demo-run-{datetime.utcnow().strftime('%H%M%S')}"
        record_ledger_event(
            event_type="simulation_reset",
            hospital_name="Regional Command Center",
            details={"message": "Simulation reset to baseline state. Stock inventory replenished across 6 facilities."},
            simulation_run_id=self.simulation_run_id,
        )

        self.simulation_time = None
        self.real_start_time = None
        logger.info("Simulation reset to initial state")

        await self.broadcast({"type": "simulation_reset"})
        return self.get_status()

    async def emergency_surge(self, hospital_id: str, multiplier: float = 3.0):
        """Increase consumption rate at a target hospital to simulate emergency."""
        db = get_database()
        hospital = db.hospitals.find_one({"hospital_id": hospital_id})
        if not hospital:
            raise ValueError(f"Hospital {hospital_id} not found")

        # Store original rate if not already stored
        if hospital_id not in self._original_rates:
            self._original_rates[hospital_id] = hospital["consumption_rate"]

        new_rate = self._original_rates[hospital_id] * multiplier
        db.hospitals.update_one(
            {"hospital_id": hospital_id},
            {"$set": {"consumption_rate": new_rate, "updated_at": datetime.utcnow()}}
        )
        self._emergency_hospital_id = hospital_id

        record_ledger_event(
            event_type="emergency_surge",
            hospital_id=hospital_id,
            hospital_name=hospital.get("name", hospital_id),
            details={
                "message": f"CRISIS DETECTED: {hospital.get('name')} experienced demand spike ({multiplier}x normal rate: {new_rate:.1f} cyl/hr).",
                "original_rate": self._original_rates[hospital_id],
                "new_rate": new_rate,
                "multiplier": multiplier,
            },
            parameter_changes={
                "original_rate": self._original_rates[hospital_id],
                "new_rate": new_rate,
                "multiplier": multiplier,
            },
            simulation_run_id=self.simulation_run_id,
        )
        logger.info(f"Emergency surge at {hospital_id}: rate {new_rate}")

        await self.broadcast({
            "type": "emergency_surge",
            "hospital_id": hospital_id,
            "new_rate": new_rate,
        })
        return self.get_status()

    async def return_normal(self, hospital_id: str):
        """Return a hospital to normal consumption rate."""
        db = get_database()
        original = self._original_rates.get(hospital_id)
        if original is None:
            return self.get_status()

        db.hospitals.update_one(
            {"hospital_id": hospital_id},
            {"$set": {"consumption_rate": original, "updated_at": datetime.utcnow()}}
        )

        if self._emergency_hospital_id == hospital_id:
            self._emergency_hospital_id = None

        h = db.hospitals.find_one({"hospital_id": hospital_id})
        h_name = h.get("name", hospital_id) if h else hospital_id
        record_ledger_event(
            event_type="return_normal",
            hospital_id=hospital_id,
            hospital_name=h_name,
            details={"message": f"{h_name} consumption rate returned to baseline {original:.1f} cyl/hr."},
            parameter_changes={"restored_rate": original},
            simulation_run_id=self.simulation_run_id,
        )
        return self.get_status()

    # ─── Core Tick Loop ───────────────────────────────────────────────
    async def _tick_loop(self):
        """Main simulation loop running every tick_seconds."""
        try:
            while self.running:
                await asyncio.sleep(self.tick_seconds)
                if not self.running:
                    break
                if self.paused:
                    continue

                # Calculate simulated time elapsed
                sim_minutes_elapsed = self.tick_seconds * self.minutes_per_real_second
                sim_hours_elapsed = sim_minutes_elapsed / 60.0

                # Advance simulation clock
                self.simulation_time = (
                    self.simulation_time + timedelta(minutes=sim_minutes_elapsed)
                    if self.simulation_time
                    else datetime.utcnow()
                )

                await self._consume_stock(sim_hours_elapsed)

        except asyncio.CancelledError:
            logger.info("Simulation tick loop cancelled")
        except Exception as e:
            logger.error(f"Simulation tick error: {e}")
            self.running = False

    async def _consume_stock(self, sim_hours_elapsed: float):
        """Apply consumption to all hospitals and persist readings."""
        db = get_database()
        hospitals = list(db.hospitals.find())
        update_payload = []

        for h in hospitals:
            consumption = h["consumption_rate"] * sim_hours_elapsed
            new_stock = max(0.0, h["current_stock"] - consumption)

            db.hospitals.update_one(
                {"hospital_id": h["hospital_id"]},
                {"$set": {
                    "current_stock": round(new_stock, 2),
                    "updated_at": datetime.utcnow(),
                }}
            )

            # Persist reading
            reading = ResourceReading(
                hospital_id=h["hospital_id"],
                timestamp=self.simulation_time or datetime.utcnow(),
                stock_level=round(new_stock, 2),
                consumption_rate=h["consumption_rate"],
                simulation_run_id=self.simulation_run_id,
            )
            db.resource_readings.insert_one(reading.model_dump())

            # Determine status
            safety = h["minimum_safety_stock"]
            if new_stock <= safety * 0.5:
                status = "critical"
            elif new_stock <= safety * 1.2:
                status = "warning"
            else:
                status = "normal"

            # Check for threshold breach transitions
            if status in ("critical", "warning") and h["hospital_id"] not in self._notified_breaches:
                self._notified_breaches.add(h["hospital_id"])
                record_ledger_event(
                    event_type="threshold_breach",
                    hospital_id=h["hospital_id"],
                    hospital_name=h["name"],
                    details={
                        "message": f"SAFETY BUFFER BREACH: {h['name']} stock dropped to {new_stock:.1f} cyl (Safety threshold: {safety} cyl). Status: {status.upper()}.",
                        "current_stock": round(new_stock, 1),
                        "safety_stock": safety,
                        "status": status,
                    },
                    simulation_run_id=self.simulation_run_id,
                )
                await self.broadcast({
                    "type": "threshold_breach",
                    "hospital_id": h["hospital_id"],
                    "hospital_name": h["name"],
                    "current_stock": round(new_stock, 1),
                    "safety_stock": safety,
                    "status": status,
                })
            elif status == "normal" and h["hospital_id"] in self._notified_breaches:
                self._notified_breaches.discard(h["hospital_id"])

            update_payload.append({
                "hospital_id": h["hospital_id"],
                "name": h["name"],
                "current_stock": round(new_stock, 2),
                "consumption_rate": h["consumption_rate"],
                "status": status,
                "simulation_time": (self.simulation_time or datetime.utcnow()).isoformat(),
            })

        # Broadcast to WebSocket clients
        await self.broadcast({
            "type": "stock_update",
            "hospitals": update_payload,
            "simulation_time": (self.simulation_time or datetime.utcnow()).isoformat(),
        })


# Module-level singleton accessor
def get_simulator() -> SimulationEngine:
    return SimulationEngine()
