"""
MediSync AI — MongoDB Connection Manager
Provides singleton database client and collection accessors.
"""

import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError
from app.core import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_db: Database | None = None
_is_mock: bool = False


def get_client() -> MongoClient:
    """Connect to persistent MongoDB; mock storage requires explicit opt-in."""
    global _client, _is_mock
    if _client is None:
        client = None
        try:
            client = MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=settings.mongodb_timeout_ms,
                connectTimeoutMS=settings.mongodb_timeout_ms,
                socketTimeoutMS=settings.mongodb_timeout_ms,
            )
            # Test ping
            client.admin.command("ping")
            _client = client
            _is_mock = False
            logger.info("Storage: real MongoDB connected; database=%s; persistent=true", settings.mongodb_database)
        except PyMongoError as e:
            if client is not None:
                client.close()
            logger.error("Persistent MongoDB unavailable (%s). Check the MongoDB service and MONGODB_URI.", type(e).__name__)
            if not settings.mongodb_allow_mock:
                raise RuntimeError("Persistent MongoDB connection failed. Start MongoDB or configure MONGODB_URI. Demo fallback requires MONGODB_ALLOW_MOCK=true.") from e
            import mongomock
            _client = mongomock.MongoClient()
            _is_mock = True
            logger.warning("Storage: IN-MEMORY MONGOMOCK; persistent=false; data is lost when this process exits. Real MongoDB is NOT connected.")
    return _client


def get_database() -> Database:
    """Get the application database."""
    global _db
    if _db is None:
        _db = get_client()[settings.mongodb_database]
    return _db


def check_connection() -> bool:
    """True only when a real, persistent MongoDB connection is reachable."""
    try:
        get_client().admin.command("ping")
        return not _is_mock
    except (PyMongoError, RuntimeError):
        return False


def get_storage_status() -> dict:
    persistent = check_connection()
    return {"mongodb": persistent, "storage_mode": "mongomock" if _is_mock else "mongodb" if persistent else "unavailable", "persistent": persistent}


def close_connection():
    """Close the MongoDB connection."""
    global _client, _db, _is_mock
    if _client is not None:
        _client.close()
        _client = None
        _db = None
    _is_mock = False


def ensure_indexes():
    """Create indexes for all collections."""
    db = get_database()

    # hospitals
    db.hospitals.create_index([("hospital_id", ASCENDING)], unique=True)

    # resource_readings
    db.resource_readings.create_index([("hospital_id", ASCENDING), ("timestamp", DESCENDING)])
    db.resource_readings.create_index([("simulation_run_id", ASCENDING)])

    # predictions
    db.predictions.create_index([("hospital_id", ASCENDING), ("created_at", DESCENDING)])
    db.predictions.create_index([("prediction_id", ASCENDING)])

    # transfer_recommendations
    db.transfer_recommendations.create_index([("recommendation_id", ASCENDING)], unique=True)
    db.transfer_recommendations.create_index([("status", ASCENDING)])
    db.transfer_recommendations.create_index([("created_at", DESCENDING)])

    # transfers
    db.transfers.create_index([("transfer_id", ASCENDING)], unique=True)
    db.transfers.create_index([("status", ASCENDING)])
    db.transfers.create_index([("recommendation_id", ASCENDING)])

    # simulation_events
    db.simulation_events.create_index([("simulation_run_id", ASCENDING)])
    db.simulation_events.create_index([("timestamp", DESCENDING)])

    # model_evaluations
    db.model_evaluations.create_index([("simulation_run_id", ASCENDING)])

    logger.info("MongoDB indexes ensured")
