from __future__ import annotations

from typing import Any, Dict, Optional


def safe_ratio(numerator: Any, denominator: Any, digits: int = 4) -> Optional[float]:
    try:
        numerator_value = float(numerator or 0)
        denominator_value = float(denominator or 0)
    except (TypeError, ValueError):
        return None
    if abs(denominator_value) < 1e-9:
        return None
    return round(numerator_value / denominator_value, digits)


def _match_numeric(value: Optional[float], lower: Optional[float], upper: Optional[float], lower_inclusive: bool = True, upper_inclusive: bool = False) -> bool:
    if value is None:
        return False
    if lower is not None:
        if lower_inclusive and value < lower:
            return False
        if not lower_inclusive and value <= lower:
            return False
    if upper is not None:
        if upper_inclusive and value > upper:
            return False
        if not upper_inclusive and value >= upper:
            return False
    return True


def _match_condition(value: Optional[float], condition: Dict[str, Any]) -> bool:
    if condition.get("ns"):
        return True
    if value is None:
        return False
    if "values" in condition:
        return value in condition["values"]
    return _match_numeric(
        value,
        condition.get("min"),
        condition.get("max"),
        lower_inclusive=condition.get("min_inclusive", True),
        upper_inclusive=condition.get("max_inclusive", False),
    )


IEC_60599_RULES = [
    {
        "case": "PD",
        "faultCode": "PD",
        "diagnosis": "Partial Discharges",
        "priority": 10,
        "c2h2_c2h4": {"ns": True},
        "ch4_h2": {"max": 0.1},
        "c2h4_c2h6": {"max": 0.2},
    },
    {
        "case": "D1",
        "faultCode": "D1",
        "diagnosis": "Discharges of Low Energy",
        "priority": 40,
        "c2h2_c2h4": {"min": 1.0},
        "ch4_h2": {"min": 0.1, "max": 0.5, "max_inclusive": True},
        "c2h4_c2h6": {"min": 1.0},
    },
    {
        "case": "D2",
        "faultCode": "D2",
        "diagnosis": "Discharges of High Energy",
        "priority": 50,
        "c2h2_c2h4": {"min": 0.6, "max": 2.5, "max_inclusive": True},
        "ch4_h2": {"min": 0.1, "max": 1.0, "max_inclusive": True},
        "c2h4_c2h6": {"min": 2.0},
    },
    {
        "case": "T1",
        "faultCode": "T1",
        "diagnosis": "Thermal Fault <300C",
        "priority": 20,
        "c2h2_c2h4": {"ns": True},
        "ch4_h2": {"min": 1.0},
        "c2h4_c2h6": {"max": 1.0},
    },
    {
        "case": "T2",
        "faultCode": "T2",
        "diagnosis": "Thermal Fault 300-700C",
        "priority": 30,
        "c2h2_c2h4": {"max": 0.1},
        "ch4_h2": {"min": 1.0},
        "c2h4_c2h6": {"min": 1.0, "max": 4.0, "max_inclusive": True},
    },
    {
        "case": "T3",
        "faultCode": "T3",
        "diagnosis": "Thermal Fault >700C",
        "priority": 35,
        "c2h2_c2h4": {"max": 0.2},
        "ch4_h2": {"min": 1.0},
        "c2h4_c2h6": {"min": 4.0},
    },
]


ROGERS_REFINED_RULES = [
    {"faultCode": "N", "diagnosis": "Normal deterioration", "priority": 10, "r1": {"values": [0]}, "r4": {"values": [0]}, "r5": {"values": [0]}, "r2": {"values": [0]}},
    {"faultCode": "PD", "diagnosis": "Partial discharge", "priority": 20, "r1": {"values": [5]}, "r4": {"values": [0]}, "r5": {"values": [0]}, "r2": {"values": [0]}},
    {"faultCode": "T1", "diagnosis": "Slight overheating below 150C", "priority": 30, "r1": {"values": [1, 2]}, "r4": {"values": [0]}, "r5": {"values": [0]}, "r2": {"values": [0]}},
    {"faultCode": "T1", "diagnosis": "Slight overheating 150-200C", "priority": 31, "r1": {"values": [1, 2]}, "r4": {"values": [1]}, "r5": {"values": [0]}, "r2": {"values": [0]}},
    {"faultCode": "T1", "diagnosis": "Slight overheating 200-300C", "priority": 32, "r1": {"values": [0]}, "r4": {"values": [1]}, "r5": {"values": [0]}, "r2": {"values": [0]}},
    {"faultCode": "T2", "diagnosis": "General conductor overheating", "priority": 40, "r1": {"values": [0]}, "r4": {"values": [0]}, "r5": {"values": [1]}, "r2": {"values": [0]}},
    {"faultCode": "T2", "diagnosis": "Winding circulating currents", "priority": 41, "r1": {"values": [1]}, "r4": {"values": [0]}, "r5": {"values": [1]}, "r2": {"values": [0]}},
    {"faultCode": "T3", "diagnosis": "Core and tank circulating currents, overheated joints", "priority": 42, "r1": {"values": [1]}, "r4": {"values": [0]}, "r5": {"values": [2]}, "r2": {"values": [0]}},
    {"faultCode": "D1", "diagnosis": "Flashover without power follow through", "priority": 50, "r1": {"values": [0]}, "r4": {"values": [0]}, "r5": {"values": [0]}, "r2": {"values": [1, 2]}},
    {"faultCode": "D2", "diagnosis": "Arc with power follow through", "priority": 60, "r1": {"values": [0]}, "r4": {"values": [0]}, "r5": {"values": [1, 2]}, "r2": {"values": [1, 2]}},
    {"faultCode": "D2", "diagnosis": "Continuous sparking to floating potential", "priority": 61, "r1": {"values": [0]}, "r4": {"values": [0]}, "r5": {"values": [2]}, "r2": {"values": [2]}},
    {"faultCode": "PD", "diagnosis": "Partial discharge with tracking", "priority": 70, "r1": {"values": [5]}, "r4": {"values": [0]}, "r5": {"values": [0]}, "r2": {"values": [1, 2]}},
]


def diagnose_iec_60599(record: Dict[str, Any]) -> Dict[str, Any]:
    ratios = {
        "C2H2_C2H4": safe_ratio(record.get("C2H2"), record.get("C2H4")),
        "CH4_H2": safe_ratio(record.get("CH4"), record.get("H2")),
        "C2H4_C2H6": safe_ratio(record.get("C2H4"), record.get("C2H6")),
    }

    matched_rule = None
    for rule in sorted(IEC_60599_RULES, key=lambda item: item["priority"], reverse=True):
        if (
            _match_condition(ratios["C2H2_C2H4"], rule["c2h2_c2h4"])
            and _match_condition(ratios["CH4_H2"], rule["ch4_h2"])
            and _match_condition(ratios["C2H4_C2H6"], rule["c2h4_c2h6"])
        ):
            matched_rule = rule
            break

    if matched_rule is None:
        return {
            "standard": "IEC 60599:2015 Table 1",
            "code": "ND",
            "diagnosis": "Undetermined",
            "ratios": ratios,
            "matchedRule": None,
        }

    return {
        "standard": "IEC 60599:2015 Table 1",
        "code": matched_rule["faultCode"],
        "case": matched_rule["case"],
        "diagnosis": matched_rule["diagnosis"],
        "ratios": ratios,
        "matchedRule": matched_rule["case"],
    }


def _rogers_code_r1(value: Optional[float]) -> int:
    if value is None:
        return 0
    if value <= 0.1:
        return 5
    if value <= 1.0:
        return 0
    if value <= 3.0:
        return 1
    return 2


def _rogers_code_binary(value: Optional[float]) -> int:
    if value is None:
        return 0
    return 0 if value < 1.0 else 1


def _rogers_code_r5(value: Optional[float]) -> int:
    if value is None:
        return 0
    if value < 1.0:
        return 0
    if value < 3.0:
        return 1
    return 2


def _rogers_code_r2(value: Optional[float]) -> int:
    if value is None:
        return 0
    if value < 0.5:
        return 0
    if value < 3.0:
        return 1
    return 2


def diagnose_rogers_refined(record: Dict[str, Any]) -> Dict[str, Any]:
    ratios = {
        "CH4_H2": safe_ratio(record.get("CH4"), record.get("H2")),
        "C2H6_CH4": safe_ratio(record.get("C2H6"), record.get("CH4")),
        "C2H4_C2H6": safe_ratio(record.get("C2H4"), record.get("C2H6")),
        "C2H2_C2H4": safe_ratio(record.get("C2H2"), record.get("C2H4")),
    }
    codes = {
        "R1": _rogers_code_r1(ratios["CH4_H2"]),
        "R4": _rogers_code_binary(ratios["C2H6_CH4"]),
        "R5": _rogers_code_r5(ratios["C2H4_C2H6"]),
        "R2": _rogers_code_r2(ratios["C2H2_C2H4"]),
    }

    matched_rule = None
    for rule in sorted(ROGERS_REFINED_RULES, key=lambda item: item["priority"], reverse=True):
        if (
            _match_condition(codes["R1"], rule["r1"])
            and _match_condition(codes["R4"], rule["r4"])
            and _match_condition(codes["R5"], rule["r5"])
            and _match_condition(codes["R2"], rule["r2"])
        ):
            matched_rule = rule
            break

    if matched_rule is None:
        return {
            "method": "Rogers refined 4-ratio method",
            "code": "ND",
            "faultCode": "ND",
            "diagnosis": "Undetermined",
            "ratios": ratios,
            "codes": codes,
        }

    return {
        "method": "Rogers refined 4-ratio method",
        "code": matched_rule["faultCode"],
        "faultCode": matched_rule["faultCode"],
        "diagnosis": matched_rule["diagnosis"],
        "ratios": ratios,
        "codes": codes,
    }
