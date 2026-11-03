"""Steward Proxy — FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import audit
from .routes import router

app = FastAPI(title="Steward Proxy", version="0.1.0")

# Permissive CORS for local development. Tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize the SQLite audit database on startup."""
    audit.init_db()


app.include_router(router)
