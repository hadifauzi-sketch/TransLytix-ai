from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, Iterable, List, Optional


GAS_KEYS = ("H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2")
TDCG_KEYS = ("H2", "CH4", "C2H2", "C2H4", "C2H6", "CO")
MODEL_FEATURE_ORDER = [
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

PLACEHOLDER_CATEGORY_VALUES = {
    "",
    "-",
    "n a",
    "na",
    "not specified",
    "not available",
    "none",
    "unknown",
    "unspecified",
}


def safe_float(value: Any) -> float:
    try:
        if value is None or value == "":
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0

def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def normalize_optional_category(value: Any) -> str:
    normalized = normalize_text(value)
    return "" if normalized in PLACEHOLDER_CATEGORY_VALUES else normalized


def encode_text_category(value: Any) -> float:
    normalized = normalize_text(value)
    if not normalized:
        return 0.0
    total = 0
    for idx, char in enumerate(normalized[:64], start=1):
        total += idx * ord(char)
    return round(total / 1000.0, 4)


def safe_div(numerator: Any, denominator: Any, digits: int = 4) -> Optional[float]:
    denom = safe_float(denominator)
    if abs(denom) < 1e-9:
        return None
    return round(safe_float(numerator) / denom, digits)


def parse_date(date_str: str | None) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str[:19], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(date_str)
    except ValueError:
        return None


def months_between(start_date: str | None, end_date: str | None) -> float:
    start = parse_date(start_date)
    end = parse_date(end_date)
    if not start or not end:
        return 0.0
    delta_days = max((end - start).days, 0)
    return delta_days / 30.4375


def compute_age_years(transformer: Dict[str, Any], reference_date: str | None = None) -> float:
    base_date = (
        transformer.get("dateEnergized")
        or transformer.get("dateManufactured")
        or reference_date
    )
    start = parse_date(base_date)
    end = parse_date(reference_date) or datetime.now()
    if not start:
        return 0.0
    return round(max((end - start).days, 0) / 365.25, 2)


def voltage_to_kv(voltage_value: Any) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)", str(voltage_value or ""))
    if not match:
        return 0.0
    return float(match.group(1))


def calculate_tdcg(record: Dict[str, Any]) -> float:
    return round(sum(safe_float(record.get(key)) for key in TDCG_KEYS), 2)


def classify_tdcg(tdcg_value: float) -> Dict[str, str]:
    if tdcg_value <= 720:
        return {"label": "Condition 1", "severity": "Low"}
    if tdcg_value <= 1920:
        return {"label": "Condition 2", "severity": "Moderate"}
    if tdcg_value <= 4630:
        return {"label": "Condition 3", "severity": "High"}
    return {"label": "Condition 4", "severity": "Critical"}


def calculate_ratios(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    ratio_defs = [
        ("ratio_CH4_H2", "CH4 / H2", "Methane to Hydrogen", record.get("CH4"), record.get("H2")),
        ("ratio_C2H4_C2H6", "C2H4 / C2H6", "Ethylene to Ethane", record.get("C2H4"), record.get("C2H6")),
        ("ratio_C2H2_C2H4", "C2H2 / C2H4", "Acetylene to Ethylene", record.get("C2H2"), record.get("C2H4")),
        ("ratio_CO2_CO", "CO2 / CO", "Carbon Dioxide to Carbon Monoxide", record.get("CO2"), record.get("CO")),
    ]
    ratios: List[Dict[str, Any]] = []
    for key, formula, label, numerator, denominator in ratio_defs:
        value = safe_div(numerator, denominator)
        ratios.append({
            "key": key,
            "label": label,
            "formula": formula,
            "value": value,
        })
    return ratios


def ratios_to_map(ratios: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    return {item["key"]: safe_float(item.get("value")) for item in ratios}


def calculate_growth_metrics(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    latest = history[-1] if history else {}
    previous = history[-2] if len(history) > 1 else None
    current_tdcg = calculate_tdcg(latest) if latest else 0.0
    previous_tdcg = calculate_tdcg(previous) if previous else 0.0
    months = months_between(previous.get("date") if previous else None, latest.get("date") if latest else None)
    normalized_months = months if months > 0 else 1.0
    delta_tdcg = current_tdcg - previous_tdcg
    rate = round(delta_tdcg / normalized_months, 2)

    gas_changes = []
    for gas in GAS_KEYS:
        latest_value = safe_float(latest.get(gas))
        previous_value = safe_float(previous.get(gas)) if previous else 0.0
        gas_changes.append({
            "gas": gas,
            "delta": round(latest_value - previous_value, 2),
        })

    dominant_change = max(gas_changes, key=lambda item: item["delta"], default={"gas": None, "delta": 0.0})
    return {
        "tdcg_current": current_tdcg,
        "tdcg_previous": previous_tdcg,
        "tdcg_delta": round(delta_tdcg, 2),
        "gas_increase_rate": rate,
        "gas_changes": gas_changes,
        "dominant_increase": dominant_change,
        "sample_gap_months": round(normalized_months, 2),
    }


def infer_indicator_scores(record: Dict[str, Any], ratio_map: Dict[str, float], growth: Dict[str, Any]) -> Dict[str, Any]:
    thermal_score = 0.0
    discharge_score = 0.0

    c2h4 = safe_float(record.get("C2H4"))
    c2h6 = safe_float(record.get("C2H6"))
    c2h2 = safe_float(record.get("C2H2"))
    h2 = safe_float(record.get("H2"))
    ch4 = safe_float(record.get("CH4"))
    co = safe_float(record.get("CO"))
    co2 = safe_float(record.get("CO2"))
    tdcg = safe_float(growth.get("tdcg_current"))

    thermal_score += min(c2h4 / 50.0, 4.0)
    thermal_score += min(c2h6 / 40.0, 3.0)
    thermal_score += min(ratio_map.get("ratio_C2H4_C2H6", 0.0), 3.0)
    thermal_score += 1.0 if growth.get("gas_increase_rate", 0.0) > 150 else 0.0

    discharge_score += min(c2h2 / 4.0, 5.0)
    discharge_score += min(h2 / 75.0, 3.0)
    discharge_score += min(ratio_map.get("ratio_C2H2_C2H4", 0.0) * 2.0, 3.0)
    discharge_score += 1.0 if ch4 > h2 else 0.0

    thermal_level = "Low"
    if thermal_score >= 5:
        thermal_level = "High"
    elif thermal_score >= 2.5:
        thermal_level = "Moderate"

    discharge_level = "Low"
    if discharge_score >= 5:
        discharge_level = "High"
    elif discharge_score >= 2.5:
        discharge_level = "Moderate"

    paper_ageing = "Normal"
    if co > 700 or ratio_map.get("ratio_CO2_CO", 0.0) < 3:
        paper_ageing = "Elevated"
    elif co > 400 or co2 > 5000 or tdcg > 720:
        paper_ageing = "Watch"

    return {
        "thermal_indicator": round(thermal_score, 2),
        "thermal_level": thermal_level,
        "discharge_indicator": round(discharge_score, 2),
        "discharge_level": discharge_level,
        "paper_ageing": paper_ageing,
    }


def build_derived_features_payload(transformer: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    latest = history[-1] if history else {}
    ratios = calculate_ratios(latest)
    ratio_map = ratios_to_map(ratios)
    growth = calculate_growth_metrics(history)
    indicators = infer_indicator_scores(latest, ratio_map, growth)
    tdcg_category = classify_tdcg(growth.get("tdcg_current", 0.0))

    indicator_cards = [
        {
            "key": "tdcg_category",
            "label": "TDCG Category",
            "value": tdcg_category["label"],
            "detail": f"{growth.get('tdcg_current', 0.0):.0f} ppm",
        },
        {
            "key": "gas_increase_rate",
            "label": "Gas Increase Rate",
            "value": f"{growth.get('gas_increase_rate', 0.0):.1f} ppm/month",
            "detail": f"Delta {growth.get('tdcg_delta', 0.0):.0f} ppm over {growth.get('sample_gap_months', 0.0):.1f} month(s)",
        },
        {
            "key": "thermal_indicator",
            "label": "Thermal Indicator",
            "value": indicators["thermal_level"],
            "detail": f"Score {indicators['thermal_indicator']:.2f}",
        },
        {
            "key": "discharge_indicator",
            "label": "Discharge Indicator",
            "value": indicators["discharge_level"],
            "detail": f"Score {indicators['discharge_indicator']:.2f}",
        },
        {
            "key": "paper_ageing",
            "label": "Paper Ageing",
            "value": indicators["paper_ageing"],
            "detail": f"CO {safe_float(latest.get('CO')):.0f} ppm, CO2/CO {ratio_map.get('ratio_CO2_CO') or 0.0:.2f}",
        },
    ]

    return {
        "transformer_id": transformer.get("id"),
        "latest_date": latest.get("date"),
        "ratios": ratios,
        "indicators": indicator_cards,
        "growth": growth,
        "raw_indicators": indicators,
    }


def build_feature_map(transformer: Dict[str, Any], record: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, float]:
    derived = build_derived_features_payload(transformer, history)
    ratio_map = ratios_to_map(derived["ratios"])
    feature_map = {
        "H2": safe_float(record.get("H2")),
        "CH4": safe_float(record.get("CH4")),
        "C2H6": safe_float(record.get("C2H6")),
        "C2H4": safe_float(record.get("C2H4")),
        "C2H2": safe_float(record.get("C2H2")),
        "CO": safe_float(record.get("CO")),
        "CO2": safe_float(record.get("CO2")),
        "TDCG": safe_float(derived["growth"].get("tdcg_current")),
        "ratio_CH4_H2": safe_float(ratio_map.get("ratio_CH4_H2")),
        "ratio_C2H4_C2H6": safe_float(ratio_map.get("ratio_C2H4_C2H6")),
        "ratio_C2H2_C2H4": safe_float(ratio_map.get("ratio_C2H2_C2H4")),
        "ratio_CO2_CO": safe_float(ratio_map.get("ratio_CO2_CO")),
        "gas_increase_rate": safe_float(derived["growth"].get("gas_increase_rate")),
        "thermal_indicator": safe_float(derived["raw_indicators"].get("thermal_indicator")),
        "discharge_indicator": safe_float(derived["raw_indicators"].get("discharge_indicator")),
        "loadMVA": safe_float(transformer.get("loadMVA")),
        "voltageKV": voltage_to_kv(transformer.get("voltage")),
        "ageYears": compute_age_years(transformer, record.get("date")),
        "brandCode": encode_text_category(transformer.get("brand")),
        "makerCode": encode_text_category(transformer.get("maker")),
        "oilBrandCode": encode_text_category(transformer.get("oilBrand")),
        "paperTypeCode": encode_text_category(normalize_optional_category(transformer.get("paperType"))),
        "oilTypeCode": encode_text_category(normalize_optional_category(transformer.get("oilType"))),
        "samplingPointCode": encode_text_category(normalize_optional_category(record.get("testType"))),
    }
    return feature_map
