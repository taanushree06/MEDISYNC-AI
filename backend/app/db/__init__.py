"""
MediSync AI — MongoDB Connection Manager
Provides singleton database client and collection accessors.
"""

import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import ConnectionFailure
from app.core import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_db: Database | None = None
_is_mock: bool = False


def get_client() -> MongoClient:
    """Get or create the MongoDB client singleton (with automatic in-memory mock fallback)."""
    global _client, _is_mock
    if _client is None:
        try:
            client = MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=1500,
                connectTimeoutMS=1500,
            )
            # Test ping
            client.admin.command("ping")
            _client = client
            _is_mock = False
            logger.info("Connected to MongoDB at %s", settings.mongodb_uri)
        except Exception as e:
            logger.warning("MongoDB not available (%s). Initializing in-memory mock database for demo.", e)
            try:
                import mongomock
                _client = mongomock.MongoClient()
                _is_mock = True
                logger.info("✅ In-memory mongomock database initialized successfully.")
            except ImportError:
                # If mongomock is somehow missing, fall back to default client
                _client = MongoClient(settings.mongodb_uri)
                _is_mock = False
    return _client


def get_database() -> Database:
    """Get the application database."""
    global _db
    if _db is None:
        _db = get_client()[settings.mongodb_database]
    return _db


def check_connection() -> bool:
    """Check if MongoDB or mock database is reachable."""
    global _is_mock
    if _is_mock:
        return True
    try:
        get_client().admin.command("ping")
        return True
    except ConnectionFailure:
        logger.error("MongoDB connection failed")
        return False


def close_connection():
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None


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
