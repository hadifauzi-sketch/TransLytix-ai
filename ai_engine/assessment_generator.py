from __future__ import annotations

from typing import Any, Dict


def _ppm(value: Any) -> str:
    try:
        return f"{float(value):.0f} ppm"
    except (TypeError, ValueError):
        return "0 ppm"


def _extract_guidance(top_case: Dict[str, Any] | None) -> str:
    if not top_case or not top_case.get("has_approved_assessment"):
        return ""
    text = " ".join(str(top_case.get("assessment_full") or "").split())
    if not text:
        return ""
    if len(text) > 240:
        text = text[:237].rstrip() + "..."
    return (
        f"A previously approved similar case ({top_case.get('transformer')}, {float(top_case.get('similarity', 0) or 0):.0f}% match) "
        f"recorded this interpretation: {text}"
    )


def _select_memory_case(similar_cases: Dict[str, Any], min_similarity: float = 88.0) -> Dict[str, Any] | None:
    for case in similar_cases.get("cases") or []:
        if not case.get("has_approved_assessment"):
            continue
        text = " ".join(str(case.get("assessment_full") or "").split())
        if not text:
            continue
        if float(case.get("similarity", 0) or 0) >= min_similarity:
            return case
    return None


def generate_assessment_draft(
    transformer: Dict[str, Any],
    summary: Dict[str, Any],
    derived_features: Dict[str, Any],
    prediction: Dict[str, Any],
    similar_cases: Dict[str, Any],
) -> Dict[str, Any]:
    gases = summary.get("latest_dga", {}).get("gases", {})
    diagnostics = summary.get("diagnostics", {})
    top_case = (similar_cases.get("cases") or [None])[0]

    observations = []
    if float(gases.get("H2", 0) or 0) >= 100:
        observations.append(f"hydrogen is elevated at {_ppm(gases.get('H2'))}")
    if float(gases.get("C2H6", 0) or 0) >= 40 or float(gases.get("C2H4", 0) or 0) >= 50:
        observations.append(
            f"thermal gases are present with ethane {_ppm(gases.get('C2H6'))} and ethylene {_ppm(gases.get('C2H4'))}"
        )
    if float(gases.get("C2H2", 0) or 0) >= 3:
        observations.append(f"acetylene at {_ppm(gases.get('C2H2'))} suggests discharge activity should be ruled out")
    if float(gases.get("CO", 0) or 0) >= 500:
        observations.append(f"carbon monoxide is elevated at {_ppm(gases.get('CO'))}, indicating possible paper insulation ageing")
    if not observations:
        observations.append("gas levels remain broadly stable against the current screening thresholds")

    ratios = {item["formula"]: item.get("value") for item in derived_features.get("ratios", [])}
    ratio_sentence = (
        f"Derived ratios show CH4/H2 at {(ratios.get('CH4 / H2') or 0):.2f}, "
        f"C2H4/C2H6 at {(ratios.get('C2H4 / C2H6') or 0):.2f}, "
        f"and C2H2/C2H4 at {(ratios.get('C2H2 / C2H4') or 0):.2f}."
    )

    diagnostic_sentence = (
        f"Diagnostic screening is aligned to Duval {diagnostics.get('duvalTriangle', {}).get('code', '-')}, "
        f"IEC Ratio {diagnostics.get('iecRatio', {}).get('code', '-')} ({diagnostics.get('iecRatio', {}).get('diagnosis', '-')}) and "
        f"Rogers Ratio {diagnostics.get('rogersRatio', {}).get('diagnosis', '-')}. "
        f"Current severity is {diagnostics.get('severityLevel', 'Moderate')}."
    )

    prediction_sentence = (
        f"The ML layer predicts {prediction.get('predicted_fault', 'an emerging fault pattern')} "
        f"with {prediction.get('risk_level', 'Moderate').lower()} risk and "
        f"{float(prediction.get('confidence', 0) or 0):.0f}% confidence."
    )

    similar_case_sentence = ""
    if top_case:
        similar_case_sentence = (
            f"Nearest historical match is {top_case.get('transformer')} at {top_case.get('voltage')} "
            f"with {float(top_case.get('similarity', 0) or 0):.0f}% similarity, "
            f"classified as {top_case.get('fault')}."
        )

    memory_case = _select_memory_case(similar_cases)
    memory_text = ""
    if memory_case:
        memory_text = " ".join(str(memory_case.get("assessment_full") or "").split())

    approved_guidance = _extract_guidance(top_case)

    recommendation = (
        "Continue routine monitoring."
        if prediction.get("risk_level") == "Low"
        else "Increase DGA monitoring frequency and review loading, cooling, and inspection actions before the next outage window."
    )

    if memory_case and memory_text:
        draft_text = " ".join([
            memory_text,
            (
                f"Auto-filled from approved assessment memory: {memory_case.get('transformer')} "
                f"({float(memory_case.get('similarity', 0) or 0):.0f}% similarity)."
            ),
            "Review and edit this text against the current sample before final approval.",
        ]).strip()
    else:
        draft_text = " ".join([
            f"Transformer {transformer.get('name') or transformer.get('id')} at {transformer.get('site') or 'the recorded site'} shows that "
            + ", ".join(observations)
            + ".",
            ratio_sentence,
            diagnostic_sentence,
            prediction_sentence,
            similar_case_sentence,
            approved_guidance,
            recommendation,
        ]).strip()

    approved_case_count = len([case for case in similar_cases.get("cases") or [] if case.get("has_approved_assessment")])
    return {
        "draft": draft_text,
        "recommendation": recommendation,
        "sources": {
            "summary_date": summary.get("latest_date"),
            "prediction_model": prediction.get("algorithm"),
            "similar_case_count": len(similar_cases.get("cases") or []),
            "approved_case_count": approved_case_count,
            "memory_reused": bool(memory_case),
            "memory_similarity": float(memory_case.get("similarity", 0) or 0) if memory_case else 0.0,
            "memory_transformer": memory_case.get("transformer") if memory_case else "",
        },
    }
