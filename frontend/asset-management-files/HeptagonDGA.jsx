import { useState, useCallback, useMemo, useRef, useEffect } from "react";
export { computeWeightedPercentages, checkExceedsNormal, determineFault, HEPTAGON_GASES_ORDER, FAULT_COLORS, FAULT_DESCRIPTIONS, NORMAL_LIMITS, WEIGHTING_FACTORS, ALL_GASES };

// ─── Constants ───────────────────────────────────────────────────────────────
const WEIGHTING_FACTORS = {
  H2: 3.5,
  CH4: 2.9167,
  C2H6: 5.3846,
  C2H4: 7.0,
  C2H2: 116.6667,
  CO: 1.0,
  CO2: 0.14,
};

const NORMAL_LIMITS = {
  H2: 100,
  CH4: 120,
  C2H4: 50,
  C2H6: 65,
  C2H2: 3,
  CO: 350,
  CO2: 2500,
};

const ALL_GASES = [
  { key: "H2", label: "H₂", fullName: "Hydrogen", used: true },
  { key: "CH4", label: "CH₄", fullName: "Methane", used: true },
  { key: "C2H2", label: "C₂H₂", fullName: "Acetylene", used: true },
  { key: "C2H4", label: "C₂H₄", fullName: "Ethylene", used: true },
  { key: "C2H6", label: "C₂H₆", fullName: "Ethane", used: true },
  { key: "CO", label: "CO", fullName: "Carbon Monoxide", used: true },
  { key: "CO2", label: "CO₂", fullName: "Carbon Dioxide", used: true },
  { key: "C3H8", label: "C₃H₈", fullName: "Propane", used: false },
  { key: "C3H6", label: "C₃H₆", fullName: "Propylene", used: false },
  { key: "O2", label: "O₂", fullName: "Oxygen", used: false },
  { key: "N2", label: "N₂", fullName: "Nitrogen", used: false },
];

const HEPTAGON_GASES_ORDER = ["CO", "CO2", "C2H4", "H2", "CH4", "C2H2", "C2H6"];

const FAULT_COLORS = {
  Normal: "#22c55e",
  HCCD: "#dc2626",
  MCCD: "#f97316",
  LCCD: "#eab308",
  T1: "#06b6d4",
  T2: "#3b82f6",
  T3: "#6366f1",
  PD: "#a855f7",
  D1: "#ec4899",
  D2: "#f43f5e",
  TD: "#8b5cf6",
};

const FAULT_DESCRIPTIONS = {
  Normal: "Normal operation — no significant fault detected. Gas levels are within acceptable limits.",
  HCCD: "High Concentration Cellulose Degradation — severe thermal degradation of paper/cellulose insulation. CO is the dominant gas (>60%), with CO₂ <25%.",
  MCCD: "Medium Concentration Cellulose Degradation — moderate thermal degradation of cellulose insulation. CO between 45-60%, CO₂ between 25-50%.",
  LCCD: "Low Concentration Cellulose Degradation — mild thermal aging of cellulose insulation. CO between 18-45%, CO₂ >50%.",
  T1: "Thermal Fault T1 (<300°C) — low temperature overheating. Produces mainly CH₄ and C₂H₆ with minor ethylene.",
  T2: "Thermal Fault T2 (300-700°C) — medium temperature overheating. Significant C₂H₄ production with CH₄.",
  T3: "Thermal Fault T3 (>700°C) — high temperature overheating causing severe oil decomposition. Dominated by C₂H₄ with high H₂.",
  PD: "Partial Discharge — low energy electrical discharge in gas cavities. Produces mainly H₂ with small amounts of CH₄ and trace C₂H₂.",
  D1: "Low Energy Discharge (D1) — spark discharge. H₂ >60% with C₂H₂ <50% of total gases.",
  D2: "High Energy Discharge (D2) — arc discharge causing severe damage. C₂H₂ >50% with high H₂.",
  TD: "Thermal & Electrical Fault — mixed fault involving both thermal and electrical discharge mechanisms.",
};

const HEPTAGON_REF_IMAGE = "/image/Heptagon.png";

// ─── Computation ─────────────────────────────────────────────────────────────
function computeWeightedPercentages(gases) {
  const weighted = {};
  let total = 0;
  for (const gas of HEPTAGON_GASES_ORDER) {
    const val = (parseFloat(gases[gas]) || 0) * WEIGHTING_FACTORS[gas];
    weighted[gas] = val;
    total += val;
  }
  if (total === 0) return null;
  const pct = {};
  for (const gas of HEPTAGON_GASES_ORDER) {
    pct[gas] = (weighted[gas] / total) * 100;
  }
  return pct;
}

function checkExceedsNormal(gases) {
  const exceeded = [];
  for (const [gas, limit] of Object.entries(NORMAL_LIMITS)) {
    const val = parseFloat(gases[gas]) || 0;
    if (val > limit) exceeded.push({ gas, value: val, limit });
  }
  return exceeded;
}

function determineFault(pct) {
  if (!pct) return "Normal";

  const co = pct.CO;
  const co2 = pct.CO2;
  const c2h4 = pct.C2H4;
  const h2 = pct.H2;
  const ch4 = pct.CH4;
  const c2h2 = pct.C2H2;
  const c2h6 = pct.C2H6;

  // Cellulose Degradation Zones
  if (co > 60 && co2 <= 25) return "HCCD";
  if (co >= 45 && co <= 60 && co2 > 25 && co2 <= 50) return "MCCD";
  if (co >= 18 && co < 45 && co2 > 50) return "LCCD";

  // Electrical Fault Zones
  if (c2h2 > 50 && h2 > 60 && c2h6 <= 75 && co < 50) return "D2";
  if (h2 > 60 && c2h2 <= 50 && c2h2 > 5) return "D1";
  if (c2h6 >= 90 && c2h2 < 50 && h2 > 60) return "D1";

  // Partial Discharge
  if (h2 > 60 && ch4 <= 40 && c2h2 <= 40 && c2h4 <= 40) return "PD";

  // Thermal Fault Zones
  if (c2h4 > 75 && h2 <= 54 && ch4 < 40) return "T3";
  if (c2h4 <= 75 && c2h4 > 50 && h2 <= 54 && ch4 >= 25) return "T3";
  if (c2h4 > 50 && c2h4 <= 75 && h2 <= 30 && ch4 >= 25 && ch4 <= 66) return "T2";
  if (c2h4 <= 50 && h2 > 30 && h2 <= 54 && ch4 < 25) return "T2";
  if (c2h4 <= 50 && h2 <= 30 && ch4 <= 66) return "T1";

  // Thermal + Discharge
  if (c2h4 > 40 && c2h2 > 10 && h2 > 30) return "TD";

  // Fallback thermal checks
  if (c2h4 > 50) return "T2";
  if (ch4 > 40 && c2h4 > 20) return "T1";

  // High CO with some hydrogen — cellulose
  if (co > 30 && co2 > 30) return "LCCD";
  if (co > 40) return "MCCD";

  return "Normal";
}

// ─── Heptagon SVG Drawing ────────────────────────────────────────────────────
function getHeptagonPoints(cx, cy, r, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = -(Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

function HeptagonChart({ percentages, fault, darkMode = false }) {
  const cx = 250, cy = 250, R = 200;
  const outerPts = getHeptagonPoints(cx, cy, R);
  const outerPath = outerPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";

  // Grid rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const ringPaths = rings.map((s) => {
    const pts = getHeptagonPoints(cx, cy, R * s);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
  });

  // Colors based on dark mode
  const gridStroke = darkMode ? "#404040" : "#e2e8f0";
  const axisStroke = darkMode ? "#555" : "#cbd5e1";
  const borderStroke = darkMode ? "#666" : "#94a3b8";
  const tickColor = darkMode ? "#888" : "#94a3b8";
  const labelColor = darkMode ? "#e2e8f0" : "#334155";

  // Data polygon
  let dataPath = "";
  let dataPoints = [];
  if (percentages) {
    dataPoints = HEPTAGON_GASES_ORDER.map((gas, i) => {
      const frac = Math.min(percentages[gas] / 100, 1);
      const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
      return [cx + R * frac * Math.cos(angle), cy + R * frac * Math.sin(angle)];
    });
    dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
  }

  // Labels
  const labelOffset = 30;
  const labelPts = getHeptagonPoints(cx, cy, R + labelOffset);
  const gasLabels = ["CO", "CO₂", "C₂H₄", "H₂", "CH₄", "C₂H₂", "C₂H₆"];

  const faultColor = FAULT_COLORS[fault] || "#6b7280";

  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-lg mx-auto">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={faultColor} stopOpacity="0.05" />
          <stop offset="100%" stopColor={faultColor} stopOpacity="0.01" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={R + 20} fill="url(#bgGrad)" />

      {/* Grid rings */}
      {ringPaths.map((path, i) => (
        <path key={i} d={path} fill="none" stroke={gridStroke} strokeWidth={i === rings.length - 1 ? 1.5 : 0.5} strokeDasharray={i < rings.length - 1 ? "3,3" : "none"} />
      ))}

      {/* Axis lines */}
      {outerPts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke={axisStroke} strokeWidth="0.5" />
      ))}

      {/* Outer border */}
      <path d={outerPath} fill="none" stroke={borderStroke} strokeWidth="1.5" />

      {/* Percentage ticks */}
      {rings.map((s, i) => (
        <text key={i} x={cx + 8} y={cy - R * s + 4} fontSize="8" fill={tickColor} fontFamily="monospace">
          {Math.round(s * 100)}%
        </text>
      ))}

      {/* Data polygon */}
      {percentages && (
        <>
          <path d={dataPath} fill={faultColor} fillOpacity="0.15" stroke={faultColor} strokeWidth="2.5" filter="url(#glow)" />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="5" fill={faultColor} stroke="white" strokeWidth="2" />
          ))}
        </>
      )}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="3" fill={tickColor} />

      {/* Gas Labels */}
      {labelPts.map((p, i) => (
        <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill={labelColor} fontFamily="'JetBrains Mono', monospace">
          {gasLabels[i]}
        </text>
      ))}

      {/* Percentage values on axes */}
      {percentages &&
        HEPTAGON_GASES_ORDER.map((gas, i) => {
          const frac = Math.min(percentages[gas] / 100, 1);
          if (frac < 0.05) return null;
          const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
          const x = cx + R * frac * Math.cos(angle);
          const y = cy + R * frac * Math.sin(angle);
          return (
            <text key={gas} x={x} y={y - 12} textAnchor="middle" fontSize="9" fill={faultColor} fontWeight="700" fontFamily="monospace">
              {percentages[gas].toFixed(1)}%
            </text>
          );
        })}
    </svg>
  );
}

// ─── Heptagon Chart Card with Tabs ───────────────────────────────────────────
function HeptagonChartCard({ percentages, fault, refImageUrl, darkMode = false }) {
  const [activeTab, setActiveTab] = useState("analysis");
  const [imgError, setImgError] = useState(false);

  const dm = darkMode ? {
    bg: '#1e1e1e', border: '#333333', headerBg: '#1a1a1a',
    text: '#f5f5f5', textSec: '#a3a3a3', textMuted: '#737373',
    tabActive: '#3b82f6', tabInactive: '#a3a3a3',
  } : {
    bg: '#ffffff', border: '#e2e8f0', headerBg: '#f8fafc',
    text: '#1e293b', textSec: '#64748b', textMuted: '#94a3b8',
    tabActive: '#3b82f6', tabInactive: '#64748b',
  };

  const tabs = [
    { key: "analysis", label: "Analysis Chart", icon: "📊" },
    { key: "reference", label: "Reference (Gouda)", icon: "🗺️" },
  ];

  return (
    <div style={{ border: `1px solid ${dm.border}`, borderRadius: 12, overflow: "hidden", background: dm.bg }}>
      <div style={{ background: dm.headerBg, padding: "8px 16px 0", borderBottom: `1px solid ${dm.border}` }}>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? dm.tabActive : dm.tabInactive,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2.5px solid #3b82f6" : "2.5px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                marginBottom: -1,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {activeTab === "analysis" && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <HeptagonChart percentages={percentages} fault={fault} darkMode={darkMode} />
          </div>
        )}

        {activeTab === "reference" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            {!imgError ? (
              <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
                <img
                  src={refImageUrl}
                  alt="Heptagon Reference Graph — Gouda et al. (2018) Fig. 7"
                  onError={() => setImgError(true)}
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }}
                />
              </div>
            ) : (
              <div style={{
                width: "100%", padding: "40px 20px", background: "#f8fafc",
                borderRadius: 8, border: "1px dashed #cbd5e1", textAlign: "center",
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🖼️</div>
                <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>
                  Reference image could not be loaded
                </p>
                <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
                  The image may be blocked by CORS or network restrictions. To use a local image, replace the URL in <code style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>HEPTAGON_REF_IMAGE</code> with your local file path (e.g. <code style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>/images/heptagon-ref.jpg</code>).
                </p>
              </div>
            )}
            <p style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", lineHeight: 1.4, fontStyle: "italic" }}>
              Source: Gouda, El-Hoshy & El-Tamaly (2018), IET GTD, Vol. 12, Iss. 2, Fig. 7
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function HeptagonDGA({ initialGases, initialTransformer, darkMode = false }) {
  const [gases, setGases] = useState({
    H2: "", CH4: "", C2H2: "", C2H4: "", C2H6: "", CO: "", CO2: "",
    C3H8: "", C3H6: "", O2: "", N2: "",
    ...(initialGases || {}),
  });
  const [transformer, setTransformer] = useState({
    name: "", serialNo: "", rating: "", voltage: "", manufacturer: "", yearMfg: "", location: "", sampleDate: "",
    ...(initialTransformer || {}),
  });
  const [result, setResult] = useState(null);

  // Auto-analyze when initial gases are provided
  useEffect(() => {
    if (initialGases) {
      const hasAnyGas = HEPTAGON_GASES_ORDER.some((g) => parseFloat(initialGases[g]) > 0);
      if (hasAnyGas) {
        const exceeded = checkExceedsNormal(initialGases);
        const pct = computeWeightedPercentages(initialGases);
        let fault;
        if (exceeded.length === 0) {
          fault = "Normal";
        } else {
          fault = determineFault(pct);
        }
        setResult({ pct, fault, exceeded });
      }
    }
  }, []);

  // Dark mode color palette
  const dm = darkMode ? {
    bg: '#0a0a0a', bgCard: '#1e1e1e', bgSection: '#1a1a1a', bgInput: '#2a2a2a',
    border: '#333333', borderLight: '#404040',
    text: '#f5f5f5', textSec: '#a3a3a3', textMuted: '#737373',
    headerBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    sectionHeader: '#1a1a1a', sectionBorder: '#333333',
    inputBorder: '#404040', inputBg: '#2a2a2a', inputText: '#f5f5f5',
    tableBg: '#1e1e1e', tableAlt: '#252525', tableHead: '#1a1a1a',
    labelText: '#94a3b8', chipBg: '#2a2020', chipBorder: '#5c2020',
  } : {
    bg: '#ffffff', bgCard: '#ffffff', bgSection: '#f8fafc', bgInput: '#fff',
    border: '#e2e8f0', borderLight: '#e2e8f0',
    text: '#1e293b', textSec: '#64748b', textMuted: '#94a3b8',
    headerBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    sectionHeader: '#f8fafc', sectionBorder: '#e2e8f0',
    inputBorder: '#e2e8f0', inputBg: '#fff', inputText: '#1e293b',
    tableBg: '#fff', tableAlt: '#fafbfc', tableHead: '#f1f5f9',
    labelText: '#64748b', chipBg: '#fef2f2', chipBorder: '#fecaca',
  };

  const handleGasChange = (key, value) => {
    setGases((prev) => ({ ...prev, [key]: value }));
  };

  const handleTransformerChange = (key, value) => {
    setTransformer((prev) => ({ ...prev, [key]: value }));
  };

  const analyze = useCallback(() => {
    const exceeded = checkExceedsNormal(gases);
    const pct = computeWeightedPercentages(gases);
    const hasAnyGas = HEPTAGON_GASES_ORDER.some((g) => parseFloat(gases[g]) > 0);

    if (!hasAnyGas) {
      setResult({ error: "Please enter at least one gas concentration value." });
      return;
    }

    let fault;
    if (exceeded.length === 0) {
      fault = "Normal";
    } else {
      fault = determineFault(pct);
    }

    setResult({ pct, fault, exceeded });
  }, [gases]);

  const clearAll = () => {
    setGases({ H2: "", CH4: "", C2H2: "", C2H4: "", C2H6: "", CO: "", CO2: "", C3H8: "", C3H6: "", O2: "", N2: "" });
    setTransformer({ name: "", serialNo: "", rating: "", voltage: "", manufacturer: "", yearMfg: "", location: "", sampleDate: "" });
    setResult(null);
  };

  const loadSample = () => {
    setGases({ H2: "755", CH4: "229", C2H2: "460", C2H4: "404", C2H6: "32", CO: "845", CO2: "5580", C3H8: "", C3H6: "", O2: "", N2: "" });
    setTransformer({
      name: "Sample Transformer #11", serialNo: "TX-2024-011", rating: "75 MVA", voltage: "220/66/11 kV",
      manufacturer: "ABB", yearMfg: "2005", location: "El-Fayoum Substation", sampleDate: "2024-01-15",
    });
    setResult(null);
  };

  const faultColor = result?.fault ? (FAULT_COLORS[result.fault] || "#6b7280") : "#6b7280";

  return (
    <div style={{ fontFamily: "'Outfit', 'Segoe UI', sans-serif", background: dm.bg, minHeight: "100vh", color: dm.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-border { 0%, 100% { border-color: ${faultColor}33; } 50% { border-color: ${faultColor}88; } }
        .result-card { animation: fadeIn 0.5s ease-out, pulse-border 2s ease-in-out 1; }
      `}</style>

      {/* Header */}
      <div style={{ background: dm.headerBg, padding: "32px 24px", borderBottom: "3px solid #3b82f6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #3b82f6, #6366f1)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 100 100">
                {getHeptagonPoints(50, 50, 40).map((p, i, arr) => (
                  <line key={i} x1={p[0]} y1={p[1]} x2={arr[(i + 1) % 7][0]} y2={arr[(i + 1) % 7][1]} stroke="white" strokeWidth="3" strokeLinecap="round" />
                ))}
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px", lineHeight: 1.2 }}>Heptagon DGA Analysis</h1>
              <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>Dissolved Gas Analysis — Gouda et al. (2018) Method</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", maxWidth: 700, lineHeight: 1.5 }}>
            Seven-gas graphical fault diagnosis for oil-immersed transformers based on H₂, CH₄, C₂H₂, C₂H₄, C₂H₆, CO, and CO₂ weighted percentages.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* LEFT COLUMN — Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Transformer Details */}
            <div style={{ border: `1px solid ${dm.border}`, borderRadius: 12, overflow: "hidden", background: dm.bgCard }}>
              <div style={{ background: dm.sectionHeader, padding: "12px 16px", borderBottom: `1px solid ${dm.sectionBorder}` }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: dm.text, letterSpacing: "0.5px", textTransform: "uppercase" }}>⚡ Transformer Details</h2>
              </div>
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "name", label: "Transformer Name", ph: "e.g. TX-001" },
                  { key: "serialNo", label: "Serial Number", ph: "e.g. SN-2024-001" },
                  { key: "rating", label: "Rating (MVA)", ph: "e.g. 75 MVA" },
                  { key: "voltage", label: "Voltage (kV)", ph: "e.g. 220/66/11" },
                  { key: "manufacturer", label: "Manufacturer", ph: "e.g. ABB / Siemens" },
                  { key: "yearMfg", label: "Year of Manufacture", ph: "e.g. 2005" },
                  { key: "location", label: "Site Name", ph: "e.g. Substation A" },
                  { key: "sampleDate", label: "Sample Date", ph: "YYYY-MM-DD", type: "date" },
                ].map(({ key, label, ph, type }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: dm.labelText, display: "block", marginBottom: 4 }}>{label}</label>
                    <input
                      type={type || "text"}
                      placeholder={ph}
                      value={transformer[key]}
                      onChange={(e) => handleTransformerChange(key, e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${dm.inputBorder}`, borderRadius: 8, fontSize: 13, color: dm.inputText, background: dm.inputBg, outline: "none", transition: "border 0.2s" }}
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e) => (e.target.style.borderColor = dm.inputBorder)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Gas Concentrations */}
            <div style={{ border: `1px solid ${dm.border}`, borderRadius: 12, overflow: "hidden", background: dm.bgCard }}>
              <div style={{ background: dm.sectionHeader, padding: "12px 16px", borderBottom: `1px solid ${dm.sectionBorder}` }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: dm.text, letterSpacing: "0.5px", textTransform: "uppercase" }}>🧪 Gas Concentrations (ppm)</h2>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {ALL_GASES.map(({ key, label, fullName, used }) => {
                    const val = parseFloat(gases[key]) || 0;
                    const limit = NORMAL_LIMITS[key];
                    const exceeded = used && limit && val > limit;
                    return (
                      <div
                        key={key}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${exceeded ? "#fca5a5" : used ? dm.border : (darkMode ? '#1a1a1a' : '#f1f5f9')}`,
                          background: exceeded ? (darkMode ? '#2a1515' : '#fef2f2') : used ? dm.bgCard : dm.bgSection,
                          transition: "all 0.2s",
                          opacity: used ? 1 : 0.6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: used ? dm.text : dm.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
                          {!used && <span style={{ fontSize: 9, color: dm.textMuted, background: darkMode ? '#2a2a2a' : '#f1f5f9', padding: "1px 6px", borderRadius: 4 }}>Not in analysis</span>}
                          {used && limit && <span style={{ fontSize: 9, color: exceeded ? "#dc2626" : dm.textMuted }}>Limit: {limit}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: dm.textMuted, marginBottom: 4 }}>{fullName}</div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={gases[key]}
                          onChange={(e) => handleGasChange(key, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            border: `1px solid ${exceeded ? "#fca5a5" : dm.inputBorder}`,
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600,
                            color: exceeded ? "#dc2626" : dm.inputText,
                            background: dm.inputBg,
                            outline: "none",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                          onBlur={(e) => (e.target.style.borderColor = exceeded ? "#fca5a5" : dm.inputBorder)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    onClick={analyze}
                    style={{
                      flex: 1, padding: "12px", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      color: "#fff", background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                      cursor: "pointer", letterSpacing: "0.5px", transition: "transform 0.15s, box-shadow 0.15s",
                      boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                    }}
                    onMouseDown={(e) => (e.target.style.transform = "scale(0.98)")}
                    onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
                  >
                    ▶ ANALYZE
                  </button>
                  <button
                    onClick={loadSample}
                    style={{
                      padding: "12px 20px", border: `1px solid ${dm.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600,
                      color: dm.textSec, background: dm.bgCard, cursor: "pointer",
                    }}
                  >
                    📋 Sample
                  </button>
                  <button
                    onClick={clearAll}
                    style={{
                      padding: "12px 20px", border: `1px solid ${dm.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600,
                      color: dm.textSec, background: dm.bgCard, cursor: "pointer",
                    }}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Heptagon Chart — Tabbed */}
            <HeptagonChartCard percentages={result?.pct || null} fault={result?.fault || "Normal"} refImageUrl={HEPTAGON_REF_IMAGE} darkMode={darkMode} />

            {/* Fault Diagnosis Result */}
            {result && !result.error && (
              <div className="result-card" style={{ border: `2px solid ${faultColor}44`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: `${faultColor}11`, padding: "12px 16px", borderBottom: `1px solid ${faultColor}22` }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: dm.text, letterSpacing: "0.5px", textTransform: "uppercase" }}>🔍 Diagnosis Result</h2>
                </div>
                <div style={{ padding: 20 }}>
                  {/* Fault Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${faultColor}, ${faultColor}cc)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 6px 20px ${faultColor}40`,
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{result.fault}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: dm.text }}>
                        {result.fault === "Normal" ? "Normal Operation" : `Fault: ${result.fault}`}
                      </div>
                      <div style={{ fontSize: 12, color: dm.textSec }}>
                        {result.fault.startsWith("T") && result.fault !== "TD" ? "Thermal Fault" :
                         result.fault.startsWith("D") ? "Electrical Discharge" :
                         result.fault === "PD" ? "Partial Discharge" :
                         result.fault.includes("CCD") ? "Cellulose Degradation" :
                         result.fault === "TD" ? "Thermal + Discharge" : "No Fault"}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 13, color: dm.textSec, lineHeight: 1.6, marginBottom: 16, padding: "12px 14px", background: dm.bgSection, borderRadius: 8, borderLeft: `3px solid ${faultColor}` }}>
                    {FAULT_DESCRIPTIONS[result.fault]}
                  </p>

                  {/* Exceeded Gases */}
                  {result.exceeded.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>⚠ Gases Exceeding Normal Limits</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {result.exceeded.map(({ gas, value, limit }) => (
                          <div key={gas} style={{ padding: "6px 12px", background: dm.chipBg, border: `1px solid ${dm.chipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ fontWeight: 700, color: "#dc2626" }}>{gas}</span>
                            <span style={{ color: dm.textSec }}> = {value} ppm</span>
                            <span style={{ color: dm.textMuted }}> (limit: {limit})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weighted Percentages Table */}
                  {result.pct && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: dm.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Weighted Percentages</div>
                      <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${dm.border}` }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: dm.tableHead }}>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dm.textSec }}>Gas</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: dm.textSec }}>ppm</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: dm.textSec }}>Weight</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: dm.textSec }}>Rel. %</th>
                              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dm.textSec }}>Bar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {HEPTAGON_GASES_ORDER.map((gas, i) => {
                              const pctVal = result.pct[gas];
                              const gasInfo = ALL_GASES.find((g) => g.key === gas);
                              return (
                                <tr key={gas} style={{ borderTop: `1px solid ${dm.border}`, background: i % 2 === 0 ? dm.tableBg : dm.tableAlt }}>
                                  <td style={{ padding: "7px 12px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: dm.text }}>{gasInfo.label}</td>
                                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: dm.textSec }}>{parseFloat(gases[gas]) || 0}</td>
                                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: dm.textMuted, fontSize: 11 }}>×{WEIGHTING_FACTORS[gas]}</td>
                                  <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: faultColor }}>{pctVal.toFixed(2)}%</td>
                                  <td style={{ padding: "7px 12px", width: 100 }}>
                                    <div style={{ height: 8, borderRadius: 4, background: darkMode ? '#333' : '#f1f5f9', overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${Math.min(pctVal, 100)}%`, background: `linear-gradient(90deg, ${faultColor}88, ${faultColor})`, borderRadius: 4, transition: "width 0.6s ease-out" }} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result?.error && (
              <div className="fade-in" style={{ padding: 20, background: darkMode ? '#2a1515' : '#fef2f2', border: `1px solid ${darkMode ? '#5c2020' : '#fecaca'}`, borderRadius: 12, color: "#dc2626", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
                {result.error}
              </div>
            )}

            {/* Legend */}
            <div style={{ border: `1px solid ${dm.border}`, borderRadius: 12, overflow: "hidden", background: dm.bgCard }}>
              <div style={{ background: dm.sectionHeader, padding: "12px 16px", borderBottom: `1px solid ${dm.sectionBorder}` }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: dm.text, letterSpacing: "0.5px", textTransform: "uppercase" }}>📖 Fault Zone Legend</h2>
              </div>
              <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(FAULT_COLORS).map(([key, color]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: result?.fault === key ? `${color}11` : "transparent", border: result?.fault === key ? `1px solid ${color}33` : "1px solid transparent" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: color, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: dm.text, fontFamily: "'JetBrains Mono', monospace" }}>{key}</span>
                      <span style={{ fontSize: 10, color: dm.textMuted, marginLeft: 6 }}>
                        {key === "Normal" ? "Normal" : key === "HCCD" ? "High Cell. Deg." : key === "MCCD" ? "Med. Cell. Deg." : key === "LCCD" ? "Low Cell. Deg." :
                         key === "T1" ? "<300°C" : key === "T2" ? "300-700°C" : key === "T3" ? ">700°C" :
                         key === "PD" ? "Partial Disch." : key === "D1" ? "Low Energy" : key === "D2" ? "High Energy" : "Thermal+Elec."}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div style={{ padding: "12px 16px", background: dm.bgSection, borderRadius: 10, border: `1px solid ${dm.border}` }}>
              <p style={{ fontSize: 10, color: dm.textMuted, lineHeight: 1.5 }}>
                <strong>Reference:</strong> Gouda, O.E., El-Hoshy, S.H., El-Tamaly, H.H. (2018). "Proposed heptagon graph for DGA interpretation of oil transformers."
                <em> IET Generation, Transmission & Distribution</em>, 12(2), 490–498.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
