"""
MediSync AI — Main Application Entry Point
FastAPI application with CORS, lifecycle events, and route registration.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import settings
from app.db import check_connection, ensure_indexes, close_connection
from app.api import router
from app.simulation import get_simulator

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
    logger.info(f"MongoDB: {settings.mongodb_uri}")

    if check_connection():
        logger.info("✅ MongoDB connected")
        ensure_indexes()
        # Seed hospitals on startup
        sim = get_simulator()
        sim.seed_hospitals()
        logger.info("✅ Demo hospitals seeded")
    else:
        logger.warning("⚠️ MongoDB not available — some features will be limited")

    yield

    # Shutdown
    logger.info("🏥 MediSync AI shutting down...")
    sim = get_simulator()
    if sim.running:
        await sim.reset()
    close_connection()
    logger.info("✅ Shutdown complete")


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


@app.get("/")
async def root():
    return {
        "name": "MediSync AI",
        "version": "1.0.0",
        "description": "Cross-Hospital Resource Rebalancing System (SIMULATED)",
        "docs": "/docs",
        "health": "/api/health",
    }
