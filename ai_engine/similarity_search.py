from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

from .feature_engineering import (
    build_feature_map,
    calculate_tdcg,
    normalize_optional_category,
    normalize_text,
    safe_float,
)

try:
    from sklearn.decomposition import PCA
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics.pairwise import cosine_similarity as skl_cosine_similarity
    from sklearn.metrics.pairwise import euclidean_distances
    from sklearn.preprocessing import StandardScaler

    HAS_SKLEARN = True
except Exception:
    HAS_SKLEARN = False

try:
    import shap

    HAS_SHAP = True
except Exception:
    HAS_SHAP = False


SIMILARITY_FEATURES = [
    "H2",
    "CH4",
    "C2H6",
    "C2H4",
    "C2H2",
    "CO",
    "CO2",
    "TDCG",
    "ratio_CH4_H2",
    "ratio_C2H4_C2H6",
    "ratio_C2H2_C2H4",
    "ratio_CO2_CO",
    "gas_increase_rate",
    "thermal_indicator",
    "discharge_indicator",
    "loadMVA",
    "voltageKV",
    "ageYears",
    "brandCode",
    "makerCode",
    "oilBrandCode",
    "paperTypeCode",
    "oilTypeCode",
    "samplingPointCode",
]

SIMILARITY_FEATURE_LABELS = {
    "H2": "H2",
    "CH4": "CH4",
    "C2H6": "C2H6",
    "C2H4": "C2H4",
    "C2H2": "C2H2",
    "CO": "CO",
    "CO2": "CO2",
    "TDCG": "TDCG",
    "ratio_CH4_H2": "CH4/H2 Ratio",
    "ratio_C2H4_C2H6": "C2H4/C2H6 Ratio",
    "ratio_C2H2_C2H4": "C2H2/C2H4 Ratio",
    "ratio_CO2_CO": "CO2/CO Ratio",
    "gas_increase_rate": "Gas Increase Rate",
    "thermal_indicator": "Thermal Indicator",
    "discharge_indicator": "Discharge Indicator",
    "loadMVA": "Load (MVA)",
    "voltageKV": "Voltage (kV)",
    "ageYears": "Age (Years)",
    "brandCode": "Brand",
    "makerCode": "Maker",
    "oilBrandCode": "Oil Brand",
    "paperTypeCode": "Paper Type",
    "oilTypeCode": "Oil Type",
    "samplingPointCode": "Sampling Point",
}

SIMILARITY_FEATURE_WEIGHTS = {
    "H2": 1.15,
    "CH4": 1.15,
    "C2H6": 1.05,
    "C2H4": 1.15,
    "C2H2": 1.2,
    "CO": 1.05,
    "CO2": 0.9,
    "TDCG": 1.25,
    "ratio_CH4_H2": 1.0,
    "ratio_C2H4_C2H6": 1.05,
    "ratio_C2H2_C2H4": 1.1,
    "ratio_CO2_CO": 0.95,
    "gas_increase_rate": 1.0,
    "thermal_indicator": 1.0,
    "discharge_indicator": 1.0,
    "loadMVA": 0.75,
    "voltageKV": 0.75,
    "ageYears": 0.7,
    "brandCode": 0.8,
    "makerCode": 0.8,
    "oilBrandCode": 0.95,
    "paperTypeCode": 0.9,
    "oilTypeCode": 1.1,
    "samplingPointCode": 0.85,
}


AI_BLOCK_PATTERN = re.compile(r"\[AI_ASSESSMENT_START\][\s\S]*?\[AI_ASSESSMENT_END\]", re.MULTILINE)


DGA_COMPARE_GAS_KEYS = ("H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2")

try:
    import tensorflow as tf

    HAS_TENSORFLOW = True
except Exception:
    HAS_TENSORFLOW = False

PATTERN_COMPARE_METHOD = (
    "TensorFlow log-spectrum embedding cosine similarity"
    if HAS_TENSORFLOW
    else "NumPy log-spectrum embedding cosine similarity"
)

PATTERN_CONTEXT_FIELD_WEIGHTS = {
    "brand": 0.18,
    "maker": 0.18,
    "oilBrand": 0.24,
    "oilType": 0.16,
    "paperType": 0.24,
}

PATTERN_SIMILARITY_BLEND = {
    "dga": 0.8,
    "context": 0.2,
}

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-9:
        return 0.0
    return float(np.dot(a, b) / denom)


def _euclidean_similarity(a: np.ndarray, b: np.ndarray) -> float:
    distance = float(np.linalg.norm(a - b))
    return 1.0 / (1.0 + distance)


def _scale_matrix(matrix: np.ndarray) -> Tuple[np.ndarray, str]:
    if matrix.size == 0:
        return matrix, "No scaling"
    if matrix.shape[0] < 2:
        return matrix.copy(), "Single sample (no scaling)"
    if HAS_SKLEARN:
        scaler = StandardScaler()
        return scaler.fit_transform(matrix), "Scikit-learn StandardScaler"

    means = matrix.mean(axis=0)
    stds = matrix.std(axis=0)
    stds[stds < 1e-9] = 1.0
    return (matrix - means) / stds, "NumPy Z-score"


def _score_similarity(target_vector: np.ndarray, candidate_matrix: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    if candidate_matrix.size == 0:
        empty = np.array([], dtype=float)
        return empty, empty, empty

    if HAS_SKLEARN:
        cosine_scores = skl_cosine_similarity(target_vector.reshape(1, -1), candidate_matrix).reshape(-1)
        euclidean_dist = euclidean_distances(target_vector.reshape(1, -1), candidate_matrix).reshape(-1)
        euclidean_scores = 1.0 / (1.0 + euclidean_dist)
    else:
        cosine_scores = np.array([_cosine_similarity(target_vector, row) for row in candidate_matrix], dtype=float)
        euclidean_scores = np.array([_euclidean_similarity(target_vector, row) for row in candidate_matrix], dtype=float)

    blended = np.clip((cosine_scores * 0.65) + (euclidean_scores * 0.35), 0.0, 1.0)
    return cosine_scores, euclidean_scores, blended


def _project_3d(scaled_matrix: np.ndarray) -> Tuple[np.ndarray, List[float], str]:
    if scaled_matrix.size == 0:
        return np.zeros((0, 3), dtype=float), [0.0, 0.0, 0.0], "No projection"

    sample_count, feature_count = scaled_matrix.shape
    if sample_count < 2 or feature_count < 1:
        coords = np.zeros((sample_count, 3), dtype=float)
        return coords, [0.0, 0.0, 0.0], "Insufficient samples for PCA"

    n_components = min(3, sample_count, feature_count)
    if n_components < 1:
        coords = np.zeros((sample_count, 3), dtype=float)
        return coords, [0.0, 0.0, 0.0], "Insufficient dimensions for PCA"

    if HAS_SKLEARN:
        projector = PCA(n_components=n_components)
        projected = projector.fit_transform(scaled_matrix)
        variance = [float(v) for v in projector.explained_variance_ratio_.tolist()]
        method = "Scikit-learn PCA (3D)"
    else:
        centered = scaled_matrix - scaled_matrix.mean(axis=0, keepdims=True)
        _, singular_values, vh = np.linalg.svd(centered, full_matrices=False)
        basis = vh[:n_components].T
        projected = centered @ basis
        total_variance = float(np.sum(singular_values**2)) or 1.0
        explained = (singular_values[:n_components] ** 2) / total_variance
        variance = [float(v) for v in explained.tolist()]
        method = "NumPy SVD projection (3D)"

    if projected.shape[1] < 3:
        projected = np.pad(projected, ((0, 0), (0, 3 - projected.shape[1])), mode="constant", constant_values=0.0)

    variance = (variance + [0.0, 0.0, 0.0])[:3]
    return projected[:, :3], variance, method


def _compute_real_shap_similarity_contributions(
    closeness_matrix: np.ndarray,
    similarity_scores: np.ndarray,
) -> Tuple[Optional[np.ndarray], float, str, str]:
    """
    Train a surrogate sklearn model and explain its outputs with SHAP TreeExplainer.

    Features are closeness scores per dimension (exp(-|delta_z|)).
    Target is blended similarity score in [0, 1].
    """
    sample_count = int(closeness_matrix.shape[0]) if closeness_matrix.ndim == 2 else 0
    feature_count = int(closeness_matrix.shape[1]) if closeness_matrix.ndim == 2 else 0

    if not HAS_SKLEARN or not HAS_SHAP:
        return None, 0.0, "proxy_shap_similarity", "Proxy Similarity Attribution"
    if sample_count < 4 or feature_count < 2:
        return None, 0.0, "proxy_shap_similarity", "Proxy Similarity Attribution"

    try:
        n_estimators = min(256, max(64, sample_count * 12))
        model = RandomForestRegressor(
            n_estimators=n_estimators,
            random_state=42,
            max_depth=6,
            min_samples_leaf=1,
            n_jobs=1,
        )
        model.fit(closeness_matrix, similarity_scores)

        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(closeness_matrix)
        shap_matrix = np.asarray(shap_values, dtype=float)

        if shap_matrix.ndim == 1:
            shap_matrix = shap_matrix.reshape(1, -1)
        if shap_matrix.shape[0] != sample_count and shap_matrix.shape[1] == sample_count:
            shap_matrix = shap_matrix.T
        if shap_matrix.shape != (sample_count, feature_count):
            shap_matrix = np.reshape(shap_matrix, (sample_count, feature_count))

        expected_value = explainer.expected_value
        if isinstance(expected_value, (list, tuple, np.ndarray)):
            base_value = float(np.asarray(expected_value, dtype=float).reshape(-1)[0])
        else:
            base_value = float(expected_value)

        return shap_matrix, base_value, "tree_shap_similarity", "SHAP TreeExplainer (RandomForest surrogate)"
    except Exception:
        return None, 0.0, "proxy_shap_similarity", "Proxy Similarity Attribution"


def _clean_notes(notes: str) -> str:
    return AI_BLOCK_PATTERN.sub("", notes or "").strip()


def _truncate(text: str, length: int = 220) -> str:
    normalized = " ".join((text or "").split())
    if len(normalized) <= length:
        return normalized
    return normalized[: length - 3].rstrip() + "..."


def _synthesize_assessment(record: Dict[str, Any], fault_code: str, fault_label_lookup: Callable[[str], str]) -> Dict[str, Any]:
    notes = _clean_notes((record.get("notes") or "").strip())
    if notes:
        return {
            "text": notes,
            "source": "result_notes",
            "approved": False,
            "assessment_id": None,
        }
    if fault_code in {"T1", "T2", "T3", "T2-H", "T3-H", "C", "O"}:
        text = "Thermal signature aligned with elevated hydrocarbon gases."
    elif fault_code in {"D1", "D2", "PD"}:
        text = "Discharge signature indicated by hydrogen and acetylene pattern."
    else:
        label = fault_label_lookup(fault_code)
        text = f"Historical case classified as {label}."
    return {
        "text": text,
        "source": "synthetic_summary",
        "approved": False,
        "assessment_id": None,
    }


def _assessment_from_case(case: Dict[str, Any], record: Dict[str, Any], fault_code: str, fault_label_lookup: Callable[[str], str]) -> Dict[str, Any]:
    entry = case.get("assessment_entry") or {}
    assessment_text = (entry.get("assessmentText") or "").strip()
    if assessment_text:
        return {
            "text": assessment_text,
            "source": entry.get("source") or "approved_history",
            "approved": str(entry.get("status") or "approved").lower() == "approved",
            "assessment_id": entry.get("id"),
        }
    return _synthesize_assessment(record, fault_code, fault_label_lookup)


def _round4(value: Any) -> float:
    try:
        return round(float(value), 4)
    except Exception:
        return 0.0


def _round2(value: Any) -> float:
    try:
        return round(float(value), 2)
    except Exception:
        return 0.0


def _build_gas_vector(record: Dict[str, Any]) -> np.ndarray:
    return np.array([safe_float(record.get(gas)) for gas in DGA_COMPARE_GAS_KEYS], dtype=np.float32)


def _build_pattern_signature(record: Dict[str, Any]) -> Tuple[np.ndarray, Dict[str, float]]:
    gas_vector = _build_gas_vector(record)

    if HAS_TENSORFLOW:
        spectrum = tf.convert_to_tensor(gas_vector, dtype=tf.float32)
        spectrum = tf.maximum(spectrum, 0.0)
        log_scaled = tf.math.log1p(spectrum)
        peak = tf.reduce_max(log_scaled)
        normalized = tf.where(peak > 0, log_scaled / peak, tf.zeros_like(log_scaled))
        total = tf.reduce_sum(log_scaled)
        share = tf.where(total > 0, log_scaled / total, tf.zeros_like(log_scaled))
        gradients = normalized[1:] - normalized[:-1]
        grouped_peaks = tf.stack([
            normalized[1] + normalized[2],
            normalized[3] + normalized[4],
            normalized[5] + normalized[6],
        ])
        embedding = tf.concat([normalized, share, gradients, grouped_peaks], axis=0)
        norm = tf.norm(embedding)
        embedding = tf.where(norm > 0, embedding / norm, tf.zeros_like(embedding))
        normalized_values = normalized.numpy()
        embedding_values = embedding.numpy()
    else:
        spectrum = np.clip(gas_vector, 0.0, None)
        log_scaled = np.log1p(spectrum)
        peak = float(np.max(log_scaled))
        normalized_values = (log_scaled / peak) if peak > 0 else np.zeros_like(log_scaled)
        total = float(np.sum(log_scaled))
        share = (log_scaled / total) if total > 0 else np.zeros_like(log_scaled)
        gradients = normalized_values[1:] - normalized_values[:-1]
        grouped_peaks = np.array([
            normalized_values[1] + normalized_values[2],
            normalized_values[3] + normalized_values[4],
            normalized_values[5] + normalized_values[6],
        ], dtype=np.float32)
        embedding_values = np.concatenate([normalized_values, share, gradients, grouped_peaks], axis=0)
        norm = float(np.linalg.norm(embedding_values))
        embedding_values = (embedding_values / norm) if norm > 0 else np.zeros_like(embedding_values)

    profile = {
        gas: _round4(value * 100.0)
        for gas, value in zip(DGA_COMPARE_GAS_KEYS, normalized_values)
    }
    return np.asarray(embedding_values, dtype=float), profile


def _score_pattern_similarity(target_embedding: np.ndarray, candidate_embedding: np.ndarray) -> float:
    if target_embedding.size == 0 or candidate_embedding.size == 0:
        return 0.0

    if HAS_TENSORFLOW:
        target_tensor = tf.convert_to_tensor(target_embedding, dtype=tf.float32)
        candidate_tensor = tf.convert_to_tensor(candidate_embedding, dtype=tf.float32)
        score = tf.reduce_sum(target_tensor * candidate_tensor)
        return float(np.clip(score.numpy(), 0.0, 1.0))

    return float(np.clip(np.dot(target_embedding, candidate_embedding), 0.0, 1.0))


def _first_transformer_text(transformer: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = transformer.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _score_transformer_context_similarity(
    target_transformer: Dict[str, Any],
    candidate_transformer: Dict[str, Any],
) -> Tuple[float, Dict[str, Any]]:
    details: List[Dict[str, Any]] = []
    weighted_sum = 0.0
    available_weight = 0.0

    for field, weight in PATTERN_CONTEXT_FIELD_WEIGHTS.items():
        if field == "brand":
            target_raw = _first_transformer_text(target_transformer, "brand", "tx_brand", "transformer_brand")
            candidate_raw = _first_transformer_text(candidate_transformer, "brand", "tx_brand", "transformer_brand")
            label = "Brand"
        elif field == "maker":
            target_raw = _first_transformer_text(target_transformer, "maker", "manufacturer", "oem")
            candidate_raw = _first_transformer_text(candidate_transformer, "maker", "manufacturer", "oem")
            label = "Maker"
        elif field == "oilBrand":
            target_raw = _first_transformer_text(target_transformer, "oilBrand", "oil_brand", "oilBrandUsed", "oil_brand_used")
            candidate_raw = _first_transformer_text(candidate_transformer, "oilBrand", "oil_brand", "oilBrandUsed", "oil_brand_used")
            label = "Oil Brand"
        elif field == "oilType":
            target_raw = _first_transformer_text(target_transformer, "oilType", "oil_type", "insulatingOilType")
            candidate_raw = _first_transformer_text(candidate_transformer, "oilType", "oil_type", "insulatingOilType")
            label = "Oil Type"
        else:
            target_raw = _first_transformer_text(target_transformer, "paperType", "paper_type", "insulationPaperType")
            candidate_raw = _first_transformer_text(candidate_transformer, "paperType", "paper_type", "insulationPaperType")
            label = "Paper Type"

        target_normalized = normalize_optional_category(target_raw)
        candidate_normalized = normalize_optional_category(candidate_raw)

        field_score: Optional[float] = None
        if target_normalized and candidate_normalized:
            available_weight += weight
            if target_normalized == candidate_normalized:
                field_score = 1.0
            elif target_normalized in candidate_normalized or candidate_normalized in target_normalized:
                field_score = 0.75
            else:
                field_score = 0.0
            weighted_sum += field_score * weight

        details.append({
            "field": field,
            "label": label,
            "target": target_raw or "-",
            "case": candidate_raw or "-",
            "score": _round4(field_score) if field_score is not None else None,
            "weight": round(weight * 100.0, 1),
            "matched": (field_score >= 0.75) if field_score is not None else None,
        })

    available_fields = len([item for item in details if item.get("score") is not None])
    if available_weight <= 0:
        return 0.0, {
            "fields": details,
            "available_fields": available_fields,
            "available_weight_pct": 0.0,
        }

    context_score = weighted_sum / available_weight
    return float(np.clip(context_score, 0.0, 1.0)), {
        "fields": details,
        "available_fields": available_fields,
        "available_weight_pct": round(available_weight * 100.0, 1),
    }


def _blend_pattern_similarity(
    dga_similarity_score: float,
    context_similarity_score: float,
    context_available_weight_pct: float,
) -> Tuple[float, Dict[str, float]]:
    dga_score = float(np.clip(dga_similarity_score, 0.0, 1.0))
    context_score = float(np.clip(context_similarity_score, 0.0, 1.0))

    if context_available_weight_pct <= 0:
        return dga_score, {"dga": 100.0, "context": 0.0}

    dga_weight = float(PATTERN_SIMILARITY_BLEND["dga"])
    context_weight = float(PATTERN_SIMILARITY_BLEND["context"])
    blended = (dga_score * dga_weight) + (context_score * context_weight)
    return float(np.clip(blended, 0.0, 1.0)), {
        "dga": round(dga_weight * 100.0, 1),
        "context": round(context_weight * 100.0, 1),
    }


def _build_dga_compare_payload(
    transformer: Dict[str, Any],
    record: Dict[str, Any],
    fault_code_lookup: Callable[[Dict[str, Any]], str],
    fault_label_lookup: Callable[[str], str],
    similarity: float = 100.0,
    pattern_profile: Optional[Dict[str, float]] = None,
    pattern_similarity: float = 100.0,
    pattern_similarity_detail: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    fault_code = fault_code_lookup(record)
    transformer_name = transformer.get("name") or transformer.get("mnemonic") or transformer.get("id")
    return {
        "record_id": record.get("id"),
        "date": record.get("date"),
        "transformer_id": transformer.get("id"),
        "transformer": transformer_name,
        "site": transformer.get("site"),
        "voltage": transformer.get("voltage"),
        "brand": transformer.get("brand"),
        "maker": transformer.get("maker"),
        "oilBrand": transformer.get("oilBrand"),
        "oilType": transformer.get("oilType"),
        "paperType": transformer.get("paperType"),
        "fault_code": fault_code,
        "fault": fault_label_lookup(fault_code),
        "similarity": round(float(similarity), 1),
        "pattern_similarity": round(float(pattern_similarity), 1),
        "pattern_similarity_detail": pattern_similarity_detail or {},
        "dga_values": {
            gas: _round2(safe_float(record.get(gas)))
            for gas in DGA_COMPARE_GAS_KEYS
        },
        "pattern_profile": pattern_profile or {gas: 0.0 for gas in DGA_COMPARE_GAS_KEYS},
        "tdcg": _round2(calculate_tdcg(record)),
    }

def _build_similarity_explanation(
    target_scaled: np.ndarray,
    candidate_scaled: np.ndarray,
    target_feature_map: Dict[str, Any],
    candidate_feature_map: Dict[str, Any],
    baseline_closeness: np.ndarray,
    shap_contributions: Optional[np.ndarray] = None,
    method: str = "proxy_shap_similarity",
    base_value: float = 0.0,
) -> Tuple[Dict[str, Any], np.ndarray]:
    if shap_contributions is not None:
        contributions = np.asarray(shap_contributions, dtype=float)
    else:
        weights = np.array([SIMILARITY_FEATURE_WEIGHTS.get(name, 1.0) for name in SIMILARITY_FEATURES], dtype=float)
        abs_delta = np.abs(candidate_scaled - target_scaled)
        closeness = np.exp(-abs_delta)
        contributions = weights * (closeness - baseline_closeness)

    total_abs = float(np.sum(np.abs(contributions))) or 1.0

    rows = []
    for idx, feature_name in enumerate(SIMILARITY_FEATURES):
        contribution = float(contributions[idx])
        rows.append({
            "feature": feature_name,
            "label": SIMILARITY_FEATURE_LABELS.get(feature_name, feature_name),
            "target_value": _round4(target_feature_map.get(feature_name)),
            "case_value": _round4(candidate_feature_map.get(feature_name)),
            "delta_z": _round4(candidate_scaled[idx] - target_scaled[idx]),
            "contribution": _round4(contribution),
            "direction": "increase_similarity" if contribution >= 0 else "decrease_similarity",
            "influence_pct": round((abs(contribution) / total_abs) * 100.0, 1),
        })

    supporting = [row for row in rows if row["contribution"] > 0]
    opposing = [row for row in rows if row["contribution"] < 0]
    supporting.sort(key=lambda item: item["contribution"], reverse=True)
    opposing.sort(key=lambda item: item["contribution"])

    top_supporting = supporting[:3]
    top_opposing = opposing[:2]
    summary_bits = [item["label"] for item in top_supporting[:2]]
    summary = (
        f"Closest signals: {', '.join(summary_bits)}."
        if summary_bits
        else "Closest match based on blended gas, ratio, and context profile."
    )

    payload = {
        "method": method,
        "summary": summary,
        "top_supporting": top_supporting,
        "top_opposing": top_opposing,
    }
    if method == "tree_shap_similarity":
        surrogate_similarity = float(base_value + np.sum(contributions))
        payload["base_similarity"] = _round4(base_value)
        payload["surrogate_similarity"] = _round4(np.clip(surrogate_similarity, 0.0, 1.0))

    return payload, contributions


def find_similar_cases(
    target_transformer: Dict[str, Any],
    target_record: Dict[str, Any],
    target_history: List[Dict[str, Any]],
    candidate_cases: List[Dict[str, Any]],
    fault_code_lookup: Callable[[Dict[str, Any]], str],
    fault_label_lookup: Callable[[str], str],
    top_k: int = 5,
    exclude_same_transformer: bool = False,
) -> Dict[str, Any]:
    target_pattern_embedding, target_pattern_profile = _build_pattern_signature(target_record)
    compare_pattern = {
        "method": f"{PATTERN_COMPARE_METHOD} + transformer context blend",
        "backend": "tensorflow" if HAS_TENSORFLOW else "numpy_fallback",
        "chart_profile": "log1p peak-normalized gas spectrum",
        "chart_mode_default": "pattern",
        "context_fields": ["brand", "maker", "oilBrand", "oilType", "paperType"],
        "blend_weights": {
            "dga": round(float(PATTERN_SIMILARITY_BLEND["dga"]) * 100.0, 1),
            "context": round(float(PATTERN_SIMILARITY_BLEND["context"]) * 100.0, 1),
        },
        "context_fallback": "If transformer metadata is missing, pattern score uses DGA only.",
    }
    target_context_similarity, target_context_detail = _score_transformer_context_similarity(target_transformer, target_transformer)
    target_pattern_score, target_pattern_weights = _blend_pattern_similarity(
        1.0,
        target_context_similarity,
        target_context_detail.get("available_weight_pct", 0.0),
    )
    target_case = _build_dga_compare_payload(
        target_transformer,
        target_record,
        fault_code_lookup,
        fault_label_lookup,
        similarity=100.0,
        pattern_profile=target_pattern_profile,
        pattern_similarity=target_pattern_score * 100.0,
        pattern_similarity_detail={
            "dga_similarity": 100.0,
            "context_similarity": round(target_context_similarity * 100.0, 1) if target_pattern_weights.get("context", 0.0) > 0 else None,
            "weights": target_pattern_weights,
            "context_fields": target_context_detail.get("fields", []),
            "context_available_fields": target_context_detail.get("available_fields", 0),
        },
    )

    if not candidate_cases:
        return {
            "algorithm": ["Cosine Similarity", "Euclidean Distance"],
            "cases": [],
            "plot_3d": {"points": []},
            "compare_pattern": compare_pattern,
            "target_case": target_case,
        }

    target_feature_map = build_feature_map(target_transformer, target_record, target_history)
    target_raw = np.array([target_feature_map[name] for name in SIMILARITY_FEATURES], dtype=float)

    candidate_entries: List[Dict[str, Any]] = []
    target_transformer_id = target_transformer.get("id")
    for case in candidate_cases:
        record = case.get("record") or {}
        case_transformer = case.get("transformer") or {}
        if record.get("id") == target_record.get("id"):
            continue
        if exclude_same_transformer and case_transformer.get("id") == target_transformer_id:
            continue
        feature_map = build_feature_map(case_transformer, record, case["history"])
        candidate_entries.append({
            "case": case,
            "record": record,
            "feature_map": feature_map,
            "raw_vector": np.array([feature_map[name] for name in SIMILARITY_FEATURES], dtype=float),
        })

    if not candidate_entries:
        if exclude_same_transformer:
            return find_similar_cases(
                target_transformer,
                target_record,
                target_history,
                candidate_cases,
                fault_code_lookup,
                fault_label_lookup,
                top_k=top_k,
                exclude_same_transformer=False,
            )
        return {
            "algorithm": ["Cosine Similarity", "Euclidean Distance"],
            "cases": [],
            "plot_3d": {"points": []},
            "compare_pattern": compare_pattern,
            "target_case": target_case,
        }

    raw_matrix = np.vstack([target_raw] + [entry["raw_vector"] for entry in candidate_entries])
    scaled_matrix, scaler_method = _scale_matrix(raw_matrix)
    target_scaled = scaled_matrix[0]
    candidate_scaled = scaled_matrix[1:]

    cosine_scores, euclidean_scores, blended_scores = _score_similarity(target_scaled, candidate_scaled)
    abs_deltas = np.abs(candidate_scaled - target_scaled)
    closeness_matrix = np.exp(-abs_deltas)
    baseline_closeness = closeness_matrix.mean(axis=0) if len(candidate_entries) else np.zeros(len(SIMILARITY_FEATURES), dtype=float)

    shap_matrix, shap_base_value, explainability_method, explainability_label = _compute_real_shap_similarity_contributions(
        closeness_matrix,
        blended_scores,
    )

    projected_matrix, variance_explained, projection_method = _project_3d(scaled_matrix)
    candidate_projected = projected_matrix[1:]

    scored_cases = []
    for idx, entry in enumerate(candidate_entries):
        case = entry["case"]
        record = entry["record"]
        feature_map = entry["feature_map"]

        cosine = float(cosine_scores[idx])
        euclidean = float(euclidean_scores[idx])
        similarity_score = float(blended_scores[idx])
        candidate_pattern_embedding, candidate_pattern_profile = _build_pattern_signature(record)
        dga_pattern_similarity_score = _score_pattern_similarity(target_pattern_embedding, candidate_pattern_embedding)
        context_similarity_score, context_similarity_detail = _score_transformer_context_similarity(target_transformer, case["transformer"])
        blended_pattern_similarity_score, blended_pattern_weights = _blend_pattern_similarity(
            dga_pattern_similarity_score,
            context_similarity_score,
            context_similarity_detail.get("available_weight_pct", 0.0),
        )
        pattern_similarity = blended_pattern_similarity_score * 100.0
        compare_payload = _build_dga_compare_payload(
            case["transformer"],
            record,
            fault_code_lookup,
            fault_label_lookup,
            similarity=similarity_score * 100.0,
            pattern_profile=candidate_pattern_profile,
            pattern_similarity=pattern_similarity,
            pattern_similarity_detail={
                "dga_similarity": round(dga_pattern_similarity_score * 100.0, 1),
                "context_similarity": round(context_similarity_score * 100.0, 1) if blended_pattern_weights.get("context", 0.0) > 0 else None,
                "weights": blended_pattern_weights,
                "context_fields": context_similarity_detail.get("fields", []),
                "context_available_fields": context_similarity_detail.get("available_fields", 0),
            },
        )
        fault_code = compare_payload["fault_code"]
        assessment = _assessment_from_case(case, record, fault_code, fault_label_lookup)

        case_shap = None
        if shap_matrix is not None and idx < shap_matrix.shape[0]:
            case_shap = shap_matrix[idx]

        explanation, contribution_vector = _build_similarity_explanation(
            target_scaled,
            candidate_scaled[idx],
            target_feature_map,
            feature_map,
            baseline_closeness,
            shap_contributions=case_shap,
            method=explainability_method,
            base_value=shap_base_value,
        )

        projected = candidate_projected[idx] if idx < len(candidate_projected) else np.array([0.0, 0.0, 0.0], dtype=float)

        scored_cases.append({
            **compare_payload,
            "assessment": _truncate(assessment["text"]),
            "assessment_full": assessment["text"],
            "assessment_source": assessment["source"],
            "assessment_id": assessment["assessment_id"],
            "has_approved_assessment": assessment["approved"],
            "similarity_reason": explanation["summary"],
            "explanation": explanation,
            "plot3d": {
                "x": _round4(projected[0]),
                "y": _round4(projected[1]),
                "z": _round4(projected[2]),
            },
            "metrics": {
                "cosine": round(cosine, 4),
                "euclidean_similarity": round(euclidean, 4),
            },
            "_contributions": contribution_vector,
            "_tdcg": _round2(feature_map.get("TDCG")),
            "_age_years": _round2(feature_map.get("ageYears")),
            "_load_mva": _round2(feature_map.get("loadMVA")),
        })

    scored_cases.sort(key=lambda item: (-item["similarity"], not item["has_approved_assessment"], item["date"] or "", item["transformer"]))

    cross_transformer_cases = [
        item for item in scored_cases
        if item.get("transformer_id") != target_transformer_id
    ]
    retrieval_pool = cross_transformer_cases if (exclude_same_transformer and cross_transformer_cases) else scored_cases
    top_cases = retrieval_pool[:top_k]

    for rank, item in enumerate(scored_cases, start=1):
        item["rank"] = rank
        item["retrieved"] = False

    for rank, item in enumerate(top_cases, start=1):
        item["retrieval_rank"] = rank
        item["retrieved"] = True

    if top_cases:
        aggregate = np.mean(np.vstack([np.abs(item["_contributions"]) for item in top_cases]), axis=0)
    else:
        aggregate = np.zeros(len(SIMILARITY_FEATURES), dtype=float)

    aggregate_total = float(np.sum(aggregate)) or 1.0
    top_features_idx = np.argsort(-aggregate)[:5]
    explainability_top_features = [{
        "feature": SIMILARITY_FEATURES[idx],
        "label": SIMILARITY_FEATURE_LABELS.get(SIMILARITY_FEATURES[idx], SIMILARITY_FEATURES[idx]),
        "influence_pct": round((float(aggregate[idx]) / aggregate_total) * 100.0, 1),
    } for idx in top_features_idx if float(aggregate[idx]) > 0]

    target_fault_code = target_case["fault_code"]
    plot_limit = min(max(top_k * 6, 24), len(scored_cases))
    plot_cases = scored_cases[:plot_limit]

    fault_codes = sorted({target_fault_code, *[item["fault_code"] for item in plot_cases]})
    fault_cluster_map = {code: idx for idx, code in enumerate(fault_codes)}

    target_projection = projected_matrix[0] if len(projected_matrix) else np.array([0.0, 0.0, 0.0], dtype=float)
    target_name = target_case["transformer"]
    plot_points = [{
        "id": f"target::{target_record.get('id')}",
        "record_id": target_record.get("id"),
        "transformer_id": target_transformer.get("id"),
        "name": target_name,
        "transformer": target_name,
        "site": target_transformer.get("site"),
        "oilBrand": target_transformer.get("oilBrand"),
        "oilType": target_transformer.get("oilType"),
        "paperType": target_transformer.get("paperType"),
        "voltage": target_transformer.get("voltage"),
        "loadMVA": _round2(target_feature_map.get("loadMVA")),
        "age": _round2(target_feature_map.get("ageYears")),
        "tdcg": _round2(target_feature_map.get("TDCG")),
        "fault_code": target_fault_code,
        "fault": target_case["fault"],
        "cluster": fault_cluster_map.get(target_fault_code, 0),
        "role": "target",
        "retrieved": True,
        "similarity": 100.0,
        "x": _round4(target_projection[0]),
        "y": _round4(target_projection[1]),
        "z": _round4(target_projection[2]),
    }]

    for item in plot_cases:
        plot_points.append({
            "id": item["record_id"],
            "record_id": item["record_id"],
            "transformer_id": item["transformer_id"],
            "name": item["transformer"],
            "transformer": item["transformer"],
            "site": item.get("site"),
            "oilBrand": item.get("oilBrand"),
            "oilType": item.get("oilType"),
            "paperType": item.get("paperType"),
            "voltage": item.get("voltage"),
            "loadMVA": item.get("_load_mva", 0.0),
            "age": item.get("_age_years", 0.0),
            "tdcg": item.get("_tdcg", 0.0),
            "fault_code": item["fault_code"],
            "fault": item["fault"],
            "cluster": fault_cluster_map.get(item["fault_code"], 0),
            "role": "case",
            "retrieved": bool(item.get("retrieved")),
            "similarity": item["similarity"],
            "x": item["plot3d"]["x"],
            "y": item["plot3d"]["y"],
            "z": item["plot3d"]["z"],
        })

    for item in scored_cases:
        item.pop("_contributions", None)
        item.pop("_tdcg", None)
        item.pop("_age_years", None)
        item.pop("_load_mva", None)

    return {
        "algorithm": [
            scaler_method,
            "Cosine Similarity",
            "Euclidean Distance",
            explainability_label,
        ],
        "explainability": {
            "method": explainability_method,
            "backend": "shap" if explainability_method == "tree_shap_similarity" else "fallback_proxy",
            "base_similarity": _round4(shap_base_value) if explainability_method == "tree_shap_similarity" else None,
            "selection_policy": "cross_transformer_only" if exclude_same_transformer else "all_transformers",
            "top_features": explainability_top_features,
        },
        "plot_3d": {
            "title": "Similar Cases - 3D PCA Projection",
            "method": projection_method,
            "axes": [
                {"key": "x", "label": "PC1", "variance": round(float(variance_explained[0]), 4)},
                {"key": "y", "label": "PC2", "variance": round(float(variance_explained[1]), 4)},
                {"key": "z", "label": "PC3", "variance": round(float(variance_explained[2]), 4)},
            ],
            "variance_explained": [round(float(v), 4) for v in variance_explained],
            "points": plot_points,
            "target_record_id": target_record.get("id"),
            "cluster_by": "fault_code",
            "hull": {
                "enabled": True,
                "minimum_points_per_cluster": 4,
            },
        },
        "compare_pattern": compare_pattern,
        "target_case": target_case,
        "cases": top_cases,
    }
