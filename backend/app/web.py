"""Serve the compiled UI after API routes, sharing HTTP and WebSocket origin."""
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


def mount_frontend(application: FastAPI, directory: str):
    dist = Path(directory).resolve()
    if not (dist / "index.html").is_file():
        raise RuntimeError("FRONTEND_DIST must contain the compiled frontend index.html.")
    application.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")
