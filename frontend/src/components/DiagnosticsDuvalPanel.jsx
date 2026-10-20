import { useId, useMemo, useState } from "react";
import DuvalHeptagonPanel, { buildHeptagonHistory } from "./DuvalHeptagonPanel";
import { Badge as UIBadge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const HISTORY_COLOR = "var(--accent)";
const RUNNER_COLOR = "#f43f5e";
const RUNNER_GLOW_FILTER = "drop-shadow(0 0 6px rgba(251, 113, 133, 0.95)) drop-shadow(0 0 18px rgba(244, 63, 94, 0.8))";

const GAS_COLORS = {
  H2: "#3b82f6",
  CH4: "#22c55e",
  C2H2: "#ef4444",
  C2H4: "#f97316",
  C2H6: "#a855f7",
};

const toNum = (value) => Number(value) || 0;
const HEPTAGON_MODE = {
  key: "h1",
  label: "Heptagon",
  modeName: "Duval Heptagon",
};

const getModeGasRows = (point, modeKey) => {
  const h2 = toNum(point?.pH2);
  const ch4 = toNum(point?.pCH4);
  const c2h2 = toNum(point?.pC2H2);
  const c2h4 = toNum(point?.pC2H4);
  const c2h6 = toNum(point?.pC2H6);

  if (modeKey === "t4") return [{ key: "H2", value: h2 }, { key: "CH4", value: ch4 }, { key: "C2H6", value: c2h6 }];
  if (modeKey === "t5") return [{ key: "CH4", value: ch4 }, { key: "C2H4", value: c2h4 }, { key: "C2H6", value: c2h6 }];
  if (modeKey === "p1") {
    return [
      { key: "H2", value: h2 },
      { key: "CH4", value: ch4 },
      { key: "C2H6", value: c2h6 },
      { key: "C2H4", value: c2h4 },
      { key: "C2H2", value: c2h2 },
    ];
  }
  return [{ key: "CH4", value: ch4 }, { key: "C2H4", value: c2h4 }, { key: "C2H2", value: c2h2 }];
};

const formatPct = (value, total) => {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
};

export default function DiagnosticsDuvalPanel({
  txResults,
  duvalImageConfig,
  getDuvalFaultForMode,
  getDuvalTriangleImageXY,
  getDuvalPentagonImageXY,
  faultLabels,
  faultColors,
  activeMode: activeModeFromParent,
  onModeChange,
  diagramOnly = false,
}) {
  const [internalMode, setInternalMode] = useState("t1");
  const activeMode = activeModeFromParent !== undefined ? activeModeFromParent : internalMode;
  const setActiveMode = onModeChange || setInternalMode;
  const [showHistory, setShowHistory] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const historyPathId = `duval-history-${useId().replace(/:/g, "")}`;

  const rawPoints = useMemo(() => {
    const sorted = [...(txResults || [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((row, idx) => ({
      idx,
      date: row?.date || `Record ${idx + 1}`,
      pH2: toNum(row?.H2),
      pCH4: toNum(row?.CH4),
      pC2H2: toNum(row?.C2H2),
      pC2H4: toNum(row?.C2H4),
      pC2H6: toNum(row?.C2H6),
    }));
  }, [txResults]);

  const heptagonHistory = useMemo(() => buildHeptagonHistory(txResults), [txResults]);

  const hasModeData = useMemo(() => {
    const hasAny = (selector) => rawPoints.some((p) => selector(p) > 0);
    return {
      t1: hasAny((p) => p.pCH4 + p.pC2H4 + p.pC2H2),
      t4: hasAny((p) => p.pH2 + p.pCH4 + p.pC2H6),
      t5: hasAny((p) => p.pCH4 + p.pC2H4 + p.pC2H6),
      p1: hasAny((p) => p.pH2 + p.pCH4 + p.pC2H6 + p.pC2H4 + p.pC2H2),
      h1: heptagonHistory.length > 0,
    };
  }, [rawPoints, heptagonHistory]);

  const modeButtons = useMemo(
    () => [...Object.values(duvalImageConfig || {}), HEPTAGON_MODE],
    [duvalImageConfig]
  );

  const activeModeKey = !diagramOnly && !hasModeData[activeMode] ? "t1" : activeMode;
  const activeDiagram = duvalImageConfig[activeModeKey] || duvalImageConfig.t1;
  const historyVisible = diagramOnly ? true : showHistory;

  const projectedPoints = useMemo(() => {
    if (activeModeKey === "h1") return [];

    const project = (p) => {
      if (activeModeKey === "p1") return getDuvalPentagonImageXY(p.pH2, p.pCH4, p.pC2H6, p.pC2H4, p.pC2H2);
      if (activeModeKey === "t4") return getDuvalTriangleImageXY(p.pH2, p.pCH4, p.pC2H6);
      if (activeModeKey === "t5") return getDuvalTriangleImageXY(p.pCH4, p.pC2H4, p.pC2H6);
      return getDuvalTriangleImageXY(p.pCH4, p.pC2H4, p.pC2H2);
    };

    return rawPoints
      .map((p) => {
        const xy = project(p);
        if (!xy) return null;
        const fault = getDuvalFaultForMode({ ...p, ...xy }, activeModeKey);
        const faultLabel = faultLabels[fault] || "Unknown";
        return { ...p, ...xy, fault, faultLabel };
      })
      .filter(Boolean);
  }, [activeModeKey, rawPoints, getDuvalPentagonImageXY, getDuvalTriangleImageXY, getDuvalFaultForMode, faultLabels]);

  const pathD = projectedPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const firstPoint = projectedPoints[0] || null;
  const latestPoint = projectedPoints[projectedPoints.length - 1] || null;
  const latestHeptagon = heptagonHistory[heptagonHistory.length - 1] || null;
  const latestFault = activeModeKey === "h1"
    ? (latestHeptagon?.fault || "N")
    : (latestPoint ? getDuvalFaultForMode(latestPoint, activeModeKey) : "N");
  const latestFaultLabel = activeModeKey === "h1"
    ? "Weighted 7-gas diagnosis"
    : (faultLabels[latestFault] || "Unknown fault");

  const latestModeRows = activeModeKey === "h1" ? [] : getModeGasRows(latestPoint, activeModeKey);
  const latestModeTotal = latestModeRows.reduce((sum, gas) => sum + gas.value, 0);
  const runnerDuration = activeModeKey === "p1" ? "3.4s" : "3s";

  const diagramCanvas = activeModeKey === "h1" ? (
    <DuvalHeptagonPanel
      txResults={txResults}
      faultColors={faultColors}
      diagramOnly={diagramOnly}
    />
  ) : projectedPoints.length > 0 ? (
    <div
      data-duval-container
      style={{
        position: "relative",
        borderRadius: 8,
        overflow: "visible",
        border: `1px solid ${"var(--border)"}`,
        background: "#eaf2ff",
        maxWidth: activeModeKey === "p1" ? 760 : 740,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <img
        src={activeDiagram.src}
        alt={activeDiagram.modeName}
        style={{
          width: "100%",
          display: "block",
          background: "#eaf2ff",
          filter: activeModeKey === "p1" ? "brightness(1.14) contrast(0.96)" : "brightness(1.2) contrast(0.95)",
        }}
      />
      <svg
        viewBox={activeDiagram.viewBox}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {historyVisible && pathD && projectedPoints.length > 1 && (
          <>
            <path
              id={historyPathId}
              d={pathD}
              fill="none"
              stroke={"var(--accent)"}
              strokeWidth="5"
              strokeDasharray="14 8"
              strokeLinecap="round"
              opacity="0.95"
            />
            <circle
              r={activeModeKey === "p1" ? 8 : 7}
              fill={RUNNER_COLOR}
              opacity="0"
              className="duval-history-runner"
              style={{ filter: RUNNER_GLOW_FILTER }}
            >
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={runnerDuration}
                repeatCount="indefinite"
                keyTimes="0;0.12;0.88;1"
              />
              <animateMotion dur={runnerDuration} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${historyPathId}`} xlinkHref={`#${historyPathId}`} />
              </animateMotion>
            </circle>
          </>
        )}
        {projectedPoints.map((point, idx) => {
          const isLatest = idx === projectedPoints.length - 1;
          if (!isLatest && !historyVisible) return null;
          const fill = isLatest ? "var(--danger)" : HISTORY_COLOR;
          return (
            <g
              key={`${point.date}-${idx}`}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onMouseEnter={(e) => {
                const container = e.currentTarget.closest("[data-duval-container]");
                const rect = container.getBoundingClientRect();
                const svgEl = e.currentTarget.closest("svg");
                const svgRect = svgEl.getBoundingClientRect();
                const circle = e.currentTarget.querySelector("circle");
                const cx = parseFloat(circle.getAttribute("cx"));
                const cy = parseFloat(circle.getAttribute("cy"));
                const vb = activeDiagram.viewBox.split(" ").map(Number);
                const pxX = ((cx - vb[0]) / vb[2]) * svgRect.width + svgRect.left - rect.left;
                const pxY = ((cy - vb[1]) / vb[3]) * svgRect.height + svgRect.top - rect.top;
                setHoveredPoint({ ...point, pxX, pxY, containerW: rect.width });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={isLatest ? 12 : 9}
                fill={fill}
                stroke="#ffffff"
                strokeWidth="3"
              />
              <circle cx={point.x} cy={point.y} r={isLatest ? 5 : 4} fill="#ffffff" />
              <circle cx={point.x} cy={point.y} r="18" fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hoveredPoint && (() => {
        const tooltipW = 240;
        const gap = 14;
        const fitsRight = hoveredPoint.pxX + gap + tooltipW < hoveredPoint.containerW;
        const left = fitsRight ? hoveredPoint.pxX + gap : hoveredPoint.pxX - gap - tooltipW;
        return (
          <div
            style={{
              position: "absolute",
              left,
              top: hoveredPoint.pxY - 36,
              width: tooltipW,
              background: "rgba(10, 15, 26, 0.95)",
              border: `1px solid ${"var(--border)"}`,
              borderRadius: 8,
              padding: "10px 14px",
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              {hoveredPoint.date}
            </div>
            <div style={{ color: faultColors[hoveredPoint.fault] || "var(--accent)", fontSize: 12, fontWeight: 600 }}>
              Zone {hoveredPoint.fault} - {hoveredPoint.faultLabel}
            </div>
          </div>
        );
      })()}
    </div>
  ) : (
    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Not enough gas data to draw Duval movement.</div>
  );

  if (diagramOnly) {
    return diagramCanvas;
  }

  return (
    <Card variant="glass" className="p-4">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>Duval Diagnostics (History to Latest)</div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>
            Latest zone: <span style={{ color: faultColors[latestFault] || "var(--accent)", fontWeight: 700 }}>{latestFault}</span> - {latestFaultLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {modeButtons.map((cfg) => {
            const unavailable = !hasModeData[cfg.key];
            const active = activeModeKey === cfg.key;
            return (
              <Button
                key={cfg.key}
                type="button"
                variant={active ? "primary" : "secondary"}
                size="sm"
                disabled={unavailable}
                onClick={() => !unavailable && setActiveMode(cfg.key)}
                className="h-7 px-2.5 text-[11px]"
                style={unavailable ? { opacity: 0.5 } : undefined}
              >
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </div>

      {!hasModeData[activeMode] && (
        <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>
          Selected Duval view has incomplete gas data. Showing Triangle 1.
        </div>
      )}

      {activeModeKey === "h1" ? (
        <DuvalHeptagonPanel
          txResults={txResults}
          faultColors={faultColors}
        />
      ) : projectedPoints.length > 0 ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, alignItems: "stretch" }}>
            {diagramCanvas}

            <div style={{ background: "var(--bg-input)", border: `1px solid ${"var(--border)"}`, borderRadius: 8, padding: 12 }}>
              <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{activeDiagram.modeName}</div>
              <div style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 8 }}>
                Latest sample: <span style={{ color: "var(--text)" }}>{latestPoint?.date || "-"}</span>
              </div>
              <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Zone {latestFault} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>({latestFaultLabel})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                {latestModeRows.map((gas) => (
                  <div
                    key={gas.key}
                    style={{
                      background: "var(--bg-card)",
                      border: `1px solid ${"var(--border)"}`,
                      borderRadius: 6,
                      padding: "8px 9px",
                    }}
                  >
                    <div style={{ color: GAS_COLORS[gas.key] || "var(--accent)", fontSize: 11, fontWeight: 700 }}>{gas.key}</div>
                    <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>{formatPct(gas.value, latestModeTotal)}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{gas.value.toFixed(1)} ppm</div>
                  </div>
                ))}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 8 }}>
                Percentages are normalized for the selected Duval mode.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: 11 }}>
            <span style={{ color: "var(--text-dim)" }}>
              Start: <span style={{ color: "var(--text)" }}>{firstPoint?.date || "-"}</span> ({firstPoint ? getDuvalFaultForMode(firstPoint, activeModeKey) : "N"})
            </span>
            <span style={{ color: "var(--text-dim)" }}>
              End: <span style={{ color: "var(--text)" }}>{latestPoint?.date || "-"}</span> ({latestPoint ? getDuvalFaultForMode(latestPoint, activeModeKey) : "N"})
            </span>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
              className="h-7 gap-2 px-2.5 text-[11px]"
              style={{ color: showHistory ? HISTORY_COLOR : "var(--text-muted)", opacity: showHistory ? 1 : 0.6 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: showHistory ? HISTORY_COLOR : "var(--text-muted)",
                  border: "2px solid #fff",
                }}
              />
              History path {showHistory ? "(on)" : "(off)"}
            </Button>
            <UIBadge variant="destructive" className="bg-destructive/10 text-[11px]">
              Latest point
            </UIBadge>
            <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>Hover points for details</span>
          </div>
        </>
      ) : (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Not enough gas data to draw Duval movement.</div>
      )}
    </Card>
  );
}
