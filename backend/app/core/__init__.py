"""
MediSync AI — Core Configuration
Loads environment variables and provides application-wide settings.
"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="medisync_ai", alias="MONGODB_DATABASE")

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
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    demo_operator_token: str = Field(default="medisync-demo-2024", alias="DEMO_OPERATOR_TOKEN")

    model_config = {"env_file": ".env", "extra": "ignore", "populate_by_name": True}

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Singleton settings instance
settings = Settings()
