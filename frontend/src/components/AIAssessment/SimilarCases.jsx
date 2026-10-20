import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SimilarCases3DGraph from "./SimilarCases3DGraph";
import { Card } from "../ui/card";
import { Badge as UIBadge } from "../ui/badge";
import { Button } from "../ui/button";

const COMPARE_GAS_KEYS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2"];
const COMPARE_GAS_LABELS = {
  H2: "Hydrogen (H2)",
  CH4: "Methane (CH4)",
  C2H6: "Ethane (C2H6)",
  C2H4: "Ethylene (C2H4)",
  C2H2: "Acetylene (C2H2)",
  CO: "Carbon Monoxide (CO)",
  CO2: "Carbon Dioxide (CO2)",
};
const TARGET_COMPARE_COLOR = "var(--accent)";
const COMPARE_CASE_COLORS = ["#22c55e", "#f59e0b", "#a855f7", "#ef4444"];
const MAX_COMPARE_CASES = 4;

function SourceBadge({ item }) {
  if (item.has_approved_assessment) {
    return <UIBadge variant="success">Approved history</UIBadge>;
  }
  if (item.assessment_source === "result_notes") {
    return <UIBadge className="border-brand/35 bg-brand/15 text-brand">Result notes</UIBadge>;
  }
  return <UIBadge variant="outline">Generated</UIBadge>;
}

function SimilarityFeaturePills({ features = [] }) {
  if (!features.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-3">
      {features.map((item) => (
        <UIBadge
          key={item.feature}
          variant="outline"
          className="border-brand/30 bg-brand/15 text-brand"
          style={{
            borderColor: "var(--accent-border)",
          }}
        >
          {item.label} {item.influence_pct}%
        </UIBadge>
      ))}
    </div>
  );
}

function CaseExplanation({ item }) {
  const drivers = item.explanation?.top_supporting || [];
  if (!drivers.length) return null;
  return (
    <div className="flex gap-1.5 flex-wrap mt-2">
      {drivers.slice(0, 2).map((driver) => (
        <UIBadge
          key={driver.feature}
          variant="outline"
          className="border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
          style={{
            borderColor: "rgba(34, 197, 94, 0.35)",
          }}
        >
          {driver.label}
        </UIBadge>
      ))}
    </div>
  );
}

function normalizeDate(dateValue) {
  if (!dateValue) return "-";
  const text = String(dateValue).trim();
  if (!text) return "-";
  return text;
}

function toNum(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNumber(value, maximumFractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatPpm(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric, 1)} ppm`;
}

function formatSimilarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric.toFixed(1)}%`;
}

function formatDgaSummary(dgaValues = {}) {
  return COMPARE_GAS_KEYS
    .map((gas) => `${gas}: ${formatNumber(dgaValues?.[gas], 1)}`)
    .join(" | ");
}

function getPatternSimilarityDetail(item) {
  const detail = item?.pattern_similarity_detail || {};
  const dga = formatSimilarity(detail.dga_similarity);
  const context = Number.isFinite(Number(detail.context_similarity))
    ? formatSimilarity(detail.context_similarity)
    : "";
  const weights = {
    dga: Number(detail?.weights?.dga) || 100,
    context: Number(detail?.weights?.context) || 0,
  };
  return { dga, context, weights };
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function caseId(item) {
  if (!item) return "";
  return String(item.record_id || `${item.transformer_id || item.transformer || "case"}::${item.date || ""}`);
}

function getCaseTitle(item) {
  const site = (item?.site || "Unknown Site").trim() || "Unknown Site";
  const transformer = (item?.transformer || item?.transformer_id || "Unknown Transformer").trim() || "Unknown Transformer";
  return `${site} - ${transformer}`;
}

function getCaseMeta(item) {
  return [normalizeDate(item?.date), item?.voltage || "Voltage -", item?.fault || "Fault -"]
    .filter(Boolean)
    .join(" | ");
}

function buildCompareSeries(targetCase, selectedCases = []) {
  if (!targetCase) return [];

  const series = [{
    key: "currentSample",
    color: TARGET_COMPARE_COLOR,
    legendLabel: `Current sample (${formatSimilarity(targetCase.similarity)})`,
    shortLabel: "Current sample",
    caseItem: targetCase,
    isTarget: true,
  }];

  selectedCases.slice(0, MAX_COMPARE_CASES).forEach((item, index) => {
    const transformerLabel = item.transformer || item.transformer_id || `Case ${index + 1}`;
    const safeId = caseId(item).replace(/[^a-zA-Z0-9_]/g, "_");
    series.push({
      key: `compare_${index}_${safeId}`,
      color: COMPARE_CASE_COLORS[index % COMPARE_CASE_COLORS.length],
      legendLabel: `${transformerLabel} (${formatSimilarity(item.similarity)})`,
      shortLabel: transformerLabel,
      caseItem: item,
      isTarget: false,
    });
  });

  return series;
}

function buildCompareRows(series = []) {
  return COMPARE_GAS_KEYS.map((gas) => {
    const row = { gas, label: COMPARE_GAS_LABELS[gas] || gas };
    series.forEach((entry) => {
      row[entry.key] = toNum(entry.caseItem?.dga_values?.[gas]);
    });
    return row;
  });
}

function buildPatternRows(series = []) {
  return COMPARE_GAS_KEYS.map((gas) => {
    const row = { gas, label: COMPARE_GAS_LABELS[gas] || gas };
    series.forEach((entry) => {
      row[entry.key] = toNum(entry.caseItem?.pattern_profile?.[gas]);
    });
    return row;
  });
}

function CompareChartTooltip({ active, payload, label, seriesMap, chartMode }) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((item) => Number.isFinite(Number(item?.value)))
    .map((item) => ({ item, series: seriesMap.get(String(item.dataKey)) }))
    .sort((left, right) => Number(right.item.value || 0) - Number(left.item.value || 0));

  return (
    <div className="rounded-lg border border-border bg-surface-input px-3 py-2 text-xs shadow-lg">
      <div className="text-primary font-semibold">{COMPARE_GAS_LABELS[label] || label}</div>
      <div className="text-primary-muted text-[10px] uppercase tracking-wide mb-2">{label}</div>
      <div className="space-y-1.5">
        {rows.map(({ item, series }) => (
          <div key={`tooltip-${item.dataKey}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-primary truncate">{series?.legendLabel || item.name}</span>
            </div>
            <span className="text-primary font-semibold shrink-0">
              {chartMode === "pattern" ? `${formatNumber(item.value, 1)}%` : formatPpm(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDefaultGasVisibility() {
  const visibility = {};
  COMPARE_GAS_KEYS.forEach((gas) => {
    visibility[gas] = true;
  });
  return visibility;
}

function GasAxisTick({ x, y, payload, visibleMap, onToggle }) {
  const gas = payload?.value;
  const enabled = visibleMap?.[gas] !== false;
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={() => onToggle?.(gas)}
      style={{ cursor: "pointer" }}
    >
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill={enabled ? "#94a3b8" : "#64748b"}
        style={{ textDecoration: enabled ? "none" : "line-through", userSelect: "none" }}
      >
        {gas}
      </text>
    </g>
  );
}

function groupCasesBySiteAndTransformer(cases = []) {
  const siteMap = new Map();

  cases.forEach((item) => {
    const site = (item.site || "Unknown Site").trim() || "Unknown Site";
    const transformer = (item.transformer || item.transformer_id || "Unknown Transformer").trim() || "Unknown Transformer";

    if (!siteMap.has(site)) {
      siteMap.set(site, new Map());
    }

    const transformerMap = siteMap.get(site);
    if (!transformerMap.has(transformer)) {
      transformerMap.set(transformer, []);
    }

    transformerMap.get(transformer).push(item);
  });

  return Array.from(siteMap.entries())
    .map(([site, transformerMap]) => {
      const transformers = Array.from(transformerMap.entries())
        .map(([transformer, items]) => {
          const sortedItems = items
            .slice()
            .sort((a, b) => (Number(b.similarity) || 0) - (Number(a.similarity) || 0) || (b.date || "").localeCompare(a.date || ""));
          const similarityValues = sortedItems
            .map((row) => Number(row.similarity))
            .filter((value) => Number.isFinite(value));
          const topSimilarity = similarityValues.length ? Math.max(...similarityValues) : 0;
          const avgSimilarity = similarityValues.length
            ? similarityValues.reduce((acc, value) => acc + value, 0) / similarityValues.length
            : 0;

          return {
            transformer,
            items: sortedItems,
            topSimilarity,
            avgSimilarity,
          };
        })
        .sort((a, b) => {
          const aTop = Number(a.items[0]?.similarity) || 0;
          const bTop = Number(b.items[0]?.similarity) || 0;
          return bTop - aTop || a.transformer.localeCompare(b.transformer);
        });

      const totalCases = transformers.reduce((acc, row) => acc + row.items.length, 0);
      const siteSimilarityValues = transformers.flatMap((row) => row.items)
        .map((row) => Number(row.similarity))
        .filter((value) => Number.isFinite(value));
      const topSimilarity = siteSimilarityValues.length ? Math.max(...siteSimilarityValues) : 0;
      const avgSimilarity = siteSimilarityValues.length
        ? siteSimilarityValues.reduce((acc, value) => acc + value, 0) / siteSimilarityValues.length
        : 0;
      return { site, transformers, totalCases, topSimilarity, avgSimilarity };
    })
    .sort((a, b) => {
      const aTop = Number(a.transformers[0]?.items[0]?.similarity) || 0;
      const bTop = Number(b.transformers[0]?.items[0]?.similarity) || 0;
      return bTop - aTop || a.site.localeCompare(b.site);
    });
}

function transformerKey(site, transformer) {
  return `${site}::${transformer}`;
}

function enrichCaseWithTransformerMeta(item, transformerLookup) {
  if (!item) return item;

  const transformerId = pickFirstText(item.transformer_id, item.transformerId);
  const transformerMeta = transformerLookup.get(transformerId);
  return {
    ...item,
    transformer_id: transformerId || item.transformer_id || "",
    transformer: pickFirstText(
      item.transformer,
      item.transformer_name,
      item.name,
      transformerMeta?.mnemonic,
      transformerMeta?.name,
      transformerId,
    ),
    site: pickFirstText(item.site, transformerMeta?.site),
    voltage: pickFirstText(item.voltage, transformerMeta?.voltage),
    brand: pickFirstText(
      item.brand,
      item.transformer_brand,
      item.tx_brand,
      transformerMeta?.brand,
    ),
    maker: pickFirstText(
      item.maker,
      item.manufacturer,
      item.transformer_maker,
      item.oem,
      transformerMeta?.maker,
    ),
    oilBrand: pickFirstText(
      item.oilBrand,
      item.oil_brand,
      item.oilBrandUsed,
      item.oil_brand_used,
      transformerMeta?.oilBrand,
    ),
  };
}

export default function SimilarCases({ similarCases, onViewResult, transformers = [] }) {
  const transformerLookup = useMemo(
    () => new Map((transformers || []).map((item) => [normalizeText(item.id), item])),
    [transformers],
  );
  const targetCase = useMemo(
    () => enrichCaseWithTransformerMeta(similarCases?.target_case || null, transformerLookup),
    [similarCases?.target_case, transformerLookup],
  );
  const cases = useMemo(
    () => (similarCases?.cases || []).map((item) => enrichCaseWithTransformerMeta(item, transformerLookup)),
    [similarCases?.cases, transformerLookup],
  );
  const topFeatures = similarCases?.explainability?.top_features || [];
  const plot3d = similarCases?.plot_3d || null;
  const comparePattern = similarCases?.compare_pattern || null;
  const defaultChartMode = comparePattern?.chart_mode_default || "pattern";

  const groupedSites = useMemo(() => groupCasesBySiteAndTransformer(cases), [cases]);
  const caseLookup = useMemo(() => new Map(cases.map((item) => [caseId(item), item])), [cases]);
  const compareResetKey = useMemo(
    () => [targetCase?.record_id || "", ...cases.map((item) => caseId(item))].join("|"),
    [cases, targetCase?.record_id],
  );

  const [expandedSites, setExpandedSites] = useState({});
  const [expandedTransformers, setExpandedTransformers] = useState({});
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [activeCompareSeriesKey, setActiveCompareSeriesKey] = useState(null);
  const [compareChartMode, setCompareChartMode] = useState(defaultChartMode);
  const [visibleGases, setVisibleGases] = useState(() => buildDefaultGasVisibility());
  const [compareNotice, setCompareNotice] = useState("");

  const selectedCompareCases = useMemo(
    () => selectedCompareIds.map((id) => caseLookup.get(id)).filter(Boolean),
    [caseLookup, selectedCompareIds],
  );
  const compareSeries = useMemo(
    () => buildCompareSeries(targetCase, selectedCompareCases),
    [selectedCompareCases, targetCase],
  );
  const compareRows = useMemo(() => buildCompareRows(compareSeries), [compareSeries]);
  const patternRows = useMemo(() => buildPatternRows(compareSeries), [compareSeries]);
  const visibleCompareRows = useMemo(
    () => compareRows.filter((row) => visibleGases[row.gas] !== false),
    [compareRows, visibleGases],
  );
  const visiblePatternRows = useMemo(
    () => patternRows.filter((row) => visibleGases[row.gas] !== false),
    [patternRows, visibleGases],
  );
  const activeChartRows = compareChartMode === "pattern" ? visiblePatternRows : visibleCompareRows;
  const allGasesVisible = useMemo(
    () => COMPARE_GAS_KEYS.every((gas) => visibleGases[gas] !== false),
    [visibleGases],
  );
  const compareSeriesMap = useMemo(
    () => new Map(compareSeries.map((entry) => [entry.key, entry])),
    [compareSeries],
  );
  const renderedCompareSeries = useMemo(() => {
    if (!activeCompareSeriesKey) return compareSeries;
    const activeSeries = compareSeries.find((entry) => entry.key === activeCompareSeriesKey);
    if (!activeSeries) return compareSeries;
    return [
      ...compareSeries.filter((entry) => entry.key !== activeCompareSeriesKey),
      activeSeries,
    ];
  }, [activeCompareSeriesKey, compareSeries]);

  const toggleSite = (site) => {
    setExpandedSites((prev) => ({ ...prev, [site]: !prev[site] }));
  };

  const toggleTransformer = (site, transformer) => {
    const key = transformerKey(site, transformer);
    setExpandedTransformers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearCompareSelection = () => {
    setSelectedCompareIds([]);
    setCompareModalOpen(false);
    setCompareChartMode(defaultChartMode);
    setCompareNotice("");
    setActiveCompareSeriesKey(null);
    setVisibleGases(buildDefaultGasVisibility());
  };

  const toggleCompareCase = (item) => {
    if (!targetCase?.dga_values || !item?.dga_values) {
      setCompareNotice("DGA comparison data is not available for this case.");
      return;
    }

    const id = caseId(item);
    if (!id) return;

    const alreadySelected = selectedCompareIds.includes(id);
    if (alreadySelected) {
      const nextIds = selectedCompareIds.filter((value) => value !== id);
      setSelectedCompareIds(nextIds);
      setCompareNotice("");
      if (!nextIds.length) {
        setCompareModalOpen(false);
        setActiveCompareSeriesKey(null);
      }
      return;
    }

    if (selectedCompareIds.length >= MAX_COMPARE_CASES) {
      setCompareNotice(`You can compare up to ${MAX_COMPARE_CASES} similar cases at one time.`);
      return;
    }

    setSelectedCompareIds([...selectedCompareIds, id]);
    setCompareNotice("");
  };

  const openCompareModal = () => {
    if (!selectedCompareCases.length) return;
    setCompareModalOpen(true);
    setCompareNotice("");
  };

  const toggleGasVisibility = (gasKey) => {
    setVisibleGases((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, gasKey)) return prev;
      const currentlyVisible = prev[gasKey] !== false;
      if (currentlyVisible) {
        const visibleCount = COMPARE_GAS_KEYS.filter((gas) => prev[gas] !== false).length;
        if (visibleCount <= 1) return prev;
      }
      return { ...prev, [gasKey]: !currentlyVisible };
    });
  };

  const showAllGases = () => {
    setVisibleGases(buildDefaultGasVisibility());
  };

  useEffect(() => {
    clearCompareSelection();
  }, [compareResetKey]);

  useEffect(() => {
    if (!compareModalOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setCompareModalOpen(false);
        setActiveCompareSeriesKey(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [compareModalOpen]);

  if (!similarCases) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No similar case data available.</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Similarity Search</div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          Input uses gas values, ratios, and transformer context. Retrieval blends {similarCases.algorithm?.join(" + ") || "similarity metrics"} and prioritizes approved historical assessments when available.
        </div>
        <div className="text-muted-foreground text-xs mt-2">
          Explainability method: <span className="text-foreground">{similarCases.explainability?.method || "-"}</span>
        </div>
        <SimilarityFeaturePills features={topFeatures} />
      </Card>

      {plot3d?.points?.length > 0 && (
        <SimilarCases3DGraph plot3d={plot3d} height={420} />
      )}

      <Card variant="glass" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-1">Case Comparison</div>
            <div className="text-muted-foreground text-xs leading-relaxed max-w-[720px]">
              Select up to {MAX_COMPARE_CASES} similar cases to compare against the current sample. The modal shows similarity percentage, DGA gas values, and a multi-line gas chart across all selected cases.
            </div>
          </div>
          <div className="text-muted-foreground text-xs text-right">
            Current sample: <span className="text-foreground">{getCaseTitle(targetCase)}</span>
            <div className="mt-1">Selected for compare: {selectedCompareCases.length} / {MAX_COMPARE_CASES}</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          <Button type="button" variant="glass-brand" size="sm" disabled={!selectedCompareCases.length} onClick={openCompareModal}>
            Open Compare
          </Button>
          <Button type="button" variant="glass" size="sm" disabled={!selectedCompareCases.length} onClick={clearCompareSelection}>
            Clear Selection
          </Button>
        </div>

        {compareNotice && <div className="text-warning text-xs mt-3">{compareNotice}</div>}

        {selectedCompareCases.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {selectedCompareCases.map((item) => (
              <Button
                key={`selected-${caseId(item)}`}
                type="button"
                variant="glass"
                size="sm"
                className="h-auto py-1 text-brand"
                onClick={() => toggleCompareCase(item)}
                style={{
                  background: "var(--accent-soft-strong)",
                  borderColor: "var(--accent-border-strong)",
                  color: "var(--accent)",
                }}
              >
                {getCaseTitle(item)} {formatSimilarity(item.similarity)} x
              </Button>
            ))}
          </div>
        )}
      </Card>

      {cases.length === 0 ? (
        <Card variant="glass" className="p-5 text-sm text-muted-foreground">No comparable historical cases were found in the current dataset.</Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedSites.map((siteGroup) => {
            const siteExpanded = Boolean(expandedSites[siteGroup.site]);

            return (
              <Card key={siteGroup.site} variant="glass" className="p-4">
                <button
                  type="button"
                  onClick={() => toggleSite(siteGroup.site)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-left"
                  aria-expanded={siteExpanded}
                >
                  <div className="text-primary text-sm font-semibold flex items-center gap-2">
                    <span className="text-accent">{siteExpanded ? "v" : ">"}</span>
                    <span>Site: {siteGroup.site}</span>
                  </div>
                  <div className="text-primary-dim text-xs text-right">
                    Best {formatSimilarity(siteGroup.topSimilarity)} | Avg {formatSimilarity(siteGroup.avgSimilarity)} | {siteGroup.transformers.length} transformer(s) | {siteGroup.totalCases} test record(s)
                  </div>
                </button>

                {siteExpanded && (
                  <div className="mt-3 flex flex-col gap-3">
                    {siteGroup.transformers.map((txGroup) => {
                      const key = transformerKey(siteGroup.site, txGroup.transformer);
                      const txExpanded = Boolean(expandedTransformers[key]);

                      return (
                        <div key={key} className="rounded-xl border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleTransformer(siteGroup.site, txGroup.transformer)}
                            className="w-full px-3 py-2 border-b border-border bg-surface-input flex items-center justify-between gap-3 text-left"
                            aria-expanded={txExpanded}
                          >
                            <div className="text-primary text-xs font-semibold flex items-center gap-2">
                              <span className="text-accent">{txExpanded ? "v" : ">"}</span>
                              <span>{txGroup.transformer}</span>
                            </div>
                            <div className="text-primary-dim text-[11px] text-right">
                              Best {formatSimilarity(txGroup.topSimilarity)} | Avg {formatSimilarity(txGroup.avgSimilarity)} | {txGroup.items.length} test record(s)
                            </div>
                          </button>

                          {txExpanded && (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr>
                                    {["Test Date", "Voltage", "Brand", "Maker", "Oil Brand", "DGA Result (ppm)", "Similarity", "Pattern (TF)", "Fault", "Assessment", "Action"].map((header) => (
                                      <th key={header} className="text-primary-muted p-3 text-left text-[10px] uppercase tracking-wide border-b border-border">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {txGroup.items.map((item) => {
                                    const isSelected = selectedCompareIds.includes(caseId(item));
                                    return (
                                      <tr key={item.record_id} className="border-b border-border align-top">
                                        <td className="p-3 text-primary font-semibold whitespace-nowrap">{normalizeDate(item.date)}</td>
                                        <td className="p-3 text-primary">{item.voltage || "-"}</td>
                                        <td className="p-3 text-primary">{item.brand || "-"}</td>
                                        <td className="p-3 text-primary">{item.maker || "-"}</td>
                                        <td className="p-3 text-primary">{item.oilBrand || "-"}</td>
                                        <td className="p-3 text-primary min-w-[220px]">{formatDgaSummary(item.dga_values)}</td>
                                        <td className="p-3 text-accent font-bold">{item.similarity}%</td>
                                        <td className="p-3 text-primary font-semibold">
                                          <div>{formatSimilarity(item.pattern_similarity)}</div>
                                          <div className="text-primary-muted text-[10px] mt-1">
                                            {(() => {
                                              const detail = getPatternSimilarityDetail(item);
                                              return `DGA ${detail.dga}${detail.context ? ` | Context ${detail.context}` : ""}`;
                                            })()}
                                          </div>
                                          <div className="text-primary-muted text-[10px]">
                                            {(() => {
                                              const detail = getPatternSimilarityDetail(item);
                                              return `W: DGA ${detail.weights.dga}%${detail.weights.context > 0 ? ` + Context ${detail.weights.context}%` : ""}`;
                                            })()}
                                          </div>
                                        </td>
                                        <td className="p-3 text-primary">{item.fault}</td>
                                        <td className="p-3 text-primary-dim leading-relaxed min-w-[340px]">
                                          <div className="mb-2"><SourceBadge item={item} /></div>
                                          <div>{item.assessment}</div>
                                          {item.similarity_reason && (
                                            <div className="text-accent text-[11px] mt-2">{item.similarity_reason}</div>
                                          )}
                                          <CaseExplanation item={item} />
                                        </td>
                                        <td className="p-3">
                                          <div className="flex gap-2 flex-wrap">
                                            <Button type="button" variant="glass" size="sm" onClick={() => onViewResult?.(item.record_id)}>
                                              View report
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="glass"
                                              size="sm"
                                              onClick={() => toggleCompareCase(item)}
                                              style={isSelected ? {
                                                background: "var(--accent-soft-strong)",
                                                borderColor: "var(--accent-border-strong)",
                                                color: "var(--accent)",
                                              } : undefined}
                                            >
                                              {isSelected ? "Selected" : "Select"}
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {compareModalOpen && compareSeries.length > 1 && (
        <div className="modal-overlay" onClick={() => setCompareModalOpen(false)}>
          <div className="modal-content p-5 max-w-[1280px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="section-label mb-1">DGA Compare</div>
                <div className="text-primary text-xl font-bold">Current sample vs selected similar cases</div>
                <div className="text-primary-dim text-sm mt-1">
                  The current transformer sample stays fixed. Each selected similar case keeps its own similarity percentage and DGA gas profile.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="glass" size="sm" onClick={clearCompareSelection}>
                  Clear All
                </Button>
                <Button type="button" variant="glass" size="sm" onClick={() => setCompareModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
              {compareSeries.map((entry) => (
                <div key={`compare-card-${entry.key}`} className="rounded-xl border border-border bg-surface-input p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: entry.color }} />
                      <div className="text-primary text-xs font-semibold truncate">{entry.isTarget ? "Current Sample" : entry.shortLabel}</div>
                    </div>
                    <div className="text-accent text-xs font-semibold shrink-0">{formatSimilarity(entry.caseItem.similarity)}</div>
                  </div>
                  <div className="text-primary text-sm font-bold mt-2">{getCaseTitle(entry.caseItem)}</div>
                  <div className="text-primary-dim text-xs mt-1">{getCaseMeta(entry.caseItem)}</div>
                  <div className="text-primary-dim text-xs mt-2">Brand: {entry.caseItem.brand || "-"}</div>
                  <div className="text-primary-dim text-xs mt-1">Maker: {entry.caseItem.maker || "-"}</div>
                  <div className="text-primary-dim text-xs mt-1">Oil brand used: {entry.caseItem.oilBrand || "-"}</div>
                  <div className="text-primary-dim text-xs mt-1">TDCG: {formatPpm(entry.caseItem.tdcg)}</div>
                  <div className="text-primary-dim text-xs mt-1">
                    Pattern match: <span className="text-accent">{formatSimilarity(entry.caseItem.pattern_similarity)}</span>
                  </div>
                  <div className="text-primary-muted text-[11px] mt-1">
                    {(() => {
                      const detail = getPatternSimilarityDetail(entry.caseItem);
                      return `DGA ${detail.dga}${detail.context ? ` | Context ${detail.context}` : ""}`;
                    })()}
                  </div>
                  <div className="text-primary-muted text-[11px] mt-1">DGA result: {formatDgaSummary(entry.caseItem.dga_values)}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface-input p-4 mb-4">
              <div className="section-label mb-2">{compareChartMode === "pattern" ? "DGA Pattern Chart" : "DGA Gas Chart"}</div>
              <div className="text-primary-dim text-xs mb-3">
                {compareChartMode === "pattern"
                  ? "Pattern view blends TensorFlow log-spectrum DGA shape with transformer context (brand, maker, oil brand), so gas profile and asset metadata are both considered."
                  : "Absolute view shows the raw DGA ppm values for each selected case."}
              </div>
              <div className="text-primary-dim text-xs mb-3">
                Click gas tags or X-axis gas names to hide/show gases. Use the case legend to focus one compared sample.
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    onClick={() => setCompareChartMode("pattern")}
                    style={compareChartMode === "pattern" ? {
                      background: "var(--accent-soft-strong)",
                      borderColor: "var(--accent-border-strong)",
                      color: "var(--accent)",
                    } : undefined}
                  >
                    Pattern View (TF)
                  </Button>
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    onClick={() => setCompareChartMode("absolute")}
                    style={compareChartMode === "absolute" ? {
                      background: "var(--accent-soft-strong)",
                      borderColor: "var(--accent-border-strong)",
                      color: "var(--accent)",
                    } : undefined}
                  >
                    Absolute PPM
                  </Button>
                </div>
                {comparePattern?.method && (
                  <div className="text-primary-dim text-[11px]">
                    {comparePattern.method}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {COMPARE_GAS_KEYS.map((gas) => {
                  const enabled = visibleGases[gas] !== false;
                  return (
                    <Button
                      key={`gas-toggle-${gas}`}
                      type="button"
                      variant="glass"
                      size="sm"
                      className="h-auto py-1"
                      onClick={() => toggleGasVisibility(gas)}
                      style={{
                        background: enabled ? "var(--accent-soft-strong)" : "rgba(113, 113, 122, 0.14)",
                        borderColor: enabled ? "var(--accent-border-strong)" : "rgba(113, 113, 122, 0.28)",
                        color: enabled ? "var(--accent)" : "var(--text-muted)",
                        textDecoration: enabled ? "none" : "line-through",
                      }}
                    >
                      {gas}
                    </Button>
                  );
                })}
                <Button type="button" variant="glass" size="sm" onClick={showAllGases} disabled={allGasesVisible}>
                  Show All Gases
                </Button>
              </div>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeChartRows} margin={{ top: 6, right: 18, left: 0, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="gas"
                      fontSize={11}
                      tickMargin={10}
                      stroke="#94a3b8"
                      tick={<GasAxisTick visibleMap={visibleGases} onToggle={toggleGasVisibility} />}
                    />
                    <YAxis
                      fontSize={11}
                      stroke="#94a3b8"
                      width={80}
                      tickFormatter={(value) => compareChartMode === "pattern" ? `${formatNumber(value, 0)}%` : formatNumber(value, 0)}
                      label={{
                        value: compareChartMode === "pattern" ? "pattern %" : "ppm",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip content={(props) => <CompareChartTooltip {...props} seriesMap={compareSeriesMap} chartMode={compareChartMode} />} />
                    <Legend
                      verticalAlign="top"
                      height={56}
                      wrapperStyle={{ paddingBottom: 10 }}
                      onMouseEnter={(entry) => {
                        if (typeof entry?.dataKey === "string") {
                          setActiveCompareSeriesKey(entry.dataKey);
                        }
                      }}
                      onMouseLeave={() => setActiveCompareSeriesKey(null)}
                      formatter={(value, entry) => {
                        const key = typeof entry?.dataKey === "string" ? entry.dataKey : "";
                        const dimmed = Boolean(activeCompareSeriesKey) && activeCompareSeriesKey !== key;
                        return (
                          <span style={{ opacity: dimmed ? 0.3 : 1, color: dimmed ? "#64748b" : "#e2e8f0", fontSize: 11 }}>
                            {value}
                          </span>
                        );
                      }}
                    />
                    {renderedCompareSeries.map((entry) => {
                      const dimmed = Boolean(activeCompareSeriesKey) && activeCompareSeriesKey !== entry.key;
                      const active = activeCompareSeriesKey === entry.key;
                      return (
                        <Line
                          key={entry.key}
                          type="monotone"
                          dataKey={entry.key}
                          name={entry.legendLabel}
                          stroke={entry.color}
                          strokeWidth={active ? 3.4 : entry.isTarget ? 3 : 2.1}
                          strokeOpacity={dimmed ? 0.18 : 0.95}
                          dot={{ r: active ? 4 : 2, fill: entry.color, strokeWidth: 0 }}
                          activeDot={{ r: 6 }}
                          zIndex={active ? 10 : undefined}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-input p-4">
              <div className="section-label mb-2">DGA Result Matrix</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="text-primary-muted p-3 text-left text-[10px] uppercase tracking-wide border-b border-border">Gas</th>
                      {compareSeries.map((entry) => (
                        <th key={`compare-head-${entry.key}`} className="text-primary-muted p-3 text-left text-[10px] uppercase tracking-wide border-b border-border min-w-[180px]">
                          {entry.shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={`compare-row-${row.gas}`} className="border-b border-border">
                        <td className="p-3 text-primary font-semibold">{row.label}</td>
                        {compareSeries.map((entry) => (
                          <td key={`compare-cell-${entry.key}-${row.gas}`} className="p-3 text-primary-dim">
                            {formatPpm(row[entry.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="p-3 text-primary font-semibold">TDCG</td>
                      {compareSeries.map((entry) => (
                        <td key={`compare-tdcg-${entry.key}`} className="p-3 text-primary-dim">
                          {formatPpm(entry.caseItem.tdcg)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
