from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

try:
    import xgboost as xgb

    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False


def _surrogate_contributions(bundle: Dict[str, Any]) -> tuple[np.ndarray, float, str]:
    feature_names = bundle.get("feature_names", [])
    feature_values = bundle.get("feature_values", {})
    importance_map = bundle.get("importance_map", {})
    means = bundle.get("training_means", {})
    stds = bundle.get("training_stds", {})

    contributions = []
    for feature_name in feature_names:
        value = float(feature_values.get(feature_name, 0.0))
        mean = float(means.get(feature_name, 0.0))
        std = float(stds.get(feature_name, 1.0)) or 1.0
        importance = float(importance_map.get(feature_name, 0.0))
        standardized = (value - mean) / std
        contributions.append(importance * standardized)
    return np.array(contributions, dtype=float), 0.0, "surrogate_shap"


def explain_prediction(bundle: Dict[str, Any], feature_labels: Dict[str, str], top_n: int = 6) -> Dict[str, Any]:
    feature_names = bundle.get("feature_names", [])
    feature_values = bundle.get("feature_values", {})
    contributions = None
    base_value = 0.0
    method = "surrogate_shap"

    if (
        bundle.get("algorithm") == "xgboost"
        and HAS_XGBOOST
        and bundle.get("model") is not None
        and hasattr(bundle["model"], "get_booster")
    ):
        try:
            matrix = np.array([[float(feature_values.get(name, 0.0)) for name in feature_names]], dtype=float)
            dmatrix = xgb.DMatrix(matrix, feature_names=feature_names)
            raw_contribs = bundle["model"].get_booster().predict(dmatrix, pred_contribs=True)
            contrib_array = np.asarray(raw_contribs)
            if contrib_array.ndim == 3:
                class_index = int(bundle.get("predicted_class_index", 0))
                contributions = contrib_array[0, class_index, :-1]
                base_value = float(contrib_array[0, class_index, -1])
            elif contrib_array.ndim == 2:
                contributions = contrib_array[0, :-1]
                base_value = float(contrib_array[0, -1])
            method = "tree_shap"
        except Exception:
            contributions, base_value, method = _surrogate_contributions(bundle)
    if contributions is None:
        contributions, base_value, method = _surrogate_contributions(bundle)

    total_abs = float(np.sum(np.abs(contributions))) or 1.0
    rows: List[Dict[str, Any]] = []
    for idx, feature_name in enumerate(feature_names):
        contribution = float(contributions[idx])
        rows.append({
            "feature": feature_name,
            "label": feature_labels.get(feature_name, feature_name),
            "value": round(float(feature_values.get(feature_name, 0.0)), 4),
            "contribution": round(contribution, 4),
            "direction": "increase" if contribution >= 0 else "decrease",
            "influence_pct": round((abs(contribution) / total_abs) * 100.0, 1),
        })

    rows.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    top_rows = rows[:top_n]
    return {
        "method": method,
        "base_value": round(base_value, 4),
        "contributors": top_rows,
        "chart_data": top_rows,
    }
