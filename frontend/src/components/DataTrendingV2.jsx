import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Droplets, FileText, FlaskConical, TrendingUp } from "lucide-react";
import { buildAssessmentLookup, resolveAssessmentText } from "./assessmentText";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const METRICS = [
  { key: "H2", label: "Hydrogen", short: "H2", unit: "ppm", color: "#38bdf8", group: "dga", alwaysShow: true },
  { key: "CH4", label: "Methane", short: "CH4", unit: "ppm", color: "#22c55e", group: "dga", alwaysShow: true },
  { key: "C2H2", label: "Acetylene", short: "C2H2", unit: "ppm", color: "#f97316", group: "dga", alwaysShow: true },
  { key: "C2H4", label: "Ethylene", short: "C2H4", unit: "ppm", color: "#f43f5e", group: "dga", alwaysShow: true },
  { key: "C2H6", label: "Ethane", short: "C2H6", unit: "ppm", color: "#a855f7", group: "dga", alwaysShow: true },
  { key: "CO", label: "Carbon Monoxide", short: "CO", unit: "ppm", color: "#06b6d4", group: "dga", alwaysShow: true },
  { key: "CO2", label: "Carbon Dioxide", short: "CO2", unit: "ppm", color: "#64748b", group: "dga", alwaysShow: true },
  { key: "O2", label: "Oxygen", short: "O2", unit: "ppm", color: "#14b8a6", group: "dga", alwaysShow: true },
  { key: "N2", label: "Nitrogen", short: "N2", unit: "ppm", color: "#94a3b8", group: "dga", alwaysShow: true },
  { key: "TDCG", label: "TDCG", short: "TDCG", unit: "ppm", color: "#f59e0b", group: "dga", alwaysShow: true },
  { key: "moisture", label: "Moisture", short: "H2O", unit: "ppm", color: "#0ea5e9", group: "oil", alwaysShow: true },
  { key: "bdv", label: "Breakdown Voltage", short: "BDV", unit: "kV", color: "#fbbf24", group: "oil", inverse: true, alwaysShow: true },
  { key: "acidity", label: "Acidity", short: "NV", unit: "mgKOH/g", color: "#ef4444", group: "oil", alwaysShow: true, decimals: 4 },
  { key: "ift", label: "Interfacial Tension", short: "IFT", unit: "mN/m", color: "#8b5cf6", group: "oil", inverse: true, alwaysShow: true, decimals: 1 },
  { key: "powerFactor", label: "Power Factor", short: "Tan d", unit: "", color: "#fb7185", group: "oil", alwaysShow: true, decimals: 4 },
  { key: "colorValue", label: "Color", short: "Color", unit: "ASTM", color: "#eab308", group: "oil", alwaysShow: true, decimals: 1 },
  { key: "inhibitor", label: "Inhibitor", short: "DBPC", unit: "%", color: "#10b981", group: "chemistry", alwaysShow: true, decimals: 4 },
  { key: "dbds", label: "DBDS", short: "DBDS", unit: "ppm", color: "#dc2626", group: "chemistry" },
  { key: "passivator", label: "Passivator", short: "Passivator", unit: "ppm", color: "#3b82f6", group: "chemistry", alwaysShow: true },
  { key: "fal2", label: "2-FAL", short: "2-FAL", unit: "ppb", color: "#7c3aed", group: "aging" },
  { key: "methanol", label: "Methanol", short: "Methanol", unit: "ppb", color: "#ec4899", group: "aging", decimals: 4 },
  { key: "dpFromFuran", label: "DP from Furan", short: "DP Furan", unit: "", color: "#22c55e", group: "aging", inverse: true, decimals: 0 },
  { key: "dpFromMethanol", label: "DP from Methanol", short: "DP MeOH", unit: "", color: "#84cc16", group: "aging", inverse: true, decimals: 0 },
];

const GROUPS = [
  { key: "all", label: "All Tests", icon: TrendingUp },
  { key: "dga", label: "DGA", icon: Activity },
  { key: "oil", label: "Oil Quality", icon: Droplets },
  { key: "chemistry", label: "Chemistry", icon: FlaskConical },
  { key: "aging", label: "Paper Aging", icon: FileText },
];

const panelStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--ui-border))",
  background: "hsl(var(--ui-card) / 0.65)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 12px 28px -10px rgba(0,0,0,0.45)",
};

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = asNumber(record?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickText(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatMetricValue(metric, value, rawLabel) {
  if (value === null || value === undefined) return "-";
  if (metric.key === "colorValue" && rawLabel) return rawLabel;
  const decimals = metric.decimals ?? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function formatDateValue(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function yearsSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const years = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 ? years.toFixed(1) : null;
}

function withAlpha(color, alphaHex) {
  if (!color || typeof color !== "string") return color;
  const shortHex = /^#([0-9a-fA-F]{3})$/;
  const longHex = /^#([0-9a-fA-F]{6})$/;
  if (longHex.test(color)) return `${color}${alphaHex}`;
  if (shortHex.test(color)) {
    const s = color.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}${alphaHex}`;
  }
  return color;
}

function deltaFor(metric, current, previous) {
  if (current === null || previous === null || previous === undefined) return null;
  if (current === previous) return { text: "Stable", tone: "muted" };
  const percent = previous === 0 ? 100 : Math.abs(((current - previous) / previous) * 100);
  const worse = metric.inverse ? current < previous : current > previous;
  return {
    text: `${current > previous ? "+" : "-"}${percent.toFixed(percent >= 10 ? 0 : 1)}%`,
    tone: worse ? "danger" : "good",
  };
}

function buildRows(source) {
  return [...source]
    .map((record) => {
      const date = record?.date || record?.testDate || record?.samplingDate || "";
      const H2 = pickNumber(record, ["H2", "h2"]);
      const CH4 = pickNumber(record, ["CH4", "ch4"]);
      const C2H2 = pickNumber(record, ["C2H2", "c2h2"]);
      const C2H4 = pickNumber(record, ["C2H4", "c2h4"]);
      const C2H6 = pickNumber(record, ["C2H6", "c2h6"]);
      const tdcg = pickNumber(record, ["TDCG", "tdcg"]) ?? [H2, CH4, C2H2, C2H4, C2H6].reduce((sum, value) => sum + (value || 0), 0);
      return {
        id: record?.id || "",
        transformerId: record?.transformerId || "",
        date,
        label: formatDateLabel(date),
        notes: String(record?.notes || ""),
        H2,
        CH4,
        C2H2,
        C2H4,
        C2H6,
        CO: pickNumber(record, ["CO", "co"]),
        CO2: pickNumber(record, ["CO2", "co2"]),
        O2: pickNumber(record, ["O2", "o2"]),
        N2: pickNumber(record, ["N2", "n2"]),
        TDCG: tdcg,
        moisture: pickNumber(record, ["moisture", "waterContent"]),
        bdv: pickNumber(record, ["bdv", "breakdown"]),
        acidity: pickNumber(record, ["acidity"]),
        ift: pickNumber(record, ["ift", "interfacialTension"]),
        powerFactor: pickNumber(record, ["powerFactor"]),
        inhibitor: pickNumber(record, ["inhibitor"]),
        dbds: pickNumber(record, ["dbds"]),
        passivator: pickNumber(record, ["passivator"]),
        fal2: pickNumber(record, ["fal2", "Furan"]),
        methanol: pickNumber(record, ["methanol", "Methanol"]),
        dpFromFuran: pickNumber(record, ["dpFromFuran", "estimatedDpFuran"]),
        dpFromMethanol: pickNumber(record, ["dpFromMethanol", "estimatedDpMethanol"]),
        colorValue: pickNumber(record, ["colorValue", "color"]),
        colorLabel: pickText(record, ["color"]),
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function Sparkline({ rows, metric }) {
  const data = rows.map((row) => ({ label: row.label, value: row[metric.key] ?? null }));
  return (
    <ResponsiveContainer width="100%" height={84}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={metric.color} fill={`url(#fill-${metric.key})`} strokeWidth={2} dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DataTrendingV2({ records, oilTests, transformer, approvedHistory = [] }) {
  const source = records?.length ? records : oilTests || [];
  const rawRows = useMemo(() => buildRows(source), [source]);
  const assessmentLookup = useMemo(() => buildAssessmentLookup(approvedHistory), [approvedHistory]);
  const rows = useMemo(() => {
    return rawRows.map((row) => {
      return {
        ...row,
        assessmentText: resolveAssessmentText({
          notes: row.notes,
          resultId: row.id,
          resultDate: row.date,
          assessmentLookup,
        }),
      };
    });
  }, [rawRows, assessmentLookup]);
  const availableMetrics = useMemo(
    () => METRICS.filter((metric) => metric.alwaysShow || rows.some((row) => (row[metric.key] ?? 0) !== 0)),
    [rows]
  );
  const [activeGroup, setActiveGroup] = useState("all");
  const [activeMetric, setActiveMetric] = useState("");
  const [heldMetrics, setHeldMetrics] = useState([]);
  const [selectedSampleDate, setSelectedSampleDate] = useState("");

  const filteredMetrics = useMemo(() => {
    if (activeGroup === "all") return availableMetrics;
    return availableMetrics.filter((metric) => metric.group === activeGroup);
  }, [activeGroup, availableMetrics]);

  const metricMap = useMemo(
    () => availableMetrics.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {}),
    [availableMetrics]
  );

  useEffect(() => {
    if (!filteredMetrics.length) return;
    if (!filteredMetrics.some((metric) => metric.key === activeMetric)) {
      setActiveMetric(filteredMetrics[0].key);
    }
  }, [activeMetric, filteredMetrics]);

  useEffect(() => {
    const allowed = new Set(filteredMetrics.map((item) => item.key));
    setHeldMetrics((current) => current.filter((key) => allowed.has(key)));
  }, [filteredMetrics]);

  useEffect(() => {
    if (!rows.length) return;
    const exists = rows.some((row) => row.date === selectedSampleDate);
    if (!exists) {
      setSelectedSampleDate(rows[rows.length - 1].date);
    }
  }, [rows, selectedSampleDate]);

  if (!rows.length) {
    return (
      <div style={{ ...panelStyle, padding: 28, color: "hsl(var(--ui-muted-foreground))" }}>
        No test history available.
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const selectedSample = rows.find((row) => row.date === selectedSampleDate) || latest;
  const metric = filteredMetrics.find((item) => item.key === activeMetric) || filteredMetrics[0] || availableMetrics[0];
  const heldMetricItems = heldMetrics.map((key) => metricMap[key]).filter(Boolean);
  const compareMode = heldMetricItems.length > 0;
  const topChartMetrics = compareMode ? heldMetricItems : [metric].filter(Boolean);
  const transformerName = transformer?.txName || transformer?.name || "Transformer";
  const transformerCode = transformer?.mnemonic || transformer?.id || "-";
  const transformerMeta = [transformer?.site, transformer?.serialNumber].filter(Boolean).join(" | ");
  const assetAge = yearsSince(transformer?.dateEnergized || transformer?.dateManufactured);
  const detailItems = [
    { label: "Site", value: transformer?.site || "-" },
    { label: "Serial No.", value: transformer?.serialNumber || "-" },
    { label: "Voltage", value: transformer?.voltage || "-" },
    { label: "Load", value: transformer?.loadMVA ? `${transformer.loadMVA} MVA` : "-" },
    { label: "Maker", value: transformer?.maker || transformer?.brand || "-" },
    { label: "Oil Brand", value: transformer?.oilBrand || "-" },
    { label: "Energized", value: formatDateValue(transformer?.dateEnergized) },
    { label: "Oil Type", value: transformer?.oilType || "-" },
  ];
  const statItems = [
    { label: "Samples", value: rows.length },
    { label: "Latest Sample", value: latest.label },
    { label: "Selected Sample", value: selectedSample?.label || "-" },
    { label: "Latest TDCG", value: formatMetricValue(METRICS.find((item) => item.key === "TDCG"), latest?.TDCG) },
    { label: "Asset Age", value: assetAge ? `${assetAge} years` : "-" },
  ];

  const toggleHeldMetric = (metricKey) => {
    setActiveMetric(metricKey);
    setHeldMetrics((current) => (
      current.includes(metricKey)
        ? current.filter((key) => key !== metricKey)
        : [...current, metricKey]
    ));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...panelStyle, padding: 20, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, 1fr)",
            gap: 16,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              padding: 18,
              border: "1px solid var(--accent-border)",
              background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-card) 65%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--accent)" }}>
                <TrendingUp size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ color: "hsl(var(--ui-foreground))", fontWeight: 800, fontSize: 20 }}>{transformerName}</div>
                  <div
                    style={{
                      borderRadius: 999,
                      padding: "4px 10px",
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--accent)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {transformerCode}
                  </div>
                </div>
                <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 13 }}>{transformerMeta || "Transformer profile"}</div>
              </div>
            </div>

            <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 13, marginBottom: 14 }}>
              Unified trend view for DGA, oil-quality, chemistry, and paper-aging tests from the same result history.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {detailItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ color: "hsl(var(--ui-foreground))", fontSize: 13, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid var(--accent-border)",
                background: "var(--bg-card)",
              }}
            >
              <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 4 }}>
                Assessment on Selected Date
              </div>
              <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                {selectedSample?.label || "-"}
              </div>
              {selectedSample?.assessmentText ? (
                <div style={{ color: "hsl(var(--ui-foreground))", fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto", paddingRight: 4 }}>
                  {selectedSample.assessmentText}
                </div>
              ) : (
                <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 12 }}>
                  No approved/manual assessment saved for this sample date.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            {statItems.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                }}
              >
                <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 4 }}>{item.label}</div>
                <div style={{ color: "hsl(var(--ui-foreground))", fontSize: 15, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}

            <div
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid var(--accent-border)",
                background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-card) 100%)",
              }}
            >
              <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 6 }}>Coverage</div>
              <div style={{ color: "hsl(var(--ui-foreground))", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {availableMetrics.length} tracked tests
              </div>
              <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 12 }}>
                Use the chips below to switch between DGA, oil, chemistry, and aging groups.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {GROUPS.filter((group) => group.key === "all" || availableMetrics.some((metricItem) => metricItem.group === group.key)).map((group) => {
          const Icon = group.icon;
          const active = activeGroup === group.key;
          return (
            <Button
              key={group.key}
              type="button"
              variant={active ? "glass-brand" : "glass"}
              size="sm"
              onClick={() => setActiveGroup(group.key)}
              className="rounded-full px-4 py-2"
            >
              <Icon size={14} />
              {group.label}
            </Button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
        <Card variant="glass" className="p-[18px]">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 4 }}>
                {compareMode ? "Held Tests" : "Focused Test"}
              </div>
              <div style={{ color: "hsl(var(--ui-foreground))", fontSize: 16, fontWeight: 700 }}>
                {compareMode ? `${topChartMetrics.length} tests pinned for comparison` : metric?.label}
              </div>
              {compareMode && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {topChartMetrics.map((item, index) => (
                    <span
                      key={item.key}
                      style={{
                        borderRadius: 999,
                        padding: "5px 10px",
                        border: `1px solid ${withAlpha(item.color, "66")}`,
                        background: withAlpha(item.color, "1f"),
                        color: item.color,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {item.short}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11, marginBottom: 4 }}>
                {compareMode ? "Compare Mode" : "Latest Reading"}
              </div>
              {compareMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  {topChartMetrics.map((item) => (
                    <div key={item.key} style={{ color: item.color, fontSize: 13, fontWeight: 700 }}>
                      {item.short}: {formatMetricValue(item, latest?.[item.key], latest?.colorLabel)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: metric?.color, fontSize: 20, fontWeight: 800 }}>
                  {metric ? formatMetricValue(metric, latest?.[metric.key], latest?.colorLabel) : "-"}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                onClick={(state) => {
                  const payload = state?.activePayload?.[0]?.payload;
                  if (payload?.date) {
                    setSelectedSampleDate(payload.date);
                  }
                }}
              >
                <CartesianGrid stroke="rgba(30,41,59,0.9)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-dim, #94a3b8)", fontSize: 11 }} tickMargin={8} />
                <YAxis tick={{ fill: "var(--text-dim, #94a3b8)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--ui-border))",
                    background: "hsl(var(--ui-popover) / 0.95)",
                    color: "hsl(var(--ui-foreground))",
                    backdropFilter: "blur(12px)",
                  }}
                  formatter={(value, _name, item) => {
                    const itemMetric = metricMap[item?.dataKey];
                    return [itemMetric ? formatMetricValue(itemMetric, value, item?.payload?.colorLabel) : value, itemMetric?.short];
                  }}
                />
                {selectedSample?.label && (
                  <ReferenceLine x={selectedSample.label} stroke="var(--accent-border-strong)" strokeDasharray="4 4" />
                )}
                {topChartMetrics.map((item) => (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.short}
                    stroke={item.color}
                    strokeWidth={compareMode ? 2.5 : 3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card variant="glass" className="p-[18px]">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ color: "hsl(var(--ui-foreground))", fontWeight: 700, fontSize: 15 }}>All Tracked Tests</div>
            <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 12 }}>Compact sparklines keep every important test visible in one area.</div>
          </div>
          <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 12, alignSelf: "center" }}>
            Click cards to hold or unhold them in the top chart.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {filteredMetrics.map((item) => {
            const delta = deltaFor(item, latest?.[item.key], previous?.[item.key]);
            const active = item.key === metric?.key;
            const held = heldMetrics.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleHeldMetric(item.key)}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 16,
                  border: held ? `1px solid ${withAlpha(item.color, "cc")}` : active ? `1px solid ${item.color}` : "1px solid rgba(148,163,184,0.14)",
                  background: held ? `linear-gradient(180deg, ${withAlpha(item.color, "26")} 0%, rgba(15,23,42,0.52) 100%)` : active ? "rgba(15,23,42,0.94)" : "rgba(15,23,42,0.52)",
                  boxShadow: held ? `0 0 0 1px ${withAlpha(item.color, "33")} inset` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ color: "hsl(var(--ui-foreground))", fontWeight: 700, fontSize: 13 }}>{item.short}</div>
                    <div style={{ color: "hsl(var(--ui-muted-foreground))", fontSize: 11 }}>{item.label}</div>
                  </div>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: item.color,
                      boxShadow: held ? `0 0 0 4px ${withAlpha(item.color, "3d")}` : `0 0 0 4px ${withAlpha(item.color, "22")}`,
                    }}
                  />
                </div>

                {held && (
                  <div
                    style={{
                      display: "inline-flex",
                      marginBottom: 8,
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      background: withAlpha(item.color, "1f"),
                      border: `1px solid ${withAlpha(item.color, "4d")}`,
                      color: item.color,
                    }}
                  >
                    Held in top chart
                  </div>
                )}

                <div style={{ color: item.color, fontWeight: 800, fontSize: 18, marginBottom: 2 }}>
                  {formatMetricValue(item, latest?.[item.key], latest?.colorLabel)}
                </div>
                <div
                  style={{
                    color: delta?.tone === "danger" ? "#f87171" : delta?.tone === "good" ? "#4ade80" : "var(--text-dim, #94a3b8)",
                    fontSize: 11,
                    marginBottom: 8,
                  }}
                >
                  {delta?.text || "No delta from previous sample"}
                </div>

                <Sparkline rows={rows} metric={item} />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
