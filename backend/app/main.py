"""
MediSync AI — Main Application Entry Point
FastAPI application with CORS, lifecycle events, and route registration.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import settings
from app.db import get_client, get_storage_status, ensure_indexes, close_connection
from app.api import router
from app.simulation import get_simulator
from app.web import mount_frontend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown."""
    # Startup
    logger.info("🏥 MediSync AI starting up...")
    logger.info(f"Environment: {settings.app_env}")
    if settings.app_env != "development" and (
        not settings.demo_operator_token or settings.demo_operator_token == "medisync-demo-2024"
    ):
        raise RuntimeError("Set a private DEMO_OPERATOR_TOKEN before starting a production backend.")
    try:
        get_client()
        storage = get_storage_status()
        logger.info("Storage mode: %s | persistent: %s", storage["storage_mode"], storage["persistent"])
        ensure_indexes()
        sim = get_simulator()
        sim.seed_hospitals()
        logger.info("Demo hospitals ensured; existing inventory preserved")
        yield
    finally:
        logger.info("MediSync AI shutting down; preserving database records")
        await get_simulator().stop()
        close_connection()
        logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="MediSync AI",
    description=(
        "Intelligent Cross-Hospital Resource Rebalancing System. "
        "SIMULATED healthcare-resource coordination prototype for HACK NEXUS HN-AI-05. "
        "Not for real clinical use."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)


if settings.frontend_dist:
    mount_frontend(app, settings.frontend_dist)
else:
    @app.get("/")
    async def root():
        return {
            "name": "MediSync AI",
            "version": "1.0.0",
            "description": "Cross-Hospital Resource Rebalancing System (SIMULATED)",
            "docs": "/docs",
            "health": "/api/health",
        }
