const AI_ASSESSMENT_BLOCK = /\[AI_ASSESSMENT_START\]([\s\S]*?)\[AI_ASSESSMENT_END\]/;

export function extractAssessmentFromNotes(notes) {
  const text = String(notes || "").trim();
  if (!text) return "";

  const blockMatch = text.match(AI_ASSESSMENT_BLOCK);
  if (!blockMatch) return text;

  const lines = String(blockMatch[1] || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Status:") && !line.startsWith("Updated:"));

  return lines.join("\n").trim() || text;
}

export function buildAssessmentLookup(approvedHistory = []) {
  const byResultId = new Map();
  const byDate = new Map();

  approvedHistory.forEach((item) => {
    if (!item) return;

    const resultId = String(item.resultId || "").trim();
    const resultDate = String(item.resultDate || "").trim();

    if (resultId && !byResultId.has(resultId)) {
      byResultId.set(resultId, item);
    }
    if (resultDate && !byDate.has(resultDate)) {
      byDate.set(resultDate, item);
    }
  });

  return { byResultId, byDate };
}

export function resolveAssessmentText({ notes, resultId, resultDate, assessmentLookup }) {
  const historyItem = assessmentLookup?.byResultId?.get(String(resultId || "").trim())
    || assessmentLookup?.byDate?.get(String(resultDate || "").trim());
  const approvedText = String(historyItem?.assessmentText || "").trim();
  return approvedText || extractAssessmentFromNotes(notes);
}
