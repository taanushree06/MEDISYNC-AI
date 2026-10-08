"""
MediSync AI — Core Configuration
Loads environment variables and provides application-wide settings.
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="medisync_ai", alias="MONGODB_DATABASE")
    mongodb_allow_mock: bool = Field(default=False, alias="MONGODB_ALLOW_MOCK")
    mongodb_timeout_ms: int = Field(default=3000, ge=100, alias="MONGODB_TIMEOUT_MS")

    # Google Gemini
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")

    # Simulation
    simulation_tick_seconds: float = Field(default=3.0, alias="SIMULATION_TICK_SECONDS")
    simulation_minutes_per_real_second: float = Field(
        default=1.0, alias="SIMULATION_MINUTES_PER_REAL_SECOND"
    )

    # Application
    app_env: str = Field(default="development", alias="APP_ENV")
    frontend_dist: str = Field(default="", alias="FRONTEND_DIST")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    demo_operator_token: str = Field(default="medisync-demo-2024", alias="DEMO_OPERATOR_TOKEN")

    model_config = {"env_file": str(Path(__file__).resolve().parents[2] / ".env"), "extra": "ignore", "populate_by_name": True}

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Singleton settings instance
settings = Settings()
