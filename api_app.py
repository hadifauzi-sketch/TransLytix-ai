"""Prediction-only deployment. The standalone app remains in main.py.

ELIMS owns persistence and authorization. Only request-supplied history is used;
this deployment never loads a shared fleet from a database.
"""
import os
import secrets
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# The legacy module initializes tables on import. Give it an empty, disposable
# process-local database, never an ELIMS database or a bundled SQLite file.
os.environ["DATABASE_URL"] = "sqlite:///" + str(
    Path(tempfile.gettempdir()) / f"translytix-{os.getpid()}-{secrets.token_hex(8)}.db"
).replace("\\", "/")
import main as legacy  # noqa: E402


async def require_token(x_ai_token: str = Header(default="")):
    expected = os.getenv("AI_API_TOKEN", "")
    if not expected:
        raise HTTPException(503, "AI_API_TOKEN is not configured")
    if not secrets.compare_digest(x_ai_token, expected):
        raise HTTPException(401, "Invalid API token")


app = FastAPI(
    title="TransLytix Prediction API",
    version="0.1.0",
    dependencies=[Depends(require_token)],
)
origins = [s.strip() for s in os.getenv("AI_ALLOWED_ORIGINS", "").split(",") if s.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins,
                       allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "X-AI-Token"])

# Retain original route validation/response models without publishing local
# storage, account management, or assessment-history endpoints.
allowed = {"/api/health", "/api/cluster", "/api/anomaly",
           "/api/predict/nature-hybrid", "/api/predict/arima",
           "/api/predict/lstm", "/api/predict/xgboost",
           "/api/predict/lightgbm", "/api/predict/fault-rf"}
for route in legacy.app.routes:
    if route.path in allowed:
        app.add_api_route(route.path, route.endpoint, methods=list(route.methods),
                          response_model=route.response_model,
                          dependencies=[Depends(require_token)])


@app.get("/")
async def index():
    return {"service": "TransLytix AI", "docs": "/docs",
            "persistence": "ELIMS", "training_scope": "submitted history"}
