import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import api from "../../services/api";
import Summary from "./Summary";
import DerivedFeatures from "./DerivedFeatures";
import SimilarCases from "./SimilarCases";
import MLPrediction from "./MLPrediction";
import AssessmentDraft from "./AssessmentDraft";
import ModelInsights from "./ModelInsights";
import AssessmentHistory from "./AssessmentHistory";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { SearchableSelect } from "../ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";


const SECTION_TABS = [
  { id: "summary", label: "Summary" },
  { id: "features", label: "Derived Features" },
  { id: "cases", label: "Similar Cases" },
  { id: "prediction", label: "ML Prediction" },
  { id: "draft", label: "Assessment Draft" },
  { id: "history", label: "Approved History" },
  { id: "insights", label: "Model Insights" },
];


function formatTxLabel(transformer) {
  const site = (transformer?.site || "").trim() || "Unknown Site";
  const mnemonic = (transformer?.mnemonic || "").trim();
  const name = (transformer?.name || "").trim();
  const fallback = (transformer?.id || "").trim() || "Unknown";
  return `${mnemonic || name || fallback} - ${site}`;
}

function formatResultOptionLabel(result) {
  const date = (result?.date || "").trim() || "Unknown Date";
  const testType = (result?.testType || "").trim();
  const suffix = testType ? ` (${testType})` : "";
  return `${date}${suffix}`;
}

export default function AIAssessment({
  transformers,
  results,
  selectedTx,
  onSelectTx,
  backendOnline,
  onViewResult,
  onSaveAssessment,
}) {
  const transformersWithResults = useMemo(() => {
    const idsWithResults = new Set((results || []).map((row) => row.transformerId));
    return (transformers || [])
      .filter((transformer) => idsWithResults.has(transformer.id));
  }, [results, transformers]);
  const [siteQuery, setSiteQuery] = useState("");
  const siteOptions = useMemo(() => {
    return [...new Set(transformersWithResults.map((transformer) => (transformer.site || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((site) => ({ value: site, label: site }));
  }, [transformersWithResults]);
  const txsInSite = useMemo(() => {
    if (!siteQuery) return transformersWithResults;
    return transformersWithResults.filter((transformer) => ((transformer.site || "").trim() || "Unknown Site") === siteQuery);
  }, [siteQuery, transformersWithResults]);
  const transformerOptions = useMemo(() => {
    return txsInSite.map((transformer) => ({
      value: transformer.id,
      label: formatTxLabel(transformer),
    }));
  }, [txsInSite]);
  const serialOptions = useMemo(() => {
    return txsInSite.map((transformer) => ({
      value: transformer.id,
      label: `${(transformer.serialNumber || "-").trim() || "-"} (${(transformer.mnemonic || transformer.name || transformer.id || "Unknown").trim()})`,
    }));
  }, [txsInSite]);

  const activeTransformerId = selectedTx || transformerOptions[0]?.value || "";
  const resultOptions = useMemo(() => {
    return (results || [])
      .filter((row) => row.transformerId === activeTransformerId)
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""))
      .map((row) => ({
        value: row.id,
        label: formatResultOptionLabel(row),
      }));
  }, [activeTransformerId, results]);

  const [selectedResultId, setSelectedResultId] = useState("");
  const [activeSection, setActiveSection] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payloads, setPayloads] = useState({
    summary: null,
    features: null,
    similarCases: null,
    prediction: null,
    draft: null,
    insights: null,
    history: null,
  });
  const [draftText, setDraftText] = useState("");
  const [generatedDraftText, setGeneratedDraftText] = useState("");
  const [manualBaselineText, setManualBaselineText] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [saveState, setSaveState] = useState({ saving: false, message: "", error: "" });
  const [historyState, setHistoryState] = useState({ saving: false, message: "", error: "" });
  const loadedResultRef = useRef("");

  useEffect(() => {
    if (!selectedTx && transformerOptions[0]?.value && onSelectTx) {
      onSelectTx(transformerOptions[0].value);
    }
  }, [selectedTx, transformerOptions, onSelectTx]);

  useEffect(() => {
    if (!resultOptions.length) {
      if (selectedResultId) setSelectedResultId("");
      return;
    }
    const hasCurrent = resultOptions.some((option) => option.value === selectedResultId);
    if (!hasCurrent) {
      setSelectedResultId(resultOptions[0].value);
    }
  }, [resultOptions, selectedResultId]);

  const refreshData = useCallback(async () => {
    const hasSelectedResult = resultOptions.some((option) => option.value === selectedResultId);
    if (!activeTransformerId || !selectedResultId || !backendOnline || !hasSelectedResult) {
      setPayloads({
        summary: null,
        features: null,
        similarCases: null,
        prediction: null,
        draft: null,
        insights: null,
        history: null,
      });
      loadedResultRef.current = "";
      setGeneratedDraftText("");
      setManualBaselineText("");
      setDraftText("");
      setDraftDirty(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSaveState({ saving: false, message: "", error: "" });
    setHistoryState({ saving: false, message: "", error: "" });

    try {
      const [summary, features, similarCases, prediction, draft, insights, history] = await Promise.all([
        api.getAiSummary(activeTransformerId, selectedResultId),
        api.getAiFeatures(activeTransformerId, selectedResultId),
        api.getAiSimilarCases(activeTransformerId, 50, selectedResultId),
        api.getAiPrediction(activeTransformerId, selectedResultId),
        api.generateAiAssessment(activeTransformerId, selectedResultId),
        api.getAiModelInsights(activeTransformerId, selectedResultId),
        api.getAiAssessmentHistory(activeTransformerId, 100),
      ]);

      setPayloads({ summary, features, similarCases, prediction, draft, insights, history });
      const selectedResultKey = summary?.selected_result_id || summary?.latest_result_id || selectedResultId;
      const generatedText = draft?.draft || "";
      const approvedForSelected = (history?.items || []).find((item) => item.resultId === selectedResultKey) || null;
      const approvedManualText = (approvedForSelected?.assessmentText || "").trim();
      const initialManualText = approvedManualText || generatedText;
      setGeneratedDraftText(generatedText);
      setManualBaselineText(approvedManualText);
      if (loadedResultRef.current !== selectedResultKey) {
        setDraftText(initialManualText);
        setDraftDirty(false);
        loadedResultRef.current = selectedResultKey;
      }
    } catch (err) {
      setError(err.message || "Failed to load AI assessment data.");
    } finally {
      setLoading(false);
    }
  }, [activeTransformerId, backendOnline, resultOptions, selectedResultId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const currentApprovedEntry = useMemo(() => {
    const selectedResultKey = payloads.summary?.selected_result_id || payloads.summary?.latest_result_id;
    return (payloads.history?.items || []).find((item) => item.resultId === selectedResultKey) || null;
  }, [payloads.history, payloads.summary]);

  const resolveAssessmentSource = useCallback((approved, explicitSource = "") => {
    if (explicitSource) return explicitSource;
    if (!approved) return "draft";
    const generatedDraft = (payloads.draft?.draft || "").trim();
    const currentText = draftText.trim();
    if (!generatedDraft) return "manual_edit";
    return currentText === generatedDraft ? "ai_generated" : "manual_edit";
  }, [draftText, payloads.draft]);

  const handleRegenerateDraft = useCallback(async () => {
    if (!activeTransformerId || !selectedResultId || !backendOnline) return;
    setSaveState({ saving: false, message: "", error: "" });
    try {
      const draft = await api.generateAiAssessment(activeTransformerId, selectedResultId);
      setPayloads((prev) => ({ ...prev, draft }));
      setGeneratedDraftText(draft?.draft || "");
      setSaveState({
        saving: false,
        message: "AI draft regenerated. Manual edit text is unchanged.",
        error: "",
      });
    } catch (err) {
      setSaveState({ saving: false, message: "", error: err.message || "Failed to regenerate draft." });
    }
  }, [activeTransformerId, backendOnline, selectedResultId]);

  const handleSaveDraft = useCallback(async (approved = false, options = {}) => {
    const selectedResultKey = payloads.summary?.selected_result_id || payloads.summary?.latest_result_id;
    if (!onSaveAssessment || !selectedResultKey) return;
    setSaveState({ saving: true, message: "", error: "" });
    try {
      await onSaveAssessment(selectedResultKey, draftText, {
        approved,
        transformerId: activeTransformerId,
        source: resolveAssessmentSource(approved, options.source),
        historyId: options.historyId,
      });
      setDraftDirty(false);
      await refreshData();
      setSaveState({
        saving: false,
        message: approved
          ? "Assessment approved and stored in approved history."
          : "Draft saved to selected result notes.",
        error: "",
      });
    } catch (err) {
      setSaveState({ saving: false, message: "", error: err.message || "Failed to save assessment draft." });
    }
  }, [activeTransformerId, draftText, onSaveAssessment, payloads.summary, refreshData, resolveAssessmentSource]);

  const handleLoadHistoryToDraft = useCallback((item) => {
    setDraftText(item.assessmentText || "");
    setDraftDirty(true);
    setSaveState({ saving: false, message: "Loaded approved assessment into draft editor.", error: "" });
    setActiveSection("draft");
  }, []);

  const handleUpdateHistory = useCallback(async (item, assessmentText) => {
    if (!onSaveAssessment) return;
    setHistoryState({ saving: true, message: "", error: "" });
    try {
      await onSaveAssessment(item.resultId, assessmentText, {
        approved: true,
        transformerId: item.transformerId,
        historyId: item.id,
        source: "manual_edit",
      });
      await refreshData();
      setHistoryState({ saving: false, message: "Approved assessment history updated.", error: "" });
    } catch (err) {
      setHistoryState({ saving: false, message: "", error: err.message || "Failed to update approved assessment." });
      throw err;
    }
  }, [onSaveAssessment, refreshData]);

  const handleImportHistory = useCallback(async (items) => {
    if (!backendOnline) {
      throw new Error("Backend must be online to import assessments.");
    }
    setHistoryState({ saving: true, message: "", error: "" });
    try {
      const result = await api.importAiAssessmentHistory({ items, upsert: true });
      await refreshData();
      setHistoryState({
        saving: false,
        message: `Imported ${result.total}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
        error: "",
      });
      return result;
    } catch (err) {
      setHistoryState({ saving: false, message: "", error: err.message || "Failed to import approved assessments." });
      throw err;
    }
  }, [backendOnline, refreshData]);

  const renderActiveSection = () => {
    if (!payloads.summary && !loading && !error) {
      return (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">
          Select a transformer and sample date from DGA history to open the AI assessment workflow.
        </Card>
      );
    }

    if (activeSection === "summary") {
      return <Summary summary={payloads.summary} />;
    }
    if (activeSection === "features") {
      return <DerivedFeatures features={payloads.features} />;
    }
    if (activeSection === "cases") {
      return <SimilarCases similarCases={payloads.similarCases} onViewResult={onViewResult} transformers={transformers} />;
    }
    if (activeSection === "prediction") {
      return <MLPrediction prediction={payloads.prediction} summary={payloads.summary} />;
    }
    if (activeSection === "draft") {
      return (
        <AssessmentDraft
          draft={payloads.draft}
          summary={payloads.summary}
          prediction={payloads.prediction}
          similarCases={payloads.similarCases}
          generatedValue={generatedDraftText}
          baselineManualValue={manualBaselineText}
          value={draftText}
          dirty={draftDirty}
          saveState={saveState}
          approvedEntry={currentApprovedEntry}
          onChange={(value) => {
            setDraftText(value);
            setDraftDirty(true);
          }}
          onLoadApproved={() => {
            if (!currentApprovedEntry) return;
            setDraftText(currentApprovedEntry.assessmentText || "");
            setDraftDirty(true);
          }}
          onUseGenerated={() => {
            setDraftText(generatedDraftText || "");
            setDraftDirty(true);
            setSaveState({ saving: false, message: "Loaded latest AI draft into manual editor.", error: "" });
          }}
          onResetManual={() => {
            setDraftText(manualBaselineText || "");
            setDraftDirty(false);
            setSaveState({ saving: false, message: "Manual editor reset to original manual assessment.", error: "" });
          }}
          onRegenerate={handleRegenerateDraft}
          onSave={() => handleSaveDraft(false)}
          onApprove={() => handleSaveDraft(true, { historyId: currentApprovedEntry?.id })}
          onViewResult={onViewResult}
        />
      );
    }
    if (activeSection === "history") {
      return (
        <div className="flex flex-col gap-3">
          {(historyState.message || historyState.error) && (
            <Card
              variant="glass"
              className={`p-3 text-xs ${historyState.error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"}`}
            >
              {historyState.error || historyState.message}
            </Card>
          )}
          <AssessmentHistory
            history={payloads.history}
            saving={historyState.saving}
            onLoadToDraft={handleLoadHistoryToDraft}
            onSaveHistory={handleUpdateHistory}
            onViewResult={onViewResult}
            onImportHistory={handleImportHistory}
          />
        </div>
      );
    }
    return <ModelInsights insights={payloads.insights} prediction={payloads.prediction} />;
  };

  return (
    <div className="flex flex-col gap-4">
      <Card variant="glass" className="p-5">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-foreground text-sm mb-1 font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-brand" />
              AI Assessment
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-[760px]">
              Transparent pre-AI review, similarity search, model prediction, draft interpretation, approved case memory, and model explanation for the selected transformer and sample date.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Select Transformer</div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1fr_1.5fr_1fr_1fr]">
              <SearchableSelect
                label="1. Site"
                value={siteQuery}
                placeholder="Select site..."
                options={siteOptions}
                onChange={(value) => {
                  setSiteQuery(value);
                  onSelectTx?.(null);
                }}
                disabled={!siteOptions.length}
              />
              <SearchableSelect
                label="2. Transformer (Name / Mnemonic)"
                value={activeTransformerId || ""}
                placeholder="Select transformer..."
                options={transformerOptions}
                onChange={(value) => onSelectTx?.(value)}
                disabled={!transformerOptions.length}
              />
              <SearchableSelect
                label="3. Serial Number"
                value={activeTransformerId || ""}
                placeholder="Select by serial no..."
                options={serialOptions}
                onChange={(value) => onSelectTx?.(value)}
                disabled={!serialOptions.length}
              />
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-muted-foreground text-xs font-medium">4. Sample Date</label>
                <Select
                  value={selectedResultId}
                  onValueChange={setSelectedResultId}
                  disabled={!activeTransformerId || !resultOptions.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={resultOptions.length ? "Select date..." : "No DGA records"} />
                  </SelectTrigger>
                  <SelectContent>
                    {resultOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(activeTransformerId || siteQuery) && (
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  onClick={() => {
                    setSiteQuery("");
                    onSelectTx?.(null);
                  }}
                >
                  Clear
                </Button>
              )}
              {siteQuery && (
                <div className="text-[11px] text-brand">
                  {txsInSite.length} transformer(s) in {siteQuery}
                </div>
              )}
            </div>
          </div>
        </div>

        {payloads.summary?.latest_date && (
          <div className="mt-3 text-muted-foreground text-xs">
            Selected sample date: <span className="text-foreground font-semibold">{payloads.summary.latest_date}</span>
          </div>
        )}

        <Tabs value={activeSection} onValueChange={setActiveSection} className="mt-4">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            {SECTION_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-3 py-1.5">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Card>

      {!backendOnline && (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">
          AI Assessment requires the Python backend because this page calls the `/api/ai/*` endpoints.
        </Card>
      )}

      {backendOnline && loading && (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">
          Loading AI assessment data...
        </Card>
      )}

      {backendOnline && error && (
        <Card variant="glass" className="border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {backendOnline && !loading && !error && renderActiveSection()}
    </div>
  );
}
