import { useEffect, useState } from "react";
import { computeHeptagonPercentages, determineHeptagonFault } from "../DuvalHeptagonPanel";
import { RadialBar, RadialBarChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const IEEE_LIMITS = {
  H2: { good: 100, fair: 200, poor: 500, veryPoor: 700 },
  CH4: { good: 75, fair: 125, poor: 200, veryPoor: 400 },
  C2H2: { good: 2, fair: 7, poor: 35, veryPoor: 50 },
  C2H4: { good: 50, fair: 100, poor: 200, veryPoor: 300 },
  C2H6: { good: 20, fair: 50, poor: 90, veryPoor: 150 },
  CO: { good: 500, fair: 700, poor: 900, veryPoor: 1100 },
  CO2: { good: 5000, fair: 7000, poor: 9000, veryPoor: 11000 },
};

const IEEE_GASES = ["H2", "CH4", "C2H2", "C2H4", "C2H6", "CO", "CO2"];
const IEEE_GAS_COLORS = {
  H2: "#38bdf8",
  CH4: "#22c55e",
  C2H2: "#f59e0b",
  C2H4: "#06b6d4",
  C2H6: "#a855f7",
  CO: "#f97316",
  CO2: "#fb7185",
};

const GAS_NAMES = {
  H2: "Hydrogen",
  CH4: "Methane",
  C2H2: "Acetylene",
  C2H4: "Ethylene",
  C2H6: "Ethane",
  CO: "Carbon Monoxide",
  CO2: "Carbon Dioxide",
};

const CONDITION_STYLES = {
  good: { text: "#4ade80", label: "Good" },
  fair: { text: "#60a5fa", label: "Fair" },
  poor: { text: "#fbbf24", label: "Poor" },
  veryPoor: { text: "#f87171", label: "Very Poor" },
  unknown: { text: "#94a3b8", label: "Unknown" },
};

const CONDITION_RANK = { good: 0, fair: 1, poor: 2, veryPoor: 3, unknown: -1 };
const IEEE_LIMIT_MARKER_COLOR = "#fb7185";

const FAULT_COLORS = {
  PD: "#3b82f6",
  D1: "#f97316",
  D2: "#ef4444",
  T1: "#22c55e",
  T2: "#84cc16",
  T3: "#eab308",
  DT: "#a855f7",
  N: "#64748b",
  "T2-H": "#eab308",
  "T2-C": "#eab308",
  "T3-H": "#f97316",
  S: "#06b6d4",
  O: "#84cc16",
  C: "#22c55e",
  ND: "#64748b",
  TD: "#a855f7",
  HCCD: "#ef4444",
  MCCD: "#f97316",
  LCCD: "#eab308",
  Normal: "#64748b",
};

const FAULT_LABELS = {
  PD: "Partial Discharge",
  D1: "Discharge Low Energy",
  D2: "Discharge High Energy",
  T1: "Thermal < 300C",
  T2: "Thermal 300-700C",
  T3: "Thermal > 700C",
  "T2-H": "Thermal 300-700C",
  "T2-C": "Thermal 300-700C",
  "T3-H": "Thermal > 700C",
  DT: "Mixed (Discharge+Thermal)",
  S: "Stray Gassing",
  O: "Overheating",
  C: "Carbonization",
  ND: "Not Determined",
  N: "Normal",
  TD: "Thermal+Discharge",
  HCCD: "High Cellulose Degradation",
  MCCD: "Medium Cellulose Degradation",
  LCCD: "Low Cellulose Degradation",
  Normal: "Normal",
};

const severityColors = {
  Low: "var(--success)",
  Moderate: "var(--accent)",
  High: "var(--warning)",
  Critical: "var(--danger)",
};

function toNum(value) {
  return Number(value) || 0;
}

function normalizePentagonFaultKey(fault) {
  return fault || "N";
}

function getCondition(gas, value) {
  const lim = IEEE_LIMITS[gas];
  if (!lim) return "unknown";
  if (value <= lim.good) return "good";
  if (value <= lim.fair) return "fair";
  if (value <= lim.poor) return "poor";
  return "veryPoor";
}

function getOverallCondition(gases) {
  const conditions = IEEE_GASES.map((gas) => getCondition(gas, toNum(gases?.[gas])));
  if (conditions.includes("veryPoor")) return "veryPoor";
  if (conditions.includes("poor")) return "poor";
  if (conditions.includes("fair")) return "fair";
  return "good";
}

function getDuvalFaultT1(ch4, c2h4, c2h2) {
  const total = ch4 + c2h4 + c2h2;
  if (total === 0) return "N";
  const pCH4 = (ch4 / total) * 100;
  const pC2H4 = (c2h4 / total) * 100;
  const pC2H2 = (c2h2 / total) * 100;
  if (pCH4 >= 98) return "PD";
  if (pC2H4 >= 50 && pC2H2 < 15) return "T3";
  if (pC2H2 >= 13) return pC2H4 < 23 ? "D1" : "D2";
  if (pC2H2 >= 4) return "DT";
  if (pC2H4 >= 20) return "T2";
  return "T1";
}

function getDuvalFaultT4(h2, ch4, c2h6) {
  const total = h2 + ch4 + c2h6;
  if (total === 0) return "N";
  const pH2 = (h2 / total) * 100;
  const pCH4 = (ch4 / total) * 100;
  const pC2H6 = (c2h6 / total) * 100;
  if (pH2 >= 90) return "PD";
  if (pCH4 >= 64) return "C";
  if (pC2H6 >= 52) return "O";
  return "S";
}

function getDuvalFaultT5(ch4, c2h4, c2h6) {
  const total = ch4 + c2h4 + c2h6;
  if (total === 0) return "N";
  const pCH4 = (ch4 / total) * 100;
  const pC2H4 = (c2h4 / total) * 100;
  const pC2H6 = (c2h6 / total) * 100;
  if (pCH4 >= 98) return "PD";
  if (pC2H4 >= 50) return "T3-H";
  if (pCH4 >= 35 && pCH4 <= 75 && pC2H4 >= 10 && pC2H4 < 40) return "C";
  if (pC2H4 >= 20) return "T2-H";
  if (pC2H6 >= 50) return "S";
  if (pCH4 >= 40) return "O";
  return "ND";
}

const DUVAL_PENTAGON_POINT_ON_POLYGON_EPSILON = 1e-15;
const DUVAL_PENTAGON_MINERAL_ZONES = [
  {
    fault: "D2",
    polygon: [
      { x: 4, y: 16 },
      { x: 32.061, y: -6.048 },
      { x: 24.204, y: -30.299 },
      { x: 0, y: -3 },
      { x: 0, y: 1.5 },
    ],
  },
  {
    fault: "D1",
    polygon: [
      { x: 0, y: 40 },
      { x: 38.042, y: 12.361 },
      { x: 32.061, y: -6.048 },
      { x: 4, y: 16 },
      { x: 0, y: 1.5 },
    ],
  },
  {
    fault: "C",
    polygon: [
      { x: -3.5, y: -3 },
      { x: 2.492, y: -32.361 },
      { x: -21.483, y: -32.361 },
      { x: -11, y: -8 },
    ],
  },
  {
    fault: "T3-H",
    polygon: [
      { x: 0, y: -3 },
      { x: 24.204, y: -30.299 },
      { x: 23.511, y: -32.361 },
      { x: 2.492, y: -32.361 },
      { x: -3.5, y: -3 },
    ],
  },
  {
    fault: "O",
    polygon: [
      { x: -3.5, y: -3 },
      { x: -11, y: -8 },
      { x: -21.483, y: -32.361 },
      { x: -23.511, y: -32.361 },
      { x: -35, y: 3 },
      { x: 0, y: 1.5 },
      { x: 0, y: -3 },
    ],
  },
  {
    fault: "S",
    polygon: [
      { x: 0, y: 1.5 },
      { x: -35, y: 3 },
      { x: -38.042, y: 12.361 },
      { x: 0, y: 40 },
      { x: 0, y: 33 },
      { x: -1, y: 33 },
      { x: -1, y: 24.5 },
      { x: 0, y: 24.5 },
    ],
  },
  {
    fault: "PD",
    polygon: [
      { x: 0, y: 33 },
      { x: -1, y: 33 },
      { x: -1, y: 24.5 },
      { x: 0, y: 24.5 },
    ],
  },
];

function roundDuvalValue(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 0.5) / factor;
}

function getPointDistance(start, end) {
  return Math.sqrt(((end.x - start.x) ** 2) + ((end.y - start.y) ** 2));
}

function getPointCross(point, start, end) {
  return (point.x - end.x) * (start.y - end.y) - (point.y - end.y) * (start.x - end.x);
}

function isPointOnPolygonSegment(point, start, end, epsilon = 0) {
  return Math.abs(getPointCross(point, start, end)) <= epsilon
    && getPointDistance(start, point) <= getPointDistance(start, end)
    && getPointDistance(end, point) <= getPointDistance(start, end);
}

function isPointOnDuvalPentagonPolygon(point, polygon, epsilon = 0) {
  return polygon.some((start, index) => isPointOnPolygonSegment(point, start, polygon[(index + 1) % polygon.length], epsilon));
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < (((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9)) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function getDuvalPentagonGeometry(h2, ch4, c2h6, c2h4, c2h2) {
  const total = h2 + ch4 + c2h6 + c2h4 + c2h2;
  if (total <= 0) return null;

  const pctH2 = (h2 / total) * 100;
  const pctC2H6 = (c2h6 / total) * 100;
  const pctCH4 = (ch4 / total) * 100;
  const pctC2H4 = (c2h4 / total) * 100;
  const pctC2H2 = (c2h2 / total) * 100;

  const xCoords = [
    0,
    pctC2H6 * Math.cos((162 * Math.PI) / 180),
    pctCH4 * Math.cos((234 * Math.PI) / 180),
    pctC2H4 * Math.cos((306 * Math.PI) / 180),
    pctC2H2 * Math.cos((18 * Math.PI) / 180),
  ];
  const yCoords = [
    pctH2,
    pctC2H6 * Math.sin((162 * Math.PI) / 180),
    pctCH4 * Math.sin((234 * Math.PI) / 180),
    pctC2H4 * Math.sin((306 * Math.PI) / 180),
    pctC2H2 * Math.sin((18 * Math.PI) / 180),
  ];

  let areaFactor = 0;
  for (let point = 0; point < 5; point += 1) {
    areaFactor += point === 4
      ? 3 * (xCoords[point] * yCoords[0] - xCoords[0] * yCoords[point])
      : 3 * (xCoords[point] * yCoords[point + 1] - xCoords[point + 1] * yCoords[point]);
  }

  if (Math.abs(areaFactor) <= 1e-12) return null;

  let centroidX = 0;
  let centroidY = 0;
  for (let point = 0; point < 5; point += 1) {
    const nextPoint = point === 4 ? 0 : point + 1;
    const cross = (xCoords[point] * yCoords[nextPoint]) - (xCoords[nextPoint] * yCoords[point]);
    centroidX += (xCoords[point] + xCoords[nextPoint]) * cross;
    centroidY += (yCoords[point] + yCoords[nextPoint]) * cross;
  }

  return {
    centroid: {
      x: roundDuvalValue(centroidX / areaFactor, 2),
      y: roundDuvalValue(centroidY / areaFactor, 2),
    },
  };
}

function classifyDuvalPentagonMineral(centroid) {
  for (const zone of DUVAL_PENTAGON_MINERAL_ZONES) {
    if (
      isPointInPolygon(centroid, zone.polygon)
      || isPointOnDuvalPentagonPolygon(centroid, zone.polygon, DUVAL_PENTAGON_POINT_ON_POLYGON_EPSILON)
    ) {
      return zone.fault;
    }
  }
  return null;
}

function getDuvalFaultP1(h2, ch4, c2h6, c2h4, c2h2) {
  const geometry = getDuvalPentagonGeometry(h2, ch4, c2h6, c2h4, c2h2);
  if (!geometry) return "N";
  return classifyDuvalPentagonMineral(geometry.centroid) || "ND";
}

function IeeeRadialTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-input px-3 py-2 text-xs">
      <div className="text-primary font-semibold">{GAS_NAMES[point.name] || point.name} ({point.name})</div>
      <div className="text-primary-dim mt-1">{point.ppm.toFixed(1)} ppm</div>
      <div className="text-primary-dim">{point.condition}</div>
      <div className="text-primary-muted mt-1">IEEE limit: {point.limitPpm.toFixed(1)} ppm</div>
      <div className="text-primary-muted">Usage vs limit: {point.limitUsagePct.toFixed(1)}%</div>
    </div>
  );
}

function toScorePercent(limit, veryPoor) {
  if (!Number.isFinite(limit) || !Number.isFinite(veryPoor) || veryPoor <= 0) return 0;
  return Math.max(0, Math.min((limit / veryPoor) * 100, 100));
}

function getAngleFromScore(startAngle, endAngle, score) {
  const clamped = Math.max(0, Math.min(score, 100));
  return startAngle + ((endAngle - startAngle) * (clamped / 100));
}

function polarPoint(cx, cy, radius, angleDeg) {
  const angle = (Math.PI / 180) * angleDeg;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function IeeeRadialShape(props) {
  const {
    cx,
    cy,
    startAngle = 90,
    endAngle = -270,
    innerRadius,
    outerRadius,
    payload,
  } = props;
  const markerPct = Number(payload?.limitPct);
  const hasMarker = Number.isFinite(markerPct);
  const angle = hasMarker ? getAngleFromScore(startAngle, endAngle, markerPct) : null;
  const p1 = hasMarker ? polarPoint(cx, cy, innerRadius - 1, angle) : null;
  const p2 = hasMarker ? polarPoint(cx, cy, outerRadius + 1, angle) : null;

  return (
    <g>
      <Sector {...props} />
      {hasMarker && (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={IEEE_LIMIT_MARKER_COLOR}
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.95}
        />
      )}
    </g>
  );
}

function formatSimilarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric.toFixed(1)}%`;
}

function formatConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric.toFixed(1)}%`;
}

export default function AssessmentDraft({
  draft,
  summary,
  prediction,
  similarCases,
  generatedValue,
  baselineManualValue,
  value,
  dirty,
  saveState,
  approvedEntry,
  onChange,
  onLoadApproved,
  onUseGenerated,
  onResetManual,
  onRegenerate,
  onSave,
  onApprove,
  onViewResult,
}) {
  if (!draft) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No draft assessment available.</Card>;
  }

  const diagnostics = summary?.diagnostics || {};
  const selectedDga = summary?.latest_dga || {};
  const gases = selectedDga.gases || {};
  const duval = diagnostics.duvalTriangle || {};
  const severityLevel = diagnostics.severityLevel || prediction?.risk_level || "Moderate";
  const nearestCase = (similarCases?.cases || [])[0] || null;
  const currentManual = String(value || "").trim();
  const baselineManual = String(baselineManualValue || "").trim();
  const canResetManual = currentManual !== baselineManual;

  const gasValues = {
    H2: toNum(gases.H2),
    CH4: toNum(gases.CH4),
    C2H2: toNum(gases.C2H2),
    C2H4: toNum(gases.C2H4),
    C2H6: toNum(gases.C2H6),
    CO: toNum(gases.CO),
    CO2: toNum(gases.CO2),
    TDCG: toNum(gases.TDCG),
  };

  const duvalT1 = duval.code || getDuvalFaultT1(gasValues.CH4, gasValues.C2H4, gasValues.C2H2);
  const duvalT4 = getDuvalFaultT4(gasValues.H2, gasValues.CH4, gasValues.C2H6);
  const duvalT5 = getDuvalFaultT5(gasValues.CH4, gasValues.C2H4, gasValues.C2H6);
  const duvalP1 = normalizePentagonFaultKey(getDuvalFaultP1(gasValues.H2, gasValues.CH4, gasValues.C2H6, gasValues.C2H4, gasValues.C2H2));
  const heptagonPct = computeHeptagonPercentages(gasValues);
  const duvalH1 = determineHeptagonFault(heptagonPct);
  const ieeeOverall = getOverallCondition(gasValues);
  const ieeeOverallStyle = CONDITION_STYLES[ieeeOverall] || CONDITION_STYLES.unknown;

  const buildRows = (keys, sort = false) => {
    const total = keys.reduce((sum, key) => sum + toNum(gasValues[key]), 0);
    const rows = keys.map((key) => ({
      key,
      ppm: toNum(gasValues[key]),
      pct: total > 0 ? (toNum(gasValues[key]) / total) * 100 : 0,
    }));
    return sort ? [...rows].sort((a, b) => b.pct - a.pct) : rows;
  };

  const heptagonRows = heptagonPct
    ? Object.entries(heptagonPct)
      .sort((a, b) => toNum(b[1]) - toNum(a[1]))
      .slice(0, 3)
      .map(([key, pct]) => ({ key, pct: toNum(pct), ppm: toNum(gasValues[key]) }))
    : [];

  const duvalCards = [
    { title: "Duval Triangle 1", fault: duvalT1, rows: buildRows(["CH4", "C2H4", "C2H2"]) },
    { title: "Duval Triangle 4", fault: duvalT4, rows: buildRows(["H2", "CH4", "C2H6"]) },
    { title: "Duval Triangle 5", fault: duvalT5, rows: buildRows(["CH4", "C2H4", "C2H6"]) },
    { title: "Duval Pentagon", fault: duvalP1, rows: buildRows(["H2", "CH4", "C2H6", "C2H4", "C2H2"], true).slice(0, 3) },
    { title: "Duval Heptagon", fault: duvalH1, rows: heptagonRows },
  ];

  const ieeeRows = IEEE_GASES
    .map((gasKey) => {
      const condition = getCondition(gasKey, gasValues[gasKey]);
      const style = CONDITION_STYLES[condition] || CONDITION_STYLES.unknown;
      return {
        gasKey,
        value: gasValues[gasKey],
        condition,
        style,
        limits: IEEE_LIMITS[gasKey],
      };
    })
    .sort((a, b) => {
      const rankDiff = CONDITION_RANK[b.condition] - CONDITION_RANK[a.condition];
      if (rankDiff !== 0) return rankDiff;
      const aRatio = a.limits?.veryPoor ? a.value / a.limits.veryPoor : 0;
      const bRatio = b.limits?.veryPoor ? b.value / b.limits.veryPoor : 0;
      return bRatio - aRatio;
    });
  const ieeeChartData = ieeeRows.map((row) => {
    const score = row.limits?.veryPoor ? Math.min((row.value / row.limits.veryPoor) * 100, 100) : 0;
    const limitPpm = Number(row.limits?.good) || 0;
    const veryPoor = Number(row.limits?.veryPoor) || 0;
    const limitUsagePct = limitPpm > 0 ? (row.value / limitPpm) * 100 : 0;
    return {
      name: row.gasKey,
      score,
      ppm: row.value,
      condition: row.style.label,
      fill: IEEE_GAS_COLORS[row.gasKey] || row.style.text,
      limitPpm,
      limitUsagePct,
      limitPct: toScorePercent(limitPpm, veryPoor),
    };
  });
  const [ieeeModalOpen, setIeeeModalOpen] = useState(false);

  useEffect(() => {
    if (!ieeeModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIeeeModalOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ieeeModalOpen]);

  return (
    <div className="flex flex-col gap-4">
      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-3">Fault Snapshot</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          <div className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Current Diagnostic Fault</div>
            <div className="text-primary text-lg font-bold mt-2">{duvalT1 || "-"}</div>
            <div className="text-primary-dim text-xs mt-1">{FAULT_LABELS[duvalT1] || duval.label || "Duval Triangle 1"}</div>
            <div className="text-primary-dim text-[11px] mt-2">TDCG: {gasValues.TDCG.toFixed(1)} ppm</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">ML Predicted Fault</div>
            <div className="text-primary text-lg font-bold mt-2">{prediction?.predicted_fault || "-"}</div>
            <div className="text-primary-dim text-xs mt-1">{prediction?.predicted_fault_label || "No model output"}</div>
            <div className="text-primary-dim text-[11px] mt-2">Model: {prediction?.algorithm || draft.sources?.prediction_model || "-"}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Risk & Confidence</div>
            <div className="text-lg font-bold mt-2" style={{ color: severityColors[severityLevel] || "var(--accent)" }}>
              {severityLevel}
            </div>
            <div className="text-primary-dim text-xs mt-1">Confidence: {formatConfidence(prediction?.confidence)}</div>
            <div className="text-primary-dim text-[11px] mt-2">Selected Date: {draft.sources?.summary_date || "-"}</div>
          </div>

          <div className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Nearest Similar Case</div>
            <div className="text-primary text-sm font-bold mt-2">{nearestCase?.transformer || "-"}</div>
            <div className="text-primary-dim text-xs mt-1">{nearestCase?.site || "-"}</div>
            <div className="text-accent text-xs mt-2">Similarity: {formatSimilarity(nearestCase?.similarity)}</div>
            <div className="text-primary-dim text-[11px] mt-1">Date: {nearestCase?.date || "-"}</div>
            {nearestCase?.record_id && (
              <Button
                type="button"
                variant="glass"
                size="sm"
                className="mt-auto"
                onClick={() => onViewResult?.(nearestCase.record_id)}
              >
                Open Similar Case
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">IEEE C57.104 Overall</div>
            <div className="text-base font-bold mt-2" style={{ color: ieeeOverallStyle.text }}>
              {ieeeOverallStyle.label}
            </div>
            <div className="text-primary-dim text-xs mt-1">TDCG: {gasValues.TDCG.toFixed(1)} ppm</div>
            <button
              type="button"
              className="mt-2 flex-1 min-h-0 rounded-lg border border-border hover:border-border-light transition-colors cursor-zoom-in"
              onClick={() => setIeeeModalOpen(true)}
              title="Click to expand chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={ieeeChartData}
                  cx="50%"
                  cy="54%"
                  innerRadius="20%"
                  outerRadius="98%"
                  barSize={13}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    background={{ fill: "rgba(100,116,139,0.16)" }}
                    dataKey="score"
                    minAngle={8}
                    shape={IeeeRadialShape}
                    clockWise
                  />
                  <Tooltip content={<IeeeRadialTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
            </button>
          </div>

          {duvalCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-surface-input p-4 h-[198px] flex flex-col">
              <div className="text-primary-muted text-[11px] uppercase tracking-wide">{card.title}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: FAULT_COLORS[card.fault] || "var(--accent)" }} />
                <div className="text-primary text-lg font-bold">{card.fault || "-"}</div>
              </div>
              <div className="text-primary-dim text-xs mt-1">{FAULT_LABELS[card.fault] || "Unknown fault"}</div>
              <div className="mt-2 text-[11px] text-primary-dim">
                {card.rows.map((row) => (
                  <div key={`${card.title}-${row.key}`} className="leading-relaxed">
                    {row.key}: {row.pct.toFixed(1)}% <span className="text-primary-muted">({row.ppm.toFixed(1)} ppm)</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Generated Interpretation</div>
        <div className="text-primary-dim text-xs leading-relaxed mb-2">
          Regenerate AI text anytime, then keep editing manually for your final report. Save and approve always use the manual editor text.
        </div>
        <div className="text-primary-dim text-[11px] mb-4">
          This lets you compare AI output and your own manual wording before updating the approved assessment.
        </div>
        {approvedEntry && (
          <div className="rounded-xl border border-border bg-surface-input p-3 mb-4">
            <div className="text-primary text-xs font-semibold">Approved version already exists for this selected result.</div>
            <div className="text-primary-dim text-xs mt-1">Last updated: {approvedEntry.updatedAt || approvedEntry.createdAt || "-"}</div>
            <Button type="button" variant="glass" size="sm" className="mt-3" onClick={onLoadApproved}>
              Load Approved into Manual Editor
            </Button>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-input p-3">
            <div className="text-primary text-xs font-semibold mb-2">AI Generated Draft (Latest Regenerate)</div>
            <Textarea
              className="min-h-[240px] resize-y opacity-95"
              value={generatedValue || ""}
              readOnly
            />
            <div className="flex gap-2 flex-wrap mt-3">
              <Button type="button" variant="glass" size="sm" onClick={onRegenerate}>
                Regenerate AI Draft
              </Button>
              <Button
                type="button"
                variant="glass-brand"
                size="sm"
                onClick={onUseGenerated}
                disabled={!String(generatedValue || "").trim()}
              >
                Use in Manual Editor
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-input p-3">
            <div className="text-primary text-xs font-semibold mb-2">Manual Edit for Final Report</div>
            <Textarea
              className="min-h-[240px] resize-y"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
            <div className="flex gap-2 flex-wrap mt-3">
              <Button
                type="button"
                variant="glass"
                size="sm"
                onClick={onResetManual}
                disabled={!canResetManual}
              >
                Reset to Original Manual
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-4">
          <Button type="button" variant="warning" size="sm" onClick={onSave} disabled={saveState.saving || !dirty}>
            Save Manual Draft
          </Button>
          <Button type="button" variant="success" size="sm" onClick={onApprove} disabled={saveState.saving}>
            {approvedEntry ? "Update Approved (Manual)" : "Approve Manual Assessment"}
          </Button>
        </div>

        {saveState.message && <div className="text-emerald-400 text-xs mt-3">{saveState.message}</div>}
        {saveState.error && <div className="text-destructive text-xs mt-3">{saveState.error}</div>}
      </Card>

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Draft Sources</div>
        {draft.sources?.memory_reused && (
          <div className="rounded-xl border border-border bg-surface-input p-3 mb-4">
            <div className="text-primary text-xs font-semibold">
              Auto-filled from approved history memory
            </div>
            <div className="text-primary-dim text-xs mt-1">
              Source transformer: {draft.sources?.memory_transformer || "-"} | Similarity: {Number(draft.sources?.memory_similarity || 0).toFixed(1)}%
            </div>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          <div>
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Selected Summary Date</div>
            <div className="text-primary text-sm font-semibold mt-1">{draft.sources?.summary_date || "-"}</div>
          </div>
          <div>
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Prediction Model</div>
            <div className="text-primary text-sm font-semibold mt-1">{draft.sources?.prediction_model || "-"}</div>
          </div>
          <div>
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Similar Cases Used</div>
            <div className="text-primary text-sm font-semibold mt-1">{draft.sources?.similar_case_count ?? 0}</div>
          </div>
          <div>
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Approved History Cases</div>
            <div className="text-foreground text-sm font-semibold mt-1">{draft.sources?.approved_case_count ?? 0}</div>
          </div>
        </div>
      </Card>

      {ieeeModalOpen && (
        <div className="modal-overlay" onClick={() => setIeeeModalOpen(false)}>
          <div className="modal-content p-5 max-w-[920px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="section-label mb-1">IEEE C57.104 Overall - Expanded View</div>
                <div className="text-primary text-xl font-bold" style={{ color: ieeeOverallStyle.text }}>
                  {ieeeOverallStyle.label}
                </div>
                <div className="text-primary-dim text-sm mt-1">TDCG: {gasValues.TDCG.toFixed(1)} ppm</div>
              </div>
              <Button type="button" variant="glass" size="sm" onClick={() => setIeeeModalOpen(false)}>
                Close
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-surface-input p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="h-[540px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      data={ieeeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="18%"
                      outerRadius="98%"
                      barSize={22}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        background={{ fill: "rgba(100,116,139,0.16)" }}
                        dataKey="score"
                        minAngle={10}
                        shape={IeeeRadialShape}
                        clockWise
                      />
                      <Tooltip content={<IeeeRadialTooltip />} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border border-border bg-surface-card p-3 h-[540px] overflow-y-auto">
                  <div className="section-label mb-2">Gas Legend & Limits</div>
                  <div className="space-y-2">
                    {ieeeChartData.map((item) => (
                      <div key={`legend-${item.name}`} className="rounded-md border border-border bg-surface-input px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: item.fill }} />
                            <span className="text-primary text-xs font-semibold">{GAS_NAMES[item.name] || item.name} ({item.name})</span>
                          </div>
                          <span className="text-primary-dim text-xs">{item.ppm.toFixed(1)} ppm</span>
                        </div>
                        <div className="text-primary-muted text-[10px] mt-1">
                          IEEE limit: {item.limitPpm.toFixed(1)} ppm
                        </div>
                        <div className="text-primary-muted text-[10px]">
                          Usage vs limit: {item.limitUsagePct.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-surface-input px-2.5 py-2">
                    <div className="text-primary text-[11px] font-semibold">Overlay Markers</div>
                    <div className="mt-2 space-y-1.5 text-[10px] text-primary-dim">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-[2px]" style={{ background: IEEE_LIMIT_MARKER_COLOR }} />
                        IEEE single limit (Condition 1 / normal)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-primary-muted text-xs mt-2">Each arc shows gas ppm relative to IEEE very-poor limit.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
