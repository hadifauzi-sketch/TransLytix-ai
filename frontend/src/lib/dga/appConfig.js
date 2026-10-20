export const REQUIRED_GAS_FIELDS = [
  { key: "h2", label: "H2" },
  { key: "ch4", label: "CH4" },
  { key: "c2h6", label: "C2H6" },
  { key: "c2h4", label: "C2H4" },
  { key: "c2h2", label: "C2H2" },
];

export const OPTIONAL_FIELDS = [
  { key: "co", label: "CO" },
  { key: "co2", label: "CO2" },
  { key: "o2", label: "O2" },
  { key: "n2", label: "N2" },
  { key: "transformerAge", label: "Age" },
];

export const OIL_OPTIONS = [
  { value: "mineral", label: "Mineral oil" },
  { value: "soybean", label: "Natural ester (soybean)" },
  { value: "rapeseed", label: "Natural ester (rapeseed)" },
  { value: "sunflower", label: "Natural ester (sunflower)" },
  { value: "synthetic", label: "Synthetic ester" },
];

export const STANDARD_OPTIONS = [
  { value: "IEC", label: "IEC 60599:2022" },
  { value: "IEEE_2019", label: "IEEE C57.104-2019" },
  { value: "IEEE_2008", label: "IEEE C57.104-2008" },
];

export const ESTER_STANDARD_OPTION = { value: "IEEE_2019", label: "IEEE C57.155" };

export function getStandardOptionsForOilType(oilType) {
  return oilType === "mineral" ? STANDARD_OPTIONS : [ESTER_STANDARD_OPTION];
}

export function getStandardLabelForOilType(standard, oilType) {
  if (oilType !== "mineral") {
    return ESTER_STANDARD_OPTION.label;
  }

  return STANDARD_OPTIONS.find((option) => option.value === standard)?.label ?? standard;
}

export const TONE_STYLES = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

export const GAS_COLORS = {
  h2: "#0ea5e9",
  ch4: "#8b5cf6",
  c2h6: "#f59e0b",
  c2h4: "#ef4444",
  c2h2: "#10b981",
};

export const ZONE_COLORS = {
  PD: "#ff6a2a",
  D1: "#0f172a",
  D2: "#0f172a",
  DT: "#0f172a",
  T1: "#0f172a",
  T2: "#0f172a",
  T3: "#0f172a",
  "T2-H": "#9ca3af",
  "T3-H": "#9ca3af",
  C: "#0f172a",
  O: "#0f172a",
  S: "#0f172a",
  ND: "#0f172a",
};
