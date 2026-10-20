export const OIL_TEST_EXTRA_DEFAULTS = {
  testType: "Routine",
  flashPoint: "",
  flashPointOpenCup: "",
  firePointOpenCup: "",
  inhibitor: "",
  passivator: "",
  copperCorrosive: "",
  density: "",
  dbds: "",
  viscosity40: "",
  methanol: "",
  pcb: "",
  resistivity: "",
  specificGravity: "",
  fol2: "",
  hmf5: "",
  fal2: "",
  acf2: "",
  mef5: "",
  copperCu: "",
  ironFe: "",
  aluminumAl: "",
  dpFromFuran: "",
  dpFromMethanol: "",
};

export const OIL_TEST_NUMERIC_KEYS = [
  "flashPoint",
  "flashPointOpenCup",
  "firePointOpenCup",
  "inhibitor",
  "passivator",
  "density",
  "dbds",
  "viscosity40",
  "methanol",
  "pcb",
  "resistivity",
  "specificGravity",
  "fol2",
  "hmf5",
  "fal2",
  "acf2",
  "mef5",
  "copperCu",
  "ironFe",
  "aluminumAl",
  "dpFromFuran",
  "dpFromMethanol",
];

export const OIL_TEST_TEXT_KEYS = ["testType", "copperCorrosive"];

export const OIL_TEST_DISPLAY_DIGITS = {
  acidity: 4,
  powerFactor: 4,
  inhibitor: 4,
  density: 4,
  viscosity40: 4,
  methanol: 4,
  resistivity: 4,
  specificGravity: 4,
};

export const getOilTestDisplayDigits = (key, fallbackDigits) => (
  Object.prototype.hasOwnProperty.call(OIL_TEST_DISPLAY_DIGITS, key)
    ? OIL_TEST_DISPLAY_DIGITS[key]
    : fallbackDigits
);

export const getOilTestInputStep = (key, fallbackDigits = 2) => {
  const digits = getOilTestDisplayDigits(key, fallbackDigits);
  return digits > 0 ? (1 / (10 ** digits)).toFixed(digits) : "1";
};

export const OIL_TEST_FORM_SECTIONS = [
  {
    title: "Physical & Chemical Tests",
    fields: [
      { key: "bdv", label: "Breakdown Voltage (kV)", type: "number" },
      { key: "acidity", label: "Acidity (mgKOH/g)", type: "number" },
      { key: "moisture", label: "Water Content (ppm)", type: "number" },
      { key: "ift", label: "IFT (mN/m)", type: "number" },
      { key: "color", label: "Color (ASTM)", type: "text" },
      { key: "flashPoint", label: "Flash Point (C)", type: "number" },
      { key: "flashPointOpenCup", label: "Flash Point Open Cup (C)", type: "number" },
      { key: "firePointOpenCup", label: "Fire Point Open Cup (C)", type: "number" },
      { key: "inhibitor", label: "Inhibitor (%)", type: "number" },
      { key: "passivator", label: "Passivator (ppm)", type: "number" },
      { key: "copperCorrosive", label: "Copper Corrosive IEC", type: "text" },
      { key: "density", label: "Density (kg/m3)", type: "number" },
      { key: "dbds", label: "DBDS (mg/kg)", type: "number" },
      { key: "viscosity40", label: "Viscosity @40C (cSt)", type: "number" },
      { key: "methanol", label: "Methanol (ppm)", type: "number" },
      { key: "pcb", label: "PCB (ppm)", type: "number" },
      { key: "powerFactor", label: "Power Factor", type: "number" },
      { key: "resistivity", label: "Resistivity (GOhm-m)", type: "number" },
      { key: "specificGravity", label: "Specific Gravity", type: "number" },
    ],
  },
  {
    title: "Furanic Compounds",
    fields: [
      { key: "fol2", label: "2-FOL (ppb)", type: "number" },
      { key: "hmf5", label: "5-HMF (ppb)", type: "number" },
      { key: "fal2", label: "2-FAL (ppb)", type: "number" },
      { key: "acf2", label: "2-ACF (ppb)", type: "number" },
      { key: "mef5", label: "5-MEF (ppb)", type: "number" },
    ],
  },
  {
    title: "Metals-In-Oil",
    fields: [
      { key: "copperCu", label: "Copper - Cu (ppm)", type: "number" },
      { key: "ironFe", label: "Iron - Fe (ppm)", type: "number" },
      { key: "aluminumAl", label: "Aluminum - Al (ppm)", type: "number" },
    ],
  },
];

export const OIL_TEST_PREDICTION_FIELDS = [
  { key: "flashPoint", label: "Flash Point", color: "#f59e0b", unit: "C" },
  { key: "flashPointOpenCup", label: "Flash Point Open Cup", color: "#fb923c", unit: "C" },
  { key: "firePointOpenCup", label: "Fire Point Open Cup", color: "#ef4444", unit: "C" },
  { key: "inhibitor", label: "Inhibitor", color: "#10b981", unit: "%" },
  { key: "passivator", label: "Passivator", color: "#3b82f6", unit: "ppm" },
  { key: "density", label: "Density", color: "#06b6d4", unit: "kg/m3" },
  { key: "dbds", label: "DBDS", color: "#f97316", unit: "mg/kg" },
  { key: "viscosity40", label: "Viscosity @40C", color: "#3b82f6", unit: "cSt" },
  { key: "methanol", label: "Methanol", color: "#ec4899", unit: "ppm" },
  { key: "pcb", label: "PCB", color: "#f43f5e", unit: "ppm" },
  { key: "resistivity", label: "Resistivity", color: "#84cc16", unit: "GOhm-m" },
  { key: "specificGravity", label: "Specific Gravity", color: "#14b8a6", unit: "ratio" },
  { key: "fol2", label: "2-FOL", color: "#a855f7", unit: "ppb" },
  { key: "hmf5", label: "5-HMF", color: "#8b5cf6", unit: "ppb" },
  { key: "fal2", label: "2-FAL", color: "#7c3aed", unit: "ppb" },
  { key: "acf2", label: "2-ACF", color: "#6366f1", unit: "ppb" },
  { key: "mef5", label: "5-MEF", color: "#4f46e5", unit: "ppb" },
  { key: "copperCu", label: "Copper (Cu)", color: "#ea580c", unit: "ppm" },
  { key: "ironFe", label: "Iron (Fe)", color: "#475569", unit: "ppm" },
  { key: "aluminumAl", label: "Aluminum (Al)", color: "#0ea5e9", unit: "ppm" },
  { key: "dpFromFuran", label: "DP from Furan", color: "#22c55e", unit: "DP" },
  { key: "dpFromMethanol", label: "DP from Methanol", color: "#16a34a", unit: "DP" },
];

const clampDp = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(100, Math.min(2000, Math.round(value)));
};

// Chendong-style correlation using 2-FAL concentration.
// Input is ppb (as stored); formula requires ppm, so divide by 1000.
export const estimateDpFromFuran = (fal2Value) => {
  const fal2 = Number(fal2Value);
  if (!Number.isFinite(fal2) || fal2 <= 0) return 0;
  const dp = (1.51 - Math.log10(fal2 / 1000)) / 0.0035;
  return clampDp(dp);
};

// Jalbert-style methanol correlation (log relationship).
export const estimateDpFromMethanol = (methanolValue) => {
  const methanol = Number(methanolValue);
  if (!Number.isFinite(methanol) || methanol <= 0) return 0;
  const dp = 1248 - (117 * Math.log(methanol));
  return clampDp(dp);
};

// Empirical formula derived from industry reference data:
// DP_new ≈ 629 (initial measured DP), DP_eol ≈ 166 (end-of-life threshold).
export const estimateLifetimeUsedPct = (dp) => {
  const v = Number(dp);
  if (!Number.isFinite(v) || v <= 0) return null;
  const pct = (629 - v) / (629 - 166) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};
