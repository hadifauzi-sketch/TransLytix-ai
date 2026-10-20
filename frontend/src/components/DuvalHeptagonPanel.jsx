import { useId, useMemo, useState } from "react";

export const HEPTAGON_IMAGE_SRC = "https://upload.wikimedia.org/wikipedia/commons/1/15/Duval_Heptagon.png";
export const HEPTAGON_GASES_ORDER = ["CO", "CO2", "C2H4", "H2", "CH4", "C2H2", "C2H6"];

const HISTORY_COLOR = "var(--accent)";
const RUNNER_COLOR = "#f43f5e";
const RUNNER_GLOW_FILTER = "drop-shadow(0 0 6px rgba(251, 113, 133, 0.95)) drop-shadow(0 0 20px rgba(244, 63, 94, 0.8))";
const DEFAULT_HEPTAGON_VIEWBOX = { width: 1000, height: 1000 };
const HEPTAGON_CENTER_RATIO = { x: 0.5, y: 0.52 };

// Anchor each gas to the corresponding axis position on the official Duval Heptagon image.
// Ratios are normalized (0..1) to remain stable across different natural image sizes.
const HEPTAGON_AXIS_RATIOS = {
  CO: { x: 0.50, y: 0.11 },
  CO2: { x: 0.86, y: 0.27 },
  C2H4: { x: 0.87, y: 0.66 },
  H2: { x: 0.63, y: 0.92 },
  CH4: { x: 0.36, y: 0.92 },
  C2H2: { x: 0.12, y: 0.66 },
  C2H6: { x: 0.13, y: 0.27 },
};

// Approximate Duval Heptagon zone polygons on the official reference image.
// Ratios are normalized (0..1) and then scaled to image natural size.
const HEPTAGON_ZONE_POLYGONS = {
  D2: [
    { x: 0.18, y: 0.30 },
    { x: 0.50, y: 0.13 },
    { x: 0.58, y: 0.32 },
    { x: 0.53, y: 0.51 },
    { x: 0.18, y: 0.51 },
  ],
  D1: [
    { x: 0.12, y: 0.65 },
    { x: 0.18, y: 0.51 },
    { x: 0.53, y: 0.51 },
    { x: 0.40, y: 0.90 },
    { x: 0.16, y: 0.76 },
  ],
  TD: [
    { x: 0.53, y: 0.51 },
    { x: 0.58, y: 0.32 },
    { x: 0.83, y: 0.50 },
    { x: 0.67, y: 0.89 },
    { x: 0.40, y: 0.90 },
  ],
  LCCD: [
    { x: 0.58, y: 0.32 },
    { x: 0.67, y: 0.26 },
    { x: 0.86, y: 0.39 },
    { x: 0.83, y: 0.50 },
  ],
  MCCD: [
    { x: 0.67, y: 0.26 },
    { x: 0.73, y: 0.21 },
    { x: 0.87, y: 0.29 },
    { x: 0.86, y: 0.39 },
  ],
  HCCD: [
    { x: 0.73, y: 0.21 },
    { x: 0.82, y: 0.19 },
    { x: 0.89, y: 0.26 },
    { x: 0.87, y: 0.29 },
  ],
  T3: [
    { x: 0.67, y: 0.89 },
    { x: 0.83, y: 0.50 },
    { x: 0.77, y: 0.59 },
    { x: 0.72, y: 0.89 },
  ],
  T2: [
    { x: 0.72, y: 0.89 },
    { x: 0.77, y: 0.61 },
    { x: 0.80, y: 0.59 },
    { x: 0.79, y: 0.71 },
    { x: 0.76, y: 0.82 },
  ],
  T1: [
    { x: 0.79, y: 0.71 },
    { x: 0.80, y: 0.59 },
    { x: 0.90, y: 0.63 },
    { x: 0.85, y: 0.77 },
  ],
  PD: [
    { x: 0.34, y: 0.86 },
    { x: 0.65, y: 0.85 },
    { x: 0.51, y: 0.97 },
    { x: 0.27, y: 0.97 },
  ],
  Normal: [
    { x: 0.56, y: 0.54 },
    { x: 0.62, y: 0.50 },
    { x: 0.60, y: 0.58 },
    { x: 0.54, y: 0.58 },
  ],
};

const HEPTAGON_FAULT_FOCUS_GASES = {
  HCCD: ["CO", "CO2", "C2H4"],
  MCCD: ["CO", "CO2", "C2H4"],
  LCCD: ["CO", "CO2", "C2H4"],
  T1: ["CH4", "H2", "C2H4"],
  T2: ["CH4", "H2", "C2H4"],
  T3: ["CH4", "H2", "C2H4"],
  PD: ["H2", "CH4", "C2H2"],
  D1: ["H2", "C2H2", "C2H6"],
  D2: ["H2", "C2H2", "C2H6"],
  TD: ["H2", "CH4", "C2H2", "C2H4"],
  Normal: HEPTAGON_GASES_ORDER,
};

const HEPTAGON_CENTROID_ZONES = new Set(["HCCD", "MCCD", "LCCD"]);

const WEIGHTING_FACTORS = {
  H2: 3.5,
  CH4: 2.9167,
  C2H6: 5.3846,
  C2H4: 7.0,
  C2H2: 116.6667,
  CO: 1.0,
  CO2: 0.14,
};

const toNum = (value) => Number(value) || 0;

const HEPTAGON_FAULT_DESCRIPTIONS = {
  Normal: "No dominant fault signature from weighted Duval Heptagon ratios.",
  HCCD: "High concentration cellulose degradation (severe paper aging).",
  MCCD: "Medium concentration cellulose degradation.",
  LCCD: "Low concentration cellulose degradation.",
  T1: "Thermal fault T1 (<300 C).",
  T2: "Thermal fault T2 (300-700 C).",
  T3: "Thermal fault T3 (>700 C).",
  PD: "Partial discharge signature.",
  D1: "Low-energy electrical discharge (D1).",
  D2: "High-energy electrical discharge (D2).",
  TD: "Combined thermal and electrical discharge behavior.",
};

export const computeHeptagonPercentages = (gases) => {
  let totalWeighted = 0;
  const weighted = {};

  HEPTAGON_GASES_ORDER.forEach((gas) => {
    const value = toNum(gases?.[gas]);
    const weightedValue = value * (WEIGHTING_FACTORS[gas] || 1);
    weighted[gas] = weightedValue;
    totalWeighted += weightedValue;
  });

  if (totalWeighted <= 0) return null;

  const pct = {};
  HEPTAGON_GASES_ORDER.forEach((gas) => {
    pct[gas] = (weighted[gas] / totalWeighted) * 100;
  });

  return pct;
};

export const determineHeptagonFault = (pct) => {
  if (!pct) return "Normal";

  const co = toNum(pct.CO);
  const co2 = toNum(pct.CO2);
  const c2h4 = toNum(pct.C2H4);
  const c2h2 = toNum(pct.C2H2);

  // Match the verified calculator thresholds for the weighted Duval Heptagon.
  if (c2h2 > 46.03) {
    return c2h4 <= 2.83 ? "D1" : "D2";
  }

  if (c2h4 <= 0.89) {
    return "PD";
  }

  if (c2h4 <= 32.97) {
    if (c2h4 <= 3.56) {
      if (co2 <= 11.49) {
        return "MCCD";
      }

      if (c2h4 <= 2.96) {
        return "HCCD";
      }

      return co2 <= 25.32 ? "T1" : "T2";
    }

    return co <= 32.87 ? "Normal" : "LCCD";
  }

  if (co2 <= 0.55) {
    return "T2";
  }

  if (c2h4 > 40 && c2h2 > 10) {
    return "TD";
  }

  return "T3";
};

const axisRatioToPoint = (gas, dims) => {
  const ratio = HEPTAGON_AXIS_RATIOS[gas] || { x: 0.5, y: 0.5 };
  return {
    x: ratio.x * dims.width,
    y: ratio.y * dims.height,
  };
};

const zonePolygonToPoints = (fault, dims) => {
  const ratios = HEPTAGON_ZONE_POLYGONS[fault] || HEPTAGON_ZONE_POLYGONS.Normal;
  return ratios.map((point) => ({
    x: point.x * dims.width,
    y: point.y * dims.height,
  }));
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const cross = (a, b) => (a.x * b.y) - (a.y * b.x);

const getPolygonCentroid = (points) => {
  if (!points?.length) return null;
  if (points.length < 3) {
    const count = points.length;
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / count,
      y: points.reduce((sum, p) => sum + p.y, 0) / count,
    };
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const factor = (p1.x * p2.y) - (p2.x * p1.y);
    twiceArea += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
  }

  if (Math.abs(twiceArea) < 1e-6) {
    const count = points.length;
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / count,
      y: points.reduce((sum, p) => sum + p.y, 0) / count,
    };
  }

  return {
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
};

const getRayPolygonIntersection = (origin, direction, polygon) => {
  let closest = null;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denom = cross(direction, edge);
    if (Math.abs(denom) < 1e-8) continue;

    const delta = { x: a.x - origin.x, y: a.y - origin.y };
    const t = cross(delta, edge) / denom;
    const u = cross(delta, direction) / denom;
    if (t < 0 || u < 0 || u > 1) continue;

    if (!closest || t < closest.t) {
      closest = {
        t,
        point: {
          x: origin.x + (direction.x * t),
          y: origin.y + (direction.y * t),
        },
      };
    }
  }

  return closest?.point || null;
};

const isPointInPolygon = (point, polygon) => {
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
};

const keepPointInsidePolygon = (target, center, polygon, safety = 0.94) => {
  const safeTarget = {
    x: center.x + ((target.x - center.x) * safety),
    y: center.y + ((target.y - center.y) * safety),
  };
  if (isPointInPolygon(safeTarget, polygon)) return safeTarget;

  let lo = 0;
  let hi = 1;
  let best = { ...center };
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    const candidate = {
      x: center.x + ((target.x - center.x) * mid),
      y: center.y + ((target.y - center.y) * mid),
    };
    if (isPointInPolygon(candidate, polygon)) {
      best = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    x: center.x + ((best.x - center.x) * safety),
    y: center.y + ((best.y - center.y) * safety),
  };
};

// Real heptagon overlay projection:
// 1) choose the diagnosed Duval zone polygon;
// 2) build weighted gas direction (from official axis order);
// 3) intersect that ray with zone boundary and place point by weighted spread.
const getHeptagonPoint = (pct, fault, dims) => {
  if (!pct) return null;
  const faultKey = HEPTAGON_ZONE_POLYGONS[fault] ? fault : "Normal";
  const zonePolygon = zonePolygonToPoints(faultKey, dims);
  const zoneCenter = getPolygonCentroid(zonePolygon);
  if (!zoneCenter) return null;

  // Cellulose zones are compact and adjacent; placing the marker at the
  // polygon centroid keeps it visibly inside the diagnosed zone.
  if (HEPTAGON_CENTROID_ZONES.has(faultKey)) {
    return {
      x: clamp(zoneCenter.x, dims.width * 0.03, dims.width * 0.97),
      y: clamp(zoneCenter.y, dims.height * 0.03, dims.height * 0.97),
    };
  }

  const center = {
    x: HEPTAGON_CENTER_RATIO.x * dims.width,
    y: HEPTAGON_CENTER_RATIO.y * dims.height,
  };
  const focusGases = HEPTAGON_FAULT_FOCUS_GASES[faultKey] || HEPTAGON_GASES_ORDER;
  const focusTotal = focusGases.reduce((sum, gas) => sum + Math.max(0, toNum(pct[gas])), 0);

  if (focusTotal <= 0) return zoneCenter;

  let dirX = 0;
  let dirY = 0;

  focusGases.forEach((gas) => {
    const anchor = axisRatioToPoint(gas, dims);
    const vx = anchor.x - center.x;
    const vy = anchor.y - center.y;
    const len = Math.hypot(vx, vy);
    if (len < 1e-6) return;
    const share = Math.max(0, toNum(pct[gas])) / focusTotal;
    dirX += (vx / len) * share;
    dirY += (vy / len) * share;
  });

  const dirLen = Math.hypot(dirX, dirY);
  if (dirLen < 1e-6) return zoneCenter;

  const ray = { x: dirX / dirLen, y: dirY / dirLen };
  const boundaryPoint = getRayPolygonIntersection(zoneCenter, ray, zonePolygon);
  if (!boundaryPoint) return zoneCenter;

  const dominantShare = focusGases.reduce((best, gas) => (
    Math.max(best, Math.max(0, toNum(pct[gas])) / focusTotal)
  ), 0);
  const spread = clamp(0.24 + (dominantShare * 0.32), 0.22, 0.58);
  const projected = {
    x: zoneCenter.x + ((boundaryPoint.x - zoneCenter.x) * spread),
    y: zoneCenter.y + ((boundaryPoint.y - zoneCenter.y) * spread),
  };
  const interiorPoint = keepPointInsidePolygon(projected, zoneCenter, zonePolygon);
  const result = {
    x: interiorPoint.x,
    y: interiorPoint.y,
  };

  // Keep PD markers near the CH4-side lower edge, matching the verified calculator.
  if (faultKey === "PD") {
    result.x = dims.width * 0.33;
    result.y = dims.height * 0.93;
  }

  return {
    x: clamp(result.x, dims.width * 0.03, dims.width * 0.97),
    y: clamp(result.y, dims.height * 0.03, dims.height * 0.97),
  };
};

export const buildHeptagonHistory = (txResults = []) => {
  const sorted = [...txResults].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return sorted
    .map((row, idx) => {
      const gases = {
        H2: toNum(row?.H2),
        CH4: toNum(row?.CH4),
        C2H2: toNum(row?.C2H2),
        C2H4: toNum(row?.C2H4),
        C2H6: toNum(row?.C2H6),
        CO: toNum(row?.CO),
        CO2: toNum(row?.CO2),
      };
      const percentages = computeHeptagonPercentages(gases);
      if (!percentages) return null;
      const fault = determineHeptagonFault(percentages);
      const dominantGas = HEPTAGON_GASES_ORDER.reduce((best, gas) => (
        toNum(percentages[gas]) > toNum(percentages[best]) ? gas : best
      ), HEPTAGON_GASES_ORDER[0]);

      return {
        idx,
        date: row?.date || `Record ${idx + 1}`,
        gases,
        percentages,
        fault,
        dominantGas,
      };
    })
    .filter(Boolean);
};

export default function DuvalHeptagonPanel({
  txResults,
  faultColors = {},
  diagramOnly = false,
}) {
  const [showHistory, setShowHistory] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [imageDims, setImageDims] = useState(DEFAULT_HEPTAGON_VIEWBOX);
  const [imageLoadError, setImageLoadError] = useState(false);
  const historyPathId = `heptagon-history-${useId().replace(/:/g, "")}`;

  const history = useMemo(() => {
    const base = buildHeptagonHistory(txResults);
    return base
      .map((entry) => ({
        ...entry,
        ...getHeptagonPoint(entry.percentages, entry.fault, imageDims),
      }))
      .filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y));
  }, [txResults, imageDims]);

  const latest = history[history.length - 1] || null;
  const first = history[0] || null;
  const latestFaultColor = faultColors[latest?.fault] || "#a855f7";
  const pathD = history.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  const latestFaultDescription = HEPTAGON_FAULT_DESCRIPTIONS[latest?.fault] || "Heptagon zone description unavailable.";
  const latestFaultCode = latest?.fault || "N/A";
  const runnerDuration = "3.6s";
  const historyVisible = diagramOnly ? true : showHistory;

  if (!history.length) {
    return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Not enough gas data to draw Duval Heptagon movement.</div>;
  }

  const diagramCanvas = (
    <div
      data-heptagon-container
      style={{
        position: "relative",
        background: "#e2e8f0",
        border: `1px solid ${"var(--border)"}`,
        borderRadius: 8,
        overflow: "hidden",
        maxWidth: 740,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {!imageLoadError ? (
        <img
          src={HEPTAGON_IMAGE_SRC}
          alt="Duval Heptagon Overlay"
          onLoad={(event) => {
            const naturalWidth = event.currentTarget.naturalWidth || DEFAULT_HEPTAGON_VIEWBOX.width;
            const naturalHeight = event.currentTarget.naturalHeight || DEFAULT_HEPTAGON_VIEWBOX.height;
            setImageDims({ width: naturalWidth, height: naturalHeight });
            setImageLoadError(false);
          }}
          onError={() => setImageLoadError(true)}
          style={{
            width: "100%",
            display: "block",
            background: "#f8fafc",
          }}
        />
      ) : (
        <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 14 }}>
          Unable to load Duval Heptagon image.
        </div>
      )}

      {!imageLoadError && (
        <svg
          viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {historyVisible && history.length > 1 && (
            <>
              <path
                id={historyPathId}
                d={pathD}
                fill="none"
                stroke={"var(--accent)"}
                strokeWidth="8"
                strokeDasharray="16 10"
                strokeLinecap="round"
                opacity="0.95"
              />
              <circle
                r="14"
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

          {history.map((point, idx) => {
            const isLatest = idx === history.length - 1;
            if (!isLatest && !historyVisible) return null;
            const color = isLatest ? "var(--danger)" : HISTORY_COLOR;
            return (
              <g
                key={`${point.date}-${idx}`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const container = e.currentTarget.closest("[data-heptagon-container]");
                  const rect = container.getBoundingClientRect();
                  const svg = e.currentTarget.closest("svg");
                  const svgRect = svg.getBoundingClientRect();
                  const circle = e.currentTarget.querySelector("circle");
                  const pxX = ((parseFloat(circle.getAttribute("cx")) / imageDims.width) * svgRect.width) + (svgRect.left - rect.left);
                  const pxY = ((parseFloat(circle.getAttribute("cy")) / imageDims.height) * svgRect.height) + (svgRect.top - rect.top);
                  setHoveredPoint({ ...point, pxX, pxY, containerW: rect.width });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isLatest ? 22 : 16}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="5"
                />
                <circle cx={point.x} cy={point.y} r={isLatest ? 9 : 7} fill="#ffffff" />
                <circle cx={point.x} cy={point.y} r="30" fill="transparent" />
              </g>
            );
          })}
        </svg>
      )}

      {hoveredPoint && (() => {
        const tooltipW = 260;
        const gap = 14;
        const left = hoveredPoint.pxX + gap + tooltipW < hoveredPoint.containerW
          ? hoveredPoint.pxX + gap
          : hoveredPoint.pxX - tooltipW - gap;
        return (
          <div
            style={{
              position: "absolute",
              left,
              top: hoveredPoint.pxY - 34,
              width: tooltipW,
              background: "rgba(10, 15, 26, 0.95)",
              border: `1px solid ${"var(--border)"}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: "var(--text)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>{hoveredPoint.date}</div>
            <div style={{ color: faultColors[hoveredPoint.fault] || "var(--accent)", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
              Zone {hoveredPoint.fault}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
              Dominant: {hoveredPoint.dominantGas} ({toNum(hoveredPoint.percentages?.[hoveredPoint.dominantGas]).toFixed(1)}%)
            </div>
          </div>
        );
      })()}
    </div>
  );

  if (diagramOnly) {
    return diagramCanvas;
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, alignItems: "stretch" }}>
        {diagramCanvas}

        <div style={{ background: "var(--bg-input)", border: `1px solid ${"var(--border)"}`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Duval Heptagon</div>
            <div style={{ color: "var(--text-dim)", fontSize: 11 }}>
              Latest sample: <span style={{ color: "var(--text)" }}>{latest?.date || "-"}</span>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}`, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ color: latestFaultColor, fontWeight: 800, fontSize: 14 }}>Zone {latestFaultCode}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 3 }}>{latestFaultDescription}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(88px, 1fr))", gap: 8 }}>
            {HEPTAGON_GASES_ORDER.map((gas) => (
              <div key={`pct-${gas}`} style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}`, borderRadius: 6, padding: "7px 8px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{gas}</div>
                <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>{toNum(latest?.percentages?.[gas]).toFixed(1)}%</div>
                <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{toNum(latest?.gases?.[gas]).toFixed(1)} ppm</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", background: "var(--bg-card)", border: `1px solid ${"var(--border)"}`, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 10 }}>
              Overlay uses weighted gas-ray calculation inside each Duval zone:
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
              {"CO -> CO2 -> C2H4 -> H2 -> CH4 -> C2H2 -> C2H6"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: 11 }}>
        <span style={{ color: "var(--text-dim)" }}>
          Start: <span style={{ color: "var(--text)" }}>{first?.date || "-"}</span> ({first?.fault || "N"})
        </span>
        <span style={{ color: "var(--text-dim)" }}>
          End: <span style={{ color: "var(--text)" }}>{latest?.date || "-"}</span> ({latest?.fault || "N"})
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: `1px solid ${"var(--border)"}`,
            borderRadius: 5,
            padding: "3px 8px",
            cursor: "pointer",
            color: showHistory ? HISTORY_COLOR : "var(--text-muted)",
            fontSize: 11,
            fontWeight: 600,
            opacity: showHistory ? 1 : 0.6,
          }}
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
        </button>
        <span style={{ color: "var(--danger)" }}>* Latest point</span>
        <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>Hover points for details</span>
      </div>
    </>
  );
}
