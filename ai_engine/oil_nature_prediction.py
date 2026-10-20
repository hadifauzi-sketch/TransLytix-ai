"""
Domain-aware transformer oil prediction helpers.

Blends raw statistical forecasts with transformer-oil ageing behaviour so
oil-quality parameters move in directions that match field experience more
closely than pure cross-transformer extrapolation alone.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

GASES = ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2"]

_UP = "increase"
_DOWN = "decrease"

NATURE_PROFILES: Dict[str, Dict[str, Any]] = {
    "ift": {
        "direction": _DOWN,
        "annual_ratio_range": (0.02, 0.08),
        "monthly_floor": 0.03,
        "monthly_cap": 0.35,
        "base_weight": 0.65,
        "recent_weight": 0.2,
        "model_weight": 0.15,
        "note": "IFT normally declines as oil ages.",
    },
    "acidity": {
        "direction": _UP,
        "annual_ratio_range": (0.08, 0.4),
        "monthly_floor": 0.0005,
        "monthly_cap": 0.02,
        "base_weight": 0.55,
        "recent_weight": 0.25,
        "model_weight": 0.2,
        "note": "Acidity normally rises with oxidation and ageing.",
    },
    "powerFactor": {
        "direction": _UP,
        "annual_ratio_range": (0.08, 0.45),
        "monthly_floor": 0.005,
        "monthly_cap": 0.2,
        "base_weight": 0.55,
        "recent_weight": 0.25,
        "model_weight": 0.2,
        "note": "Power factor / tan delta usually trends upward as oil condition weakens.",
    },
    "inhibitor": {
        "direction": _DOWN,
        "annual_ratio_range": (0.03, 0.18),
        "monthly_floor": 0.1,
        "monthly_cap": 4.0,
        "load_sensitivity": 0.35,
        "base_weight": 0.6,
        "recent_weight": 0.15,
        "model_weight": 0.15,
        "cross_weight": 0.1,
        "note": "Inhibitor normally depletes over time and faster under higher loading.",
    },
    "passivator": {
        "direction": _DOWN,
        "annual_ratio_range": (0.03, 0.15),
        "monthly_floor": 0.05,
        "monthly_cap": 2.0,
        "load_sensitivity": 0.2,
        "base_weight": 0.62,
        "recent_weight": 0.18,
        "model_weight": 0.12,
        "cross_weight": 0.08,
        "note": "Passivator normally depletes over time.",
    },
    "dbds": {
        "direction": _DOWN,
        "annual_ratio_range": (0.02, 0.12),
        "monthly_floor": 0.05,
        "monthly_cap": 3.0,
        "base_weight": 0.62,
        "recent_weight": 0.18,
        "model_weight": 0.12,
        "cross_weight": 0.08,
        "note": "DBDS usually trends downward when the oil is conditioned or replaced.",
    },
    "methanol": {
        "direction": _UP,
        "annual_ratio_range": (0.03, 0.2),
        "monthly_floor": 0.05,
        "monthly_cap": 3.0,
        "base_weight": 0.6,
        "recent_weight": 0.22,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "Methanol tends to increase slowly as cellulose ages.",
    },
    "fal2": {
        "direction": _UP,
        "annual_ratio_range": (0.05, 0.3),
        "monthly_floor": 0.01,
        "monthly_cap": 1.5,
        "base_weight": 0.62,
        "recent_weight": 0.2,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "2-FAL normally increases as paper degradation progresses.",
    },
    "fol2": {
        "direction": _UP,
        "annual_ratio_range": (0.04, 0.2),
        "monthly_floor": 0.005,
        "monthly_cap": 1.0,
        "base_weight": 0.6,
        "recent_weight": 0.22,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "Furan compounds generally rise with paper ageing.",
    },
    "hmf5": {
        "direction": _UP,
        "annual_ratio_range": (0.04, 0.2),
        "monthly_floor": 0.005,
        "monthly_cap": 1.0,
        "base_weight": 0.6,
        "recent_weight": 0.22,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "Furan compounds generally rise with paper ageing.",
    },
    "acf2": {
        "direction": _UP,
        "annual_ratio_range": (0.04, 0.2),
        "monthly_floor": 0.005,
        "monthly_cap": 1.0,
        "base_weight": 0.6,
        "recent_weight": 0.22,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "Furan compounds generally rise with paper ageing.",
    },
    "mef5": {
        "direction": _UP,
        "annual_ratio_range": (0.04, 0.2),
        "monthly_floor": 0.005,
        "monthly_cap": 1.0,
        "base_weight": 0.6,
        "recent_weight": 0.22,
        "model_weight": 0.12,
        "cross_weight": 0.06,
        "note": "Furan compounds generally rise with paper ageing.",
    },
    "moisture": {
        "direction": _UP,
        "annual_ratio_range": (0.04, 0.18),
        "monthly_floor": 0.05,
        "monthly_cap": 3.0,
        "base_weight": 0.5,
        "recent_weight": 0.25,
        "model_weight": 0.15,
        "cross_weight": 0.1,
        "note": "Moisture generally increases with ageing, unless filtration/drying was performed.",
    },
    "bdv": {
        "direction": _DOWN,
        "annual_ratio_range": (0.02, 0.12),
        "monthly_floor": 0.05,
        "monthly_cap": 2.0,
        "base_weight": 0.5,
        "recent_weight": 0.25,
        "model_weight": 0.15,
        "cross_weight": 0.1,
        "note": "BDV usually declines as oil condition worsens, but rises after effective filtration.",
    },
    "dpFromFuran": {
        "direction": _DOWN,
        "annual_ratio_range": (0.02, 0.12),
        "monthly_floor": 2.0,
        "monthly_cap": 35.0,
        "base_weight": 0.65,
        "recent_weight": 0.2,
        "model_weight": 0.1,
        "cross_weight": 0.05,
        "note": "Estimated paper DP should trend downward as furans accumulate.",
    },
    "dpFromMethanol": {
        "direction": _DOWN,
        "annual_ratio_range": (0.02, 0.12),
        "monthly_floor": 2.0,
        "monthly_cap": 35.0,
        "base_weight": 0.65,
        "recent_weight": 0.2,
        "model_weight": 0.1,
        "cross_weight": 0.05,
        "note": "Estimated paper DP should trend downward as methanol rises.",
    },
}


def _safe_float(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def _parse_date(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.fromisoformat(text.split("T")[0])
        except Exception:
            return datetime.utcnow()


def _sort_history(history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(history, key=lambda item: _parse_date(item.get("date")))


def _months_between(start: datetime, end: datetime) -> float:
    delta_days = max((end - start).days, 1)
    return max(delta_days / 30.4375, 1 / 30.4375)


def _average_step_months(history: List[Dict[str, Any]]) -> float:
    if len(history) < 2:
        return 1.0
    spans = []
    for idx in range(1, len(history)):
        spans.append(
            _months_between(
                _parse_date(history[idx - 1].get("date")),
                _parse_date(history[idx].get("date")),
            )
        )
    return max(sum(spans) / len(spans), 0.25)


def _recent_monthly_slope(history: List[Dict[str, Any]], field: str) -> float:
    if len(history) < 2:
        return 0.0
    start_idx = max(1, len(history) - 4)
    weighted_sum = 0.0
    weight_total = 0.0
    for idx in range(start_idx, len(history)):
        prev = history[idx - 1]
        curr = history[idx]
        prev_val = _safe_float(prev.get(field))
        curr_val = _safe_float(curr.get(field))
        months = _months_between(_parse_date(prev.get("date")), _parse_date(curr.get("date")))
        slope = (curr_val - prev_val) / months
        weight = idx - start_idx + 1
        weighted_sum += slope * weight
        weight_total += weight
    return weighted_sum / weight_total if weight_total else 0.0


def _recent_monthly_volatility(history: List[Dict[str, Any]], field: str) -> float:
    if len(history) < 3:
        return 0.0
    slopes: List[float] = []
    start_idx = max(1, len(history) - 4)
    for idx in range(start_idx, len(history)):
        prev = history[idx - 1]
        curr = history[idx]
        months = _months_between(_parse_date(prev.get("date")), _parse_date(curr.get("date")))
        slopes.append((_safe_float(curr.get(field)) - _safe_float(prev.get(field))) / months)
    if len(slopes) < 2:
        return abs(slopes[0]) * 0.2 if slopes else 0.0
    mean_slope = sum(slopes) / len(slopes)
    variance = sum((value - mean_slope) ** 2 for value in slopes) / len(slopes)
    return math.sqrt(max(variance, 0.0))


def _detect_maintenance_event(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    if len(history) < 2:
        return {"detected": False}
    prev = history[-2]
    curr = history[-1]

    prev_gas = sum(_safe_float(prev.get(gas)) for gas in GASES)
    curr_gas = sum(_safe_float(curr.get(gas)) for gas in GASES)
    prev_moisture = _safe_float(prev.get("moisture"))
    curr_moisture = _safe_float(curr.get("moisture"))
    prev_bdv = _safe_float(prev.get("bdv"))
    curr_bdv = _safe_float(curr.get("bdv"))

    gas_drop_ratio = ((curr_gas - prev_gas) / prev_gas) if prev_gas > 0 else 0.0
    moisture_drop_ratio = ((curr_moisture - prev_moisture) / prev_moisture) if prev_moisture > 0 else 0.0
    bdv_rise_ratio = ((curr_bdv - prev_bdv) / prev_bdv) if prev_bdv > 0 else 0.0

    detected = (
        prev_bdv > 0
        and bdv_rise_ratio >= 0.08
        and (
            (prev_gas > 0 and gas_drop_ratio <= -0.18)
            or (prev_moisture > 0 and moisture_drop_ratio <= -0.15)
        )
    )

    return {
        "detected": detected,
        "gas_drop_ratio": round(gas_drop_ratio, 4),
        "moisture_drop_ratio": round(moisture_drop_ratio, 4),
        "bdv_rise_ratio": round(bdv_rise_ratio, 4),
    }


def _is_stable_gassing(values: List[float]) -> bool:
    if len(values) < 3:
        return False
    recent = values[-4:]
    avg_val = max(sum(recent) / len(recent), 1.0)
    span = max(recent) - min(recent)
    last_step = abs(recent[-1] - recent[-2])
    return span <= max(5.0, avg_val * 0.12) and last_step <= max(2.0, avg_val * 0.06)


def _weighted_average(pairs: List[tuple]) -> float:
    numerator = 0.0
    denominator = 0.0
    for value, weight in pairs:
        if value is None or weight <= 0:
            continue
        numerator += float(value) * float(weight)
        denominator += float(weight)
    return numerator / denominator if denominator else 0.0


def _expected_monthly_change(
    field: str,
    current_value: float,
    load_mva: float,
    maintenance_event: bool,
) -> float:
    profile = NATURE_PROFILES.get(field)
    if not profile:
        return 0.0

    low_ratio, high_ratio = profile.get("annual_ratio_range", (0.0, 0.0))
    annual_ratio = (low_ratio + high_ratio) / 2
    magnitude = max(profile.get("monthly_floor", 0.0), current_value * annual_ratio / 12.0)
    cap = profile.get("monthly_cap")
    if cap is not None:
        magnitude = min(magnitude, cap)

    load_sensitivity = profile.get("load_sensitivity", 0.0)
    if load_sensitivity > 0:
        load_scale = min(max(load_mva, 0.0) / 100.0, 1.5)
        magnitude *= 1.0 + load_scale * load_sensitivity

    direction = profile.get("direction")
    if maintenance_event and field == "moisture":
        direction = _DOWN
    elif maintenance_event and field == "bdv":
        direction = _UP

    if direction == _UP:
        return magnitude
    if direction == _DOWN:
        return -magnitude
    return 0.0


def _build_monotonic_points(
    field: str,
    current_value: float,
    forecast_months: int,
    last_date: datetime,
    slope_per_month: float,
    base_points: List[Dict[str, Any]],
    uncertainty: float,
) -> List[Dict[str, Any]]:
    profile = NATURE_PROFILES.get(field, {})
    direction = profile.get("direction")
    points: List[Dict[str, Any]] = []
    previous_value = current_value

    for month in range(1, forecast_months + 1):
        model_value = None
        if month - 1 < len(base_points):
            model_value = _safe_float(base_points[month - 1].get("value"))

        domain_value = max(0.0, current_value + slope_per_month * month)
        if model_value is None:
            value = domain_value
        else:
            blend = 0.2 if direction else 0.55
            value = domain_value * (1 - blend) + model_value * blend

        if direction == _UP and value < previous_value:
            value = previous_value
        elif direction == _DOWN and value > previous_value:
            value = previous_value

        band = uncertainty * math.sqrt(month)
        lower = max(0.0, value - band)
        upper = max(value, value + band)
        future_date = last_date + timedelta(days=30 * month)
        points.append(
            {
                "month": month,
                "date": future_date.strftime("%Y-%m-%d"),
                "value": round(value, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            }
        )
        previous_value = value

    return points


def _adjust_gas_points(
    current_value: float,
    forecast_months: int,
    last_date: datetime,
    base_points: List[Dict[str, Any]],
    recent_slope: float,
    stable_stray: bool,
    maintenance_event: bool,
) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []
    for month in range(1, forecast_months + 1):
        base_point = base_points[month - 1] if month - 1 < len(base_points) else None
        value = _safe_float(base_point.get("value")) if base_point else max(0.0, current_value + recent_slope * month)
        lower = _safe_float(base_point.get("lower")) if base_point else max(0.0, value * 0.85)
        upper = _safe_float(base_point.get("upper")) if base_point else max(value, value * 1.15)

        if stable_stray:
            value = current_value * 0.8 + value * 0.2
            band = max(1.0, abs(value - current_value) + (upper - lower) * 0.2)
            lower = max(0.0, value - band)
            upper = value + band
        elif maintenance_event:
            if recent_slope < 0:
                ceiling = max(0.0, current_value + recent_slope * month)
            else:
                ceiling = current_value * max(0.55, 1.0 - 0.04 * month)
            value = min(value, ceiling)
            band = max(1.0, value * 0.12)
            lower = max(0.0, value - band)
            upper = value + band

        future_date = last_date + timedelta(days=30 * month)
        points.append(
            {
                "month": month,
                "date": future_date.strftime("%Y-%m-%d"),
                "value": round(max(0.0, value), 2),
                "lower": round(max(0.0, lower), 2),
                "upper": round(max(value, upper), 2),
            }
        )
    return points


def _classify_trend(current_value: float, forecasted_values: List[Dict[str, Any]]) -> str:
    if not forecasted_values:
        return "stable"
    last_value = _safe_float(forecasted_values[-1].get("value"))
    threshold = max(abs(current_value) * 0.02, 0.05)
    if last_value - current_value > threshold:
        return "increasing"
    if current_value - last_value > threshold:
        return "decreasing"
    return "stable"


def apply_nature_hybrid_forecast(
    field: str,
    history: List[Dict[str, Any]],
    forecast_months: int,
    transformer: Optional[Dict[str, Any]] = None,
    base_forecast: Optional[Dict[str, Any]] = None,
    cross_growth_rate: Optional[float] = None,
    base_model_name: str = "nature_hybrid",
) -> Dict[str, Any]:
    """
    Blend an existing forecast with transformer-oil domain rules.
    """
    ordered_history = _sort_history(history)
    values = [_safe_float(row.get(field)) for row in ordered_history]
    current_value = values[-1] if values else 0.0
    last_date = _parse_date(ordered_history[-1].get("date")) if ordered_history else datetime.utcnow()
    step_months = _average_step_months(ordered_history)
    recent_slope = _recent_monthly_slope(ordered_history, field)
    recent_volatility = _recent_monthly_volatility(ordered_history, field)
    maintenance = _detect_maintenance_event(ordered_history)
    stable_stray = field in GASES and _is_stable_gassing(values)

    base_payload = dict(base_forecast or {})
    base_points = list(base_payload.get("forecasted_values") or [])
    base_slope = _safe_float(base_payload.get("slope_per_month")) if base_payload else recent_slope
    base_confidence = _safe_float(base_payload.get("model_confidence")) if base_payload else 0.0
    diagnostics = dict(base_payload.get("diagnostics") or {})

    if field in GASES:
        forecasted_values = _adjust_gas_points(
            current_value=current_value,
            forecast_months=forecast_months,
            last_date=last_date,
            base_points=base_points,
            recent_slope=recent_slope,
            stable_stray=stable_stray,
            maintenance_event=maintenance.get("detected", False),
        )
        slope_per_month = (
            (_safe_float(forecasted_values[-1].get("value")) - current_value) / forecast_months
            if forecasted_values and forecast_months > 0
            else base_slope
        )
        diagnostics.update(
            {
                "nature_hybrid": True,
                "base_model": base_model_name,
                "gas_behavior_rule": "stable_stray_gassing" if stable_stray else "maintenance_damped" if maintenance.get("detected") else "data_driven",
                "stable_stray_gassing": stable_stray,
                "maintenance_event_detected": maintenance.get("detected", False),
                "maintenance_event_details": maintenance,
                "recent_slope_per_month": round(recent_slope, 4),
            }
        )
        return {
            "gas": field,
            "current_value": round(current_value, 3),
            "forecasted_values": forecasted_values,
            "trend": _classify_trend(current_value, forecasted_values),
            "slope_per_month": round(slope_per_month, 3),
            "will_exceed_limit": base_payload.get("will_exceed_limit"),
            "months_to_exceed": base_payload.get("months_to_exceed"),
            "model_confidence": round(min(0.95, max(base_confidence, 0.72 if stable_stray else 0.55)), 3),
            "diagnostics": diagnostics,
        }

    profile = NATURE_PROFILES.get(field)
    if not profile:
        if base_payload:
            diagnostics.update(
                {
                    "nature_hybrid": True,
                    "base_model": base_model_name,
                    "nature_profile": "generic_data_driven",
                    "recent_slope_per_month": round(recent_slope, 4),
                }
            )
            base_payload["diagnostics"] = diagnostics
            return base_payload
        uncertainty = max(abs(recent_slope) * 0.75, recent_volatility, 0.1)
        forecasted_values = _build_monotonic_points(
            field=field,
            current_value=current_value,
            forecast_months=forecast_months,
            last_date=last_date,
            slope_per_month=recent_slope,
            base_points=[],
            uncertainty=uncertainty,
        )
        return {
            "gas": field,
            "current_value": round(current_value, 3),
            "forecasted_values": forecasted_values,
            "trend": _classify_trend(current_value, forecasted_values),
            "slope_per_month": round(recent_slope, 3),
            "will_exceed_limit": None,
            "months_to_exceed": None,
            "model_confidence": 0.45,
            "diagnostics": {
                "nature_hybrid": True,
                "base_model": base_model_name,
                "nature_profile": "generic_data_driven",
            },
        }

    load_mva = _safe_float((transformer or {}).get("loadMVA"))
    expected_change = _expected_monthly_change(
        field=field,
        current_value=current_value,
        load_mva=load_mva,
        maintenance_event=maintenance.get("detected", False),
    )
    cross_slope = cross_growth_rate / max(step_months, 0.25) if cross_growth_rate is not None else None
    blended_slope = _weighted_average(
        [
            (expected_change, profile.get("base_weight", 0.6)),
            (recent_slope, profile.get("recent_weight", 0.2)),
            (base_slope, profile.get("model_weight", 0.15)),
            (cross_slope, profile.get("cross_weight", 0.05)),
        ]
    )

    minimum_guard = abs(expected_change) * 0.35 if expected_change else 0.0
    direction = profile.get("direction")
    if direction == _UP and blended_slope < minimum_guard:
        blended_slope = minimum_guard
    elif direction == _DOWN and blended_slope > -minimum_guard:
        blended_slope = -minimum_guard

    slope_cap = profile.get("monthly_cap")
    if slope_cap is not None:
        blended_slope = max(-slope_cap, min(slope_cap, blended_slope))

    uncertainty = max(
        abs(blended_slope) * 0.85,
        recent_volatility,
        profile.get("monthly_floor", 0.05) * 0.6,
    )
    forecasted_values = _build_monotonic_points(
        field=field,
        current_value=current_value,
        forecast_months=forecast_months,
        last_date=last_date,
        slope_per_month=blended_slope,
        base_points=base_points,
        uncertainty=uncertainty,
    )

    diagnostics.update(
        {
            "nature_hybrid": True,
            "base_model": base_model_name,
            "nature_profile": field,
            "nature_direction": direction,
            "nature_note": profile.get("note"),
            "maintenance_event_detected": maintenance.get("detected", False),
            "maintenance_event_details": maintenance,
            "recent_slope_per_month": round(recent_slope, 4),
            "cross_growth_rate_per_step": round(cross_growth_rate, 4) if cross_growth_rate is not None else None,
            "final_slope_per_month": round(blended_slope, 4),
        }
    )

    return {
        "gas": field,
        "current_value": round(current_value, 3),
        "forecasted_values": forecasted_values,
        "trend": _classify_trend(current_value, forecasted_values),
        "slope_per_month": round(blended_slope, 3),
        "will_exceed_limit": None,
        "months_to_exceed": None,
        "model_confidence": round(min(0.95, max(base_confidence, 0.68)), 3),
        "diagnostics": diagnostics,
    }
