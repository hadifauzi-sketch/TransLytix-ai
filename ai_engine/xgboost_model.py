from __future__ import annotations

from typing import Any, Callable, Dict, List

import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder

    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    from xgboost import XGBClassifier

    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False

from .feature_engineering import (
    MODEL_FEATURE_ORDER,
    build_feature_map,
    calculate_tdcg,
    normalize_optional_category,
    normalize_text,
)


FAULT_RISK_LEVELS = {
    "N": "Low",
    "ND": "Low",
    "PD": "Moderate",
    "T1": "Moderate",
    "S": "Moderate",
    "O": "Moderate",
    "D1": "High",
    "T2": "High",
    "T2-H": "High",
    "T2-C": "High",
    "C": "High",
    "DT": "High",
    "D2": "Critical",
    "T3": "Critical",
    "T3-H": "Critical",
}

FEATURE_LABELS = {
    "H2": "Hydrogen",
    "CH4": "Methane",
    "C2H6": "Ethane",
    "C2H4": "Ethylene",
    "C2H2": "Acetylene",
    "CO": "Carbon Monoxide",
    "CO2": "Carbon Dioxide",
    "TDCG": "TDCG",
    "ratio_CH4_H2": "CH4 / H2",
    "ratio_C2H4_C2H6": "C2H4 / C2H6",
    "ratio_C2H2_C2H4": "C2H2 / C2H4",
    "ratio_CO2_CO": "CO2 / CO",
    "gas_increase_rate": "Gas Increase Rate",
    "thermal_indicator": "Thermal Indicator",
    "discharge_indicator": "Discharge Indicator",
    "loadMVA": "Load MVA",
    "voltageKV": "Voltage",
    "ageYears": "Age",
    "brandCode": "Brand",
    "makerCode": "Maker",
    "oilBrandCode": "Oil Brand",
    "paperTypeCode": "Paper Type",
    "oilTypeCode": "Oil Type",
    "samplingPointCode": "Sampling Point",
}


def _build_feature_matrix(cases: List[Dict[str, Any]]) -> tuple[np.ndarray, List[Dict[str, float]]]:
    feature_maps = [build_feature_map(case["transformer"], case["record"], case["history"]) for case in cases]
    matrix = np.array(
        [[feature_map[name] for name in MODEL_FEATURE_ORDER] for feature_map in feature_maps],
        dtype=float,
    )
    return matrix, feature_maps


def _build_case_weights(target_transformer: Dict[str, Any], cases: List[Dict[str, Any]]) -> np.ndarray:
    target_transformer_id = str(target_transformer.get("id") or "").strip()
    target_oil_brand = normalize_text(target_transformer.get("oilBrand"))
    target_oil_type = normalize_text(target_transformer.get("oilType"))
    target_paper_type = normalize_optional_category(target_transformer.get("paperType"))
    weights = []
    for case in cases:
        case_transformer = case.get("transformer") or {}
        weight = 1.0
        if target_transformer_id and case_transformer.get("id") == target_transformer_id:
            weight += 0.65
        if target_oil_brand and normalize_text(case_transformer.get("oilBrand")) == target_oil_brand:
            weight += 0.45
        if target_oil_type and normalize_text(case_transformer.get("oilType")) == target_oil_type:
            weight += 0.2
        if target_paper_type and normalize_optional_category(case_transformer.get("paperType")) == target_paper_type:
            weight += 0.3
        weights.append(weight)
    return np.array(weights, dtype=float)


def _top_feature_importance(
    feature_map: Dict[str, float],
    importance_map: Dict[str, float],
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    ordered = sorted(importance_map.items(), key=lambda item: item[1], reverse=True)
    top_items = []
    for feature_name, importance in ordered[:top_n]:
        top_items.append({
            "feature": feature_name,
            "label": FEATURE_LABELS.get(feature_name, feature_name),
            "importance": round(float(importance), 4),
            "value": round(float(feature_map.get(feature_name, 0.0)), 4),
        })
    return top_items


def _heuristic_prediction(
    target_transformer: Dict[str, Any],
    target_record: Dict[str, Any],
    target_history: List[Dict[str, Any]],
    fault_lookup: Callable[[Dict[str, Any]], str],
) -> Dict[str, Any]:
    feature_map = build_feature_map(target_transformer, target_record, target_history)
    predicted_fault = fault_lookup(target_record)
    tdcg = calculate_tdcg(target_record)
    confidence = min(92.0, 58.0 + (tdcg / 180.0))

    importance_map = {
        "H2": feature_map["H2"],
        "CH4": feature_map["CH4"],
        "C2H6": feature_map["C2H6"],
        "C2H4": feature_map["C2H4"],
        "C2H2": feature_map["C2H2"],
        "CO": feature_map["CO"],
        "TDCG": feature_map["TDCG"],
        "gas_increase_rate": max(feature_map["gas_increase_rate"], 0.0),
    }
    max_importance = max(importance_map.values()) if importance_map else 1.0
    normalized_importance = {
        key: (value / max_importance) if max_importance > 0 else 0.0
        for key, value in importance_map.items()
    }

    return {
        "algorithm": "heuristic",
        "predicted_fault": predicted_fault,
        "risk_level": FAULT_RISK_LEVELS.get(predicted_fault, "Moderate"),
        "confidence": round(confidence, 1),
        "feature_importance": _top_feature_importance(feature_map, normalized_importance),
        "importance_map": normalized_importance,
        "feature_names": MODEL_FEATURE_ORDER,
        "feature_values": feature_map,
        "predicted_class_index": 0,
        "class_labels": [predicted_fault],
        "training_means": {name: 0.0 for name in MODEL_FEATURE_ORDER},
        "training_stds": {name: 1.0 for name in MODEL_FEATURE_ORDER},
        "model": None,
        "recommendation": "Model fallback in use. Validate prediction against diagnostics before approval.",
    }


def predict_fault_assessment(
    target_transformer: Dict[str, Any],
    target_record: Dict[str, Any],
    target_history: List[Dict[str, Any]],
    training_cases: List[Dict[str, Any]],
    fault_lookup: Callable[[Dict[str, Any]], str],
) -> Dict[str, Any]:
    usable_cases = []
    labels = []
    for case in training_cases:
        same_record = case["record"].get("id") == target_record.get("id")
        same_snapshot = (
            case["transformer"].get("id") == target_transformer.get("id")
            and case["record"].get("date") == target_record.get("date")
        )
        if same_record or same_snapshot:
            continue
        label = fault_lookup(case["record"])
        if not label:
            continue
        usable_cases.append(case)
        labels.append(label)

    if len(usable_cases) < 8 or len(set(labels)) < 2 or not HAS_SKLEARN:
        return _heuristic_prediction(target_transformer, target_record, target_history, fault_lookup)

    X_train, feature_maps = _build_feature_matrix(usable_cases)
    target_feature_map = build_feature_map(target_transformer, target_record, target_history)
    X_target = np.array([[target_feature_map[name] for name in MODEL_FEATURE_ORDER]], dtype=float)

    encoder = LabelEncoder()
    y_train = encoder.fit_transform(labels)

    if HAS_XGBOOST:
        model = XGBClassifier(
            n_estimators=140,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            objective="multi:softprob" if len(encoder.classes_) > 2 else "binary:logistic",
            eval_metric="mlogloss",
            reg_lambda=1.0,
            min_child_weight=1,
        )
        algorithm = "xgboost"
    else:
        model = RandomForestClassifier(
            n_estimators=160,
            max_depth=6,
            min_samples_leaf=2,
            random_state=42,
        )
        algorithm = "random_forest"

    sample_weights = _build_case_weights(target_transformer, usable_cases)
    model.fit(X_train, y_train, sample_weight=sample_weights)
    probabilities = model.predict_proba(X_target)[0]
    best_index = int(np.argmax(probabilities))
    predicted_fault = str(encoder.inverse_transform([best_index])[0])

    confidence = round(float(probabilities[best_index]) * 100.0, 1)
    feature_importances = getattr(model, "feature_importances_", np.zeros(len(MODEL_FEATURE_ORDER)))
    importance_map = {
        feature_name: float(feature_importances[idx])
        for idx, feature_name in enumerate(MODEL_FEATURE_ORDER)
    }
    means = X_train.mean(axis=0)
    stds = X_train.std(axis=0)

    return {
        "algorithm": algorithm,
        "predicted_fault": predicted_fault,
        "risk_level": FAULT_RISK_LEVELS.get(predicted_fault, "Moderate"),
        "confidence": confidence,
        "feature_importance": _top_feature_importance(target_feature_map, importance_map),
        "importance_map": importance_map,
        "feature_names": MODEL_FEATURE_ORDER,
        "feature_values": target_feature_map,
        "predicted_class_index": best_index,
        "class_labels": encoder.classes_.tolist(),
        "training_means": {
            MODEL_FEATURE_ORDER[idx]: float(means[idx]) for idx in range(len(MODEL_FEATURE_ORDER))
        },
        "training_stds": {
            MODEL_FEATURE_ORDER[idx]: float(stds[idx]) if float(stds[idx]) > 0 else 1.0
            for idx in range(len(MODEL_FEATURE_ORDER))
        },
        "model": model,
        "recommendation": "Prediction prioritizes same-transformer and same-oil-brand cases when available. Review similar cases and diagnostics before approving the draft assessment.",
    }


