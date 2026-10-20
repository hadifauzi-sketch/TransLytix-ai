"""
Transformer DGA ML Prediction Backend
======================================
FastAPI server providing ARIMA, LSTM, XGBoost, and LightGBM-based predictions for
dissolved gas analysis (DGA) data from power transformers.

Endpoints:
    GET  /api/ai/summary        - AI assessment input overview
    GET  /api/ai/features       - Derived AI feature set
    GET  /api/ai/similar-cases  - Similar historical cases
    GET  /api/ai/predict        - Fault prediction for AI assessment
    GET  /api/ai/generate-assessment - Draft assessment narrative
    GET  /api/ai/model-insights - Feature contribution explanation
    POST /api/predict/arima     - ARIMA time-series forecast
    POST /api/predict/lstm      - LSTM deep learning forecast
    POST /api/predict/xgboost   - XGBoost regression forecast
    POST /api/predict/lightgbm  - LightGBM regression forecast
    POST /api/predict/fault-rf  - Random Forest future fault classification
    POST /api/cluster           - K-Means clustering with PCA
    POST /api/anomaly           - Anomaly detection (Isolation Forest)
    GET  /api/health            - Health check

Author: ChM. Ts. Hadi Fauzi - Senior Chemist
"""

import os
import json
import re
import math
import hashlib
import secrets
import numpy as np
import pandas as pd
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, String, Float, Text, ForeignKey, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session, Mapped, mapped_column

from ai_engine.assessment_generator import generate_assessment_draft
from ai_engine.feature_engineering import (
    build_derived_features_payload,
    calculate_tdcg as ai_calculate_tdcg,
    classify_tdcg,
    encode_text_category,
    normalize_optional_category,
)
from ai_engine.diagnostic_rules import diagnose_iec_60599, diagnose_rogers_refined
from ai_engine.shap_explainer import explain_prediction
from ai_engine.similarity_search import HAS_SHAP as HAS_SIMILARITY_SHAP, find_similar_cases
from ai_engine.xgboost_model import FEATURE_LABELS as AI_FEATURE_LABELS, predict_fault_assessment
from ai_engine.cross_transformer_data import (
    fetch_all_gas_series,
    build_gas_lag_pairs,
    build_lstm_sequences,
    compute_series_weights,
    build_fault_training_pool,
    compute_weighted_growth_rate,
    build_cross_training_diagnostics,
)

from ai_engine.oil_nature_prediction import apply_nature_hybrid_forecast

AI_ASSESSMENT_BLOCK_PATTERN = re.compile(r"\[AI_ASSESSMENT_START\][\s\S]*?\[AI_ASSESSMENT_END\]", re.MULTILINE)
MANUAL_RESULT_NOTE_SOURCE = "manual_result_note"
SUPERADMIN_NAME = "ChM. Ts. Hadi Fauzi"
SUPERADMIN_EMAIL = "hadi.fauzi@gmail.com"

# ============================================================
# ML IMPORTS (with graceful fallback)
# ============================================================
try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.stattools import adfuller
    HAS_ARIMA = True
except ImportError:
    HAS_ARIMA = False
    print("[WARN] statsmodels not installed. ARIMA predictions unavailable.")
    print("   Install: pip install statsmodels")

try:
    import tensorflow as tf
    Sequential = tf.keras.models.Sequential
    LSTM = tf.keras.layers.LSTM
    Dense = tf.keras.layers.Dense
    Dropout = tf.keras.layers.Dropout
    EarlyStopping = tf.keras.callbacks.EarlyStopping
    from sklearn.preprocessing import MinMaxScaler
    HAS_LSTM = True
    _LSTM_BACKEND = "tensorflow"
except (ImportError, AttributeError):
    # TensorFlow unavailable (common in PyInstaller builds).
    # Fall back to a pure-numpy LSTM implementation.
    try:
        from ai_engine.lstm_numpy import NumpyLSTMModel
        from sklearn.preprocessing import MinMaxScaler
        HAS_LSTM = True
        _LSTM_BACKEND = "numpy"
        print("[INFO] TensorFlow unavailable — using numpy LSTM fallback.")
    except ImportError:
        HAS_LSTM = False
        _LSTM_BACKEND = None
        print("[WARN] TensorFlow not installed. LSTM predictions unavailable.")
        print("   Install: pip install tensorflow")

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False
    print("[WARN] XGBoost not available. XGBoost predictions unavailable.")
    print("   Install: pip install xgboost")

try:
    from lightgbm import LGBMRegressor
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    print("[WARN] LightGBM not installed. LightGBM predictions unavailable.")
    print("   Install: pip install lightgbm")

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("[WARN] scikit-learn not installed. Clustering/anomaly unavailable.")
    print("   Install: pip install scikit-learn")

# ============================================================
# FASTAPI APP
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    run_oil_brand_catalog_backfill()
    run_manual_result_note_history_backfill()
    yield


app = FastAPI(
    title="Transformer DGA ML API",
    description="Machine Learning predictions for transformer oil DGA analysis",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# SQLITE STORAGE
# ============================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./transformer_assets.db")
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
class Base(DeclarativeBase):
    pass


TRANSFORMER_ID_PATTERN = re.compile(r"^TX-(\d{6})-(\d{2,})$")


def get_transformer_id_date_code(reference_date: Optional[datetime] = None) -> str:
    current = reference_date or datetime.now()
    return current.strftime("%d%m%y")


def generate_next_transformer_id(
    db: Session,
    reference_date: Optional[datetime] = None,
    reserved_ids: Optional[set[str]] = None,
) -> str:
    date_code = get_transformer_id_date_code(reference_date)
    prefix = f"TX-{date_code}-"
    reserved_ids = reserved_ids or set()
    existing_ids = {
        row_id
        for (row_id,) in db.query(TransformerDB.id).filter(TransformerDB.id.like(f"{prefix}%")).all()
    }

    next_sequence = 1
    for existing_id in existing_ids.union(reserved_ids):
        match = TRANSFORMER_ID_PATTERN.match(existing_id)
        if match and match.group(1) == date_code:
            next_sequence = max(next_sequence, int(match.group(2)) + 1)

    while True:
        candidate = f"{prefix}{next_sequence:02d}"
        if candidate not in existing_ids and candidate not in reserved_ids:
            return candidate
        next_sequence += 1


def rename_transformer_id_references(db: Session, current_id: str, target_id: str) -> None:
    if current_id == target_id:
        return

    if DATABASE_URL.startswith("sqlite"):
        db.execute(text("PRAGMA defer_foreign_keys = ON"))

    row = db.get(TransformerDB, current_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Transformer '{current_id}' not found")

    existing = db.get(TransformerDB, target_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Transformer '{target_id}' already exists")

    row.id = target_id
    db.flush()
    db.query(DGAResultDB).filter(DGAResultDB.transformer_id == current_id).update(
        {DGAResultDB.transformer_id: target_id},
        synchronize_session=False,
    )
    db.query(AssessmentHistoryDB).filter(AssessmentHistoryDB.transformer_id == current_id).update(
        {AssessmentHistoryDB.transformer_id: target_id},
        synchronize_session=False,
    )


DEFAULT_OIL_BRAND_LIBRARY = [
    {
        "name": "Shell Diala S4 ZX-I",
        "oilType": "Mineral - Naphthenic",
        "notes": "Common mineral naphthenic insulating oil.",
    },
    {
        "name": "Shell Diala S3 ZX-I",
        "oilType": "Mineral - Naphthenic",
        "notes": "Mineral naphthenic insulating oil for transformer fleets.",
    },
    {
        "name": "Nynas Nytro Libra",
        "oilType": "Mineral - Naphthenic",
        "notes": "Mineral naphthenic transformer oil.",
    },
    {
        "name": "Nynas Nytro 10XN",
        "oilType": "Mineral - Iso-Paraffinic",
        "notes": "Iso-paraffinic transformer oil grade.",
    },
    {
        "name": "Hyrax Hypertrans",
        "oilType": "Mineral - Paraffinic",
        "notes": "Paraffinic transformer insulating oil.",
    },
    {
        "name": "Cargill FR3",
        "oilType": "Natural Ester",
        "notes": "Natural ester dielectric fluid.",
    },
    {
        "name": "MIDEL 7131",
        "oilType": "Synthetic Ester",
        "notes": "Synthetic ester dielectric fluid.",
    },
]
KNOWN_TRANSFORMER_OIL_BRAND_MATCHES = {
    "t001": "Nynas Nytro Libra",
    "t002": "Shell Diala S4 ZX-I",
    "t003": "Hyrax Hypertrans",
    "t004": "MIDEL 7131",
    "t005": "Cargill FR3",
}
KNOWN_SERIAL_OIL_BRAND_MATCHES = {
    "abb-2014-001": "Nynas Nytro Libra",
    "sie-2017-042": "Shell Diala S4 ZX-I",
    "ge-2009-118": "Hyrax Hypertrans",
    "tos-2020-007": "MIDEL 7131",
    "abb-2007-203": "Cargill FR3",
}
KNOWN_NAME_OIL_BRAND_MATCHES = {
    "main power tx-1": "Nynas Nytro Libra",
    "distribution tx-2": "Shell Diala S4 ZX-I",
    "generator step-up tx-3": "Hyrax Hypertrans",
    "auxiliary tx-4": "MIDEL 7131",
    "interconnect tx-5": "Cargill FR3",
}
UNAMBIGUOUS_OIL_TYPE_BRAND_MATCHES = {
    "mineral - paraffinic": "Hyrax Hypertrans",
    "natural ester": "Cargill FR3",
    "synthetic ester": "MIDEL 7131",
}

class TransformerDB(Base):
    __tablename__ = "transformers"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    mnemonic: Mapped[str] = mapped_column(String, default="", index=True)
    serial_number: Mapped[str] = mapped_column(String, default="", index=True)
    brand: Mapped[str] = mapped_column(String, default="")
    maker: Mapped[str] = mapped_column(String, default="")
    voltage: Mapped[str] = mapped_column(String, default="")
    load_mva: Mapped[Optional[float]] = mapped_column(Float, default=0)
    site: Mapped[str] = mapped_column(String, default="")
    date_energized: Mapped[str] = mapped_column(String, default="")
    date_manufactured: Mapped[str] = mapped_column(String, default="")
    oil_brand: Mapped[str] = mapped_column(String, default="")
    oil_type: Mapped[str] = mapped_column(String, default="")
    paper_type: Mapped[str] = mapped_column(String, default="Not specified")

class OilBrandDB(Base):
    __tablename__ = "oil_brands"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    oil_type: Mapped[str] = mapped_column(String, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[str] = mapped_column(String, default="")


class DGAResultDB(Base):
    __tablename__ = "dga_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    transformer_id: Mapped[str] = mapped_column(String, ForeignKey("transformers.id"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    H2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    CH4: Mapped[Optional[float]] = mapped_column(Float, default=0)
    C2H2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    C2H4: Mapped[Optional[float]] = mapped_column(Float, default=0)
    C2H6: Mapped[Optional[float]] = mapped_column(Float, default=0)
    CO: Mapped[Optional[float]] = mapped_column(Float, default=0)
    CO2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    O2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    N2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    moisture: Mapped[Optional[float]] = mapped_column(Float, default=0)
    bdv: Mapped[Optional[float]] = mapped_column(Float, default=0)
    acidity: Mapped[Optional[float]] = mapped_column(Float, default=0)
    ift: Mapped[Optional[float]] = mapped_column(Float, default=0)
    color: Mapped[str] = mapped_column(String, default="")
    power_factor: Mapped[Optional[float]] = mapped_column(Float, default=0)
    test_type: Mapped[str] = mapped_column(String, default="Routine")
    flash_point: Mapped[Optional[float]] = mapped_column(Float, default=0)
    inhibitor: Mapped[Optional[float]] = mapped_column(Float, default=0)
    passivator: Mapped[Optional[float]] = mapped_column(Float, default=0)
    copper_corrosive: Mapped[str] = mapped_column(String, default="")
    density: Mapped[Optional[float]] = mapped_column(Float, default=0)
    dbds: Mapped[Optional[float]] = mapped_column(Float, default=0)
    viscosity40: Mapped[Optional[float]] = mapped_column(Float, default=0)
    methanol: Mapped[Optional[float]] = mapped_column(Float, default=0)
    pcb: Mapped[Optional[float]] = mapped_column(Float, default=0)
    resistivity: Mapped[Optional[float]] = mapped_column(Float, default=0)
    specific_gravity: Mapped[Optional[float]] = mapped_column(Float, default=0)
    fol2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    hmf5: Mapped[Optional[float]] = mapped_column(Float, default=0)
    fal2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    acf2: Mapped[Optional[float]] = mapped_column(Float, default=0)
    mef5: Mapped[Optional[float]] = mapped_column(Float, default=0)
    copper_cu: Mapped[Optional[float]] = mapped_column(Float, default=0)
    iron_fe: Mapped[Optional[float]] = mapped_column(Float, default=0)
    aluminum_al: Mapped[Optional[float]] = mapped_column(Float, default=0)
    dp_from_furan: Mapped[Optional[float]] = mapped_column(Float, default=0)
    dp_from_methanol: Mapped[Optional[float]] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")


class AssessmentHistoryDB(Base):
    __tablename__ = "assessment_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    result_id: Mapped[str] = mapped_column(String, ForeignKey("dga_results.id"), nullable=False, index=True)
    transformer_id: Mapped[str] = mapped_column(String, ForeignKey("transformers.id"), nullable=False, index=True)
    assessment_text: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String, default="manual")
    status: Mapped[str] = mapped_column(String, default="approved")
    created_at: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[str] = mapped_column(String, default="")


class UserDB(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="user")
    status: Mapped[str] = mapped_column(String, default="pending")
    approved_at: Mapped[str] = mapped_column(String, default="")
    approved_by: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[str] = mapped_column(String, default="")


Base.metadata.create_all(bind=engine)

# Lightweight migration: add columns that may not exist in older databases
with engine.connect() as _conn:
    for _col, _default in [("oil_type", "''"), ("oil_brand", "''"), ("paper_type", "'Not specified'")]:
        try:
            _conn.execute(text(f"ALTER TABLE transformers ADD COLUMN {_col} TEXT DEFAULT {_default}"))
            _conn.commit()
        except Exception:
            pass  # column already exists

    dga_columns = [
        ("test_type", "TEXT", "'Routine'"),
        ("flash_point", "REAL", "0"),
        ("inhibitor", "REAL", "0"),
        ("passivator", "REAL", "0"),
        ("copper_corrosive", "TEXT", "''"),
        ("density", "REAL", "0"),
        ("dbds", "REAL", "0"),
        ("viscosity40", "REAL", "0"),
        ("methanol", "REAL", "0"),
        ("pcb", "REAL", "0"),
        ("resistivity", "REAL", "0"),
        ("specific_gravity", "REAL", "0"),
        ("fol2", "REAL", "0"),
        ("hmf5", "REAL", "0"),
        ("fal2", "REAL", "0"),
        ("acf2", "REAL", "0"),
        ("mef5", "REAL", "0"),
        ("copper_cu", "REAL", "0"),
        ("iron_fe", "REAL", "0"),
        ("aluminum_al", "REAL", "0"),
        ("dp_from_furan", "REAL", "0"),
        ("dp_from_methanol", "REAL", "0"),
    ]
    for _col, _dtype, _default in dga_columns:
        try:
            _conn.execute(text(f"ALTER TABLE dga_results ADD COLUMN {_col} {_dtype} DEFAULT {_default}"))
            _conn.commit()
        except Exception:
            pass  # column already exists

    user_columns = [
        ("role", "TEXT", "'user'"),
        ("status", "TEXT", "'pending'"),
        ("approved_at", "TEXT", "''"),
        ("approved_by", "TEXT", "''"),
        ("updated_at", "TEXT", "''"),
    ]
    for _col, _dtype, _default in user_columns:
        try:
            _conn.execute(text(f"ALTER TABLE users ADD COLUMN {_col} {_dtype} DEFAULT {_default}"))
            _conn.commit()
        except Exception:
            pass  # column already exists


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================
# PYDANTIC MODELS (Request/Response schemas)
# ============================================================
GASES = ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2"]
PREDICTION_FIELDS = [
    *GASES,
    "O2",
    "N2",
    "moisture",
    "bdv",
    "acidity",
    "ift",
    "powerFactor",
    "flashPoint",
    "inhibitor",
    "passivator",
    "density",
    "dbds",
    "viscosity40",
    "methanol",
    "pcb",
    "resistivity",
    "specificGravity",
    "fol2",
    "hmf5",
    "fal2",
    "acf2",
    "mef5",
    "copperCu",
    "ironFe",
    "aluminumAl",
    "dpFromFuran",
    "dpFromMethanol",
]
ANOMALY_FEATURE_SETS = {
    "dga": GASES,
    "oil": [
        "moisture",
        "bdv",
        "acidity",
        "ift",
        "powerFactor",
        "passivator",
        "fal2",
        "dpFromFuran",
        "dpFromMethanol",
    ],
}
ANOMALY_MODE_LABELS = {
    "dga": "DGA",
    "oil": "oil test",
}

# IEEE C57.104-2019 Limits
IEEE_LIMITS = {
    "H2":   {"good": 100, "fair": 200, "poor": 500, "veryPoor": 700},
    "CH4":  {"good": 75,  "fair": 125, "poor": 200, "veryPoor": 400},
    "C2H2": {"good": 2,   "fair": 7,   "poor": 35,  "veryPoor": 50},
    "C2H4": {"good": 50,  "fair": 100, "poor": 200, "veryPoor": 300},
    "C2H6": {"good": 20,  "fair": 50,  "poor": 90,  "veryPoor": 150},
    "CO":   {"good": 500, "fair": 700, "poor": 900, "veryPoor": 1100},
    "CO2":  {"good": 5000,"fair": 7000,"poor": 9000,"veryPoor": 11000},
}

# ============================================================
# AUTH HELPERS
# ============================================================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{pw_hash.hex()}"

def verify_password(password: str, stored: str) -> bool:
    salt, pw_hash = stored.split(":")
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex() == pw_hash


def serialize_user(user: UserDB) -> Dict[str, str]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role or "user",
        "status": user.status or "pending",
        "approved_at": user.approved_at or "",
        "approved_by": user.approved_by or "",
        "created_at": user.created_at or "",
        "updated_at": user.updated_at or "",
    }


def ensure_superadmin_user(db: Session) -> UserDB:
    existing = db.query(UserDB).filter(UserDB.name == SUPERADMIN_NAME).first()
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        if existing.email != SUPERADMIN_EMAIL:
            # Keep a deterministic account identifier for superadmin checks.
            existing.email = SUPERADMIN_EMAIL
        existing.role = "superadmin"
        existing.status = "approved"
        if not existing.approved_at:
            existing.approved_at = now
        if not existing.created_at:
            existing.created_at = now
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return existing

    user = UserDB(
        id=str(uuid4()),
        name=SUPERADMIN_NAME,
        email=SUPERADMIN_EMAIL,
        password_hash=hash_password(os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or secrets.token_urlsafe(32)),
        role="superadmin",
        status="approved",
        approved_at=now,
        approved_by=SUPERADMIN_NAME,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def require_superadmin(db: Session, requester_id: str) -> UserDB:
    if not requester_id:
        raise HTTPException(400, "Requester ID is required")
    requester = db.query(UserDB).filter(UserDB.id == requester_id).first()
    if not requester or (requester.role or "user") != "superadmin":
        raise HTTPException(403, "Only superadmin can manage users")
    return requester


class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str

class SignInRequest(BaseModel):
    email: str
    password: str


class UserCreateByAdminRequest(BaseModel):
    requester_id: str
    name: str
    email: str
    password: str


class UserUpdateByAdminRequest(BaseModel):
    requester_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class UserApproveRequest(BaseModel):
    requester_id: str


class UserDeleteRequest(BaseModel):
    requester_id: str



class DGARecord(BaseModel):
    """Single DGA test result."""
    id: Optional[str] = None
    date: str
    H2: float = 0
    CH4: float = 0
    C2H2: float = 0
    C2H4: float = 0
    C2H6: float = 0
    CO: float = 0
    CO2: float = 0
    O2: float = 0
    N2: float = 0
    moisture: float = 0
    bdv: float = 0
    acidity: float = 0
    ift: float = 0
    powerFactor: float = 0
    flashPoint: float = 0
    inhibitor: float = 0
    passivator: float = 0
    density: float = 0
    dbds: float = 0
    viscosity40: float = 0
    methanol: float = 0
    pcb: float = 0
    resistivity: float = 0
    specificGravity: float = 0
    fol2: float = 0
    hmf5: float = 0
    fal2: float = 0
    acf2: float = 0
    mef5: float = 0
    copperCu: float = 0
    ironFe: float = 0
    aluminumAl: float = 0
    dpFromFuran: float = 0
    dpFromMethanol: float = 0


class TransformerInfo(BaseModel):
    """Transformer metadata for clustering/context."""
    id: str
    brand: str = ""
    maker: str = ""
    voltage: str = ""
    loadMVA: float = 0
    site: str = ""
    dateEnergized: str = ""
    dateManufactured: str = ""
    oilBrand: str = ""
    oilType: str = ""
    paperType: str = "Not specified"


class TransformerAsset(BaseModel):
    """Transformer record persisted in local database."""
    id: str
    name: str
    mnemonic: str = ""
    serialNumber: str = ""
    brand: str = ""
    maker: str = ""
    voltage: str = ""
    loadMVA: float = 0
    site: str = ""
    dateEnergized: str = ""
    dateManufactured: str = ""
    oilBrand: str = ""
    oilType: str = ""
    paperType: str = "Not specified"

class OilBrandAsset(BaseModel):
    """Master oil-brand catalog item persisted in local database."""
    id: str = ""
    name: str
    oilType: str = ""
    notes: str = ""


class DGAResultAsset(BaseModel):
    """DGA result record persisted in local database."""
    id: Optional[str] = None
    transformerId: str
    date: str
    H2: float = 0
    CH4: float = 0
    C2H2: float = 0
    C2H4: float = 0
    C2H6: float = 0
    CO: float = 0
    CO2: float = 0
    O2: float = 0
    N2: float = 0
    moisture: float = 0
    bdv: float = 0
    acidity: float = 0
    ift: float = 0
    color: str = ""
    powerFactor: float = 0
    testType: str = "Routine"
    flashPoint: float = 0
    inhibitor: float = 0
    passivator: float = 0
    copperCorrosive: str = ""
    density: float = 0
    dbds: float = 0
    viscosity40: float = 0
    methanol: float = 0
    pcb: float = 0
    resistivity: float = 0
    specificGravity: float = 0
    fol2: float = 0
    hmf5: float = 0
    fal2: float = 0
    acf2: float = 0
    mef5: float = 0
    copperCu: float = 0
    ironFe: float = 0
    aluminumAl: float = 0
    dpFromFuran: float = 0
    dpFromMethanol: float = 0
    notes: str = ""


class AssessmentHistoryPayload(BaseModel):
    id: Optional[str] = None
    resultId: str
    transformerId: str
    assessmentText: str
    source: str = "manual"
    status: str = "approved"


class AssessmentHistoryImportItem(BaseModel):
    id: Optional[str] = None
    resultId: Optional[str] = None
    transformerId: Optional[str] = None
    date: Optional[str] = None
    assessmentText: str
    source: str = "manual_import"
    status: str = "approved"


class AssessmentHistoryImportPayload(BaseModel):
    items: List[AssessmentHistoryImportItem] = Field(default_factory=list)
    upsert: bool = True


class StorageBootstrapRequest(BaseModel):
    """Bootstrap payload used to seed an empty local database."""
    transformers: List[TransformerAsset] = Field(default_factory=list)
    results: List[DGAResultAsset] = Field(default_factory=list)


class PredictionRequest(BaseModel):
    """Request body for ARIMA/LSTM/XGBoost/LightGBM prediction."""
    transformer: TransformerInfo
    history: List[DGARecord]
    forecast_months: int = Field(default=12, ge=1, le=60)
    gases: List[str] = Field(default=GASES)

    @field_validator("history")
    @classmethod
    def history_min_length(cls, v):
        if len(v) < 1:
            raise ValueError("Need at least 1 DGA record")
        return v

    @field_validator("gases")
    @classmethod
    def gases_supported(cls, v):
        if not v:
            raise ValueError("Select at least one prediction test")
        invalid = [name for name in v if name not in PREDICTION_FIELDS]
        if invalid:
            raise ValueError(f"Unsupported prediction tests: {', '.join(invalid)}")
        # preserve order while removing duplicates
        seen = set()
        normalized = []
        for name in v:
            if name in seen:
                continue
            seen.add(name)
            normalized.append(name)
        return normalized


class ClusterRequest(BaseModel):
    """Request body for clustering."""
    transformers: List[TransformerInfo]
    latest_results: Dict[str, DGARecord]  # keyed by transformer ID
    n_clusters: int = Field(default=3, ge=2, le=10)


class AnomalyRequest(BaseModel):
    """Request body for anomaly detection."""
    transformer: TransformerInfo
    history: List[DGARecord]
    contamination: float = Field(default=0.1, ge=0.01, le=0.5)
    mode: str = "dga"

    @field_validator("history")
    @classmethod
    def history_min_length(cls, v):
        if len(v) < 5:
            raise ValueError("Need at least 5 records")
        return v

    @field_validator("mode")
    @classmethod
    def mode_supported(cls, v):
        normalized = (v or "dga").lower()
        if normalized not in ANOMALY_FEATURE_SETS:
            raise ValueError(f"Unsupported anomaly mode: {v}")
        return normalized


class GasForecast(BaseModel):
    """Forecast result for a single gas."""
    gas: str
    current_value: float
    forecasted_values: List[Dict[str, Any]]  # [{month, date, value, lower, upper}]
    trend: str  # "increasing", "decreasing", "stable"
    slope_per_month: float
    will_exceed_limit: Optional[str] = None  # "good", "fair", "poor" if crossing
    months_to_exceed: Optional[int] = None
    model_confidence: float  # 0-1
    diagnostics: Dict[str, Any] = {}


class PredictionResponse(BaseModel):
    """Full prediction response."""
    transformer_id: str
    model_type: str  # "arima" | "lstm" | "xgboost" | "lightgbm"
    forecasts: Dict[str, GasForecast]
    overall_risk: str  # "low", "medium", "high", "critical"
    risk_summary: str
    recommendation: str


class FaultForecast(BaseModel):
    """Forecasted fault class for a single future month."""
    month: int
    date: str
    predicted_fault: str
    confidence: float
    top_probabilities: Dict[str, float] = Field(default_factory=dict)


class DuvalPoint(BaseModel):
    """Single point on Duval movement timeline (triangle/pentagon-ready)."""
    date: str
    type: str  # "history" | "forecast"
    month: int = 0  # 0 for history, +N for forecast points
    fault: str
    duval_fault: Optional[str] = None
    duval_t1: Optional[str] = None
    duval_t4: Optional[str] = None
    duval_t5: Optional[str] = None
    duval_p1: Optional[str] = None
    pH2: float = 0
    pCH4: float
    pC2H6: float = 0
    pC2H4: float
    pC2H2: float


class FaultPredictionResponse(BaseModel):
    """Random Forest based future fault classification response."""
    transformer_id: str
    model_type: str  # "fault_rf"
    current_fault: str
    fault_history: List[Dict[str, str]]  # [{date, fault}]
    fault_forecast: List[FaultForecast]
    duval_points: List[DuvalPoint] = Field(default_factory=list)
    overall_risk: str
    risk_summary: str
    recommendation: str
    diagnostics: Dict[str, Any] = Field(default_factory=dict)


# ============================================================
# HELPER FUNCTIONS
# ============================================================
def get_condition(gas: str, value: float) -> str:
    """Get IEEE C57.104 condition for a gas value."""
    limits = IEEE_LIMITS.get(gas)
    if not limits:
        return "unknown"
    if value <= limits.get("good", 0):
        return "good"
    if value <= limits.get("fair", 0):
        return "fair"
    if value <= limits.get("poor", 0):
        return "poor"
    return "veryPoor"


def compute_age_years(date_str: str) -> float:
    """Calculate age in years from a date string."""
    if not date_str:
        return 0
    try:
        dt = datetime.fromisoformat(date_str)
        return (datetime.now() - dt).days / 365.25
    except Exception:
        return 0


def assess_overall_risk(forecasts: Dict[str, GasForecast]) -> tuple:
    """Assess overall risk level from gas forecasts."""
    risk_gases = []
    evaluated_any = False
    max_risk = "low"
    risk_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}

    for gas, fc in forecasts.items():
        if gas == "CO2" or gas not in IEEE_LIMITS:
            continue  # CO2 alone is less diagnostic; non-IEEE tests are informational only.
        evaluated_any = True
        last_val = fc.forecasted_values[-1]["value"] if fc.forecasted_values else fc.current_value
        cond = get_condition(gas, last_val)

        if cond == "veryPoor":
            risk = "critical"
            risk_gases.append(f"{gas} (critical: {last_val:.0f} ppm)")
        elif cond == "poor":
            risk = "high"
            risk_gases.append(f"{gas} (high: {last_val:.0f} ppm)")
        elif cond == "fair":
            risk = "medium"
            risk_gases.append(f"{gas} (elevated: {last_val:.0f} ppm)")
        else:
            risk = "low"

        if risk_order.get(risk, 0) > risk_order.get(max_risk, 0):
            max_risk = risk

    if not evaluated_any:
        summary = "Forecast completed for selected tests. IEEE risk grading requires dissolved gas parameters."
        recommendation = "Include at least one dissolved gas (H2, CH4, C2H2, C2H4, C2H6, CO, CO2) for risk grading."
        return "low", summary, recommendation

    if max_risk == "critical":
        summary = f"CRITICAL: {', '.join(risk_gases)}. Immediate action required."
        recommendation = "Schedule urgent oil sampling and consider removing transformer from service for inspection."
    elif max_risk == "high":
        summary = f"HIGH RISK: {', '.join(risk_gases)}. Close monitoring needed."
        recommendation = "Increase DGA sampling frequency to monthly. Plan maintenance window for investigation."
    elif max_risk == "medium":
        summary = f"MODERATE: {', '.join(risk_gases)}. Enhanced monitoring recommended."
        recommendation = "Increase sampling to quarterly. Track gas generation rates closely."
    else:
        summary = "All gas levels within acceptable IEEE C57.104 limits for forecast period."
        recommendation = "Continue routine DGA monitoring at standard intervals."

    return max_risk, summary, recommendation


FAULT_LABELS = {
    "PD": "Partial Discharge",
    "D1": "Discharge Low Energy",
    "D2": "Discharge High Energy",
    "T1": "Thermal < 300C",
    "T2": "Thermal 300-700C",
    "T3": "Thermal > 700C",
    "T2-H": "Thermal 300-700C",
    "T3-H": "Thermal > 700C",
    "DT": "Mixed (Discharge + Thermal)",
    "S": "Stray Gassing",
    "O": "Overheating",
    "C": "Carbonization",
    "ND": "Not Determined",
    "N": "Normal",
}

FAULT_RISK_LEVELS = {
    "N": "low",
    "ND": "low",
    "PD": "medium",
    "T1": "medium",
    "S": "medium",
    "O": "medium",
    "D1": "high",
    "T2": "high",
    "T2-H": "high",
    "C": "high",
    "DT": "high",
    "D2": "critical",
    "T3": "critical",
    "T3-H": "critical",
}

DUVAL_P1_POINT_ON_POLYGON_EPSILON = 1e-15
DUVAL_P1_MINERAL_POLYGONS = [
    (
        "D2",
        ((4.0, 16.0), (32.061, -6.048), (24.204, -30.299), (0.0, -3.0), (0.0, 1.5)),
    ),
    (
        "D1",
        ((0.0, 40.0), (38.042, 12.361), (32.061, -6.048), (4.0, 16.0), (0.0, 1.5)),
    ),
    (
        "C",
        ((-3.5, -3.0), (2.492, -32.361), (-21.483, -32.361), (-11.0, -8.0)),
    ),
    (
        "T3-H",
        ((0.0, -3.0), (24.204, -30.299), (23.511, -32.361), (2.492, -32.361), (-3.5, -3.0)),
    ),
    (
        "O",
        ((-3.5, -3.0), (-11.0, -8.0), (-21.483, -32.361), (-23.511, -32.361), (-35.0, 3.0), (0.0, 1.5), (0.0, -3.0)),
    ),
    (
        "S",
        ((0.0, 1.5), (-35.0, 3.0), (-38.042, 12.361), (0.0, 40.0), (0.0, 33.0), (-1.0, 33.0), (-1.0, 24.5), (0.0, 24.5)),
    ),
    (
        "PD",
        ((0.0, 33.0), (-1.0, 33.0), (-1.0, 24.5), (0.0, 24.5)),
    ),
]


def _round_duval_value(value: float, digits: int = 2) -> float:
    factor = 10 ** digits
    return math.floor(float(value) * factor + 0.5) / factor


def _get_duval_p1_centroid(h2: float, ch4: float, c2h6: float, c2h4: float, c2h2: float):
    total = float(h2) + float(ch4) + float(c2h6) + float(c2h4) + float(c2h2)
    if total <= 0:
        return None

    pct_h2 = (float(h2) / total) * 100
    pct_c2h6 = (float(c2h6) / total) * 100
    pct_ch4 = (float(ch4) / total) * 100
    pct_c2h4 = (float(c2h4) / total) * 100
    pct_c2h2 = (float(c2h2) / total) * 100

    x_coords = [
        0.0,
        pct_c2h6 * math.cos(math.radians(162)),
        pct_ch4 * math.cos(math.radians(234)),
        pct_c2h4 * math.cos(math.radians(306)),
        pct_c2h2 * math.cos(math.radians(18)),
    ]
    y_coords = [
        pct_h2,
        pct_c2h6 * math.sin(math.radians(162)),
        pct_ch4 * math.sin(math.radians(234)),
        pct_c2h4 * math.sin(math.radians(306)),
        pct_c2h2 * math.sin(math.radians(18)),
    ]

    area_factor = 0.0
    for point in range(5):
        if point == 4:
            area_factor += 3 * (x_coords[point] * y_coords[0] - x_coords[0] * y_coords[point])
        else:
            area_factor += 3 * (x_coords[point] * y_coords[point + 1] - x_coords[point + 1] * y_coords[point])

    if abs(area_factor) <= 1e-12:
        return None

    centroid_x = 0.0
    centroid_y = 0.0
    for point in range(5):
        if point == 4:
            cross = x_coords[point] * y_coords[0] - x_coords[0] * y_coords[point]
            centroid_x += (x_coords[point] + x_coords[0]) * cross
            centroid_y += (y_coords[point] + y_coords[0]) * cross
        else:
            cross = x_coords[point] * y_coords[point + 1] - x_coords[point + 1] * y_coords[point]
            centroid_x += (x_coords[point] + x_coords[point + 1]) * cross
            centroid_y += (y_coords[point] + y_coords[point + 1]) * cross

    return (
        _round_duval_value(centroid_x / area_factor, 2),
        _round_duval_value(centroid_y / area_factor, 2),
    )


def _duval_segment_length(segment) -> float:
    return math.sqrt((segment[1][0] - segment[0][0]) ** 2 + (segment[1][1] - segment[0][1]) ** 2)


def _duval_cross(point, start, end) -> float:
    return (point[0] - end[0]) * (start[1] - end[1]) - (point[1] - end[1]) * (start[0] - end[0])


def _is_point_on_duval_segment(point, segment, epsilon: float = 0.0) -> bool:
    return (
        abs(_duval_cross(point, segment[0], segment[1])) <= epsilon
        and _duval_segment_length((segment[0], point)) <= _duval_segment_length(segment)
        and _duval_segment_length((segment[1], point)) <= _duval_segment_length(segment)
    )


def _is_point_in_duval_polygon(point, polygon) -> bool:
    is_inside = False
    x, y = point
    previous = len(polygon) - 1
    for index in range(len(polygon)):
        x1, y1 = polygon[index]
        x2, y2 = polygon[previous]
        if (y1 > y) != (y2 > y) and x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1:
            is_inside = not is_inside
        previous = index
    return is_inside


def _is_point_on_duval_polygon(point, polygon, epsilon: float = 0.0) -> bool:
    for index in range(len(polygon)):
        if _is_point_on_duval_segment(point, (polygon[index], polygon[(index + 1) % len(polygon)]), epsilon):
            return True
    return False


def _classify_duval_p1_centroid(centroid) -> Optional[str]:
    for fault, polygon in DUVAL_P1_MINERAL_POLYGONS:
        if _is_point_in_duval_polygon(centroid, polygon) or _is_point_on_duval_polygon(
            centroid,
            polygon,
            DUVAL_P1_POINT_ON_POLYGON_EPSILON,
        ):
            return fault
    return None


def get_duval_fault(ch4: float, c2h4: float, c2h2: float) -> str:
    """
    Classify fault zone from CH4/C2H4/C2H2 percentages (Duval Triangle 1 logic).

    Aligned with DGAToolsV2 `calcDuval1` thresholds used in the referenced app.
    """
    total = float(ch4) + float(c2h4) + float(c2h2)
    if total <= 0:
        return "N"

    p_ch4 = (float(ch4) / total) * 100
    p_c2h4 = (float(c2h4) / total) * 100
    p_c2h2 = (float(c2h2) / total) * 100

    if p_ch4 >= 98:
        return "PD"
    if p_c2h4 >= 50 and p_c2h2 < 15:
        return "T3"
    if p_c2h2 >= 13:
        if p_c2h4 < 23:
            return "D1"
        return "D2"
    if p_c2h2 >= 4:
        return "DT"
    if p_c2h4 >= 20:
        return "T2"
    return "T1"


def get_duval_t4_fault(h2: float, ch4: float, c2h6: float) -> str:
    """Duval Triangle 4 fault zone (aligned with DGAToolsV2)."""
    total = float(h2) + float(ch4) + float(c2h6)
    if total <= 0:
        return "N"

    p_h2 = (float(h2) / total) * 100
    p_ch4 = (float(ch4) / total) * 100
    p_c2h6 = (float(c2h6) / total) * 100

    fault = "S"
    if p_h2 >= 90:
        fault = "PD"
    elif p_ch4 >= 64:
        fault = "C"
    elif p_c2h6 >= 52:
        fault = "O"
    return fault


def get_duval_t5_fault(ch4: float, c2h4: float, c2h6: float) -> str:
    """Duval Triangle 5 fault zone (aligned with DGAToolsV2)."""
    total = float(ch4) + float(c2h4) + float(c2h6)
    if total <= 0:
        return "N"

    p_ch4 = (float(ch4) / total) * 100
    p_c2h4 = (float(c2h4) / total) * 100
    p_c2h6 = (float(c2h6) / total) * 100

    fault = "ND"
    if p_ch4 >= 98:
        fault = "PD"
    elif p_c2h4 >= 50:
        fault = "T3-H"
    elif p_ch4 >= 35 and p_ch4 <= 75 and p_c2h4 >= 10 and p_c2h4 < 40:
        fault = "C"
    elif p_c2h4 >= 20:
        fault = "T2-H"
    elif p_c2h6 >= 50:
        fault = "S"
    elif p_ch4 >= 40:
        fault = "O"
    return fault


def get_duval_p1_fault(h2: float, ch4: float, c2h6: float, c2h4: float, c2h2: float) -> str:
    """Duval Pentagon 1 fault zone using the Vaisala centroid + polygon method."""
    centroid = _get_duval_p1_centroid(h2, ch4, c2h6, c2h4, c2h2)
    if centroid is None:
        return "N"
    return _classify_duval_p1_centroid(centroid) or "ND"


def get_duval_percentages(ch4: float, c2h4: float, c2h2: float) -> Dict[str, float]:
    """Return Duval Triangle percentages for CH4 / C2H4 / C2H2."""
    total = float(ch4) + float(c2h4) + float(c2h2)
    if total <= 0:
        return {"pCH4": 0.0, "pC2H4": 0.0, "pC2H2": 0.0}
    return {
        "pCH4": (float(ch4) / total) * 100.0,
        "pC2H4": (float(c2h4) / total) * 100.0,
        "pC2H2": (float(c2h2) / total) * 100.0,
    }


def get_duval_pentagon_percentages(h2: float, ch4: float, c2h6: float, c2h4: float, c2h2: float) -> Dict[str, float]:
    """Return Duval Pentagon percentages for H2 / CH4 / C2H6 / C2H4 / C2H2."""
    total = float(h2) + float(ch4) + float(c2h6) + float(c2h4) + float(c2h2)
    if total <= 0:
        return {"pH2": 0.0, "pCH4": 0.0, "pC2H6": 0.0, "pC2H4": 0.0, "pC2H2": 0.0}
    return {
        "pH2": (float(h2) / total) * 100.0,
        "pCH4": (float(ch4) / total) * 100.0,
        "pC2H6": (float(c2h6) / total) * 100.0,
        "pC2H4": (float(c2h4) / total) * 100.0,
        "pC2H2": (float(c2h2) / total) * 100.0,
    }


def _linear_extrapolate_values(values: List[float], steps: int) -> List[float]:
    """Simple linear extrapolation used to generate future feature inputs."""
    n = len(values)
    if n == 0:
        return [0.0] * steps
    if n == 1:
        return [max(0.0, float(values[0]))] * steps

    x = np.arange(n, dtype=np.float32)
    y = np.array(values, dtype=np.float32)
    slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x ** 2) - np.sum(x) ** 2 + 1e-10)
    intercept = (np.sum(y) - slope * np.sum(x)) / n
    return [max(0.0, float(slope * (n + i) + intercept)) for i in range(steps)]


def _build_fault_features(gases: Dict[str, float], month_index: int) -> List[float]:
    """Feature vector for Random Forest fault classifier."""
    h2 = float(gases.get("H2", 0.0))
    ch4 = float(gases.get("CH4", 0.0))
    c2h2 = float(gases.get("C2H2", 0.0))
    c2h4 = float(gases.get("C2H4", 0.0))
    c2h6 = float(gases.get("C2H6", 0.0))
    co = float(gases.get("CO", 0.0))
    co2 = float(gases.get("CO2", 0.0))

    r1 = ch4 / (h2 + 1e-6)      # CH4/H2
    r2 = c2h2 / (c2h4 + 1e-6)   # C2H2/C2H4
    r5 = c2h4 / (c2h6 + 1e-6)   # C2H4/C2H6
    tdcg = h2 + ch4 + c2h2 + c2h4 + c2h6 + co

    return [
        float(month_index),
        h2, ch4, c2h2, c2h4, c2h6, co, co2,
        r1, r2, r5, tdcg,
    ]


def assess_fault_forecast_risk(current_fault: str, forecast_faults: List[str]) -> tuple:
    """Assess risk level based on current and forecasted fault classes."""
    risk_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    all_faults = [current_fault] + list(forecast_faults)
    max_risk = "low"
    worst_fault = current_fault

    for fault in all_faults:
        risk = FAULT_RISK_LEVELS.get(fault, "low")
        if risk_order[risk] > risk_order[max_risk]:
            max_risk = risk
            worst_fault = fault

    if max_risk == "critical":
        summary = f"Critical risk trend detected. Predicted fault behavior reaches {worst_fault} ({FAULT_LABELS.get(worst_fault, worst_fault)})."
        recommendation = "Plan urgent inspection and consider immediate mitigation actions before next sampling cycle."
    elif max_risk == "high":
        summary = f"High risk trend detected. Forecast indicates {worst_fault} fault behavior."
        recommendation = "Increase monitoring to monthly and schedule maintenance diagnostics."
    elif max_risk == "medium":
        summary = "Moderate risk trend detected. Early-stage electrical/thermal fault signatures may persist."
        recommendation = "Increase monitoring frequency and verify with confirmatory tests."
    else:
        summary = "Low risk trend. Fault pattern remains in normal/low-severity region."
        recommendation = "Continue routine monitoring schedule."

    return max_risk, summary, recommendation


def normalize_catalog_text(value: Any) -> str:
    return re.sub(r"\s+", " ", f"{value or ''}").strip()



def normalize_catalog_key(value: Any) -> str:
    return normalize_catalog_text(value).casefold()



def current_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()



def get_oil_brand_library_defaults(name: str) -> Dict[str, str]:
    lookup_key = normalize_catalog_key(name)
    for item in DEFAULT_OIL_BRAND_LIBRARY:
        if normalize_catalog_key(item.get("name")) == lookup_key:
            return {
                "oilType": normalize_catalog_text(item.get("oilType")),
                "notes": normalize_catalog_text(item.get("notes")),
            }
    return {"oilType": "", "notes": ""}



def serialize_oil_brand(row: OilBrandDB, transformer_count: int = 0) -> Dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name or "",
        "oilType": row.oil_type or "",
        "notes": row.notes or "",
        "transformerCount": int(transformer_count or 0),
        "createdAt": row.created_at or "",
        "updatedAt": row.updated_at or "",
    }



def find_oil_brand_by_name(db: Session, name: str, exclude_id: Optional[str] = None) -> Optional[OilBrandDB]:
    target_key = normalize_catalog_key(name)
    if not target_key:
        return None
    for row in db.query(OilBrandDB).all():
        if exclude_id and row.id == exclude_id:
            continue
        if normalize_catalog_key(row.name) == target_key:
            return row
    return None



def upsert_oil_brand_catalog_entry(db: Session, name: str, oil_type: str = "", notes: str = "") -> Optional[OilBrandDB]:
    normalized_name = normalize_catalog_text(name)
    if not normalized_name:
        return None

    normalized_oil_type = normalize_catalog_text(oil_type)
    normalized_notes = f"{notes or ''}".strip()
    defaults = get_oil_brand_library_defaults(normalized_name)
    if not normalized_oil_type:
        normalized_oil_type = defaults.get("oilType", "")
    if not normalized_notes:
        normalized_notes = defaults.get("notes", "")

    existing = find_oil_brand_by_name(db, normalized_name)
    if existing:
        changed = False
        if normalized_name != existing.name:
            existing.name = normalized_name
            changed = True
        if normalized_oil_type and not normalize_catalog_text(existing.oil_type):
            existing.oil_type = normalized_oil_type
            changed = True
        if normalized_notes and not normalize_catalog_text(existing.notes):
            existing.notes = normalized_notes
            changed = True
        if changed:
            existing.updated_at = current_timestamp()
        db.flush()
        return existing

    timestamp = current_timestamp()
    row = OilBrandDB(
        id=f"oil-brand-{uuid4().hex[:12]}",
        name=normalized_name,
        oil_type=normalized_oil_type,
        notes=normalized_notes,
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(row)
    db.flush()
    return row



def infer_transformer_oil_brand(row: TransformerDB) -> str:
    for value, lookup in [
        (row.id, KNOWN_TRANSFORMER_OIL_BRAND_MATCHES),
        (row.serial_number, KNOWN_SERIAL_OIL_BRAND_MATCHES),
        (row.name, KNOWN_NAME_OIL_BRAND_MATCHES),
        (row.mnemonic, KNOWN_TRANSFORMER_OIL_BRAND_MATCHES),
    ]:
        match = lookup.get(normalize_catalog_key(value))
        if match:
            return match
    return UNAMBIGUOUS_OIL_TYPE_BRAND_MATCHES.get(normalize_catalog_key(row.oil_type), "")



def sync_oil_brand_catalog(db: Session) -> Dict[str, int]:
    for item in DEFAULT_OIL_BRAND_LIBRARY:
        upsert_oil_brand_catalog_entry(db, item.get("name", ""), item.get("oilType", ""), item.get("notes", ""))

    backfilled_transformers = 0
    unresolved_transformers = 0
    transformers = db.query(TransformerDB).order_by(TransformerDB.id).all()
    for row in transformers:
        normalized_brand = normalize_catalog_text(row.oil_brand)
        normalized_type = normalize_catalog_text(row.oil_type)
        if normalized_brand != (row.oil_brand or ""):
            row.oil_brand = normalized_brand
        if normalized_type != (row.oil_type or ""):
            row.oil_type = normalized_type

        if not row.oil_brand:
            inferred_brand = infer_transformer_oil_brand(row)
            if inferred_brand:
                row.oil_brand = inferred_brand
                backfilled_transformers += 1
            else:
                unresolved_transformers += 1

        if row.oil_brand:
            catalog_entry = upsert_oil_brand_catalog_entry(db, row.oil_brand, row.oil_type)
            catalog_oil_type = normalize_catalog_text(catalog_entry.oil_type if catalog_entry else "")
            if catalog_oil_type and catalog_oil_type != normalize_catalog_text(row.oil_type):
                row.oil_type = catalog_oil_type

    db.flush()
    catalog_size = db.query(OilBrandDB).count()
    return {
        "catalogSize": catalog_size,
        "backfilledTransformers": backfilled_transformers,
        "unresolvedTransformers": unresolved_transformers,
    }



def get_serialized_oil_brand_catalog(db: Session) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = {}
    for transformer in db.query(TransformerDB).all():
        key = normalize_catalog_key(transformer.oil_brand)
        if key:
            counts[key] = counts.get(key, 0) + 1

    items: List[Dict[str, Any]] = []
    rows = db.query(OilBrandDB).order_by(OilBrandDB.name).all()
    for row in rows:
        items.append(serialize_oil_brand(row, counts.get(normalize_catalog_key(row.name), 0)))
    return items



def run_oil_brand_catalog_backfill() -> None:
    db = SessionLocal()
    try:
        sync_oil_brand_catalog(db)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[WARN] Oil-brand catalog backfill failed: {exc}")
    finally:
        db.close()


def serialize_transformer(row: TransformerDB) -> Dict[str, Any]:
    """Convert DB transformer row to frontend-friendly shape."""
    return {
        "id": row.id,
        "name": row.name or "",
        "mnemonic": row.mnemonic or "",
        "serialNumber": row.serial_number or "",
        "brand": row.brand or "",
        "maker": row.maker or "",
        "voltage": row.voltage or "",
        "loadMVA": float(row.load_mva or 0),
        "site": row.site or "",
        "dateEnergized": row.date_energized or "",
        "dateManufactured": row.date_manufactured or "",
        "oilBrand": row.oil_brand or "",
        "oilType": row.oil_type or "",
        "paperType": row.paper_type or "Not specified",
    }


def serialize_result(row: DGAResultDB) -> Dict[str, Any]:
    """Convert DB DGA row to frontend-friendly shape."""
    return {
        "id": row.id,
        "transformerId": row.transformer_id,
        "date": row.date,
        "H2": float(row.H2 or 0),
        "CH4": float(row.CH4 or 0),
        "C2H2": float(row.C2H2 or 0),
        "C2H4": float(row.C2H4 or 0),
        "C2H6": float(row.C2H6 or 0),
        "CO": float(row.CO or 0),
        "CO2": float(row.CO2 or 0),
        "O2": float(row.O2 or 0),
        "N2": float(row.N2 or 0),
        "moisture": float(row.moisture or 0),
        "bdv": float(row.bdv or 0),
        "acidity": float(row.acidity or 0),
        "ift": float(row.ift or 0),
        "color": row.color or "",
        "powerFactor": float(row.power_factor or 0),
        "testType": row.test_type or "Routine",
        "flashPoint": float(row.flash_point or 0),
        "inhibitor": float(row.inhibitor or 0),
        "passivator": float(row.passivator or 0),
        "copperCorrosive": row.copper_corrosive or "",
        "density": float(row.density or 0),
        "dbds": float(row.dbds or 0),
        "viscosity40": float(row.viscosity40 or 0),
        "methanol": float(row.methanol or 0),
        "pcb": float(row.pcb or 0),
        "resistivity": float(row.resistivity or 0),
        "specificGravity": float(row.specific_gravity or 0),
        "fol2": float(row.fol2 or 0),
        "hmf5": float(row.hmf5 or 0),
        "fal2": float(row.fal2 or 0),
        "acf2": float(row.acf2 or 0),
        "mef5": float(row.mef5 or 0),
        "copperCu": float(row.copper_cu or 0),
        "ironFe": float(row.iron_fe or 0),
        "aluminumAl": float(row.aluminum_al or 0),
        "dpFromFuran": float(row.dp_from_furan or 0),
        "dpFromMethanol": float(row.dp_from_methanol or 0),
        "notes": row.notes or "",
    }


def serialize_assessment_history(row: AssessmentHistoryDB, transformer: Optional[TransformerDB] = None, result: Optional[DGAResultDB] = None) -> Dict[str, Any]:
    result_payload = serialize_result(result) if result else None
    fault_code = build_fault_code(result_payload) if result_payload else "ND"
    return {
        "id": row.id,
        "resultId": row.result_id,
        "transformerId": row.transformer_id,
        "assessmentText": row.assessment_text or "",
        "source": row.source or "manual",
        "status": row.status or "approved",
        "createdAt": row.created_at or "",
        "updatedAt": row.updated_at or "",
        "transformer": serialize_transformer(transformer) if transformer else None,
        "resultDate": result.date if result else "",
        "faultCode": fault_code,
        "faultLabel": get_fault_label(fault_code),
    }


def extract_manual_assessment_text(notes: str) -> str:
    text = AI_ASSESSMENT_BLOCK_PATTERN.sub("", notes or "").strip()
    return text


def sync_assessment_from_result_notes(db: Session, result_row: DGAResultDB, now: Optional[str] = None) -> bool:
    manual_text = extract_manual_assessment_text(result_row.notes or "")
    history_rows = (
        db.query(AssessmentHistoryDB)
        .filter(
            AssessmentHistoryDB.result_id == result_row.id,
            AssessmentHistoryDB.source == MANUAL_RESULT_NOTE_SOURCE,
        )
        .order_by(AssessmentHistoryDB.updated_at.desc(), AssessmentHistoryDB.id.desc())
        .all()
    )
    primary = history_rows[0] if history_rows else None
    duplicate_rows = history_rows[1:] if len(history_rows) > 1 else []
    changed = False
    stamp = now or datetime.now(timezone.utc).isoformat(timespec="seconds")

    for duplicate in duplicate_rows:
        db.delete(duplicate)
        changed = True

    if manual_text:
        if primary is None:
            primary = AssessmentHistoryDB(
                id=f"AH-{uuid4().hex[:12]}",
                result_id=result_row.id,
                transformer_id=result_row.transformer_id,
                assessment_text=manual_text,
                source=MANUAL_RESULT_NOTE_SOURCE,
                status="approved",
                created_at=stamp,
                updated_at=stamp,
            )
            db.add(primary)
            changed = True
        else:
            if primary.transformer_id != result_row.transformer_id:
                primary.transformer_id = result_row.transformer_id
                changed = True
            if primary.assessment_text != manual_text:
                primary.assessment_text = manual_text
                changed = True
            if primary.status != "approved":
                primary.status = "approved"
                changed = True
            if primary.source != MANUAL_RESULT_NOTE_SOURCE:
                primary.source = MANUAL_RESULT_NOTE_SOURCE
                changed = True
            if changed:
                primary.updated_at = stamp
    elif primary is not None:
        db.delete(primary)
        changed = True

    return changed


def sync_manual_result_note_history(db: Session, transformer_id: Optional[str] = None) -> None:
    query = db.query(DGAResultDB)
    if transformer_id:
        query = query.filter(DGAResultDB.transformer_id == transformer_id)
    result_rows = query.order_by(DGAResultDB.transformer_id, DGAResultDB.date, DGAResultDB.id).all()
    if not result_rows:
        return

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    changed = False
    for result_row in result_rows:
        changed = sync_assessment_from_result_notes(db, result_row, now=stamp) or changed
    if changed:
        db.flush()


def run_manual_result_note_history_backfill() -> None:
    db = SessionLocal()
    try:
        sync_manual_result_note_history(db)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[WARN] Manual note assessment backfill failed: {exc}")
    finally:
        db.close()



def get_assessment_history_lookup(db: Session) -> Dict[str, Dict[str, Any]]:
    rows = (
        db.query(AssessmentHistoryDB, TransformerDB, DGAResultDB)
        .join(TransformerDB, AssessmentHistoryDB.transformer_id == TransformerDB.id)
        .join(DGAResultDB, AssessmentHistoryDB.result_id == DGAResultDB.id)
        .filter(AssessmentHistoryDB.status == "approved")
        .order_by(AssessmentHistoryDB.updated_at.desc(), AssessmentHistoryDB.id.desc())
        .all()
    )
    lookup: Dict[str, Dict[str, Any]] = {}
    for history_row, transformer_row, result_row in rows:
        if history_row.result_id in lookup:
            continue
        lookup[history_row.result_id] = serialize_assessment_history(history_row, transformer_row, result_row)
    return lookup


def get_assessment_history_rows(db: Session, transformer_id: Optional[str] = None, limit: int = 100, approved_only: bool = True) -> List[Dict[str, Any]]:
    query = (
        db.query(AssessmentHistoryDB, TransformerDB, DGAResultDB)
        .join(TransformerDB, AssessmentHistoryDB.transformer_id == TransformerDB.id)
        .join(DGAResultDB, AssessmentHistoryDB.result_id == DGAResultDB.id)
    )
    if transformer_id:
        query = query.filter(AssessmentHistoryDB.transformer_id == transformer_id)
    if approved_only:
        query = query.filter(AssessmentHistoryDB.status == "approved")
    rows = query.order_by(AssessmentHistoryDB.updated_at.desc(), AssessmentHistoryDB.id.desc()).limit(limit).all()
    return [serialize_assessment_history(history_row, transformer_row, result_row) for history_row, transformer_row, result_row in rows]


def resolve_assessment_result(db: Session, result_id: Optional[str] = None, transformer_id: Optional[str] = None, date: Optional[str] = None) -> DGAResultDB:
    if result_id:
        row = db.get(DGAResultDB, result_id)
        if row:
            return row
        raise ValueError(f"Result '{result_id}' not found")
    if transformer_id and date:
        row = (
            db.query(DGAResultDB)
            .filter(DGAResultDB.transformer_id == transformer_id, DGAResultDB.date == date)
            .order_by(DGAResultDB.id.desc())
            .first()
        )
        if row:
            return row
        raise ValueError(f"No result found for transformer '{transformer_id}' on date '{date}'")
    raise ValueError("Provide either resultId, or transformerId with date")


def save_assessment_history_entry(
    db: Session,
    result_row: DGAResultDB,
    assessment_text: str,
    source: str = "manual",
    status: str = "approved",
    history_id: Optional[str] = None,
    upsert: bool = True,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    row = db.get(AssessmentHistoryDB, history_id) if history_id else None
    if row is None and upsert:
        row = (
            db.query(AssessmentHistoryDB)
            .filter(AssessmentHistoryDB.result_id == result_row.id, AssessmentHistoryDB.status == status)
            .order_by(AssessmentHistoryDB.updated_at.desc(), AssessmentHistoryDB.id.desc())
            .first()
        )
    created = row is None
    if created:
        row = AssessmentHistoryDB(
            id=history_id or f"AH-{uuid4().hex[:12]}",
            result_id=result_row.id,
            transformer_id=result_row.transformer_id,
            created_at=now,
        )
        db.add(row)
    row.result_id = result_row.id
    row.transformer_id = result_row.transformer_id
    row.assessment_text = assessment_text or ""
    row.source = source or "manual"
    row.status = status or "approved"
    row.updated_at = now

    transformer_row = db.get(TransformerDB, row.transformer_id)
    return {
        "row": row,
        "created": created,
        "serialized": serialize_assessment_history(row, transformer_row, result_row),
    }


def get_tdcg_value(record: Dict[str, Any]) -> float:
    return ai_calculate_tdcg(record)


def get_overall_condition_for_record(record: Dict[str, Any]) -> str:
    conditions = [get_condition(gas, float(record.get(gas, 0) or 0)) for gas in GASES]
    if "veryPoor" in conditions:
        return "veryPoor"
    if "poor" in conditions:
        return "poor"
    if "fair" in conditions:
        return "fair"
    return "good"


def get_severity_level(record: Dict[str, Any]) -> str:
    overall = get_overall_condition_for_record(record)
    severity = {"good": "Low", "fair": "Moderate", "poor": "High", "veryPoor": "Critical"}.get(overall, "Moderate")
    tdcg_severity = classify_tdcg(get_tdcg_value(record)).get("severity", "Moderate")
    order = {"Low": 0, "Moderate": 1, "High": 2, "Critical": 3}
    return severity if order.get(severity, 1) >= order.get(tdcg_severity, 1) else tdcg_severity


def get_rogers_ratio_details(record: Dict[str, Any]) -> Dict[str, Any]:
    return diagnose_rogers_refined(record)


def get_iec_ratio_details(record: Dict[str, Any]) -> Dict[str, Any]:
    return diagnose_iec_60599(record)


def build_fault_code(record: Dict[str, Any]) -> str:
    return get_duval_fault(
        float(record.get("CH4", 0) or 0),
        float(record.get("C2H4", 0) or 0),
        float(record.get("C2H2", 0) or 0),
    )


def get_fault_label(fault_code: str) -> str:
    return FAULT_LABELS.get(fault_code, fault_code or "Unknown")


def build_ai_cases(db: Session) -> List[Dict[str, Any]]:
    transformer_rows = db.query(TransformerDB).order_by(TransformerDB.id).all()
    transformer_map = {row.id: serialize_transformer(row) for row in transformer_rows}
    result_rows = db.query(DGAResultDB).order_by(DGAResultDB.transformer_id, DGAResultDB.date, DGAResultDB.id).all()
    assessment_lookup = get_assessment_history_lookup(db)

    history_by_tx: Dict[str, List[Dict[str, Any]]] = {}
    cases: List[Dict[str, Any]] = []
    for row in result_rows:
        transformer = transformer_map.get(row.transformer_id)
        if not transformer:
            continue
        serialized = serialize_result(row)
        history = history_by_tx.setdefault(row.transformer_id, [])
        history.append(serialized)
        cases.append({
            "transformer": transformer,
            "record": serialized,
            "history": list(history),
            "assessment_entry": assessment_lookup.get(serialized["id"]),
        })
    return cases


def get_ai_context(transformer_id: str, db: Session, result_id: Optional[str] = None) -> Dict[str, Any]:
    transformer_row = db.query(TransformerDB).filter(TransformerDB.id == transformer_id).first()
    if not transformer_row:
        raise HTTPException(status_code=404, detail=f"Transformer {transformer_id} not found")

    result_rows = (
        db.query(DGAResultDB)
        .filter(DGAResultDB.transformer_id == transformer_id)
        .order_by(DGAResultDB.date, DGAResultDB.id)
        .all()
    )
    if not result_rows:
        raise HTTPException(status_code=404, detail=f"No DGA results found for transformer {transformer_id}")

    transformer = serialize_transformer(transformer_row)
    history = [serialize_result(row) for row in result_rows]
    selected_index = len(history) - 1
    if result_id:
        selected_index = next((idx for idx, item in enumerate(history) if item.get("id") == result_id), -1)
        if selected_index < 0:
            raise HTTPException(
                status_code=404,
                detail=f"Result '{result_id}' not found for transformer {transformer_id}",
            )
    selected_history = history[: selected_index + 1]
    selected_record = selected_history[-1]
    return {
        "transformer": transformer,
        "history": selected_history,
        "full_history": history,
        "latest": selected_record,
        "selected": selected_record,
        "selected_result_id": selected_record.get("id"),
        "training_cases": build_ai_cases(db),
    }


def build_ai_summary(transformer: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    latest = history[-1]
    tdcg_value = get_tdcg_value(latest)
    duval_fault = build_fault_code(latest)
    iec_ratio = get_iec_ratio_details(latest)
    rogers_ratio = get_rogers_ratio_details(latest)

    return {
        "transformer": {
            "id": transformer.get("id"),
            "name": transformer.get("name"),
            "mnemonic": transformer.get("mnemonic"),
            "site": transformer.get("site"),
            "voltage": transformer.get("voltage"),
            "loadMVA": transformer.get("loadMVA"),
            "maker": transformer.get("maker"),
            "oilBrand": transformer.get("oilBrand") or "-",
            "oilType": transformer.get("oilType") or "-",
            "paperType": transformer.get("paperType") or "Not specified",
            "dateEnergized": transformer.get("dateEnergized") or "",
            "dateManufactured": transformer.get("dateManufactured") or "",
        },
        "latest_result_id": latest.get("id"),
        "latest_date": latest.get("date"),
        "latest_dga": {
            "gases": {
                "H2": float(latest.get("H2", 0) or 0),
                "CH4": float(latest.get("CH4", 0) or 0),
                "C2H6": float(latest.get("C2H6", 0) or 0),
                "C2H4": float(latest.get("C2H4", 0) or 0),
                "C2H2": float(latest.get("C2H2", 0) or 0),
                "CO": float(latest.get("CO", 0) or 0),
                "CO2": float(latest.get("CO2", 0) or 0),
                "TDCG": tdcg_value,
            },
            "tdcgCategory": classify_tdcg(tdcg_value),
        },
        "diagnostics": {
            "duvalTriangle": {
                "code": duval_fault,
                "label": get_fault_label(duval_fault),
            },
            "iecRatio": iec_ratio,
            "rogersRatio": rogers_ratio,
            "severityLevel": get_severity_level(latest),
        },
    }


def serialize_ai_prediction(bundle: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "algorithm": bundle.get("algorithm"),
        "predicted_fault": bundle.get("predicted_fault"),
        "predicted_fault_label": get_fault_label(bundle.get("predicted_fault")),
        "risk_level": bundle.get("risk_level"),
        "confidence": bundle.get("confidence"),
        "feature_importance": bundle.get("feature_importance", []),
        "recommendation": bundle.get("recommendation"),
    }


# ============================================================
# ARIMA PREDICTION ENGINE
# ============================================================
def predict_arima(
    dates: List[str],
    values: List[float],
    gas: str,
    forecast_months: int = 12,
    cross_growth_rate: Optional[float] = None,
    cross_diagnostics: Optional[Dict[str, Any]] = None,
) -> GasForecast:
    """
    ARIMA prediction for a single gas time series.

    Automatically determines (p,d,q) order:
    - Uses ADF test to determine differencing (d)
    - Tries common orders and picks best AIC

    For short series (< 10 points), augments with synthetic prior data
    using cross-transformer weighted-average growth rates.
    """
    if not HAS_ARIMA:
        raise HTTPException(
            status_code=503,
            detail="statsmodels not installed. Run: pip install statsmodels"
        )

    series = pd.Series(values, index=pd.to_datetime(dates))
    series = series.sort_index()
    current_value = float(series.iloc[-1])

    # Augment short series with cross-transformer growth-rate priors.
    augmented_points = 0
    if cross_growth_rate is not None and len(series) < 10:
        max_augment = min(6, 10 - len(series))
        earliest_date = series.index[0]
        earliest_value = float(series.iloc[0])
        synthetic_dates = []
        synthetic_values = []
        for j in range(max_augment, 0, -1):
            syn_date = earliest_date - timedelta(days=30 * j)
            syn_val = max(0.0, earliest_value - cross_growth_rate * j)
            synthetic_dates.append(syn_date)
            synthetic_values.append(syn_val)
        if synthetic_values:
            syn_series = pd.Series(synthetic_values, index=synthetic_dates)
            series = pd.concat([syn_series, series]).sort_index()
            augmented_points = len(synthetic_values)

    # If the target transformer is still extremely sparse, return a stable fallback
    # instead of hard-failing the whole request.
    if len(series) < 3:
        return _linear_fallback(gas, dates, values, forecast_months)

    # ADF test for stationarity -> determine d
    try:
        adf_result = adfuller(series.dropna(), maxlag=min(5, len(series) // 2 - 1))
        d = 0 if adf_result[1] < 0.05 else 1
    except Exception:
        d = 1

    # Try multiple ARIMA orders and pick best AIC
    best_aic = float("inf")
    best_model = None
    best_order = (1, d, 0)

    orders_to_try = [
        (1, d, 0), (1, d, 1), (2, d, 0), (2, d, 1),
        (0, d, 1), (0, d, 2), (1, d, 2),
    ]

    for order in orders_to_try:
        try:
            model = ARIMA(series, order=order)
            fitted = model.fit()
            if fitted.aic < best_aic:
                best_aic = fitted.aic
                best_model = fitted
                best_order = order
        except Exception:
            continue

    if best_model is None:
        # Fallback: simple (1,1,0)
        try:
            model = ARIMA(series, order=(1, 1, 0))
            best_model = model.fit()
            best_order = (1, 1, 0)
        except Exception:
            # Last resort: return linear extrapolation
            return _linear_fallback(gas, dates, values, forecast_months)

    # Generate forecast
    forecast = best_model.get_forecast(steps=forecast_months)
    pred_mean = forecast.predicted_mean
    conf_int = forecast.conf_int(alpha=0.05)

    last_date = series.index[-1]
    forecasted_values = []
    for i in range(forecast_months):
        future_date = last_date + timedelta(days=30 * (i + 1))
        val = max(0, float(pred_mean.iloc[i]))
        lower = max(0, float(conf_int.iloc[i, 0]))
        upper = max(0, float(conf_int.iloc[i, 1]))
        forecasted_values.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "value": round(val, 2),
            "lower": round(lower, 2),
            "upper": round(upper, 2),
        })

    # Determine trend
    if len(forecasted_values) >= 2:
        first_val = forecasted_values[0]["value"]
        last_val = forecasted_values[-1]["value"]
        change = last_val - first_val
        if change > current_value * 0.05:
            trend = "increasing"
        elif change < -current_value * 0.05:
            trend = "decreasing"
        else:
            trend = "stable"
        slope = change / forecast_months
    else:
        trend = "stable"
        slope = 0

    # Check IEEE limit crossing
    will_exceed = None
    months_to_exceed = None
    limits = IEEE_LIMITS.get(gas, {})
    current_cond = get_condition(gas, current_value)

    for fv in forecasted_values:
        new_cond = get_condition(gas, fv["value"])
        cond_order = {"good": 0, "fair": 1, "poor": 2, "veryPoor": 3}
        if cond_order.get(new_cond, 0) > cond_order.get(current_cond, 0):
            will_exceed = new_cond
            months_to_exceed = fv["month"]
            break

    # Model confidence based on residual analysis
    residuals = best_model.resid
    confidence = max(0, min(1, 1 - (residuals.std() / (series.std() + 1e-6))))

    return GasForecast(
        gas=gas,
        current_value=current_value,
        forecasted_values=forecasted_values,
        trend=trend,
        slope_per_month=round(slope, 3),
        will_exceed_limit=will_exceed,
        months_to_exceed=months_to_exceed,
        model_confidence=round(confidence, 3),
        diagnostics=_arima_diagnostics(
            best_order, best_aic, d, series,
            augmented_points, cross_diagnostics,
        ),
    )


def _arima_diagnostics(best_order, best_aic, d, series, augmented_points, cross_diagnostics):
    diag = {
        "order": list(best_order),
        "aic": round(best_aic, 2),
        "adf_stationary": d == 0,
        "n_observations": len(series),
    }
    if augmented_points > 0:
        diag["augmented"] = True
        diag["synthetic_points"] = augmented_points
    if cross_diagnostics:
        diag.update(cross_diagnostics)
    return diag


def _linear_fallback(gas, dates, values, forecast_months):
    """Simple linear regression fallback when ARIMA fails."""
    n = len(values)
    x = np.arange(n)
    y = np.array(values)
    slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x**2) - np.sum(x)**2 + 1e-10)
    intercept = (np.sum(y) - slope * np.sum(x)) / n

    last_date = pd.to_datetime(dates[-1])
    forecasted_values = []
    for i in range(forecast_months):
        future_date = last_date + timedelta(days=30 * (i + 1))
        val = max(0, slope * (n + i) + intercept)
        forecasted_values.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "value": round(val, 2),
            "lower": round(max(0, val * 0.8), 2),
            "upper": round(val * 1.2, 2),
        })

    current_value = float(values[-1])
    trend = "increasing" if slope > 0.5 else "decreasing" if slope < -0.5 else "stable"

    return GasForecast(
        gas=gas,
        current_value=current_value,
        forecasted_values=forecasted_values,
        trend=trend,
        slope_per_month=round(float(slope), 3),
        model_confidence=0.3,
        diagnostics={"method": "linear_fallback", "n_observations": n},
    )


# ============================================================
# LSTM PREDICTION ENGINE
# ============================================================
def predict_lstm(
    dates: List[str],
    values: List[float],
    gas: str,
    forecast_months: int = 12,
    epochs: int = 100,
    lookback: int = 3,
    cross_series_list: Optional[List[np.ndarray]] = None,
    cross_series_tx_ids: Optional[List[str]] = None,
    cross_series_weights_map: Optional[Dict[str, float]] = None,
    cross_diagnostics: Optional[Dict[str, Any]] = None,
    history_rows: Optional[List[Dict[str, Any]]] = None,
    transformer_info: Optional[Dict[str, Any]] = None,
    cross_growth_rate: Optional[float] = None,
) -> GasForecast:
    """
    LSTM neural network prediction for a single gas time series.

    Uses a simple LSTM architecture suitable for small DGA datasets.
    Learns from ALL transformers when cross-series data is provided.
    Applies a narrow direction guard for moisture / BDV when the raw LSTM
    conflicts with recent oil-behaviour expectations.
    """
    if not HAS_LSTM:
        raise HTTPException(
            status_code=503,
            detail="TensorFlow not installed. Run: pip install tensorflow"
        )

    series = np.array(values, dtype=np.float32)
    current_value = float(series[-1])

    all_raw_series: List[np.ndarray] = [series.copy()]
    all_series_weights: List[float] = [2.3]

    if cross_series_list and cross_series_tx_ids and cross_series_weights_map:
        for cs, tx_id in zip(cross_series_list, cross_series_tx_ids):
            all_raw_series.append(cs)
            all_series_weights.append(cross_series_weights_map.get(tx_id, 1.0))

    processed_series: List[np.ndarray] = []
    for s in all_raw_series:
        if len(s) < 10:
            x_orig = np.linspace(0, 1, len(s))
            x_new = np.linspace(0, 1, max(20, len(s) * 3))
            processed_series.append(np.interp(x_new, x_orig, s).astype(np.float32))
        else:
            processed_series.append(s.astype(np.float32))

    all_values_flat = np.concatenate(processed_series)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaler.fit(all_values_flat.reshape(-1, 1))

    lookback = min(lookback, max(len(s) for s in processed_series) - 1)
    lookback = max(1, lookback)

    X_all, y_all, w_all = [], [], []
    for s_idx, s in enumerate(processed_series):
        scaled_s = scaler.transform(s.reshape(-1, 1))
        lb = min(lookback, len(scaled_s) - 1)
        if lb < 1:
            continue
        for i in range(lb, len(scaled_s)):
            X_all.append(scaled_s[i - lb:i, 0])
            y_all.append(scaled_s[i, 0])
            w_all.append(all_series_weights[s_idx])

    X_all = np.array(X_all)
    y_all = np.array(y_all)
    w_all = np.array(w_all, dtype=np.float32)

    if len(X_all) < 2:
        return _linear_fallback(gas, dates, values, forecast_months)

    X_all = X_all.reshape((X_all.shape[0], X_all.shape[1], 1))
    target_scaled = scaler.transform(processed_series[0].reshape(-1, 1))

    if _LSTM_BACKEND == "tensorflow":
        tf.random.set_seed(42)
        model = Sequential([
            LSTM(32, input_shape=(lookback, 1), return_sequences=True),
            Dropout(0.2),
            LSTM(16),
            Dropout(0.2),
            Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        early_stop = EarlyStopping(
            monitor="loss", patience=10, restore_best_weights=True
        )
        model.fit(
            X_all, y_all,
            sample_weight=w_all,
            epochs=epochs,
            batch_size=min(16, len(X_all)),
            verbose=0,
            callbacks=[early_stop],
        )
        _predict_fn = lambda inp: model.predict(inp, verbose=0)
    else:
        dup_X, dup_y = [], []
        for i in range(len(X_all)):
            reps = max(1, round(float(w_all[i])))
            for _ in range(reps):
                dup_X.append(X_all[i])
                dup_y.append(y_all[i])
        dup_X = np.array(dup_X)
        dup_y = np.array(dup_y)
        model = NumpyLSTMModel(lookback=lookback, seed=42)
        model.fit(dup_X, dup_y, epochs=epochs, batch_size=min(16, len(dup_X)), patience=10)
        _predict_fn = lambda inp: model.predict(inp)

    last_sequence = target_scaled[-lookback:].reshape(1, lookback, 1)
    predictions = []
    current_input = last_sequence.copy()

    for _ in range(forecast_months):
        pred = float(_predict_fn(current_input)[0, 0])
        predictions.append(pred)
        current_input = np.roll(current_input, -1, axis=1)
        current_input[0, -1, 0] = pred

    pred_values = scaler.inverse_transform(
        np.array(predictions).reshape(-1, 1)
    ).flatten()

    target_lb = min(lookback, len(target_scaled) - 1)
    X_target, y_target = [], []
    for i in range(target_lb, len(target_scaled)):
        X_target.append(target_scaled[i - target_lb:i, 0])
        y_target.append(target_scaled[i, 0])
    if X_target:
        X_target = np.array(X_target).reshape(-1, target_lb, 1)
        y_target = np.array(y_target)
    else:
        X_target = X_all[:1]
        y_target = y_all[:1]

    train_pred = _predict_fn(X_target).flatten()
    train_actual = y_target
    residual_std = float(np.std(
        scaler.inverse_transform(train_actual.reshape(-1, 1)).flatten() -
        scaler.inverse_transform(train_pred.reshape(-1, 1)).flatten()
    ))

    forecasted_values = []
    last_date = pd.to_datetime(dates[-1])
    for i in range(forecast_months):
        future_date = last_date + timedelta(days=30 * (i + 1))
        val = max(0, float(pred_values[i]))
        uncertainty = residual_std * (1 + i * 0.1)
        forecasted_values.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "value": round(val, 2),
            "lower": round(max(0, val - 1.96 * uncertainty), 2),
            "upper": round(val + 1.96 * uncertainty, 2),
        })

    if len(forecasted_values) >= 2:
        first_val = forecasted_values[0]["value"]
        last_val = forecasted_values[-1]["value"]
        change = last_val - first_val
        if change > current_value * 0.05:
            trend = "increasing"
        elif change < -current_value * 0.05:
            trend = "decreasing"
        else:
            trend = "stable"
        slope = change / forecast_months
    else:
        trend = "stable"
        slope = 0

    will_exceed = None
    months_to_exceed = None
    current_cond = get_condition(gas, current_value)
    cond_order = {"good": 0, "fair": 1, "poor": 2, "veryPoor": 3}

    for fv in forecasted_values:
        new_cond = get_condition(gas, fv["value"])
        if cond_order.get(new_cond, 0) > cond_order.get(current_cond, 0):
            will_exceed = new_cond
            months_to_exceed = fv["month"]
            break

    ss_res = np.sum((train_actual - train_pred) ** 2)
    ss_tot = np.sum((train_actual - np.mean(train_actual)) ** 2)
    r2 = max(0, 1 - ss_res / (ss_tot + 1e-10))

    diag = {
        "method": "lstm",
        "backend": _LSTM_BACKEND,
        "epochs_trained": epochs,
        "lookback": lookback,
        "interpolated": len(values) < 10,
        "original_points": len(values),
        "training_r2": round(float(r2), 4),
        "residual_std": round(residual_std, 2),
    }
    if cross_diagnostics:
        diag.update(cross_diagnostics)

    result = GasForecast(
        gas=gas,
        current_value=current_value,
        forecasted_values=forecasted_values,
        trend=trend,
        slope_per_month=round(slope, 3),
        will_exceed_limit=will_exceed,
        months_to_exceed=months_to_exceed,
        model_confidence=round(float(r2), 3),
        diagnostics=diag,
    )

    if history_rows and transformer_info and gas in {"moisture", "bdv"}:
        return _apply_lstm_direction_guard(
            gas,
            history_rows,
            transformer_info,
            forecast_months,
            result,
            cross_growth_rate,
        )

    return result


# ============================================================
# XGBOOST PREDICTION ENGINE
# ============================================================
def predict_xgboost(
    dates: List[str],
    values: List[float],
    gas: str,
    forecast_months: int = 12,
    lookback: int = 3,
    cross_X: Optional[np.ndarray] = None,
    cross_y: Optional[np.ndarray] = None,
    cross_weights: Optional[np.ndarray] = None,
    cross_diagnostics: Optional[Dict[str, Any]] = None,
) -> GasForecast:
    """
    XGBoost regression prediction for a single gas time series.

    Uses lag features (previous values) and recursive forecasting.
    Learns from ALL transformers when cross-transformer data is provided.
    """
    if not HAS_XGBOOST:
        raise HTTPException(
            status_code=503,
            detail="xgboost not installed. Run: pip install xgboost"
        )

    # Ensure chronological order
    series_pd = pd.Series(values, index=pd.to_datetime(dates)).sort_index()
    base_series = series_pd.values.astype(np.float32)
    current_value = float(base_series[-1])

    # Interpolate sparse DGA history for more stable lag training.
    if len(base_series) < 12:
        x_orig = np.linspace(0, 1, len(base_series))
        x_new = np.linspace(0, 1, max(18, len(base_series) * 3))
        train_series = np.interp(x_new, x_orig, base_series).astype(np.float32)
        interpolated = True
    else:
        train_series = base_series.copy()
        interpolated = False

    lookback = max(2, min(lookback, len(train_series) - 1))
    X, y = [], []
    for i in range(lookback, len(train_series)):
        X.append(train_series[i - lookback:i])
        y.append(train_series[i])
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    if len(X) < 3 and (cross_X is None or len(cross_X) < 3):
        return _linear_fallback(gas, dates, values, forecast_months)

    # Pool with cross-transformer data
    if cross_X is not None and len(cross_X) > 0:
        target_weights = np.full(len(X), 2.3, dtype=np.float64)  # max weight for own data
        X_combined = np.vstack([X, cross_X]) if len(X) > 0 else cross_X
        y_combined = np.concatenate([y, cross_y]) if len(y) > 0 else cross_y
        w_combined = np.concatenate([target_weights, cross_weights]) if len(X) > 0 else cross_weights
    else:
        X_combined = X
        y_combined = y
        w_combined = None

    model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X_combined, y_combined, sample_weight=w_combined)

    # In-sample diagnostics (on target transformer's data only)
    if len(X) >= 1:
        train_pred = model.predict(X)
        residual_std = float(np.std(y - train_pred))
        ss_res = float(np.sum((y - train_pred) ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = max(0.0, min(1.0, 1 - ss_res / (ss_tot + 1e-10)))
    else:
        all_pred = model.predict(X_combined)
        residual_std = float(np.std(y_combined - all_pred))
        ss_res = float(np.sum((y_combined - all_pred) ** 2))
        ss_tot = float(np.sum((y_combined - np.mean(y_combined)) ** 2))
        r2 = max(0.0, min(1.0, 1 - ss_res / (ss_tot + 1e-10)))
    confidence = max(0.0, min(1.0, r2))

    # Recursive multi-step forecast
    forecasted_values = []
    last_date = pd.to_datetime(series_pd.index[-1])
    window = train_series[-lookback:].copy()

    for i in range(forecast_months):
        pred = float(model.predict(window.reshape(1, -1))[0])
        pred = max(0.0, pred)
        uncertainty = residual_std * (1 + i * 0.12)

        future_date = last_date + timedelta(days=30 * (i + 1))
        forecasted_values.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "value": round(pred, 2),
            "lower": round(max(0.0, pred - 1.96 * uncertainty), 2),
            "upper": round(pred + 1.96 * uncertainty, 2),
        })

        window = np.roll(window, -1)
        window[-1] = pred

    # Trend analysis
    if len(forecasted_values) >= 2:
        first_val = forecasted_values[0]["value"]
        last_val = forecasted_values[-1]["value"]
        change = last_val - first_val
        if change > current_value * 0.05:
            trend = "increasing"
        elif change < -current_value * 0.05:
            trend = "decreasing"
        else:
            trend = "stable"
        slope = change / forecast_months
    else:
        trend = "stable"
        slope = 0

    # Check IEEE limit crossings
    will_exceed = None
    months_to_exceed = None
    current_cond = get_condition(gas, current_value)
    cond_order = {"good": 0, "fair": 1, "poor": 2, "veryPoor": 3}
    for fv in forecasted_values:
        new_cond = get_condition(gas, fv["value"])
        if cond_order.get(new_cond, 0) > cond_order.get(current_cond, 0):
            will_exceed = new_cond
            months_to_exceed = fv["month"]
            break

    diag = {
        "method": "xgboost",
        "lookback": lookback,
        "interpolated": interpolated,
        "original_points": len(values),
        "training_r2": round(float(r2), 4),
        "residual_std": round(residual_std, 2),
        "n_estimators": 300,
        "max_depth": 3,
        "learning_rate": 0.05,
    }
    if cross_diagnostics:
        diag.update(cross_diagnostics)

    return GasForecast(
        gas=gas,
        current_value=current_value,
        forecasted_values=forecasted_values,
        trend=trend,
        slope_per_month=round(slope, 3),
        will_exceed_limit=will_exceed,
        months_to_exceed=months_to_exceed,
        model_confidence=round(confidence, 3),
        diagnostics=diag,
    )


# ============================================================
# LIGHTGBM PREDICTION ENGINE
# ============================================================
def predict_lightgbm(
    dates: List[str],
    values: List[float],
    gas: str,
    forecast_months: int = 12,
    lookback: int = 3,
    cross_X: Optional[np.ndarray] = None,
    cross_y: Optional[np.ndarray] = None,
    cross_weights: Optional[np.ndarray] = None,
    cross_diagnostics: Optional[Dict[str, Any]] = None,
) -> GasForecast:
    """
    LightGBM regression prediction for a single gas time series.

    Uses lag features and recursive multi-step forecasting.
    Learns from ALL transformers when cross-transformer data is provided.
    """
    if not HAS_LIGHTGBM:
        raise HTTPException(
            status_code=503,
            detail="lightgbm not installed. Run: pip install lightgbm"
        )

    series_pd = pd.Series(values, index=pd.to_datetime(dates)).sort_index()
    base_series = series_pd.values.astype(np.float32)
    current_value = float(base_series[-1])

    if len(base_series) < 12:
        x_orig = np.linspace(0, 1, len(base_series))
        x_new = np.linspace(0, 1, max(18, len(base_series) * 3))
        train_series = np.interp(x_new, x_orig, base_series).astype(np.float32)
        interpolated = True
    else:
        train_series = base_series.copy()
        interpolated = False

    lookback = max(2, min(lookback, len(train_series) - 1))
    X, y = [], []
    for i in range(lookback, len(train_series)):
        X.append(train_series[i - lookback:i])
        y.append(train_series[i])
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    if len(X) < 3 and (cross_X is None or len(cross_X) < 3):
        return _linear_fallback(gas, dates, values, forecast_months)

    # Pool with cross-transformer data
    if cross_X is not None and len(cross_X) > 0:
        target_weights = np.full(len(X), 2.3, dtype=np.float64)
        X_combined = np.vstack([X, cross_X]) if len(X) > 0 else cross_X
        y_combined = np.concatenate([y, cross_y]) if len(y) > 0 else cross_y
        w_combined = np.concatenate([target_weights, cross_weights]) if len(X) > 0 else cross_weights
    else:
        X_combined = X
        y_combined = y
        w_combined = None

    model = LGBMRegressor(
        n_estimators=400,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    model.fit(X_combined, y_combined, sample_weight=w_combined)

    # In-sample diagnostics (on target transformer's data only)
    if len(X) >= 1:
        train_pred = model.predict(X)
        residual_std = float(np.std(y - train_pred))
        ss_res = float(np.sum((y - train_pred) ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = max(0.0, min(1.0, 1 - ss_res / (ss_tot + 1e-10)))
    else:
        all_pred = model.predict(X_combined)
        residual_std = float(np.std(y_combined - all_pred))
        ss_res = float(np.sum((y_combined - all_pred) ** 2))
        ss_tot = float(np.sum((y_combined - np.mean(y_combined)) ** 2))
        r2 = max(0.0, min(1.0, 1 - ss_res / (ss_tot + 1e-10)))
    confidence = max(0.0, min(1.0, r2))

    forecasted_values = []
    last_date = pd.to_datetime(series_pd.index[-1])
    window = train_series[-lookback:].copy()

    for i in range(forecast_months):
        pred = float(model.predict(window.reshape(1, -1))[0])
        pred = max(0.0, pred)
        uncertainty = residual_std * (1 + i * 0.12)

        future_date = last_date + timedelta(days=30 * (i + 1))
        forecasted_values.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "value": round(pred, 2),
            "lower": round(max(0.0, pred - 1.96 * uncertainty), 2),
            "upper": round(pred + 1.96 * uncertainty, 2),
        })

        window = np.roll(window, -1)
        window[-1] = pred

    if len(forecasted_values) >= 2:
        first_val = forecasted_values[0]["value"]
        last_val = forecasted_values[-1]["value"]
        change = last_val - first_val
        if change > current_value * 0.05:
            trend = "increasing"
        elif change < -current_value * 0.05:
            trend = "decreasing"
        else:
            trend = "stable"
        slope = change / forecast_months
    else:
        trend = "stable"
        slope = 0

    will_exceed = None
    months_to_exceed = None
    current_cond = get_condition(gas, current_value)
    cond_order = {"good": 0, "fair": 1, "poor": 2, "veryPoor": 3}
    for fv in forecasted_values:
        new_cond = get_condition(gas, fv["value"])
        if cond_order.get(new_cond, 0) > cond_order.get(current_cond, 0):
            will_exceed = new_cond
            months_to_exceed = fv["month"]
            break

    diag = {
        "method": "lightgbm",
        "lookback": lookback,
        "interpolated": interpolated,
        "original_points": len(values),
        "training_r2": round(float(r2), 4),
        "residual_std": round(residual_std, 2),
        "n_estimators": 400,
        "num_leaves": 31,
        "learning_rate": 0.05,
    }
    if cross_diagnostics:
        diag.update(cross_diagnostics)

    return GasForecast(
        gas=gas,
        current_value=current_value,
        forecasted_values=forecasted_values,
        trend=trend,
        slope_per_month=round(slope, 3),
        will_exceed_limit=will_exceed,
        months_to_exceed=months_to_exceed,
        model_confidence=round(confidence, 3),
        diagnostics=diag,
    )


# ============================================================
# RANDOM FOREST FAULT CLASSIFICATION ENGINE
# ============================================================
def predict_fault_random_forest(
    history: List[DGARecord],
    forecast_months: int = 12,
    cross_X: Optional[np.ndarray] = None,
    cross_y: Optional[np.ndarray] = None,
    cross_weights: Optional[np.ndarray] = None,
    cross_diagnostics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Predict future fault class timeline using Random Forest classifier.

    Training labels are derived from Duval Triangle class on historical records.
    Learns from ALL transformers when cross-transformer data is provided.
    """
    if not HAS_SKLEARN:
        raise HTTPException(503, "scikit-learn not installed")

    history_sorted = sorted(history, key=lambda r: r.date)
    if len(history_sorted) < 5:
        raise HTTPException(400, "Need at least 5 DGA records for fault RF prediction")

    # Build supervised training set from target transformer's historical rows.
    X_train = []
    y_train = []
    fault_history = []
    duval_points = []
    for idx, r in enumerate(history_sorted):
        gas_map = {
            "H2": r.H2, "CH4": r.CH4, "C2H2": r.C2H2, "C2H4": r.C2H4,
            "C2H6": r.C2H6, "CO": r.CO, "CO2": r.CO2,
        }
        duval_t1 = get_duval_fault(r.CH4, r.C2H4, r.C2H2)
        duval_t4 = get_duval_t4_fault(r.H2, r.CH4, r.C2H6)
        duval_t5 = get_duval_t5_fault(r.CH4, r.C2H4, r.C2H6)
        duval_p1 = get_duval_p1_fault(r.H2, r.CH4, r.C2H6, r.C2H4, r.C2H2)
        fault = duval_t1
        pent_pct = get_duval_pentagon_percentages(r.H2, r.CH4, r.C2H6, r.C2H4, r.C2H2)
        X_train.append(_build_fault_features(gas_map, idx))
        y_train.append(fault)
        fault_history.append({"date": r.date, "fault": fault})
        duval_points.append({
            "date": r.date,
            "type": "history",
            "month": 0,
            "fault": fault,
            "duval_fault": fault,
            "duval_t1": duval_t1,
            "duval_t4": duval_t4,
            "duval_t5": duval_t5,
            "duval_p1": duval_p1,
            "pH2": round(pent_pct["pH2"], 2),
            "pCH4": round(pent_pct["pCH4"], 2),
            "pC2H6": round(pent_pct["pC2H6"], 2),
            "pC2H4": round(pent_pct["pC2H4"], 2),
            "pC2H2": round(pent_pct["pC2H2"], 2),
        })

    X_train = np.array(X_train, dtype=np.float32)
    y_train = np.array(y_train)

    # Pool with cross-transformer fault training data
    if cross_X is not None and len(cross_X) > 0:
        target_weights = np.full(len(X_train), 2.3, dtype=np.float64)
        X_combined = np.vstack([X_train, cross_X])
        y_combined = np.concatenate([y_train, cross_y])
        w_combined = np.concatenate([target_weights, cross_weights])
    else:
        X_combined = X_train
        y_combined = y_train
        w_combined = None

    model = RandomForestClassifier(
        n_estimators=400,
        max_depth=8,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced_subsample",
    )
    model.fit(X_combined, y_combined, sample_weight=w_combined)

    # Forecast future gases with lightweight linear extrapolation.
    gas_future = {}
    for gas in GASES:
        gas_values = [float(getattr(r, gas)) for r in history_sorted]
        gas_future[gas] = _linear_extrapolate_values(gas_values, forecast_months)

    classes = [str(c) for c in model.classes_]
    last_date = pd.to_datetime(history_sorted[-1].date)
    fault_forecast = []
    for i in range(forecast_months):
        future_gases = {gas: float(gas_future[gas][i]) for gas in GASES}
        feature_vec = np.array([_build_fault_features(future_gases, len(history_sorted) + i)], dtype=np.float32)

        probs = model.predict_proba(feature_vec)[0]
        best_idx = int(np.argmax(probs))
        predicted_fault = classes[best_idx]
        confidence = float(probs[best_idx])
        duval_t1 = get_duval_fault(
            future_gases["CH4"],
            future_gases["C2H4"],
            future_gases["C2H2"],
        )
        duval_t4 = get_duval_t4_fault(
            future_gases["H2"],
            future_gases["CH4"],
            future_gases["C2H6"],
        )
        duval_t5 = get_duval_t5_fault(
            future_gases["CH4"],
            future_gases["C2H4"],
            future_gases["C2H6"],
        )
        duval_p1 = get_duval_p1_fault(
            future_gases["H2"],
            future_gases["CH4"],
            future_gases["C2H6"],
            future_gases["C2H4"],
            future_gases["C2H2"],
        )
        pent_pct = get_duval_pentagon_percentages(
            future_gases["H2"],
            future_gases["CH4"],
            future_gases["C2H6"],
            future_gases["C2H4"],
            future_gases["C2H2"],
        )

        # Keep top-3 probabilities for explainability.
        ranked = sorted(
            [(classes[j], float(probs[j])) for j in range(len(classes))],
            key=lambda x: x[1],
            reverse=True,
        )[:3]
        top_probs = {fault: round(prob, 4) for fault, prob in ranked}

        future_date = last_date + timedelta(days=30 * (i + 1))
        fault_forecast.append({
            "month": i + 1,
            "date": future_date.strftime("%Y-%m-%d"),
            "predicted_fault": predicted_fault,
            "confidence": round(confidence, 4),
            "top_probabilities": top_probs,
        })
        duval_points.append({
            "date": future_date.strftime("%Y-%m-%d"),
            "type": "forecast",
            "month": i + 1,
            "fault": predicted_fault,
            "duval_fault": duval_t1,
            "duval_t1": duval_t1,
            "duval_t4": duval_t4,
            "duval_t5": duval_t5,
            "duval_p1": duval_p1,
            "pH2": round(pent_pct["pH2"], 2),
            "pCH4": round(pent_pct["pCH4"], 2),
            "pC2H6": round(pent_pct["pC2H6"], 2),
            "pC2H4": round(pent_pct["pC2H4"], 2),
            "pC2H2": round(pent_pct["pC2H2"], 2),
        })

    current_fault = fault_history[-1]["fault"]
    future_faults = [f["predicted_fault"] for f in fault_forecast]
    overall_risk, risk_summary, recommendation = assess_fault_forecast_risk(current_fault, future_faults)

    feature_names = [
        "month_index", "H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2",
        "ratio_CH4_H2", "ratio_C2H2_C2H4", "ratio_C2H4_C2H6", "TDCG",
    ]
    importances = {
        name: round(float(model.feature_importances_[idx]), 4)
        for idx, name in enumerate(feature_names)
    }

    return {
        "model_type": "fault_rf",
        "current_fault": current_fault,
        "fault_history": fault_history,
        "fault_forecast": fault_forecast,
        "duval_points": duval_points,
        "overall_risk": overall_risk,
        "risk_summary": risk_summary,
        "recommendation": recommendation,
        "diagnostics": _fault_rf_diagnostics(
            model, X_train, classes, importances, cross_diagnostics,
        ),
    }


def _fault_rf_diagnostics(model, X_train, classes, importances, cross_diagnostics):
    diag = {
        "method": "random_forest_fault_classifier",
        "n_estimators": model.n_estimators,
        "n_training_samples": int(len(X_train)),
        "n_classes": int(len(classes)),
        "classes": classes,
        "feature_importance": importances,
    }
    if cross_diagnostics:
        diag.update(cross_diagnostics)
    return diag


# ============================================================
# API ENDPOINTS
# ============================================================
@app.get("/api/storage")
async def get_storage(db: Session = Depends(get_db)):
    """Return all locally stored transformers, oil-brand catalog, and DGA records."""
    sync_oil_brand_catalog(db)
    db.commit()
    transformers = db.query(TransformerDB).order_by(TransformerDB.id).all()
    results = db.query(DGAResultDB).order_by(DGAResultDB.date, DGAResultDB.id).all()
    return {
        "transformers": [serialize_transformer(t) for t in transformers],
        "results": [serialize_result(r) for r in results],
        "oilBrands": get_serialized_oil_brand_catalog(db),
    }


@app.post("/api/storage/bootstrap")
async def bootstrap_storage(req: StorageBootstrapRequest, db: Session = Depends(get_db)):
    """
    Seed database with initial data if storage is empty.
    Safe to call repeatedly; it only writes when both tables are empty.
    """
    existing_transformers = db.query(TransformerDB).count()
    existing_results = db.query(DGAResultDB).count()
    if existing_transformers > 0 or existing_results > 0:
        return {
            "seeded": False,
            "reason": "storage_not_empty",
            "transformers": existing_transformers,
            "results": existing_results,
        }

    known_ids = set()
    transformer_id_map: Dict[str, str] = {}
    reserved_transformer_ids: set[str] = set()
    for tx in req.transformers:
        normalized_oil_brand = normalize_catalog_text(tx.oilBrand)
        normalized_oil_type = normalize_catalog_text(tx.oilType)
        normalized_paper_type = normalize_catalog_text(tx.paperType) or "Not specified"
        generated_transformer_id = generate_next_transformer_id(db, reserved_ids=reserved_transformer_ids)
        reserved_transformer_ids.add(generated_transformer_id)
        transformer_id_map[tx.id] = generated_transformer_id
        known_ids.add(generated_transformer_id)
        db.add(
            TransformerDB(
                id=generated_transformer_id,
                name=tx.name,
                mnemonic=tx.mnemonic,
                serial_number=tx.serialNumber,
                brand=tx.brand,
                maker=tx.maker,
                voltage=tx.voltage,
                load_mva=float(tx.loadMVA or 0),
                site=tx.site,
                date_energized=tx.dateEnergized,
                date_manufactured=tx.dateManufactured,
                oil_brand=normalized_oil_brand,
                oil_type=normalized_oil_type,
                paper_type=normalized_paper_type,
            )
        )
        if normalized_oil_brand:
            upsert_oil_brand_catalog_entry(db, normalized_oil_brand, normalized_oil_type)

    for r in req.results:
        mapped_transformer_id = transformer_id_map.get(r.transformerId, r.transformerId)
        if mapped_transformer_id not in known_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Result {r.id or '<new>'} references unknown transformer '{r.transformerId}'",
            )
        db.add(
            DGAResultDB(
                id=r.id or f"R-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                transformer_id=mapped_transformer_id,
                date=r.date,
                H2=float(r.H2 or 0),
                CH4=float(r.CH4 or 0),
                C2H2=float(r.C2H2 or 0),
                C2H4=float(r.C2H4 or 0),
                C2H6=float(r.C2H6 or 0),
                CO=float(r.CO or 0),
                CO2=float(r.CO2 or 0),
                O2=float(r.O2 or 0),
                N2=float(r.N2 or 0),
                moisture=float(r.moisture or 0),
                bdv=float(r.bdv or 0),
                acidity=float(r.acidity or 0),
                ift=float(r.ift or 0),
                color=r.color or "",
                power_factor=float(r.powerFactor or 0),
                test_type=r.testType or "Routine",
                flash_point=float(r.flashPoint or 0),
                inhibitor=float(r.inhibitor or 0),
                passivator=float(r.passivator or 0),
                copper_corrosive=r.copperCorrosive or "",
                density=float(r.density or 0),
                dbds=float(r.dbds or 0),
                viscosity40=float(r.viscosity40 or 0),
                methanol=float(r.methanol or 0),
                pcb=float(r.pcb or 0),
                resistivity=float(r.resistivity or 0),
                specific_gravity=float(r.specificGravity or 0),
                fol2=float(r.fol2 or 0),
                hmf5=float(r.hmf5 or 0),
                fal2=float(r.fal2 or 0),
                acf2=float(r.acf2 or 0),
                mef5=float(r.mef5 or 0),
                copper_cu=float(r.copperCu or 0),
                iron_fe=float(r.ironFe or 0),
                aluminum_al=float(r.aluminumAl or 0),
                dp_from_furan=float(r.dpFromFuran or 0),
                dp_from_methanol=float(r.dpFromMethanol or 0),
                notes=r.notes or "",
            )
        )

    sync_oil_brand_catalog(db)
    db.commit()
    sync_manual_result_note_history(db)
    db.commit()
    return {
        "seeded": True,
        "transformers": len(req.transformers),
        "results": len(req.results),
        "oilBrands": get_serialized_oil_brand_catalog(db),
    }


@app.post("/api/transformers")
async def create_transformer(payload: TransformerAsset, db: Session = Depends(get_db)):
    """Create a transformer asset record."""
    generated_transformer_id = generate_next_transformer_id(db)

    normalized_oil_brand = normalize_catalog_text(payload.oilBrand)
    normalized_oil_type = normalize_catalog_text(payload.oilType)
    normalized_paper_type = normalize_catalog_text(payload.paperType) or "Not specified"
    if normalized_oil_brand:
        catalog_entry = upsert_oil_brand_catalog_entry(db, normalized_oil_brand, normalized_oil_type)
        if catalog_entry and not normalized_oil_type:
            normalized_oil_type = catalog_entry.oil_type or normalized_oil_type

    row = TransformerDB(
        id=generated_transformer_id,
        name=payload.name,
        mnemonic=payload.mnemonic,
        serial_number=payload.serialNumber,
        brand=payload.brand,
        maker=payload.maker,
        voltage=payload.voltage,
        load_mva=float(payload.loadMVA or 0),
        site=payload.site,
        date_energized=payload.dateEnergized,
        date_manufactured=payload.dateManufactured,
        oil_brand=normalized_oil_brand,
        oil_type=normalized_oil_type,
        paper_type=normalized_paper_type,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_transformer(row)


@app.put("/api/transformers/{transformer_id:path}")
async def update_transformer(transformer_id: str, payload: TransformerAsset, db: Session = Depends(get_db)):
    """Update a transformer asset record."""
    target_transformer_id = (payload.id or "").strip()
    if not target_transformer_id:
        raise HTTPException(status_code=400, detail="Transformer ID is required")

    row = db.get(TransformerDB, transformer_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Transformer '{transformer_id}' not found")

    if target_transformer_id != transformer_id:
        rename_transformer_id_references(db, transformer_id, target_transformer_id)
        row = db.get(TransformerDB, target_transformer_id)
        if not row:
            raise HTTPException(status_code=500, detail="Transformer rename failed")

    normalized_oil_brand = normalize_catalog_text(payload.oilBrand)
    normalized_oil_type = normalize_catalog_text(payload.oilType)
    normalized_paper_type = normalize_catalog_text(payload.paperType) or "Not specified"
    if normalized_oil_brand:
        catalog_entry = upsert_oil_brand_catalog_entry(db, normalized_oil_brand, normalized_oil_type)
        if catalog_entry and not normalized_oil_type:
            normalized_oil_type = catalog_entry.oil_type or normalized_oil_type

    row.name = payload.name
    row.mnemonic = payload.mnemonic
    row.serial_number = payload.serialNumber
    row.brand = payload.brand
    row.maker = payload.maker
    row.voltage = payload.voltage
    row.load_mva = float(payload.loadMVA or 0)
    row.site = payload.site
    row.date_energized = payload.dateEnergized
    row.date_manufactured = payload.dateManufactured
    row.oil_brand = normalized_oil_brand
    row.oil_type = normalized_oil_type
    row.paper_type = normalized_paper_type
    db.commit()
    updated_row = db.get(TransformerDB, target_transformer_id)
    if not updated_row:
        raise HTTPException(status_code=500, detail="Transformer update failed")
    return serialize_transformer(updated_row)


@app.delete("/api/transformers/{transformer_id:path}")
async def delete_transformer(transformer_id: str, db: Session = Depends(get_db)):
    """Delete a transformer and all its DGA records."""
    row = db.get(TransformerDB, transformer_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Transformer '{transformer_id}' not found")

    db.query(AssessmentHistoryDB).filter(AssessmentHistoryDB.transformer_id == transformer_id).delete()
    db.query(DGAResultDB).filter(DGAResultDB.transformer_id == transformer_id).delete()
    db.delete(row)
    db.commit()
    return {"deleted": transformer_id}

@app.get("/api/oil-brands")
async def list_oil_brands(db: Session = Depends(get_db)):
    sync_oil_brand_catalog(db)
    db.commit()
    return {"items": get_serialized_oil_brand_catalog(db)}


@app.post("/api/oil-brands")
async def create_oil_brand(payload: OilBrandAsset, db: Session = Depends(get_db)):
    normalized_name = normalize_catalog_text(payload.name)
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Oil brand name is required")
    if find_oil_brand_by_name(db, normalized_name):
        raise HTTPException(status_code=409, detail=f"Oil brand '{normalized_name}' already exists")

    row = upsert_oil_brand_catalog_entry(db, normalized_name, payload.oilType, payload.notes)
    db.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create oil brand")
    db.refresh(row)
    return serialize_oil_brand(row, 0)


@app.put("/api/oil-brands/{oil_brand_id}")
async def update_oil_brand(oil_brand_id: str, payload: OilBrandAsset, db: Session = Depends(get_db)):
    row = db.get(OilBrandDB, oil_brand_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Oil brand '{oil_brand_id}' not found")

    normalized_name = normalize_catalog_text(payload.name)
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Oil brand name is required")

    existing = find_oil_brand_by_name(db, normalized_name, exclude_id=oil_brand_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Oil brand '{normalized_name}' already exists")

    previous_name = row.name
    previous_name_key = normalize_catalog_key(previous_name)
    previous_oil_type = normalize_catalog_text(row.oil_type)
    normalized_oil_type = normalize_catalog_text(payload.oilType)
    row.name = normalized_name
    row.oil_type = normalized_oil_type
    row.notes = f"{payload.notes or ''}".strip()
    row.updated_at = current_timestamp()

    current_name_key = normalize_catalog_key(normalized_name)
    should_sync_linked_transformers = (
        previous_name_key != current_name_key
        or (normalized_oil_type and normalized_oil_type != previous_oil_type)
    )
    if should_sync_linked_transformers:
        for transformer in db.query(TransformerDB).all():
            transformer_brand_key = normalize_catalog_key(transformer.oil_brand)
            if transformer_brand_key not in {previous_name_key, current_name_key}:
                continue
            transformer.oil_brand = normalized_name
            if normalized_oil_type:
                transformer.oil_type = normalized_oil_type

    db.commit()
    db.refresh(row)
    linked_count = sum(
        1
        for transformer in db.query(TransformerDB).all()
        if normalize_catalog_key(transformer.oil_brand) == normalize_catalog_key(row.name)
    )
    return serialize_oil_brand(row, linked_count)


@app.delete("/api/oil-brands/{oil_brand_id}")
async def delete_oil_brand(oil_brand_id: str, db: Session = Depends(get_db)):
    row = db.get(OilBrandDB, oil_brand_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Oil brand '{oil_brand_id}' not found")

    linked_count = sum(
        1
        for transformer in db.query(TransformerDB).all()
        if normalize_catalog_key(transformer.oil_brand) == normalize_catalog_key(row.name)
    )
    if linked_count:
        raise HTTPException(
            status_code=409,
            detail=f"Oil brand '{row.name}' is assigned to {linked_count} transformer(s)",
        )

    db.delete(row)
    db.commit()
    return {"deleted": True, "id": oil_brand_id}


@app.post("/api/results")
async def create_result(payload: DGAResultAsset, db: Session = Depends(get_db)):
    """Create a DGA result record."""
    transformer = db.get(TransformerDB, payload.transformerId)
    if not transformer:
        raise HTTPException(status_code=404, detail=f"Transformer '{payload.transformerId}' not found")

    result_id = payload.id or f"R-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    existing = db.get(DGAResultDB, result_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Result '{result_id}' already exists")

    row = DGAResultDB(
        id=result_id,
        transformer_id=payload.transformerId,
        date=payload.date,
        H2=float(payload.H2 or 0),
        CH4=float(payload.CH4 or 0),
        C2H2=float(payload.C2H2 or 0),
        C2H4=float(payload.C2H4 or 0),
        C2H6=float(payload.C2H6 or 0),
        CO=float(payload.CO or 0),
        CO2=float(payload.CO2 or 0),
        O2=float(payload.O2 or 0),
        N2=float(payload.N2 or 0),
        moisture=float(payload.moisture or 0),
        bdv=float(payload.bdv or 0),
        acidity=float(payload.acidity or 0),
        ift=float(payload.ift or 0),
        color=payload.color or "",
        power_factor=float(payload.powerFactor or 0),
        test_type=payload.testType or "Routine",
        flash_point=float(payload.flashPoint or 0),
        inhibitor=float(payload.inhibitor or 0),
        passivator=float(payload.passivator or 0),
        copper_corrosive=payload.copperCorrosive or "",
        density=float(payload.density or 0),
        dbds=float(payload.dbds or 0),
        viscosity40=float(payload.viscosity40 or 0),
        methanol=float(payload.methanol or 0),
        pcb=float(payload.pcb or 0),
        resistivity=float(payload.resistivity or 0),
        specific_gravity=float(payload.specificGravity or 0),
        fol2=float(payload.fol2 or 0),
        hmf5=float(payload.hmf5 or 0),
        fal2=float(payload.fal2 or 0),
        acf2=float(payload.acf2 or 0),
        mef5=float(payload.mef5 or 0),
        copper_cu=float(payload.copperCu or 0),
        iron_fe=float(payload.ironFe or 0),
        aluminum_al=float(payload.aluminumAl or 0),
        dp_from_furan=float(payload.dpFromFuran or 0),
        dp_from_methanol=float(payload.dpFromMethanol or 0),
        notes=payload.notes or "",
    )
    db.add(row)
    sync_assessment_from_result_notes(db, row)
    db.commit()
    db.refresh(row)
    return serialize_result(row)


@app.put("/api/results/{result_id:path}")
async def update_result(result_id: str, payload: DGAResultAsset, db: Session = Depends(get_db)):
    """Update a DGA result record."""
    if payload.id and payload.id != result_id:
        raise HTTPException(status_code=400, detail="Result ID in body must match URL")

    row = db.get(DGAResultDB, result_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Result '{result_id}' not found")

    transformer = db.get(TransformerDB, payload.transformerId)
    if not transformer:
        raise HTTPException(status_code=404, detail=f"Transformer '{payload.transformerId}' not found")

    row.transformer_id = payload.transformerId
    row.date = payload.date
    row.H2 = float(payload.H2 or 0)
    row.CH4 = float(payload.CH4 or 0)
    row.C2H2 = float(payload.C2H2 or 0)
    row.C2H4 = float(payload.C2H4 or 0)
    row.C2H6 = float(payload.C2H6 or 0)
    row.CO = float(payload.CO or 0)
    row.CO2 = float(payload.CO2 or 0)
    row.O2 = float(payload.O2 or 0)
    row.N2 = float(payload.N2 or 0)
    row.moisture = float(payload.moisture or 0)
    row.bdv = float(payload.bdv or 0)
    row.acidity = float(payload.acidity or 0)
    row.ift = float(payload.ift or 0)
    row.color = payload.color or ""
    row.power_factor = float(payload.powerFactor or 0)
    row.test_type = payload.testType or "Routine"
    row.flash_point = float(payload.flashPoint or 0)
    row.inhibitor = float(payload.inhibitor or 0)
    row.passivator = float(payload.passivator or 0)
    row.copper_corrosive = payload.copperCorrosive or ""
    row.density = float(payload.density or 0)
    row.dbds = float(payload.dbds or 0)
    row.viscosity40 = float(payload.viscosity40 or 0)
    row.methanol = float(payload.methanol or 0)
    row.pcb = float(payload.pcb or 0)
    row.resistivity = float(payload.resistivity or 0)
    row.specific_gravity = float(payload.specificGravity or 0)
    row.fol2 = float(payload.fol2 or 0)
    row.hmf5 = float(payload.hmf5 or 0)
    row.fal2 = float(payload.fal2 or 0)
    row.acf2 = float(payload.acf2 or 0)
    row.mef5 = float(payload.mef5 or 0)
    row.copper_cu = float(payload.copperCu or 0)
    row.iron_fe = float(payload.ironFe or 0)
    row.aluminum_al = float(payload.aluminumAl or 0)
    row.dp_from_furan = float(payload.dpFromFuran or 0)
    row.dp_from_methanol = float(payload.dpFromMethanol or 0)
    row.notes = payload.notes or ""
    sync_assessment_from_result_notes(db, row)
    db.commit()
    db.refresh(row)
    return serialize_result(row)


@app.delete("/api/results/{result_id:path}")
async def delete_result(result_id: str, db: Session = Depends(get_db)):
    """Delete a DGA result record."""
    row = db.get(DGAResultDB, result_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Result '{result_id}' not found")

    db.query(AssessmentHistoryDB).filter(AssessmentHistoryDB.result_id == result_id).delete()
    db.delete(row)
    db.commit()
    return {"deleted": result_id}


@app.get("/api/health")
async def health():
    """Health check with ML capability status."""
    return {
        "status": "healthy",
        "capabilities": {
            "arima": HAS_ARIMA,
            "lstm": HAS_LSTM,
            "xgboost": HAS_XGBOOST,
            "lightgbm": HAS_LIGHTGBM,
            "nature_hybrid": True,
            "fault_prediction": HAS_SKLEARN,
            "clustering": HAS_SKLEARN,
            "anomaly": HAS_SKLEARN,
            "shap_similarity": HAS_SIMILARITY_SHAP,
            "ai_assessment": True,
            "assessment_history": True,
            "storage": True,
        },
        "storage": {
            "engine": "sqlite" if DATABASE_URL.startswith("sqlite") else "sqlalchemy",
            "database_url": DATABASE_URL,
        },
    }


@app.get("/api/ai/assessment-history")
async def ai_assessment_history_endpoint(transformer_id: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    return {
        "items": get_assessment_history_rows(db, transformer_id=transformer_id, limit=max(1, min(limit, 500))),
    }


@app.post("/api/ai/assessment-history")
async def create_ai_assessment_history(payload: AssessmentHistoryPayload, db: Session = Depends(get_db)):
    result_row = db.get(DGAResultDB, payload.resultId)
    if not result_row:
        raise HTTPException(status_code=404, detail=f"Result '{payload.resultId}' not found")
    if payload.transformerId and payload.transformerId != result_row.transformer_id:
        raise HTTPException(
            status_code=400,
            detail=f"Result '{payload.resultId}' belongs to transformer '{result_row.transformer_id}', not '{payload.transformerId}'",
        )

    saved = save_assessment_history_entry(
        db,
        result_row=result_row,
        assessment_text=payload.assessmentText,
        source=payload.source,
        status=payload.status,
        history_id=payload.id,
        upsert=True,
    )
    db.commit()
    db.refresh(saved["row"])
    transformer_row = db.get(TransformerDB, saved["row"].transformer_id)
    result_row = db.get(DGAResultDB, saved["row"].result_id)
    return serialize_assessment_history(saved["row"], transformer_row, result_row)


@app.post("/api/ai/assessment-history/import")
async def import_ai_assessment_history(payload: AssessmentHistoryImportPayload, db: Session = Depends(get_db)):
    created = 0
    updated = 0
    skipped = 0
    items = []
    errors = []

    for index, item in enumerate(payload.items):
        line_no = index + 1
        try:
            assessment_text = (item.assessmentText or "").strip()
            if not assessment_text:
                raise ValueError("Assessment text cannot be empty")

            result_row = resolve_assessment_result(
                db,
                result_id=item.resultId,
                transformer_id=item.transformerId,
                date=item.date,
            )
            if item.transformerId and item.transformerId != result_row.transformer_id:
                raise ValueError(
                    f"Result '{result_row.id}' belongs to transformer '{result_row.transformer_id}', not '{item.transformerId}'"
                )

            saved = save_assessment_history_entry(
                db,
                result_row=result_row,
                assessment_text=assessment_text,
                source=item.source,
                status=item.status,
                history_id=item.id,
                upsert=payload.upsert,
            )
            if saved["created"]:
                created += 1
            else:
                updated += 1

            items.append({
                "line": line_no,
                "action": "created" if saved["created"] else "updated",
                "assessmentId": saved["serialized"]["id"],
                "resultId": saved["serialized"]["resultId"],
                "transformerId": saved["serialized"]["transformerId"],
                "resultDate": saved["serialized"]["resultDate"],
            })
        except Exception as exc:
            skipped += 1
            errors.append({
                "line": line_no,
                "message": str(exc),
                "resultId": item.resultId,
                "transformerId": item.transformerId,
                "date": item.date,
            })

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total": len(payload.items),
        "items": items,
        "errors": errors,
    }


@app.put("/api/ai/assessment-history/{assessment_id:path}")
async def update_ai_assessment_history(assessment_id: str, payload: AssessmentHistoryPayload, db: Session = Depends(get_db)):
    row = db.get(AssessmentHistoryDB, assessment_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Assessment history '{assessment_id}' not found")

    row.assessment_text = payload.assessmentText or row.assessment_text
    row.source = payload.source or row.source
    row.status = payload.status or row.status
    row.updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.commit()
    db.refresh(row)

    transformer_row = db.get(TransformerDB, row.transformer_id)
    result_row = db.get(DGAResultDB, row.result_id)
    return serialize_assessment_history(row, transformer_row, result_row)


@app.get("/api/ai/summary")
async def ai_summary_endpoint(transformer_id: str, result_id: Optional[str] = None, db: Session = Depends(get_db)):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    payload = build_ai_summary(context["transformer"], context["history"])
    payload["selected_result_id"] = context["selected"].get("id")
    return payload


@app.get("/api/ai/features")
async def ai_features_endpoint(transformer_id: str, result_id: Optional[str] = None, db: Session = Depends(get_db)):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    payload = build_derived_features_payload(context["transformer"], context["history"])
    payload["latest_result_id"] = context["selected"].get("id")
    payload["selected_result_id"] = context["selected"].get("id")
    return payload


@app.get("/api/ai/similar-cases")
async def ai_similar_cases_endpoint(
    transformer_id: str,
    limit: int = 5,
    result_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    payload = find_similar_cases(
        context["transformer"],
        context["selected"],
        context["history"],
        context["training_cases"],
        build_fault_code,
        get_fault_label,
        top_k=max(1, min(limit, 200)),
        exclude_same_transformer=True,
    )
    payload["transformer_id"] = transformer_id
    payload["latest_result_id"] = context["selected"].get("id")
    payload["selected_result_id"] = context["selected"].get("id")
    return payload


@app.get("/api/ai/predict")
async def ai_predict_endpoint(transformer_id: str, result_id: Optional[str] = None, db: Session = Depends(get_db)):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    bundle = predict_fault_assessment(
        context["transformer"],
        context["selected"],
        context["history"],
        context["training_cases"],
        build_fault_code,
    )
    response = serialize_ai_prediction(bundle)
    response["transformer_id"] = transformer_id
    response["latest_result_id"] = context["selected"].get("id")
    response["selected_result_id"] = context["selected"].get("id")
    return response


@app.get("/api/ai/generate-assessment")
async def ai_generate_assessment_endpoint(transformer_id: str, result_id: Optional[str] = None, db: Session = Depends(get_db)):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    summary = build_ai_summary(context["transformer"], context["history"])
    features = build_derived_features_payload(context["transformer"], context["history"])
    similar_cases = find_similar_cases(
        context["transformer"],
        context["selected"],
        context["history"],
        context["training_cases"],
        build_fault_code,
        get_fault_label,
        top_k=3,
        exclude_same_transformer=True,
    )
    prediction_bundle = predict_fault_assessment(
        context["transformer"],
        context["selected"],
        context["history"],
        context["training_cases"],
        build_fault_code,
    )
    prediction = serialize_ai_prediction(prediction_bundle)
    draft = generate_assessment_draft(
        context["transformer"],
        summary,
        features,
        prediction,
        similar_cases,
    )
    return {
        "transformer_id": transformer_id,
        "latest_result_id": context["selected"].get("id"),
        "selected_result_id": context["selected"].get("id"),
        "prediction": prediction,
        **draft,
    }


@app.get("/api/ai/model-insights")
async def ai_model_insights_endpoint(transformer_id: str, result_id: Optional[str] = None, db: Session = Depends(get_db)):
    context = get_ai_context(transformer_id, db, result_id=result_id)
    bundle = predict_fault_assessment(
        context["transformer"],
        context["selected"],
        context["history"],
        context["training_cases"],
        build_fault_code,
    )
    insights = explain_prediction(bundle, AI_FEATURE_LABELS, top_n=6)
    return {
        "transformer_id": transformer_id,
        "latest_result_id": context["selected"].get("id"),
        "selected_result_id": context["selected"].get("id"),
        "algorithm": bundle.get("algorithm"),
        "predicted_fault": bundle.get("predicted_fault"),
        "predicted_fault_label": get_fault_label(bundle.get("predicted_fault")),
        "risk_level": bundle.get("risk_level"),
        "confidence": bundle.get("confidence"),
        "explanation_method": insights.get("method"),
        "top_contributors": insights.get("contributors", []),
        "chart_data": insights.get("chart_data", []),
        "feature_importance": bundle.get("feature_importance", []),
    }


def _history_records_to_dicts(history: List[DGARecord]) -> List[Dict[str, Any]]:
    return [record.model_dump() if hasattr(record, "model_dump") else record.dict() for record in history]



def _refresh_limit_crossing(forecast_data: Dict[str, Any]) -> Dict[str, Any]:
    gas = forecast_data.get("gas")
    if gas not in IEEE_LIMITS:
        forecast_data["will_exceed_limit"] = None
        forecast_data["months_to_exceed"] = None
        return forecast_data

    current_cond = get_condition(gas, float(forecast_data.get("current_value", 0)))
    cond_order = {"good": 0, "fair": 1, "poor": 2, "veryPoor": 3}
    will_exceed = None
    months_to_exceed = None

    for point in forecast_data.get("forecasted_values", []):
        new_cond = get_condition(gas, float(point.get("value", 0)))
        if cond_order.get(new_cond, 0) > cond_order.get(current_cond, 0):
            will_exceed = new_cond
            months_to_exceed = int(point.get("month") or 0) or None
            break

    forecast_data["will_exceed_limit"] = will_exceed
    forecast_data["months_to_exceed"] = months_to_exceed
    return forecast_data



def _finalize_base_forecast(base_forecast: GasForecast) -> GasForecast:
    return GasForecast(**_refresh_limit_crossing(base_forecast.model_dump()))


def _apply_nature_forecast(
    field: str,
    history_rows: List[Dict[str, Any]],
    transformer: Dict[str, Any],
    forecast_months: int,
    base_forecast: GasForecast,
    cross_growth_rate: Optional[float],
    base_model_name: str,
) -> GasForecast:
    forecast_payload = apply_nature_hybrid_forecast(
        field=field,
        history=history_rows,
        forecast_months=forecast_months,
        transformer=transformer,
        base_forecast=base_forecast.model_dump(),
        cross_growth_rate=cross_growth_rate,
        base_model_name=base_model_name,
    )
    return GasForecast(**_refresh_limit_crossing(forecast_payload))


def _apply_lstm_direction_guard(
    field: str,
    history_rows: List[Dict[str, Any]],
    transformer: Dict[str, Any],
    forecast_months: int,
    base_forecast: GasForecast,
    cross_growth_rate: Optional[float],
) -> GasForecast:
    if field not in {"moisture", "bdv"} or not base_forecast.forecasted_values:
        return base_forecast

    base_trend = base_forecast.trend
    base_confidence = float(base_forecast.model_confidence or 0)
    current_value = float(base_forecast.current_value or 0)
    base_last = float(base_forecast.forecasted_values[-1].get("value", current_value))
    delta_threshold = max(abs(current_value) * 0.02, 0.25 if field == "moisture" else 0.5)

    if field == "moisture":
        base_conflicts = base_last < current_value - delta_threshold
    else:
        base_conflicts = base_last > current_value + delta_threshold

    base_payload_for_guard = None if base_conflicts else base_forecast.model_dump()
    base_model_name = "lstm_direction_guard_strong" if base_conflicts else "lstm_direction_guard"
    guarded_payload = apply_nature_hybrid_forecast(
        field=field,
        history=history_rows,
        forecast_months=forecast_months,
        transformer=transformer,
        base_forecast=base_payload_for_guard,
        cross_growth_rate=cross_growth_rate,
        base_model_name=base_model_name,
    )
    guarded_trend = guarded_payload.get("trend", "stable")
    guarded_points = guarded_payload.get("forecasted_values") or []
    guarded_last = float(guarded_points[-1].get("value", current_value)) if guarded_points else current_value

    if field == "moisture":
        guarded_resolves = guarded_last >= current_value + (delta_threshold * 0.5)
    else:
        guarded_resolves = guarded_last <= current_value - (delta_threshold * 0.5)

    if not base_conflicts and guarded_trend == base_trend:
        return base_forecast
    if base_confidence >= 0.85 and not base_conflicts:
        return base_forecast
    if not base_conflicts and not guarded_resolves:
        return base_forecast

    diagnostics = dict(guarded_payload.get("diagnostics") or {})
    diagnostics.update(
        {
            "direction_guard_applied": True,
            "direction_guard_field": field,
            "direction_guard_reason": "lstm_non_gas_direction_conflict",
            "direction_guard_base_trend": base_trend,
            "direction_guard_guarded_trend": guarded_trend,
            "direction_guard_base_confidence": round(base_confidence, 3),
            "direction_guard_base_last": round(base_last, 3),
            "direction_guard_guarded_last": round(guarded_last, 3),
            "direction_guard_mode": "strong" if base_conflicts else "blend",
        }
    )
    guarded_payload["diagnostics"] = diagnostics
    guarded_payload["model_confidence"] = round(
        max(base_confidence, float(guarded_payload.get("model_confidence", 0) or 0)),
        3,
    )
    return GasForecast(**_refresh_limit_crossing(guarded_payload))


@app.post("/api/predict/nature-hybrid", response_model=PredictionResponse)
async def predict_nature_hybrid_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    Domain-aware transformer oil prediction.

    Uses a statistical base forecast for every test, then only adjusts non-gas
    oil-condition parameters with ageing rules and maintenance-event detection.
    Cross-transformer support now prioritises similar maker, brand, oil,
    paper insulation,
    voltage class, and load across all sites.
    """
    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }
    history_rows = _history_records_to_dicts(req.history)

    forecasts = {}
    for gas in req.gases:
        dates = [r.date for r in req.history]
        values = [getattr(r, gas) for r in req.history]

        if all(v == 0 for v in values):
            continue

        growth_rate = compute_weighted_growth_rate(all_series, gas, tx_info)
        cross_diag = {
            "cross_transformer_training": True,
            "total_transformers_available": len(all_series),
            "expert_rules": gas not in GASES,
            "similarity_strategy": "all sites weighted by maker, brand, oil, paper insulation, voltage class, and load similarity",
        }

        try:
            if HAS_ARIMA:
                base_forecast = predict_arima(
                    dates,
                    values,
                    gas,
                    req.forecast_months,
                    cross_growth_rate=growth_rate,
                    cross_diagnostics=cross_diag,
                )
                base_model = "arima"
            else:
                raise RuntimeError("statsmodels not installed")
        except Exception as e:
            base_forecast = _linear_fallback(gas, dates, values, req.forecast_months)
            base_forecast.diagnostics["error"] = str(e)
            base_forecast.diagnostics["method"] = "linear_fallback (nature hybrid base)"
            base_model = "linear_fallback"

        if gas in GASES:
            forecasts[gas] = _finalize_base_forecast(base_forecast)
        else:
            forecasts[gas] = _apply_nature_forecast(
                gas,
                history_rows,
                tx_info,
                req.forecast_months,
                base_forecast,
                growth_rate,
                f"{base_model}+nature_hybrid",
            )

    risk, summary, recommendation = assess_overall_risk(forecasts)
    if any(name not in GASES for name in forecasts):
        recommendation = f"{recommendation} Oil-property forecasts were adjusted with ageing rules and filtration-aware corrections."

    return PredictionResponse(
        transformer_id=req.transformer.id,
        model_type="nature_hybrid",
        forecasts=forecasts,
        overall_risk=risk,
        risk_summary=summary,
        recommendation=recommendation,
    )


@app.post("/api/predict/arima", response_model=PredictionResponse)
async def predict_arima_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    ARIMA-based DGA gas prediction.

    Learns from all transformers: augments short series using cross-transformer
    weighted-average growth rates, prioritising similar maker, brand, oil,
    paper insulation,
    voltage class, and load across all sites.
    """
    if not HAS_ARIMA:
        raise HTTPException(503, "statsmodels not installed")

    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }

    forecasts = {}
    for gas in req.gases:
        dates = [r.date for r in req.history]
        values = [getattr(r, gas) for r in req.history]

        if all(v == 0 for v in values):
            continue

        growth_rate = compute_weighted_growth_rate(all_series, gas, tx_info)
        cross_diag = {
            "cross_transformer_training": True,
            "total_transformers_available": len(all_series),
            "similarity_strategy": "all sites weighted by maker, brand, oil, paper insulation, voltage class, and load similarity",
        }

        try:
            base_forecast = predict_arima(
                dates,
                values,
                gas,
                req.forecast_months,
                cross_growth_rate=growth_rate,
                cross_diagnostics=cross_diag,
            )
        except Exception as e:
            base_forecast = _linear_fallback(gas, dates, values, req.forecast_months)
            base_forecast.diagnostics["error"] = str(e)
            base_forecast.diagnostics["method"] = "linear_fallback (arima failed)"

        forecasts[gas] = _finalize_base_forecast(base_forecast)

    risk, summary, recommendation = assess_overall_risk(forecasts)

    return PredictionResponse(
        transformer_id=req.transformer.id,
        model_type="arima",
        forecasts=forecasts,
        overall_risk=risk,
        risk_summary=summary,
        recommendation=recommendation,
    )


@app.post("/api/predict/lstm", response_model=PredictionResponse)
async def predict_lstm_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    LSTM neural network DGA gas prediction.

    Learns from all transformers: pools sequences from every transformer,
    normalises together, and weights similar maker, brand, oil, paper insulation, voltage class,
    and load higher across all sites.
    """
    if not HAS_LSTM:
        raise HTTPException(503, "TensorFlow not installed")

    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }
    history_rows = _history_records_to_dicts(req.history)

    forecasts = {}
    for gas in req.gases:
        dates = [r.date for r in req.history]
        values = [getattr(r, gas) for r in req.history]

        if all(v == 0 for v in values):
            continue

        growth_rate = compute_weighted_growth_rate(all_series, gas, tx_info)
        series_list, series_tx_ids = build_lstm_sequences(all_series, gas, lookback=3)
        filtered_series = []
        filtered_tx_ids = []
        for s, tid in zip(series_list, series_tx_ids):
            if tid != req.transformer.id:
                filtered_series.append(s)
                filtered_tx_ids.append(tid)

        weights_map: Dict[str, float] = {}
        if filtered_tx_ids:
            from ai_engine.cross_transformer_data import compute_transformer_similarity_weight

            for tid in set(filtered_tx_ids):
                entry = all_series.get(tid)
                if not entry:
                    continue
                weights_map[tid] = compute_transformer_similarity_weight(
                    tx_info,
                    entry["transformer"],
                    include_same_transformer=False,
                )

        series_weights = np.array(
            [weights_map.get(tid, 1.0) for tid in filtered_tx_ids],
            dtype=np.float64,
        ) if filtered_tx_ids else np.array([])
        cross_diag = build_cross_training_diagnostics(
            req.transformer.id,
            filtered_tx_ids,
            series_weights,
            all_series,
        )
        cross_diag["cross_transformer_series"] = len(filtered_series)

        try:
            base_forecast = predict_lstm(
                dates,
                values,
                gas,
                req.forecast_months,
                cross_series_list=filtered_series if filtered_series else None,
                cross_series_tx_ids=filtered_tx_ids if filtered_tx_ids else None,
                cross_series_weights_map=weights_map if weights_map else None,
                cross_diagnostics=cross_diag,
                history_rows=history_rows,
                transformer_info=tx_info,
                cross_growth_rate=growth_rate,
            )
        except Exception as e:
            base_forecast = _linear_fallback(gas, dates, values, req.forecast_months)
            base_forecast.diagnostics["error"] = str(e)
            base_forecast.diagnostics["method"] = "linear_fallback (lstm failed)"

        forecasts[gas] = _finalize_base_forecast(base_forecast)

    risk, summary, recommendation = assess_overall_risk(forecasts)

    return PredictionResponse(
        transformer_id=req.transformer.id,
        model_type="lstm",
        forecasts=forecasts,
        overall_risk=risk,
        risk_summary=summary,
        recommendation=recommendation,
    )


@app.post("/api/predict/xgboost", response_model=PredictionResponse)
async def predict_xgboost_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    XGBoost DGA gas prediction.

    Learns from all transformers: pools lag-feature pairs from every transformer
    and uses sample_weight to prioritise similar maker, brand, oil, paper insulation, voltage
    class, and load data across all sites.
    """
    if not HAS_XGBOOST:
        raise HTTPException(503, "xgboost not installed")

    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }

    forecasts = {}
    for gas in req.gases:
        dates = [r.date for r in req.history]
        values = [getattr(r, gas) for r in req.history]

        if all(v == 0 for v in values):
            continue

        cross_X, cross_y, tx_ids = build_gas_lag_pairs(all_series, gas, lookback=3)
        if len(tx_ids) > 0:
            mask = np.array([tid != req.transformer.id for tid in tx_ids])
            cx = cross_X[mask] if mask.any() else None
            cy = cross_y[mask] if mask.any() else None
            filtered_ids = [tid for tid, m in zip(tx_ids, mask) if m]
            cw = compute_series_weights(tx_info, filtered_ids, all_series) if filtered_ids else None
        else:
            cx, cy, cw, filtered_ids = None, None, None, []

        cross_diag = build_cross_training_diagnostics(
            req.transformer.id,
            filtered_ids,
            cw if cw is not None else np.array([]),
            all_series,
        )

        try:
            base_forecast = predict_xgboost(
                dates,
                values,
                gas,
                req.forecast_months,
                cross_X=cx,
                cross_y=cy,
                cross_weights=cw,
                cross_diagnostics=cross_diag,
            )
        except Exception as e:
            base_forecast = _linear_fallback(gas, dates, values, req.forecast_months)
            base_forecast.diagnostics["error"] = str(e)
            base_forecast.diagnostics["method"] = "linear_fallback (xgboost failed)"

        forecasts[gas] = _finalize_base_forecast(base_forecast)

    risk, summary, recommendation = assess_overall_risk(forecasts)

    return PredictionResponse(
        transformer_id=req.transformer.id,
        model_type="xgboost",
        forecasts=forecasts,
        overall_risk=risk,
        risk_summary=summary,
        recommendation=recommendation,
    )


@app.post("/api/predict/lightgbm", response_model=PredictionResponse)
async def predict_lightgbm_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    LightGBM DGA gas prediction.

    Learns from all transformers: pools lag-feature pairs from every transformer
    and uses sample_weight to prioritise similar maker, brand, oil, paper insulation, voltage
    class, and load data across all sites.
    """
    if not HAS_LIGHTGBM:
        raise HTTPException(503, "lightgbm not installed")

    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }

    forecasts = {}
    for gas in req.gases:
        dates = [r.date for r in req.history]
        values = [getattr(r, gas) for r in req.history]

        if all(v == 0 for v in values):
            continue

        cross_X, cross_y, tx_ids = build_gas_lag_pairs(all_series, gas, lookback=3)
        if len(tx_ids) > 0:
            mask = np.array([tid != req.transformer.id for tid in tx_ids])
            cx = cross_X[mask] if mask.any() else None
            cy = cross_y[mask] if mask.any() else None
            filtered_ids = [tid for tid, m in zip(tx_ids, mask) if m]
            cw = compute_series_weights(tx_info, filtered_ids, all_series) if filtered_ids else None
        else:
            cx, cy, cw, filtered_ids = None, None, None, []

        cross_diag = build_cross_training_diagnostics(
            req.transformer.id,
            filtered_ids,
            cw if cw is not None else np.array([]),
            all_series,
        )

        try:
            base_forecast = predict_lightgbm(
                dates,
                values,
                gas,
                req.forecast_months,
                cross_X=cx,
                cross_y=cy,
                cross_weights=cw,
                cross_diagnostics=cross_diag,
            )
        except Exception as e:
            base_forecast = _linear_fallback(gas, dates, values, req.forecast_months)
            base_forecast.diagnostics["error"] = str(e)
            base_forecast.diagnostics["method"] = "linear_fallback (lightgbm failed)"

        forecasts[gas] = _finalize_base_forecast(base_forecast)

    risk, summary, recommendation = assess_overall_risk(forecasts)

    return PredictionResponse(
        transformer_id=req.transformer.id,
        model_type="lightgbm",
        forecasts=forecasts,
        overall_risk=risk,
        risk_summary=summary,
        recommendation=recommendation,
    )


@app.post("/api/predict/fault-rf", response_model=FaultPredictionResponse)
async def predict_fault_rf_endpoint(req: PredictionRequest, db: Session = Depends(get_db)):
    """
    Random Forest based future fault classification.

    Learns from all transformers: pools fault-classification training data
    from every transformer and weights similar maker, brand, oil, paper insulation, voltage
    class, and load data across all sites.
    """
    all_series = fetch_all_gas_series(db)
    tx_info = {
        "id": req.transformer.id,
        "brand": req.transformer.brand,
        "maker": req.transformer.maker,
        "voltage": req.transformer.voltage,
        "loadMVA": req.transformer.loadMVA,
        "oilBrand": req.transformer.oilBrand,
        "oilType": req.transformer.oilType,
        "paperType": req.transformer.paperType,
    }

    # Build cross-transformer fault training pool
    cross_X, cross_y, tx_ids = build_fault_training_pool(
        all_series, _build_fault_features, get_duval_fault,
    )
    # Exclude target transformer's rows (they come from req.history)
    if len(tx_ids) > 0:
        mask = np.array([tid != req.transformer.id for tid in tx_ids])
        cx = cross_X[mask] if mask.any() else None
        cy = cross_y[mask] if mask.any() else None
        filtered_ids = [tid for tid, m in zip(tx_ids, mask) if m]
        cw = compute_series_weights(tx_info, filtered_ids, all_series) if filtered_ids else None
    else:
        cx, cy, cw, filtered_ids = None, None, None, []

    cross_diag = build_cross_training_diagnostics(
        req.transformer.id, filtered_ids,
        cw if cw is not None else np.array([]),
        all_series,
    )

    result = predict_fault_random_forest(
        req.history, req.forecast_months,
        cross_X=cx, cross_y=cy, cross_weights=cw,
        cross_diagnostics=cross_diag,
    )
    return FaultPredictionResponse(
        transformer_id=req.transformer.id,
        model_type="fault_rf",
        current_fault=result["current_fault"],
        fault_history=result["fault_history"],
        fault_forecast=result["fault_forecast"],
        duval_points=result.get("duval_points", []),
        overall_risk=result["overall_risk"],
        risk_summary=result["risk_summary"],
        recommendation=result["recommendation"],
        diagnostics=result["diagnostics"],
    )


@app.post("/api/cluster")
async def cluster_endpoint(req: ClusterRequest):
    """
    K-Means clustering of transformers by DGA gas patterns.

    Features used: 7 DGA gases (normalized) + age + load MVA + paper insulation type code.
    Returns cluster assignments with PCA coordinates for 2D/3D visualization.
    """
    if not HAS_SKLEARN:
        raise HTTPException(503, "scikit-learn not installed")

    # Build feature matrix
    tx_ids = []
    features = []
    for tx in req.transformers:
        if tx.id not in req.latest_results:
            continue
        r = req.latest_results[tx.id]
        age = compute_age_years(tx.dateEnergized)
        paper_type_code = encode_text_category(normalize_optional_category(tx.paperType))
        feature_vec = [
            r.H2, r.CH4, r.C2H2, r.C2H4, r.C2H6, r.CO, r.CO2,
            age, tx.loadMVA, paper_type_code
        ]
        features.append(feature_vec)
        tx_ids.append(tx.id)

    if len(features) < req.n_clusters:
        raise HTTPException(
            400,
            f"Need at least {req.n_clusters} transformers with data, got {len(features)}"
        )

    X = np.array(features)

    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # K-Means clustering
    kmeans = KMeans(n_clusters=req.n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # PCA coordinates for visualization. Use up to 3 components when possible.
    pca_components = min(3, X_scaled.shape[0], X_scaled.shape[1])
    pca = PCA(n_components=pca_components)
    coords = pca.fit_transform(X_scaled)

    # Build response
    cluster_data = []
    for i, tx_id in enumerate(tx_ids):
        cluster_data.append({
            "transformer_id": tx_id,
            "cluster": int(labels[i]),
            "pca_x": round(float(coords[i, 0]), 4) if coords.shape[1] > 0 else 0.0,
            "pca_y": round(float(coords[i, 1]), 4) if coords.shape[1] > 1 else 0.0,
            "pca_z": round(float(coords[i, 2]), 4) if coords.shape[1] > 2 else 0.0,
            "features": {
                "H2": features[i][0], "CH4": features[i][1],
                "C2H2": features[i][2], "C2H4": features[i][3],
                "C2H6": features[i][4], "CO": features[i][5],
                "CO2": features[i][6], "age": round(features[i][7], 1),
                "loadMVA": features[i][8],
                "paperTypeCode": round(features[i][9], 4),
            },
        })

    # Cluster statistics
    cluster_stats = []
    for ci in range(req.n_clusters):
        members_idx = [i for i, l in enumerate(labels) if l == ci]
        if not members_idx:
            continue
        member_features = X[members_idx]
        stat = {
            "cluster": ci,
            "count": len(members_idx),
            "centroid": {
                name: round(float(kmeans.cluster_centers_[ci][j]), 2)
                for j, name in enumerate(
                    ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2", "age", "loadMVA", "paperTypeCode"]
                )
            },
            "avg_gases": {
                name: round(float(np.mean(member_features[:, j])), 1)
                for j, name in enumerate(
                    ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2"]
                )
            },
        }
        cluster_stats.append(stat)

    return {
        "n_clusters": req.n_clusters,
        "assignments": cluster_data,
        "cluster_stats": cluster_stats,
        "pca_variance_explained": [
            round(float(v), 4) for v in pca.explained_variance_ratio_
        ],
        "inertia": round(float(kmeans.inertia_), 2),
    }


@app.post("/api/anomaly")
async def anomaly_endpoint(req: AnomalyRequest):
    """
    Anomaly detection on DGA or oil-test history using Isolation Forest.
    """
    if not HAS_SKLEARN:
        raise HTTPException(503, "scikit-learn not installed")

    feature_mode = req.mode or "dga"
    feature_keys = ANOMALY_FEATURE_SETS[feature_mode]
    def get_feature_value(record: DGARecord, key: str) -> float:
        value = float(getattr(record, key, 0) or 0)
        if key == "dpFromFuran" and value <= 0:
            fal2 = float(getattr(record, "fal2", 0) or 0)
            if fal2 > 0:
                value = max(100, min(2000, round((1.51 - np.log10(fal2)) / 0.0035)))
        elif key == "dpFromMethanol" and value <= 0:
            methanol = float(getattr(record, "methanol", 0) or 0)
            if methanol > 0:
                value = max(100, min(2000, round(1248 - (117 * np.log(methanol)))))
        return value

    features = []
    for r in req.history:
        features.append([get_feature_value(r, key) for key in feature_keys])

    X = np.array(features)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest
    iso_forest = IsolationForest(
        contamination=req.contamination,
        random_state=42,
        n_estimators=100,
    )
    predictions = iso_forest.fit_predict(X_scaled)
    scores = iso_forest.decision_function(X_scaled)

    results = []
    for i, record in enumerate(req.history):
        measurements = {
            key: round(get_feature_value(record, key), 4)
            for key in feature_keys
        }
        results.append({
            "result_id": record.id,
            "date": record.date,
            "is_anomaly": int(predictions[i]) == -1,
            "anomaly_score": round(float(scores[i]), 4),
            "measurements": measurements,
        })
        if feature_mode == "dga":
            results[-1]["gases"] = measurements

    anomalies = [r for r in results if r["is_anomaly"]]
    mode_label = ANOMALY_MODE_LABELS.get(feature_mode, "sample")

    return {
        "transformer_id": req.transformer.id,
        "mode": feature_mode,
        "feature_keys": feature_keys,
        "total_records": len(results),
        "anomalies_detected": len(anomalies),
        "contamination": req.contamination,
        "results": results,
        "anomaly_dates": [a["date"] for a in anomalies],
        "summary": (
            f"Detected {len(anomalies)} anomalous {mode_label} records "
            f"out of {len(results)} total."
            + (f" Anomalous dates: {', '.join(a['date'] for a in anomalies)}" if anomalies else "")
        ),
    }


# ============================================================
# AUTH ENDPOINTS
# ============================================================

@app.post("/api/auth/signup")
async def auth_signup(req: SignUpRequest, db: Session = Depends(get_db)):
    """Register a new user with name, email, and password."""
    ensure_superadmin_user(db)
    if not req.email or not req.password or not req.name:
        raise HTTPException(400, "Name, email, and password are required")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = db.query(UserDB).filter(UserDB.email == req.email).first()
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    user = UserDB(
        id=str(uuid4()),
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role="user",
        status="pending",
        approved_at="",
        approved_by="",
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Sign up submitted. Your account is pending superadmin approval.",
        "user": serialize_user(user),
    }


@app.post("/api/auth/login")
async def auth_login(req: SignInRequest, db: Session = Depends(get_db)):
    """Authenticate a user with email and password."""
    ensure_superadmin_user(db)
    if not req.email or not req.password:
        raise HTTPException(400, "Email and password are required")

    user = db.query(UserDB).filter(UserDB.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    user_status = (user.status or "pending").lower()
    if user_status != "approved":
        if user_status == "pending":
            raise HTTPException(403, "Your account is pending superadmin approval")
        raise HTTPException(403, "Your account is not active")

    return serialize_user(user)


@app.get("/api/auth/users")
async def auth_list_users(requester_id: str, db: Session = Depends(get_db)):
    ensure_superadmin_user(db)
    require_superadmin(db, requester_id)
    users = db.query(UserDB).order_by(UserDB.created_at.desc()).all()
    return {"items": [serialize_user(u) for u in users]}


@app.post("/api/auth/users")
async def auth_create_user_by_admin(req: UserCreateByAdminRequest, db: Session = Depends(get_db)):
    admin = require_superadmin(db, req.requester_id)
    if not req.name or not req.email or not req.password:
        raise HTTPException(400, "Name, email, and password are required")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = db.query(UserDB).filter(UserDB.email == req.email).first()
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    now = datetime.now(timezone.utc).isoformat()
    user = UserDB(
        id=str(uuid4()),
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role="user",
        status="approved",
        approved_at=now,
        approved_by=admin.name,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.put("/api/auth/users/{user_id}")
async def auth_update_user_by_admin(user_id: str, req: UserUpdateByAdminRequest, db: Session = Depends(get_db)):
    admin = require_superadmin(db, req.requester_id)
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.name == SUPERADMIN_NAME:
        raise HTTPException(400, "Superadmin account cannot be modified")

    if req.email and req.email != user.email:
        existing = db.query(UserDB).filter(UserDB.email == req.email).first()
        if existing and existing.id != user.id:
            raise HTTPException(409, "An account with this email already exists")
        user.email = req.email

    if req.name is not None:
        user.name = req.name
    if req.password:
        if len(req.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        user.password_hash = hash_password(req.password)
    if req.role in {"user", "superadmin"}:
        user.role = req.role
    if req.status in {"pending", "approved", "disabled"}:
        user.status = req.status
        if req.status == "approved":
            user.approved_at = datetime.now(timezone.utc).isoformat()
            user.approved_by = admin.name

    user.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.post("/api/auth/users/{user_id}/approve")
async def auth_approve_user(user_id: str, req: UserApproveRequest, db: Session = Depends(get_db)):
    admin = require_superadmin(db, req.requester_id)
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.status = "approved"
    user.approved_at = datetime.now(timezone.utc).isoformat()
    user.approved_by = admin.name
    user.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.delete("/api/auth/users/{user_id}")
async def auth_delete_user(user_id: str, req: UserDeleteRequest, db: Session = Depends(get_db)):
    require_superadmin(db, req.requester_id)
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.name == SUPERADMIN_NAME:
        raise HTTPException(400, "Superadmin account cannot be deleted")

    db.delete(user)
    db.commit()
    return {"ok": True}


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    import uvicorn
    print("\nTransformer DGA ML API Server")
    print("=" * 50)
    print(f"  ARIMA:      {'Available' if HAS_ARIMA else 'Not installed'}")
    print(f"  LSTM:       {'Available' if HAS_LSTM else 'Not installed'}")
    print(f"  XGBoost:    {'Available' if HAS_XGBOOST else 'Not installed'}")
    print(f"  LightGBM:   {'Available' if HAS_LIGHTGBM else 'Not installed'}")
    print(f"  Fault RF:   {'Available' if HAS_SKLEARN else 'Not installed'}")
    print(f"  Clustering: {'Available' if HAS_SKLEARN else 'Not installed'}")
    print(f"  SHAP Similarity: {'Available' if HAS_SIMILARITY_SHAP else 'Fallback proxy'}")
    print("=" * 50)
    print("\nStarting server on http://localhost:8000")
    print("API docs at http://localhost:8000/docs\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)


