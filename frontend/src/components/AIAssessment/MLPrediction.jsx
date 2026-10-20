import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/card";


const riskColors = {
  Low: "var(--success)",
  Moderate: "var(--accent)",
  High: "var(--warning)",
  Critical: "var(--danger)",
};

const featureImportanceColors = [
  "#22d3ee",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
  "#f472b6",
];

const anatomyMetricDefs = [
  {
    key: "ratio_c2h2_c2h4",
    label: "C2H2 / C2H4",
    axisLine1: "C2H2 /",
    axisLine2: "C2H4",
    code: "Ratio",
    type: "ratio",
    aliases: ["C2H2 / C2H4", "C2H2/C2H4"],
    getValue: (gases) => computeRatio(gases.C2H2, gases.C2H4),
  },
  {
    key: "ratio_c2h4_c2h6",
    label: "C2H4 / C2H6",
    axisLine1: "C2H4 /",
    axisLine2: "C2H6",
    code: "Ratio",
    type: "ratio",
    aliases: ["C2H4 / C2H6", "C2H4/C2H6"],
    getValue: (gases) => computeRatio(gases.C2H4, gases.C2H6),
  },
  {
    key: "ethylene",
    label: "Ethylene",
    axisLine1: "Ethylene",
    axisLine2: "C2H4",
    code: "Gas",
    type: "gas",
    aliases: ["Ethylene", "C2H4"],
    getValue: (gases) => safeNumber(gases.C2H4),
  },
  {
    key: "methane",
    label: "Methane",
    axisLine1: "Methane",
    axisLine2: "CH4",
    code: "Gas",
    type: "gas",
    aliases: ["Methane", "CH4"],
    getValue: (gases) => safeNumber(gases.CH4),
  },
  {
    key: "acetylene",
    label: "Acetylene",
    axisLine1: "Acetylene",
    axisLine2: "C2H2",
    code: "Gas",
    type: "gas",
    aliases: ["Acetylene", "C2H2"],
    getValue: (gases) => safeNumber(gases.C2H2),
  },
];


function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}


function computeRatio(numerator, denominator) {
  const den = safeNumber(denominator);
  if (den <= 0) return null;
  return safeNumber(numerator) / den;
}


function normalizeFeatureLabel(value) {
  return `${value || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
}


function findImportance(featureImportance, aliases = []) {
  const lookup = new Map(
    (featureImportance || []).map((item) => [normalizeFeatureLabel(item.label), safeNumber(item.importance)])
  );
  for (const alias of aliases) {
    const matched = lookup.get(normalizeFeatureLabel(alias));
    if (matched != null) return matched;
  }
  return 0;
}


function formatMetricValue(metric, rawValue) {
  if (metric.type === "ratio") {
    if (rawValue == null) return "N/A";
    return rawValue >= 10 ? rawValue.toFixed(2) : rawValue.toFixed(3);
  }
  return `${Math.round(safeNumber(rawValue))} ppm`;
}


function buildDecisionMetrics(prediction, summary) {
  const gases = summary?.latest_dga?.gases || {};
  const baseMetrics = anatomyMetricDefs.map((metric) => {
    const rawValue = metric.getValue(gases);
    return {
      ...metric,
      rawValue,
      displayValue: formatMetricValue(metric, rawValue),
      importance: findImportance(prediction?.feature_importance, metric.aliases),
    };
  });

  const gasMax = Math.max(
    1,
    ...baseMetrics
      .filter((metric) => metric.type === "gas")
      .map((metric) => safeNumber(metric.rawValue))
  );
  const ratioMax = Math.max(
    1,
    ...baseMetrics
      .filter((metric) => metric.type === "ratio")
      .map((metric) => safeNumber(metric.rawValue))
  );
  const importanceMax = Math.max(1, ...baseMetrics.map((metric) => safeNumber(metric.importance)));

  return baseMetrics.map((metric) => ({
    ...metric,
    signalScore:
      metric.type === "ratio"
        ? Math.min(1, safeNumber(metric.rawValue) / ratioMax)
        : Math.min(1, safeNumber(metric.rawValue) / gasMax),
    importanceScore: Math.min(1, safeNumber(metric.importance) / importanceMax),
  }));
}


function buildLinePath(points, key) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point[key].toFixed(2)}`)
    .join(" ");
}


function scoreToY(score, chartTop, chartHeight) {
  const clamped = Math.max(0, Math.min(1, score));
  const visibleScore = 0.08 + clamped * 0.84;
  return chartTop + (1 - visibleScore) * chartHeight;
}


function DecisionAnatomyFigure({ prediction, summary }) {
  const metrics = buildDecisionMetrics(prediction, summary);
  if (!metrics.length) return null;

  const width = 980;
  const height = 332;
  const margin = { top: 24, right: 46, bottom: 92, left: 72 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = 214;
  const chartBottom = margin.top + chartHeight;
  const step = metrics.length > 1 ? chartWidth / (metrics.length - 1) : 0;
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const chartPanel = {
    x: margin.left - 18,
    y: margin.top - 12,
    width: chartWidth + 36,
    height: chartHeight + 24,
  };

  const plotted = metrics.map((metric, index) => ({
    ...metric,
    x: margin.left + step * index,
    signalY: scoreToY(metric.signalScore, margin.top, chartHeight),
    importanceY: scoreToY(metric.importanceScore, margin.top, chartHeight),
  }));

  const signalPath = buildLinePath(plotted, "signalY");
  const importancePath = buildLinePath(plotted, "importanceY");
  const topImportance = plotted.reduce((best, metric) => (metric.importance > best.importance ? metric : best), plotted[0]);
  const topSignal = plotted.reduce((best, metric) => (metric.signalScore > best.signalScore ? metric : best), plotted[0]);
  const sampleDate = summary?.latest_date || "Selected sample";
  const confidenceText = Number(prediction.confidence || 0).toFixed(1);
  const riskColor = riskColors[prediction.risk_level] || "var(--accent)";
  const topDriverAccent = topImportance.type === "ratio" ? "#f97316" : "var(--accent)";
  const chartBands = gridTicks.slice(0, -1).map((tick, index) => {
    const nextTick = gridTicks[index + 1];
    const yTop = scoreToY(nextTick, margin.top, chartHeight);
    const yBottom = scoreToY(tick, margin.top, chartHeight);
    return {
      key: `${tick}-${nextTick}`,
      y: yTop,
      height: yBottom - yTop,
      fill: index % 2 === 0 ? "rgba(15, 23, 42, 0.30)" : "rgba(15, 23, 42, 0.16)",
    };
  });

  return (
    <Card variant="glass" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Decision Anatomy</div>
          <div className="text-foreground text-lg font-semibold">How this sample pushes the AI fault call</div>
          <div className="text-muted-foreground text-xs mt-1 max-w-3xl">
            The blue line is the selected transformer reading normalized into the same view. The orange line is the model weight behind the current decision, so we can compare physical stress with AI emphasis without clutter.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            Sample date <span className="text-foreground font-semibold">{sampleDate}</span>
          </div>
          <div className="rounded-full border border-border bg-surface-input px-3 py-2 text-xs text-primary-dim">
            Model <span className="text-primary font-semibold uppercase">{prediction.algorithm}</span>
          </div>
          <div className="rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: riskColor, color: riskColor, backgroundColor: "rgba(15, 23, 42, 0.82)" }}>
            {prediction.predicted_fault} | {prediction.risk_level}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="w-full overflow-x-auto">
          <div className="rounded-[28px] border border-border bg-surface-input p-3">
            <div className="px-2 pt-2 pb-4 border-b border-[rgba(148,163,184,0.14)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary-muted">Signal Balance View</div>
              <div className="text-primary text-[30px] font-semibold leading-tight tracking-tight mt-2">
                Transformer gas and ratio balance
              </div>
              <div className="text-primary-dim text-sm mt-2 max-w-3xl">
                Higher position means stronger influence in the current sample and prediction context.
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <div
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    border: "1px solid var(--accent-border-strong)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  Selected-sample signal
                </div>
                <div className="rounded-full border border-[rgba(249,115,22,0.34)] bg-[rgba(249,115,22,0.08)] px-3 py-1.5 text-xs font-medium text-[#fdba74]">
                  AI importance weight
                </div>
                <div className="text-primary-dim text-xs">5 drivers focused on gases and key Duval ratios</div>
              </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[760px] mt-4">
              <defs>
                <linearGradient id="decisionPanelFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(15, 23, 42, 0.98)" />
                  <stop offset="100%" stopColor="rgba(10, 18, 32, 0.92)" />
                </linearGradient>
                <linearGradient id="signalGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent-soft-strong)" />
                  <stop offset="100%" stopColor="var(--accent-soft)" />
                </linearGradient>
                <linearGradient id="importanceGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(249, 115, 22, 0.16)" />
                  <stop offset="100%" stopColor="rgba(249, 115, 22, 0.04)" />
                </linearGradient>
              </defs>

              <rect x="6" y="6" width={width - 12} height={height - 12} rx="22" fill="url(#decisionPanelFill)" stroke="rgba(148, 163, 184, 0.34)" strokeWidth="2.5" />
              <rect x={chartPanel.x} y={chartPanel.y} width={chartPanel.width} height={chartPanel.height} rx="18" fill="var(--bg-input)" stroke="var(--accent-border)" strokeWidth="1.2" />

              {chartBands.map((band) => (
                <rect
                  key={band.key}
                  x={margin.left}
                  y={band.y}
                  width={chartWidth}
                  height={band.height}
                  fill={band.fill}
                />
              ))}

              <path d={signalPath} fill="none" stroke="url(#signalGlow)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d={importancePath} fill="none" stroke="url(#importanceGlow)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />

            {gridTicks.map((tick) => {
              const y = scoreToY(tick, margin.top, chartHeight);
              return (
                <g key={tick}>
                  <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--accent-border-strong)" strokeDasharray={tick === 0 ? "0" : "5 7"} />
                  <text x={margin.left - 14} y={y + 4} fill="var(--text-dim)" fontSize="11" textAnchor="end">
                    {Math.round(tick * 100)}
                  </text>
                </g>
              );
            })}

            {plotted.map((metric) => (
              <line key={metric.key} x1={metric.x} x2={metric.x} y1={margin.top} y2={chartBottom} stroke="rgba(148, 163, 184, 0.08)" />
            ))}

            <line x1={margin.left} x2={margin.left} y1={margin.top} y2={chartBottom} stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.5" />
            <line x1={margin.left} x2={width - margin.right} y1={chartBottom} y2={chartBottom} stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.5" />

            <path d={signalPath} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d={importancePath} fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8" />

            {plotted.map((metric) => (
              <g key={`${metric.key}-signal`}>
                <circle cx={metric.x} cy={metric.signalY} r={metric.key === topSignal.key ? "9" : "6.5"} fill="var(--bg-input)" stroke="var(--accent)" strokeWidth={metric.key === topSignal.key ? "3.5" : "2.5"} />
                {metric.key === topSignal.key && (
                  <>
                    <circle cx={metric.x} cy={metric.signalY} r="17" fill="none" stroke="var(--accent-border-strong)" strokeWidth="1.5" />
                    <text x={metric.x} y={metric.signalY - 18} fill="var(--accent)" fontSize="11" fontWeight="700" textAnchor="middle">
                      {metric.displayValue}
                    </text>
                  </>
                )}
              </g>
            ))}

            {plotted.map((metric) => (
              <g key={`${metric.key}-importance`}>
                <rect
                  x={metric.x - (metric.key === topImportance.key ? 7 : 5.5)}
                  y={metric.importanceY - (metric.key === topImportance.key ? 7 : 5.5)}
                  width={metric.key === topImportance.key ? "14" : "11"}
                  height={metric.key === topImportance.key ? "14" : "11"}
                  rx="2.5"
                  fill="var(--bg-input)"
                  stroke="#f97316"
                  strokeWidth={metric.key === topImportance.key ? "3" : "2.5"}
                />
                {metric.key === topImportance.key && (
                  <>
                    <circle cx={metric.x} cy={metric.importanceY} r="16" fill="none" stroke="rgba(249, 115, 22, 0.20)" strokeWidth="1.5" />
                    <text x={metric.x} y={metric.importanceY + 22} fill="#fdba74" fontSize="10.5" fontWeight="700" textAnchor="middle">
                      AI {metric.importance.toFixed(3)}
                    </text>
                  </>
                )}
              </g>
            ))}

            <text x="26" y={margin.top + chartHeight / 2} fill="var(--text-dim)" fontSize="12" textAnchor="middle" transform={`rotate(-90 26 ${margin.top + chartHeight / 2})`}>
              Relative intensity
            </text>
            <text x={margin.left + chartWidth / 2} y={height - 18} fill="var(--text-dim)" fontSize="12" textAnchor="middle">
              Gas and ratio drivers from the selected transformer sample
            </text>

            {plotted.map((metric) => (
              <g key={`${metric.key}-axis`}>
                <line x1={metric.x} x2={metric.x} y1={chartBottom} y2={chartBottom + 8} stroke="rgba(226, 232, 240, 0.65)" strokeWidth="1.25" />
                <text x={metric.x} y={chartBottom + 28} fill="var(--text)" fontSize="12" fontWeight="700" textAnchor="middle">
                  {metric.label}
                </text>
                <text x={metric.x} y={chartBottom + 46} fill="var(--text-dim)" fontSize="11" textAnchor="middle">
                  {metric.type === "ratio" ? "Ratio" : metric.axisLine2}
                </text>
              </g>
            ))}
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: riskColor, background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(12,18,30,0.96))" }}>
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Predicted fault</div>
            <div className="flex items-end justify-between gap-3 mt-1">
              <div className="text-primary text-2xl font-bold">{prediction.predicted_fault}</div>
              <div className="text-right">
                <div className="text-primary-dim text-[11px] uppercase tracking-wide">Confidence</div>
                <div className="text-primary text-lg font-semibold">{confidenceText}%</div>
              </div>
            </div>
            <div className="text-primary-dim text-sm mt-1">{prediction.predicted_fault_label}</div>
            <div className="text-xs mt-3 font-medium" style={{ color: riskColor }}>
              Risk level: {prediction.risk_level}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-input p-4">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Strongest sample signal</div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="text-accent text-xl font-bold">{topSignal.label}</div>
              <div className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                signal
              </div>
            </div>
            <div className="text-primary-dim text-sm mt-1">Measured value: {topSignal.displayValue}</div>
            <div className="h-1.5 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${Math.max(10, topSignal.signalScore * 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-input p-4">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Top AI driver</div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="text-warning text-xl font-bold">{topImportance.label}</div>
              <div className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[rgba(249,115,22,0.08)] text-[#fdba74]">
                weight
              </div>
            </div>
            <div className="text-primary-dim text-sm mt-1">Importance weight: {topImportance.importance.toFixed(4)}</div>
            <div className="h-1.5 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden mt-3">
              <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${Math.max(10, topImportance.importanceScore * 100)}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-input p-4">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Decision reading</div>
            <div className="text-primary-dim text-sm leading-6 mt-1">
              The current call leans on <span style={{ color: topDriverAccent }} className="font-medium">{topImportance.label}</span>, while the strongest raw signal in the sample is{" "}
              <span className="text-primary font-medium">{topSignal.label}</span>. Review this together with diagnostics and similar cases before confirming the fault interpretation.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mt-4">
        {plotted.map((metric) => (
          <div
            key={`${metric.key}-card`}
            className="rounded-xl border border-border bg-surface-input p-3"
            style={{
              boxShadow:
                metric.key === topSignal.key
                  ? "inset 0 0 0 1px var(--accent-border-strong)"
                  : metric.key === topImportance.key
                    ? "inset 0 0 0 1px rgba(249, 115, 22, 0.22)"
                    : "none",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-primary-muted text-[11px] uppercase tracking-wide">{metric.label}</div>
              <div
                className="h-2.5 w-2.5 rounded-full mt-1"
                style={{
                  backgroundColor:
                    metric.key === topSignal.key
                      ? "var(--accent)"
                      : metric.key === topImportance.key
                        ? "#f97316"
                        : "rgba(148, 163, 184, 0.6)",
                }}
              />
            </div>
            <div className="text-primary text-base font-semibold mt-1">{metric.displayValue}</div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-primary-dim text-[11px]">Signal</div>
                <div className="h-1.5 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden mt-1">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(6, metric.signalScore * 100)}%`, background: "var(--accent)" }} />
                </div>
              </div>
              <div>
                <div className="text-primary-dim text-[11px]">AI weight</div>
                <div className="h-1.5 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${Math.max(6, metric.importanceScore * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="text-muted-foreground text-xs mt-2">AI weight {metric.importance.toFixed(4)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}


export default function MLPrediction({ prediction, summary }) {
  if (!prediction) {
    return <Card variant="glass" className="p-5 text-sm text-muted-foreground">No prediction data available.</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        <Card variant="glass" className="p-5">
          <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Predicted Fault</div>
          <div className="text-foreground text-lg font-bold">{prediction.predicted_fault}</div>
          <div className="text-muted-foreground text-xs mt-1">{prediction.predicted_fault_label}</div>
        </Card>
        <Card variant="glass" className="p-5">
          <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Risk Level</div>
          <div className="text-lg font-bold" style={{ color: riskColors[prediction.risk_level] || "var(--accent)" }}>
            {prediction.risk_level}
          </div>
          <div className="text-muted-foreground text-xs mt-1">Decision layer output</div>
        </Card>
        <Card variant="glass" className="p-5">
          <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Confidence</div>
          <div className="text-foreground text-lg font-bold">{prediction.confidence}%</div>
          <div className="text-muted-foreground text-xs mt-1">Model: {prediction.algorithm}</div>
        </Card>
      </div>

      <Card variant="glass" className="p-5">
        <div className="text-muted-foreground text-[11px] uppercase tracking-widest font-medium mb-2">Feature Importance</div>
        <div className="text-muted-foreground text-xs mb-4">
          Top factors driving the current AI decision for the selected transformer.
        </div>

        {(prediction.feature_importance || []).length === 0 ? (
          <div className="text-muted-foreground text-sm">No feature-importance output available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={prediction.feature_importance} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={120}
                tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--text)",
                }}
                formatter={(value) => [Number(value).toFixed(4), "Importance"]}
              />
              <Bar dataKey="importance" radius={[0, 6, 6, 0]} stroke="rgba(255,255,255,0.18)" strokeWidth={1}>
                {(prediction.feature_importance || []).map((entry, index) => (
                  <Cell
                    key={`${entry.label}-${index}`}
                    fill={featureImportanceColors[index % featureImportanceColors.length]}
                    fillOpacity={Math.max(0.7, 1 - index * 0.06)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="text-muted-foreground text-xs mt-4">{prediction.recommendation}</div>
      </Card>

      <DecisionAnatomyFigure prediction={prediction} summary={summary} />
    </div>
  );
}
