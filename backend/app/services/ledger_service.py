"""
MediSync AI — Cryptographic Audit Ledger Service
Maintains a tamper-evident, append-only ledger of all simulation and operational events.
Every event is signed with a chained SHA-256 hash linking back to the genesis event.
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from app.db import get_database
from app.schemas import SimulationEvent

logger = logging.getLogger(__name__)

_GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def compute_event_hash(prev_hash: str, event_id: str, timestamp_iso: str, event_type: str, hospital_id: str, details_str: str) -> str:
    """Compute deterministic SHA-256 checksum for event chain block."""
    raw = f"{prev_hash}|{event_id}|{timestamp_iso}|{event_type}|{hospital_id}|{details_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_last_ledger_hash() -> str:
    """Retrieve the latest hash from the ledger chain."""
    db = get_database()
    last_event = db.simulation_events.find_one(
        {"ledger_hash": {"$exists": True, "$ne": ""}},
        sort=[("timestamp", -1)]
    )
    if last_event and "ledger_hash" in last_event:
        return last_event["ledger_hash"]
    return _GENESIS_HASH


def record_ledger_event(
    event_type: str,
    hospital_id: str = "",
    hospital_name: str = "",
    details: Optional[Dict[str, Any]] = None,
    parameter_changes: Optional[Dict[str, Any]] = None,
    simulation_run_id: str = "default",
) -> SimulationEvent:
    """
    Log an immutable event to the audit ledger with cryptographic hash chaining.
    """
    db = get_database()
    details = details or {}
    parameter_changes = parameter_changes or {}

    # If hospital_name not provided, look it up from database
    if hospital_id and not hospital_name:
        h = db.hospitals.find_one({"hospital_id": hospital_id})
        if h:
            hospital_name = h.get("name", "")

    now = datetime.utcnow()
    now_iso = now.isoformat()
    prev_hash = get_last_ledger_hash()

    # Create event model
    event = SimulationEvent(
        simulation_run_id=simulation_run_id,
        hospital_id=hospital_id,
        hospital_name=hospital_name,
        event_type=event_type,
        details=details,
        parameter_changes=parameter_changes,
        previous_hash=prev_hash,
        timestamp=now,
    )

    details_str = json.dumps(details, sort_keys=True, default=str)
    event.ledger_hash = compute_event_hash(
        prev_hash=prev_hash,
        event_id=event.event_id,
        timestamp_iso=now_iso,
        event_type=event_type,
        hospital_id=hospital_id,
        details_str=details_str,
    )

    db.simulation_events.insert_one(event.model_dump())
    logger.info(f"Audit Ledger: [{event_type}] {hospital_name or 'System'} | Hash: {event.ledger_hash[:12]}...")
    return event
