"""
Cross-transformer data helpers.

Fetches DGA data from ALL transformers in the database and builds pooled
training sets so that prediction models can learn from the entire dataset,
not just one transformer's history.  Same-transformer and same-oil-brand
rows receive higher sample weights.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GASES = ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2"]

# Weight boosts (mirrors ai_engine/xgboost_model._build_case_weights)
_W_SAME_TX = 0.65
_W_SAME_OIL_BRAND = 0.45
_W_SAME_OIL_TYPE = 0.20
_W_SAME_PAPER_TYPE = 0.30


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def _normalize_category(value: Any) -> str:
    normalized = _normalize_text(value)
    if normalized in {"", "-", "n a", "na", "not specified", "not available", "none", "unknown", "unspecified"}:
        return ""
    return normalized


_W_SAME_BRAND = 0.30
_W_SAME_MAKER = 0.25
_W_SAME_VOLTAGE_CLASS = 0.25
_W_SIMILAR_LOAD = 0.30


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0



def _extract_voltage_kv(transformer: Dict[str, Any]) -> float:
    try:
        from ai_engine.feature_engineering import voltage_to_kv

        return float(voltage_to_kv(transformer.get("voltage")))
    except Exception:
        return 0.0



def _compute_load_match_score(target_load: float, candidate_load: float) -> float:
    if target_load <= 0 or candidate_load <= 0:
        return 0.0

    diff_ratio = abs(candidate_load - target_load) / max(target_load, candidate_load, 1.0)
    if diff_ratio <= 0.10:
        return 1.0
    if diff_ratio <= 0.20:
        return 0.75
    if diff_ratio <= 0.35:
        return 0.4
    return 0.0



def describe_transformer_similarity(
    target_transformer: Dict[str, Any],
    candidate_transformer: Dict[str, Any],
) -> Dict[str, Any]:
    target_brand = _normalize_category(target_transformer.get("brand"))
    candidate_brand = _normalize_category(candidate_transformer.get("brand"))
    target_maker = _normalize_category(target_transformer.get("maker"))
    candidate_maker = _normalize_category(candidate_transformer.get("maker"))
    target_oil_brand = _normalize_category(target_transformer.get("oilBrand"))
    candidate_oil_brand = _normalize_category(candidate_transformer.get("oilBrand"))
    target_oil_type = _normalize_category(target_transformer.get("oilType"))
    candidate_oil_type = _normalize_category(candidate_transformer.get("oilType"))
    target_paper_type = _normalize_category(target_transformer.get("paperType"))
    candidate_paper_type = _normalize_category(candidate_transformer.get("paperType"))

    target_voltage_kv = _extract_voltage_kv(target_transformer)
    candidate_voltage_kv = _extract_voltage_kv(candidate_transformer)
    same_voltage_class = False
    if target_voltage_kv > 0 and candidate_voltage_kv > 0:
        same_voltage_class = abs(candidate_voltage_kv - target_voltage_kv) <= max(5.0, target_voltage_kv * 0.10)

    load_match_score = _compute_load_match_score(
        _safe_float(target_transformer.get("loadMVA")),
        _safe_float(candidate_transformer.get("loadMVA")),
    )

    return {
        "same_brand": bool(target_brand and candidate_brand == target_brand),
        "same_maker": bool(target_maker and candidate_maker == target_maker),
        "same_oil_brand": bool(target_oil_brand and candidate_oil_brand == target_oil_brand),
        "same_oil_type": bool(target_oil_type and candidate_oil_type == target_oil_type),
        "same_paper_type": bool(target_paper_type and candidate_paper_type == target_paper_type),
        "same_voltage_class": same_voltage_class,
        "load_match_score": load_match_score,
    }



def compute_transformer_similarity_weight(
    target_transformer: Dict[str, Any],
    candidate_transformer: Dict[str, Any],
    include_same_transformer: bool = True,
) -> float:
    similarity = describe_transformer_similarity(target_transformer, candidate_transformer)
    weight = 1.0

    target_id = str(target_transformer.get("id") or "").strip()
    candidate_id = str(candidate_transformer.get("id") or "").strip()
    if include_same_transformer and target_id and candidate_id == target_id:
        weight += _W_SAME_TX
    if similarity["same_brand"]:
        weight += _W_SAME_BRAND
    if similarity["same_maker"]:
        weight += _W_SAME_MAKER
    if similarity["same_oil_brand"]:
        weight += _W_SAME_OIL_BRAND
    if similarity["same_oil_type"]:
        weight += _W_SAME_OIL_TYPE
    if similarity["same_paper_type"]:
        weight += _W_SAME_PAPER_TYPE
    if similarity["same_voltage_class"]:
        weight += _W_SAME_VOLTAGE_CLASS
    weight += _W_SIMILAR_LOAD * similarity["load_match_score"]
    return weight


# ---------------------------------------------------------------------------
# 1. Fetch all gas series from DB
# ---------------------------------------------------------------------------

def fetch_all_gas_series(db) -> Dict[str, Dict[str, Any]]:
    """
    Query all transformers and their DGA results, grouped by transformer_id.

    Returns::

        {
            "t001": {
                "transformer": {"id": ..., "oilBrand": ..., "oilType": ..., ...},
                "records": [
                    {"date": "2024-01-15", "H2": 45.0, "CH4": 12.0, ...},
                    ...
                ],
            },
            ...
        }

    Imports DB models lazily to avoid circular imports.
    """
    # Late import to avoid circular dependency (main -> ai_engine -> main)
    from main import TransformerDB, DGAResultDB, serialize_transformer, serialize_result

    transformer_rows = db.query(TransformerDB).order_by(TransformerDB.id).all()
    tx_map: Dict[str, Dict[str, Any]] = {}
    for row in transformer_rows:
        tx_map[row.id] = {
            "transformer": serialize_transformer(row),
            "records": [],
        }

    result_rows = (
        db.query(DGAResultDB)
        .order_by(DGAResultDB.transformer_id, DGAResultDB.date, DGAResultDB.id)
        .all()
    )
    for row in result_rows:
        entry = tx_map.get(row.transformer_id)
        if entry is None:
            continue
        entry["records"].append(serialize_result(row))

    return tx_map


# ---------------------------------------------------------------------------
# 2. Build lag-feature pairs from all transformers for one gas
# ---------------------------------------------------------------------------

def build_gas_lag_pairs(
    all_series: Dict[str, Dict[str, Any]],
    gas: str,
    lookback: int = 3,
    interpolate_threshold: int = 12,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Build lag-feature training pairs from every transformer's gas history.

    Each transformer's series is processed independently (no cross-transformer
    windows).  Short series (< *interpolate_threshold* records) are linearly
    interpolated to give more training pairs, matching existing XGBoost /
    LightGBM behaviour.

    Returns
    -------
    X : ndarray, shape (N, lookback)
        Lag feature matrix.
    y : ndarray, shape (N,)
        Target values.
    tx_ids : list[str]
        Transformer id for each row (used to compute weights).
    """
    X_parts: List[np.ndarray] = []
    y_parts: List[np.ndarray] = []
    tx_ids: List[str] = []

    for tx_id, entry in all_series.items():
        values = [float(r.get(gas, 0)) for r in entry["records"]]
        if len(values) < lookback + 1:
            continue
        if all(v == 0 for v in values):
            continue

        series = np.array(values, dtype=np.float32)

        # Interpolate short series (same logic as predict_xgboost / predict_lightgbm)
        if len(series) < interpolate_threshold:
            x_orig = np.linspace(0, 1, len(series))
            x_new = np.linspace(0, 1, max(18, len(series) * 3))
            series = np.interp(x_new, x_orig, series).astype(np.float32)

        lb = max(2, min(lookback, len(series) - 1))
        for i in range(lb, len(series)):
            X_parts.append(series[i - lb : i])
            y_parts.append(series[i])
            tx_ids.append(tx_id)

    if not X_parts:
        return np.empty((0, lookback)), np.empty((0,)), []

    return np.array(X_parts, dtype=np.float32), np.array(y_parts, dtype=np.float32), tx_ids


# ---------------------------------------------------------------------------
# 3. Compute per-row sample weights
# ---------------------------------------------------------------------------

def compute_series_weights(
    target_transformer: Dict[str, Any],
    tx_ids: List[str],
    all_series: Dict[str, Dict[str, Any]],
) -> np.ndarray:
    """
    Assign sample weights for pooled training rows.

    All transformers across the fleet can contribute, but rows from transformers
    with matching brand, maker, oil, voltage class, and load profile receive
    higher weight.
    """
    weights = np.ones(len(tx_ids), dtype=np.float64)
    for idx, tx_id in enumerate(tx_ids):
        entry = all_series.get(tx_id)
        if entry is None:
            continue
        weights[idx] = compute_transformer_similarity_weight(
            target_transformer,
            entry["transformer"],
        )

    return weights


# ---------------------------------------------------------------------------
# 4. Build fault-classification training pool from all transformers
# ---------------------------------------------------------------------------

def build_fault_training_pool(
    all_series: Dict[str, Dict[str, Any]],
    build_fault_features_fn,
    get_duval_fault_fn,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Build fault-classification feature vectors + Duval Triangle labels
    from ALL transformers.

    Parameters
    ----------
    all_series : dict
        Output of ``fetch_all_gas_series``.
    build_fault_features_fn : callable
        ``_build_fault_features(gas_map, month_index) -> list[float]``
    get_duval_fault_fn : callable
        ``get_duval_fault(CH4, C2H4, C2H2) -> str``

    Returns
    -------
    X : ndarray
    y : ndarray of str
    tx_ids : list[str]
    """
    X_parts: List[List[float]] = []
    y_parts: List[str] = []
    tx_ids: List[str] = []

    for tx_id, entry in all_series.items():
        records = entry["records"]
        for idx, r in enumerate(records):
            gas_map = {
                "H2": float(r.get("H2", 0)),
                "CH4": float(r.get("CH4", 0)),
                "C2H2": float(r.get("C2H2", 0)),
                "C2H4": float(r.get("C2H4", 0)),
                "C2H6": float(r.get("C2H6", 0)),
                "CO": float(r.get("CO", 0)),
                "CO2": float(r.get("CO2", 0)),
            }
            fault = get_duval_fault_fn(
                float(r.get("CH4", 0)),
                float(r.get("C2H4", 0)),
                float(r.get("C2H2", 0)),
            )
            if not fault:
                continue
            X_parts.append(build_fault_features_fn(gas_map, idx))
            y_parts.append(fault)
            tx_ids.append(tx_id)

    if not X_parts:
        return np.empty((0, 12)), np.array([]), []

    return (
        np.array(X_parts, dtype=np.float32),
        np.array(y_parts),
        tx_ids,
    )


# ---------------------------------------------------------------------------
# 5. Weighted average growth rate for ARIMA augmentation
# ---------------------------------------------------------------------------

def compute_weighted_growth_rate(
    all_series: Dict[str, Dict[str, Any]],
    gas: str,
    target_transformer: Dict[str, Any],
) -> Optional[float]:
    """
    Compute the weighted-average per-step growth rate for *gas* across all
    transformers (excluding target). Used to augment short ARIMA series.

    Returns ``None`` if no usable cross-transformer data exists.
    """
    target_id = str(target_transformer.get("id") or "").strip()

    rates: List[float] = []
    weights: List[float] = []

    for tx_id, entry in all_series.items():
        if tx_id == target_id:
            continue
        values = [float(r.get(gas, 0)) for r in entry["records"]]
        if len(values) < 2:
            continue
        if all(v == 0 for v in values):
            continue

        diffs = [values[i + 1] - values[i] for i in range(len(values) - 1)]
        avg_rate = sum(diffs) / len(diffs)

        rates.append(avg_rate)
        weights.append(
            compute_transformer_similarity_weight(
                target_transformer,
                entry["transformer"],
                include_same_transformer=False,
            )
        )

    if not rates:
        return None

    w_arr = np.array(weights, dtype=np.float64)
    r_arr = np.array(rates, dtype=np.float64)
    return float(np.average(r_arr, weights=w_arr))


# ---------------------------------------------------------------------------
# 6. Build LSTM sequences from all transformers
# ---------------------------------------------------------------------------

def build_lstm_sequences(
    all_series: Dict[str, Dict[str, Any]],
    gas: str,
    lookback: int = 3,
) -> Tuple[List[np.ndarray], List[str]]:
    """
    Collect raw gas value arrays from every transformer (for LSTM pooling).

    Returns a list of 1-D arrays (one per transformer with enough data)
    and the corresponding transformer ids.
    """
    series_list: List[np.ndarray] = []
    tx_ids: List[str] = []

    for tx_id, entry in all_series.items():
        values = [float(r.get(gas, 0)) for r in entry["records"]]
        if len(values) < lookback + 1:
            continue
        if all(v == 0 for v in values):
            continue
        series_list.append(np.array(values, dtype=np.float32))
        tx_ids.append(tx_id)

    return series_list, tx_ids


# ---------------------------------------------------------------------------
# 7. Diagnostics
# ---------------------------------------------------------------------------

def build_cross_training_diagnostics(
    target_id: str,
    tx_ids: List[str],
    weights: np.ndarray,
    all_series: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Summary dict appended to each model's diagnostics."""
    unique_tx = {tx_id for tx_id in tx_ids if tx_id}
    target_count = sum(1 for t in tx_ids if t == target_id)
    diagnostics = {
        "cross_transformer_training": True,
        "similarity_strategy": "all sites weighted by maker, brand, oil, voltage class, and load similarity",
        "total_transformers_used": len(unique_tx),
        "total_training_samples": len(tx_ids),
        "target_transformer_samples": target_count,
        "weight_distribution": {
            "min": round(float(weights.min()), 2) if len(weights) else 0,
            "max": round(float(weights.max()), 2) if len(weights) else 0,
            "mean": round(float(weights.mean()), 2) if len(weights) else 0,
        },
    }

    target_entry = all_series.get(target_id)
    if not target_entry:
        return diagnostics

    target_transformer = target_entry["transformer"]
    candidate_transformers = [
        all_series[tx_id]["transformer"]
        for tx_id in unique_tx
        if tx_id in all_series and tx_id != target_id
    ]
    if not candidate_transformers:
        return diagnostics

    similarity_summary = {
        "same_brand": 0,
        "same_maker": 0,
        "same_oil_brand": 0,
        "same_oil_type": 0,
        "same_paper_type": 0,
        "same_voltage_class": 0,
        "close_load_match": 0,
        "avg_load_match_score": 0.0,
    }
    load_scores: List[float] = []
    for transformer in candidate_transformers:
        similarity = describe_transformer_similarity(target_transformer, transformer)
        if similarity["same_brand"]:
            similarity_summary["same_brand"] += 1
        if similarity["same_maker"]:
            similarity_summary["same_maker"] += 1
        if similarity["same_oil_brand"]:
            similarity_summary["same_oil_brand"] += 1
        if similarity["same_oil_type"]:
            similarity_summary["same_oil_type"] += 1
        if similarity["same_paper_type"]:
            similarity_summary["same_paper_type"] += 1
        if similarity["same_voltage_class"]:
            similarity_summary["same_voltage_class"] += 1
        if similarity["load_match_score"] >= 0.75:
            similarity_summary["close_load_match"] += 1
        load_scores.append(similarity["load_match_score"])

    similarity_summary["avg_load_match_score"] = round(float(np.mean(load_scores)), 2) if load_scores else 0.0
    diagnostics["similarity_matches"] = similarity_summary
    return diagnostics
