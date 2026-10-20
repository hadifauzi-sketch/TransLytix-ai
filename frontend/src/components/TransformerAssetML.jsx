import { useState, useEffect, useRef, useId, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { useDropzone } from "react-dropzone";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell,
  PieChart, Pie, Area, AreaChart, ComposedChart,
} from "recharts";
import {
  LayoutDashboard,
  Zap,
  FlaskConical,
  Microscope,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Bot,
  Sparkles,
  Siren,
  TriangleAlert,
  CheckCircle2,
  Lightbulb,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Circle,
  Info,
  Droplets,
  BarChart3,
  Linkedin,
  Users,
  UserCheck,
  Download,
  Printer,
  Upload,
} from "lucide-react";
import api from "../services/api";
import { Button } from "./ui/button";
import { Badge as UIBadge } from "./ui/badge";
import { Card } from "./ui/card";
import { Input as UITextInput } from "./ui/input";
import { Label as FieldLabel } from "./ui/label";
import { SearchableSelect as UISearchableSelect } from "./ui/searchable-select";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseIcon,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { generateDiagnosticsPdfReport } from "../services/diagnosticsPdfReport";
import { extractAssetImportFromFile, IMPORTABLE_FILE_TYPES } from "../lib/assetFileImport";
import { OIL_OPTIONS, getStandardOptionsForOilType } from "../lib/dga/appConfig";
import { FAULT_METADATA as DGA_FAULT_METADATA, analyzeSample } from "../lib/dga/diagnostics";
import {
  applyColorMode,
  COLOR_MODE_STORAGE_KEY,
  COLOR_MODES,
  getInitialColorMode,
} from "../lib/theme";
import DiagnosticsDuvalPanel from "./DiagnosticsDuvalPanel";
import DGAWorkbenchPanel from "./DGAWorkbenchPanel";
import DataTrendingV2 from "./DataTrendingV2";
import DataChartTrending from "./DataChartTrending";
import AIAssessment from "./AIAssessment";
import Cluster3DGraph from "./Cluster3DGraph";
import { computeHeptagonPercentages, determineHeptagonFault } from "./DuvalHeptagonPanel";
import {
  OIL_TEST_EXTRA_DEFAULTS,
  OIL_TEST_NUMERIC_KEYS,
  OIL_TEST_TEXT_KEYS,
  OIL_TEST_FORM_SECTIONS,
  OIL_TEST_PREDICTION_FIELDS,
  estimateDpFromFuran,
  estimateDpFromMethanol,
  estimateLifetimeUsedPct,
  getOilTestDisplayDigits,
  getOilTestInputStep,
} from "./OilTestSections";

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================
const GASES = [
  { key: "H2", label: "H2", color: "#3b82f6", unit: "ppm" },
  { key: "CH4", label: "CH4", color: "#22c55e", unit: "ppm" },
  { key: "C2H2", label: "C2H2", color: "#ef4444", unit: "ppm" },
  { key: "C2H4", label: "C2H4", color: "#f97316", unit: "ppm" },
  { key: "C2H6", label: "C2H6", color: "#a855f7", unit: "ppm" },
  { key: "CO", label: "CO", color: "#06b6d4", unit: "ppm" },
  { key: "CO2", label: "CO2", color: "#64748b", unit: "ppm" },
];

const EXTRA_PREDICTION_TESTS = [
  { key: "O2", label: "O2", color: "#06b6d4", unit: "ppm" },
  { key: "N2", label: "N2", color: "#14b8a6", unit: "ppm" },
  { key: "moisture", label: "Moisture", color: "#0ea5e9", unit: "ppm" },
  { key: "bdv", label: "BDV", color: "#f59e0b", unit: "kV" },
  { key: "acidity", label: "Acidity", color: "#ef4444", unit: "mgKOH/g" },
  { key: "ift", label: "IFT", color: "#a855f7", unit: "mN/m" },
  { key: "powerFactor", label: "PF / Tan Delta", color: "#f97316", unit: "%" },
];

const TEST_TYPE_OPTIONS = ["Routine", "Pre-Commissioning", "Post-Fault", "After Filter", "Topup Oil", "Replace New Oil"];
const TEST_TYPE_BADGE = {
  "Routine":           { bg: "#1e293b", color: "#94a3b8", border: "#334155" },
  "Pre-Commissioning": { bg: "#1e3a5f", color: "#60a5fa", border: "#2563eb" },
  "Post-Fault":        { bg: "#431407", color: "#fb923c", border: "#ea580c" },
  "After Filter":      { bg: "#14532d", color: "#4ade80", border: "#16a34a" },
  "Topup Oil":         { bg: "#164e63", color: "#22d3ee", border: "#0891b2" },
  "Replace New Oil":   { bg: "#3b0764", color: "#c084fc", border: "#9333ea" },
};
const getTestTypeBadge = (t) => TEST_TYPE_BADGE[t] || { bg: "#1e293b", color: "#94a3b8", border: "#334155" };
const COPPER_CORROSIVE_OPTIONS = ["No", "1a", "1b", "2a", "2b", "3", "4"];

const PREDICTION_TESTS = [...GASES, ...EXTRA_PREDICTION_TESTS, ...OIL_TEST_PREDICTION_FIELDS];
const DEFAULT_PREDICTION_TEST_KEYS = GASES.map(g => g.key);
const PREDICTION_TEST_META = PREDICTION_TESTS.reduce((acc, test) => {
  acc[test.key] = test;
  return acc;
}, {});

const ASSET_OIL_RESULT_COLUMNS = [
  { key: "moisture", label: "Moisture (ppm)", digits: 1, color: "#0ea5e9" },
  { key: "bdv", label: "BDV (kV)", digits: 1, color: "#f59e0b" },
  { key: "acidity", label: "Acidity (mgKOH/g)", digits: getOilTestDisplayDigits("acidity", 3), color: "#ef4444" },
  { key: "ift", label: "IFT (mN/m)", digits: 1, color: "#a855f7" },
  { key: "powerFactor", label: "PF / Tan Delta (%)", digits: getOilTestDisplayDigits("powerFactor", 2), color: "#f97316" },
  { key: "passivator", label: "Passivator (ppm)", digits: 1, color: "#3b82f6" },
  { key: "fal2", label: "2-FAL (ppb)", digits: 1, color: "#7c3aed" },
  { key: "dpFromFuran", label: "DP from Furan", digits: 0, color: "#22c55e" },
  { key: "dpFromMethanol", label: "DP from Methanol", digits: 0, color: "#16a34a" },
];
const OIL_ANOMALY_COLUMNS = ASSET_OIL_RESULT_COLUMNS;
const ANOMALY_MODE_OPTIONS = [
  {
    key: "dga",
    label: "DGA Results",
    shortLabel: "DGA",
    description: "Flags abnormal dissolved gas readings using Isolation Forest algorithm.",
    minRecordsMessage: "Need at least 5 DGA records for anomaly detection.",
    chartTitle: "DGA Anomaly Scores Over Time",
    tableTitle: "DGA Record Details",
  },
  {
    key: "oil",
    label: "Oil Test Results",
    shortLabel: "Oil Test",
    description: "Flags abnormal oil test readings using Isolation Forest algorithm.",
    minRecordsMessage: "Need at least 5 oil test records with oil data for anomaly detection.",
    chartTitle: "Oil Test Anomaly Scores Over Time",
    tableTitle: "Oil Test Record Details",
  },
];

const VOLTAGE_CLASSES = ["11kV", "33kV", "66kV", "132kV", "275kV", "500kV"];
const BRANDS = ["ABB", "Siemens", "GE", "Toshiba", "Hitachi", "Hyundai", "CG Global", "TBEA", "Crompton Greaves", "Mitsubishi", "Other"];
const OIL_TYPES = [
  "Mineral - Naphthenic",
  "Mineral - Paraffinic",
  "Mineral - Iso-Paraffinic",
  "Silicone",
  "Natural Ester",
  "Synthetic Ester",
];
const DEFAULT_PAPER_TYPE = "Not specified";
const PAPER_TYPES = [
  "TUP (Thermal Upgraded Paper)",
  "Kraft Paper",
  "DDP (Diamond Dot Paper)",
  DEFAULT_PAPER_TYPE,
];

const IMPORTED_RESULT_KEYS = [...new Set([
  ...GASES.map((gas) => gas.key),
  "O2",
  "N2",
  "moisture",
  "bdv",
  "acidity",
  "ift",
  "color",
  "powerFactor",
  ...OIL_TEST_TEXT_KEYS,
  ...OIL_TEST_NUMERIC_KEYS,
  "notes",
])];

const normalizeImportLookupValue = (value) => `${value ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
const hasImportedValue = (value) => {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return `${value}`.trim() !== "";
};
const countImportedResultFields = (row = {}) => IMPORTED_RESULT_KEYS.filter((key) => key !== "date" && hasImportedValue(row[key])).length;
const hasImportedResultData = (row = {}) => countImportedResultFields(row) > 0;
const buildImportedTransformerId = (patch = {}, fileName = "") => {
  const baseSource = [
    patch.id,
    patch.serialNumber,
    patch.mnemonic,
    patch.name,
    fileName ? fileName.replace(/\.[^.]+$/, "") : "",
    `import-${Date.now()}`,
  ].find((value) => normalizeImportLookupValue(value));

  const normalized = normalizeImportLookupValue(baseSource)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return (normalized || `import-${Date.now()}`).toUpperCase();
};
const mergeImportedResultRows = (rows = []) => {
  const today = new Date().toISOString().split("T")[0];
  const groupedRows = new Map();

  rows.forEach((row, index) => {
    if (!hasImportedResultData(row)) {
      return;
    }

    const rowKey = row.date || `__row_${index}`;
    const existing = groupedRows.get(rowKey) || {};
    groupedRows.set(rowKey, {
      ...existing,
      ...row,
      date: row.date || existing.date || today,
    });
  });

  return Array.from(groupedRows.values());
};

const DEFAULT_OIL_BRAND_LIBRARY = [
  { name: "Shell Diala S4 ZX-I", oilType: "Mineral - Naphthenic", notes: "Common mineral naphthenic insulating oil." },
  { name: "Shell Diala S3 ZX-I", oilType: "Mineral - Naphthenic", notes: "Mineral naphthenic insulating oil for transformer fleets." },
  { name: "Nynas Nytro Libra", oilType: "Mineral - Naphthenic", notes: "Mineral naphthenic transformer oil." },
  { name: "Nynas Nytro 10XN", oilType: "Mineral - Iso-Paraffinic", notes: "Iso-paraffinic transformer oil grade." },
  { name: "Hyrax Hypertrans", oilType: "Mineral - Paraffinic", notes: "Paraffinic transformer insulating oil." },
  { name: "Cargill FR3", oilType: "Natural Ester", notes: "Natural ester dielectric fluid." },
  { name: "MIDEL 7131", oilType: "Synthetic Ester", notes: "Synthetic ester dielectric fluid." },
];

const IEEE_LIMITS = {
  H2:   { good: 100, fair: 200, poor: 500, veryPoor: 700 },
  CH4:  { good: 75,  fair: 125, poor: 200, veryPoor: 400 },
  C2H2: { good: 2,   fair: 7,   poor: 35,  veryPoor: 50 },
  C2H4: { good: 50,  fair: 100, poor: 200, veryPoor: 300 },
  C2H6: { good: 20,  fair: 50,  poor: 90,  veryPoor: 150 },
  CO:   { good: 500, fair: 700, poor: 900, veryPoor: 1100 },
  CO2:  { good: 5000,fair: 7000,poor: 9000,veryPoor: 11000 },
};

const FAULT_COLORS = {
  PD: "#3b82f6", D1: "#f97316", D2: "#ef4444",
  T1: "#22c55e", T2: "#84cc16", T3: "#eab308",
  DT: "#a855f7", N: "#64748b",
  "T2-H": "#eab308", "T2-C": "#eab308", "T3-H": "#f97316",
  S: "#06b6d4", O: "#84cc16", C: "#22c55e", ND: "#64748b",
  TD: "#a855f7", HCCD: "#ef4444", MCCD: "#f97316", LCCD: "#eab308", Normal: "#64748b",
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "assets", label: "Transformers", icon: Zap },
  { id: "results", label: "DGA Results", icon: FlaskConical },
  { id: "oil_results", label: "Oil Results", icon: Droplets },
  { id: "diagnostics", label: "Diagnostics", icon: Microscope },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "clustering", label: "ML Clustering", icon: Bot },
  { id: "predictions", label: "ML Predictions", icon: Sparkles },
  { id: "anomaly", label: "Anomaly", icon: Siren },
  { id: "ai_assessment", label: "AI Assessment", icon: Lightbulb },
];

// ============================================================
// SAMPLE DATA
// ============================================================
const SAMPLE_TRANSFORMERS = [
  { id: "T001", name: "Main Power TX-1", mnemonic: "MPT1", serialNumber: "ABB-2014-001", brand: "ABB", maker: "ABB Power Grids", voltage: "132kV", loadMVA: 90, site: "Substation Alpha", dateEnergized: "2015-03-15", dateManufactured: "2014-08-20", oilBrand: "Nynas Nytro Libra", oilType: "Mineral - Naphthenic", paperType: "TUP (Thermal Upgraded Paper)" },
  { id: "T002", name: "Distribution TX-2", mnemonic: "DTX2", serialNumber: "SIE-2017-042", brand: "Siemens", maker: "Siemens Energy", voltage: "33kV", loadMVA: 30, site: "Substation Beta", dateEnergized: "2018-07-01", dateManufactured: "2017-12-10", oilBrand: "Shell Diala S4 ZX-I", oilType: "Mineral - Naphthenic", paperType: "Kraft Paper" },
  { id: "T003", name: "Generator Step-Up TX-3", mnemonic: "GSU3", serialNumber: "GE-2009-118", brand: "GE", maker: "GE Vernova", voltage: "275kV", loadMVA: 200, site: "Power Plant Gamma", dateEnergized: "2010-01-20", dateManufactured: "2009-05-15", oilBrand: "Hyrax Hypertrans", oilType: "Mineral - Paraffinic", paperType: "DDP (Diamond Dot Paper)" },
  { id: "T004", name: "Auxiliary TX-4", mnemonic: "AUX4", serialNumber: "TOS-2020-007", brand: "Toshiba", maker: "Toshiba Energy Systems", voltage: "11kV", loadMVA: 10, site: "Substation Alpha", dateEnergized: "2020-09-10", dateManufactured: "2020-03-01", oilBrand: "MIDEL 7131", oilType: "Synthetic Ester", paperType: "TUP (Thermal Upgraded Paper)" },
  { id: "T005", name: "Interconnect TX-5", mnemonic: "ICT5", serialNumber: "ABB-2007-203", brand: "ABB", maker: "ABB Power Grids", voltage: "500kV", loadMVA: 500, site: "Substation Delta", dateEnergized: "2008-06-12", dateManufactured: "2007-11-20", oilBrand: "Cargill FR3", oilType: "Natural Ester", paperType: DEFAULT_PAPER_TYPE },
];

const generateSampleResults = () => {
  const results = [];
  const now = new Date();
  SAMPLE_TRANSFORMERS.forEach(tx => {
    const numResults = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numResults; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - (numResults - i) * 6);
      const aging = (numResults - i) * 0.1;
      const hasFault = tx.id === "T003" && i >= numResults - 2;
      results.push({
        id: `R-${tx.id}-${i}`,
        transformerId: tx.id,
        date: date.toISOString().split("T")[0],
        H2: Math.round((15 + Math.random() * 30 + aging * 50) * (hasFault ? 5 : 1)),
        CH4: Math.round((8 + Math.random() * 20 + aging * 25) * (hasFault ? 4 : 1)),
        C2H2: Math.round((0.5 + Math.random() * 2 + aging * 3) * (hasFault ? 10 : 1) * 10) / 10,
        C2H4: Math.round((10 + Math.random() * 25 + aging * 30) * (hasFault ? 6 : 1)),
        C2H6: Math.round((5 + Math.random() * 10 + aging * 10) * (hasFault ? 3 : 1)),
        CO: Math.round((100 + Math.random() * 200 + aging * 150) * (hasFault ? 2 : 1)),
        CO2: Math.round((1500 + Math.random() * 2000 + aging * 800) * (hasFault ? 1.5 : 1)),
        O2: Math.round(15000 + Math.random() * 10000),
        N2: Math.round(50000 + Math.random() * 20000),
        moisture: Math.round((5 + Math.random() * 20 + aging * 5) * 10) / 10,
        bdv: Math.round((40 + Math.random() * 30 - aging * 5) * 10) / 10,
        acidity: Math.round((0.01 + Math.random() * 0.05 + aging * 0.02) * 10000) / 10000,
        ift: Math.round((25 + Math.random() * 10 - aging * 3) * 10) / 10,
        color: ["0.5", "1.0", "1.5", "2.0", "2.5"][Math.floor(Math.random() * 5)],
        powerFactor: Math.round((0.1 + Math.random() * 0.5 + aging * 0.2) * 10000) / 10000,
        notes: hasFault ? "Elevated gases detected - monitor closely" : "",
      });
    }
  });
  return results.sort((a, b) => a.date.localeCompare(b.date));
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const getAge = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return ((Date.now() - d.getTime()) / (365.25 * 24 * 3600000)).toFixed(1);
};

const normalizeCatalogValue = (value) => `${value ?? ""}`.replace(/\s+/g, " " ).trim();
const isSameCatalogValue = (left, right) => normalizeCatalogValue(left).toLowerCase() === normalizeCatalogValue(right).toLowerCase();
const BRAND_MATCH_ALIASES = {
  ABB: ["abb", "abb power grids"],
  Siemens: ["siemens", "siemens energy"],
  GE: ["general electric", "ge vernova"],
  Toshiba: ["toshiba", "toshiba energy systems"],
  Hitachi: ["hitachi", "hitachi energy"],
  Hyundai: ["hyundai", "hyundai electric"],
  "CG Global": ["cg global", "cg power"],
  TBEA: ["tbea"],
  "Crompton Greaves": ["crompton greaves"],
  Mitsubishi: ["mitsubishi", "mitsubishi electric"],
};

const findKnownBrand = (value) => {
  const normalizedValue = normalizeCatalogValue(value).toLowerCase();
  if (!normalizedValue) {
    return "";
  }

  return BRANDS.find((brand) => {
    if (brand === "Other") {
      return false;
    }

    if (normalizedValue === brand.toLowerCase()) {
      return true;
    }

    const aliases = BRAND_MATCH_ALIASES[brand] || [];
    return aliases.some((alias) => normalizedValue.includes(alias.toLowerCase()));
  }) || "";
};

const resolveImportedBrandAndMaker = (brandValue, makerValue) => {
  const normalizedBrand = normalizeCatalogValue(brandValue);
  const normalizedMaker = normalizeCatalogValue(makerValue);

  if (isSameCatalogValue(normalizedBrand, "Other")) {
    return {
      brand: "Other",
      maker: normalizedMaker,
    };
  }

  const matchedBrand = findKnownBrand(normalizedBrand) || findKnownBrand(normalizedMaker);

  if (matchedBrand) {
    const maker = normalizedMaker || (normalizedBrand && !isSameCatalogValue(normalizedBrand, matchedBrand) ? normalizedBrand : "");
    return {
      brand: matchedBrand,
      maker,
    };
  }

  if (normalizedBrand || normalizedMaker) {
    return {
      brand: "Other",
      maker: normalizedMaker || normalizedBrand,
    };
  }

  return {
    brand: "",
    maker: "",
  };
};

const resolveImportedDateEnergized = (dateEnergized, dateManufactured) => (
  dateEnergized || dateManufactured || ""
);

const emptyOilBrand = { id: "", name: "", oilType: "", notes: "" };

const createDefaultOilBrandCatalog = () => DEFAULT_OIL_BRAND_LIBRARY.map((item, index) => ({
  id: `default-oil-brand-${index + 1}`,
  name: item.name,
  oilType: item.oilType || "",
  notes: item.notes || "",
  transformerCount: 0,
}));

const mergeOilBrandCatalog = (catalog = [], transformerList = []) => {
  const lookup = new Map();
  const counts = {};
  transformerList.forEach((transformer) => {
    const key = normalizeCatalogValue(transformer.oilBrand).toLowerCase();
    if (key) counts[key] = (counts[key] || 0) + 1;
  });

  const pushItem = (item = {}) => {
    const normalizedName = normalizeCatalogValue(item.name);
    if (!normalizedName) return;
    const key = normalizedName.toLowerCase();
    const existing = lookup.get(key);
    const nextItem = {
      id: item.id || existing?.id || `oil-brand-${key.replace(/[^a-z0-9]+/g, '-')}`,
      name: normalizedName,
      oilType: normalizeCatalogValue(item.oilType || existing?.oilType || ""),
      notes: `${item.notes || existing?.notes || ""}`.trim(),
      transformerCount: Number(item.transformerCount ?? existing?.transformerCount ?? 0),
    };
    lookup.set(key, existing ? { ...existing, ...nextItem } : nextItem);
  };

  createDefaultOilBrandCatalog().forEach(pushItem);
  catalog.forEach(pushItem);
  transformerList.forEach((transformer) => {
    const normalizedName = normalizeCatalogValue(transformer.oilBrand);
    if (!normalizedName) return;
    const key = normalizedName.toLowerCase();
    if (!lookup.has(key)) {
      pushItem({ name: normalizedName, oilType: transformer.oilType || "" });
    }
  });

  return [...lookup.values()]
    .map((item) => ({
      ...item,
      transformerCount: counts[normalizeCatalogValue(item.name).toLowerCase()] || 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const getCondition = (gas, value) => {
  const lim = IEEE_LIMITS[gas];
  if (!lim) return "unknown";
  if (value <= lim.good) return "good";
  if (value <= lim.fair) return "fair";
  if (value <= lim.poor) return "poor";
  return "veryPoor";
};

const getOverallCondition = (result) => {
  const conditions = GASES.map(g => getCondition(g.key, result[g.key]));
  if (conditions.includes("veryPoor")) return "veryPoor";
  if (conditions.includes("poor")) return "poor";
  if (conditions.includes("fair")) return "fair";
  return "good";
};

const CONDITION_STYLES = {
  good: { bg: "#052e16", border: "#16a34a", text: "#4ade80", label: "Good", description: "All gas levels within normal IEEE C57.104 limits." },
  fair: { bg: "#1a2332", border: "#2563eb", text: "#60a5fa", label: "Fair", description: "Minor gas elevation. Maintain routine sampling schedule." },
  poor: { bg: "#2d1b06", border: "#d97706", text: "#fbbf24", label: "Poor", description: "Significant gas elevation. Investigate and increase sampling frequency." },
  veryPoor: { bg: "#2d0606", border: "#dc2626", text: "#f87171", label: "Very Poor", description: "Critical gas levels. Urgent attention and follow-up testing required." },
  unknown: { bg: "#1e1e2e", border: "#475569", text: "#94a3b8", label: "Unknown", description: "Insufficient data to determine condition." },
};

const getDuvalFault = (ch4, c2h4, c2h2) => {
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
};

const getDuvalFaultT4 = (h2, ch4, c2h6) => {
  const total = h2 + ch4 + c2h6;
  if (total === 0) return "N";
  const pH2 = (h2 / total) * 100;
  const pCH4 = (ch4 / total) * 100;
  const pC2H6 = (c2h6 / total) * 100;
  if (pH2 >= 90) return "PD";
  if (pCH4 >= 64) return "C";
  if (pC2H6 >= 52) return "O";
  return "S";
};

const getDuvalFaultT5 = (ch4, c2h4, c2h6) => {
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
};

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

const roundDuvalValue = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 0.5) / factor;
};

const getPointDistance = (start, end) => Math.sqrt(((end.x - start.x) ** 2) + ((end.y - start.y) ** 2));

const getPointCross = (point, start, end) => (
  (point.x - end.x) * (start.y - end.y) - (point.y - end.y) * (start.x - end.x)
);

const isPointOnPolygonSegment = (point, start, end, epsilon = 0) => (
  Math.abs(getPointCross(point, start, end)) <= epsilon
  && getPointDistance(start, point) <= getPointDistance(start, end)
  && getPointDistance(end, point) <= getPointDistance(start, end)
);

const isPointOnDuvalPentagonPolygon = (point, polygon, epsilon = 0) => (
  polygon.some((start, index) => isPointOnPolygonSegment(point, start, polygon[(index + 1) % polygon.length], epsilon))
);

const getDuvalPentagonGeometry = (h2, ch4, c2h6, c2h4, c2h2) => {
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
};

const classifyDuvalPentagonMineral = (centroid) => {
  for (const zone of DUVAL_PENTAGON_MINERAL_ZONES) {
    if (
      isPointInPolygon(centroid, zone.polygon)
      || isPointOnDuvalPentagonPolygon(centroid, zone.polygon, DUVAL_PENTAGON_POINT_ON_POLYGON_EPSILON)
    ) {
      return zone.fault;
    }
  }
  return null;
};

const getDuvalFaultP1 = (h2, ch4, c2h6, c2h4, c2h2) => {
  const geometry = getDuvalPentagonGeometry(h2, ch4, c2h6, c2h4, c2h2);
  if (!geometry) return "N";
  return classifyDuvalPentagonMineral(geometry.centroid) || "ND";
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

const getRogersRatio = (result) => {
  const r1 = result.CH4 / result.H2;
  const r2 = result.C2H2 / result.C2H4;
  const r5 = result.C2H4 / result.C2H6;
  const code1 = r1 < 0.1 ? 5 : r1 <= 1 ? 0 : r1 <= 3 ? 1 : 2;
  const code2 = r2 < 0.1 ? 0 : r2 <= 1 ? 1 : 2;
  const code5 = r5 < 1 ? 0 : r5 <= 3 ? 1 : 2;
  if (code1 === 0 && code2 === 0 && code5 === 0) return "Normal Ageing";
  if (code1 === 5 && code2 === 0 && code5 === 0) return "Partial Discharge";
  if ((code1 === 1 || code1 === 2) && code2 === 0 && code5 === 0) return "Slight Overheating <150 C";
  if ((code1 === 1 || code1 === 2) && code2 === 0 && code5 === 1) return "Overheating 150-200 C";
  if (code1 === 0 && code2 === 0 && code5 === 1) return "Overheating 200-300 C";
  if (code1 === 0 && code2 === 1 && code5 === 0) return "Discharge Low Energy";
  if (code1 === 0 && code2 === 2 && code5 === 0) return "Discharge High Energy";
  if (code1 === 0 && code2 === 1 && code5 === 2) return "Thermal Fault >700 C";
  return "Undetermined";
};

const getKeyGas = (result) => {
  const gases = { H2: result.H2, CH4: result.CH4, C2H2: result.C2H2, C2H4: result.C2H4, C2H6: result.C2H6, CO: result.CO };
  const max = Object.entries(gases).reduce((a, b) => a[1] > b[1] ? a : b);
  const keyGasFaults = {
    H2: "Corona/Partial Discharge", CH4: "Low Temp Thermal (<300 C)",
    C2H2: "Arcing", C2H4: "High Temp Thermal (>700 C)",
    C2H6: "Low Temp Thermal (150-300 C)", CO: "Cellulose Degradation"
  };
  return { gas: max[0], fault: keyGasFaults[max[0]] || "Unknown" };
};

const getTDCG = (result) => result.H2 + result.CH4 + result.C2H2 + result.C2H4 + result.C2H6 + result.CO;

const formatTestValue = (value, digits = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
};

const formatOilTestValue = (key, value, fallbackDigits = 2) => (
  formatTestValue(value, getOilTestDisplayDigits(key, fallbackDigits))
);

const DGA_WORKBENCH_TRIANGLE_ZONE_KEYS = {
  mineral: "triangle1",
  soybean: "triangle3_soybean",
  rapeseed: "triangle3_rapeseed",
  sunflower: "triangle3_sunflower",
  synthetic: "triangle3_synthetic",
};

const DGA_WORKBENCH_PENTAGON_ZONE_KEYS = {
  mineral: "pentagon",
  soybean: "pentagon3_soybean",
  rapeseed: "pentagon3_rapeseed",
  sunflower: "pentagon3_sunflower",
  synthetic: "pentagon3_synthetic",
};

const DGA_WORKBENCH_OIL_LABELS = {
  mineral: "Mineral oil",
  soybean: "Soybean",
  rapeseed: "Rapeseed",
  sunflower: "Sunflower",
  synthetic: "Synthetic ester",
};

const toDgaWorkbenchSampleValue = (value) => (
  value === null || value === undefined ? "" : String(value)
);

const resolveDgaWorkbenchOilType = (transformer = {}) => {
  const value = transformer?.oilType;
  if (OIL_OPTIONS.some((option) => option.value === value)) return value;

  const text = `${transformer?.oilType || ""} ${transformer?.oilBrand || ""}`.toLowerCase();
  if (text.includes("synthetic") || text.includes("midel")) return "synthetic";
  if (text.includes("rapeseed") || text.includes("canola")) return "rapeseed";
  if (text.includes("sunflower")) return "sunflower";
  if (text.includes("soybean") || text.includes("soya") || text.includes("fr3") || text.includes("natural ester")) return "soybean";
  return "mineral";
};

const resolveDgaWorkbenchGasLimitStandard = (transformer = {}, oilType = "mineral") => {
  const options = getStandardOptionsForOilType(oilType);
  const value = transformer?.gasLimitStandard;
  if (options.some((option) => option.value === value)) return value;
  return options[0]?.value || "IEEE_2019";
};

const getDgaWorkbenchSampleYear = (testDate) => {
  const year = Number(String(testDate || "").slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

const getDgaWorkbenchBuiltYear = (transformer = {}) => {
  const source = transformer?.dateManufactured || transformer?.yearBuilt || transformer?.dateEnergized || "";
  const match = String(source).match(/\d{4}/);
  return match ? Number(match[0]) : null;
};

const getDgaWorkbenchTransformerAge = (transformer = {}, testDate = "") => {
  const builtYear = getDgaWorkbenchBuiltYear(transformer);
  const sampleYear = getDgaWorkbenchSampleYear(testDate);
  if (!builtYear || !sampleYear) return "";
  return String(Math.max(0, sampleYear - builtYear));
};

const mapResultToDgaWorkbenchSample = (result = {}, transformer = {}) => {
  const sampleDate = result.date || result.testDate || result.samplingDate || "";
  return {
    id: result.id,
    date: String(sampleDate || "").slice(0, 10),
    h2: toDgaWorkbenchSampleValue(result.H2 ?? result.h2),
    ch4: toDgaWorkbenchSampleValue(result.CH4 ?? result.ch4),
    c2h6: toDgaWorkbenchSampleValue(result.C2H6 ?? result.c2h6),
    c2h4: toDgaWorkbenchSampleValue(result.C2H4 ?? result.c2h4),
    c2h2: toDgaWorkbenchSampleValue(result.C2H2 ?? result.c2h2),
    co: toDgaWorkbenchSampleValue(result.CO ?? result.co),
    co2: toDgaWorkbenchSampleValue(result.CO2 ?? result.co2),
    o2: toDgaWorkbenchSampleValue(result.O2 ?? result.o2),
    n2: toDgaWorkbenchSampleValue(result.N2 ?? result.n2),
    transformerAge: toDgaWorkbenchSampleValue(result.transformerAge ?? getDgaWorkbenchTransformerAge(transformer, sampleDate)),
  };
};

const getDgaWorkbenchAnalysisForResult = (result, transformer) => {
  const oilType = resolveDgaWorkbenchOilType(transformer);
  const gasLimitStandard = resolveDgaWorkbenchGasLimitStandard(transformer, oilType);
  return analyzeSample(mapResultToDgaWorkbenchSample(result, transformer), gasLimitStandard, oilType);
};

const getDgaWorkbenchFaultForMode = (result, transformer, modeKey = "t1") => {
  const oilType = resolveDgaWorkbenchOilType(transformer);
  const analysis = getDgaWorkbenchAnalysisForResult(result, transformer);
  const faultZones = analysis?.faultZones || {};

  if (modeKey === "h1") {
    return analysis?.heptagon?.zone || faultZones.heptagon || "ND";
  }

  const faultZoneKey = {
    t1: DGA_WORKBENCH_TRIANGLE_ZONE_KEYS[oilType] || "triangle1",
    t4: "triangle4",
    t5: "triangle5",
    p1: DGA_WORKBENCH_PENTAGON_ZONE_KEYS[oilType] || "pentagon",
  }[modeKey] || "triangle1";

  return faultZones[faultZoneKey] || "ND";
};

const getDgaFaultLabel = (fault) => {
  const code = fault || "ND";
  return DGA_FAULT_METADATA[code]?.label || FAULT_LABELS[code] || "Unknown fault";
};

const getDgaFaultColor = (fault) => FAULT_COLORS[fault || "ND"] || "#0f6cbd";

const getDgaTriangleSummaryTitle = (oilType) => (
  oilType === "mineral"
    ? "Duval Triangle 1"
    : `Duval Triangle 3 (${DGA_WORKBENCH_OIL_LABELS[oilType] || oilType})`
);

const getDgaPentagonSummaryTitle = (oilType) => (
  oilType === "mineral"
    ? "Duval Pentagon"
    : `Duval Pentagon 3 (${DGA_WORKBENCH_OIL_LABELS[oilType] || oilType})`
);

const getTransformerIdDateCode = (referenceDate = new Date()) => {
  const day = String(referenceDate.getDate()).padStart(2, "0");
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const year = String(referenceDate.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
};

const generateNextTransformerId = (existingTransformers = [], referenceDate = new Date()) => {
  const dateCode = getTransformerIdDateCode(referenceDate);
  const prefix = `TX-${dateCode}-`;
  let nextSequence = 1;

  existingTransformers.forEach((transformer) => {
    const match = `${transformer?.id || ""}`.trim().match(/^TX-(\d{6})-(\d{2,})$/i);
    if (match && match[1] === dateCode) {
      nextSequence = Math.max(nextSequence, Number(match[2]) + 1);
    }
  });

  return `${prefix}${String(nextSequence).padStart(2, "0")}`;
};

const escapeHtml = (value) => String(value ?? "-")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getOilColumnValue = (row, columnKey) => {
  if (columnKey === "dpFromFuran") return Number(row.dpFromFuran) || estimateDpFromFuran(row.fal2);
  if (columnKey === "dpFromMethanol") return Number(row.dpFromMethanol) || estimateDpFromMethanol(row.methanol);
  return row[columnKey];
};

const getAnomalyColumns = (mode = "dga") => (mode === "oil" ? OIL_ANOMALY_COLUMNS : GASES);

const getAnomalyMeasurementValue = (row, mode = "dga", key) => {
  if (!row) return 0;
  if (mode === "oil") {
    return Number(getOilColumnValue(row, key)) || 0;
  }
  return Number(row[key]) || 0;
};

const hasAnomalyMeasurementData = (row, mode = "dga") => (
  getAnomalyColumns(mode).some((column) => Math.abs(getAnomalyMeasurementValue(row, mode, column.key)) > 0)
);

const getTxMnemonicOrId = (tx) => {
  const mnemonic = (tx?.mnemonic || "").trim();
  const txNo = (tx?.id || "").trim();
  if (mnemonic && txNo && mnemonic !== txNo) return `${mnemonic} / ${txNo}`;
  return mnemonic || txNo || (tx?.name || "").trim() || "Unknown TX";
};

const formatTxPickerLabel = (tx) => {
  const site = (tx?.site || "").trim() || "Unknown Site";
  return `${site} - ${getTxMnemonicOrId(tx)}`;
};

const DUVAL_IMAGE_CONFIG = {
  t1: {
    key: "t1",
    label: "Triangle 1",
    src: "https://upload.wikimedia.org/wikipedia/commons/3/3b/Duval_Triangle_1.png",
    viewBox: "0 0 1005 1024",
    modeName: "Duval Triangle 1",
  },
  t4: {
    key: "t4",
    label: "Triangle 4",
    src: "https://upload.wikimedia.org/wikipedia/commons/9/97/Duval_Triangle_4.png",
    viewBox: "0 0 1005 1024",
    modeName: "Duval Triangle 4",
  },
  t5: {
    key: "t5",
    label: "Triangle 5",
    src: "https://upload.wikimedia.org/wikipedia/commons/7/71/Duval_Triangle_5.png",
    viewBox: "0 0 1005 1024",
    modeName: "Duval Triangle 5",
  },
  p1: {
    key: "p1",
    label: "Pentagon",
    src: "https://upload.wikimedia.org/wikipedia/commons/7/76/Duval_Pentagram_3.png",
    viewBox: "0 0 976 822",
    modeName: "Duval Pentagon",
  },
};

const DUVAL_PENTAGON_ZONE_POLYGONS = {
  S: [
    { x: 483, y: 76 },
    { x: 483, y: 430 },
    { x: 464, y: 430 },
    { x: 178, y: 417 },
    { x: 158, y: 416 },
    { x: 154, y: 405 },
    { x: 134, y: 341 },
    { x: 131, y: 331 },
    { x: 179, y: 296 },
    { x: 478, y: 79 },
  ],
  D1: [
    { x: 487, y: 420 },
    { x: 487, y: 75 },
    { x: 508, y: 90 },
    { x: 818, y: 315 },
    { x: 839, y: 331 },
    { x: 837, y: 340 },
    { x: 788, y: 491 },
    { x: 784, y: 500 },
  ],
  D2: [
    { x: 523, y: 302 },
    { x: 531, y: 305 },
    { x: 758, y: 484 },
    { x: 783, y: 504 },
    { x: 779, y: 519 },
    { x: 716, y: 716 },
    { x: 713, y: 724 },
    { x: 692, y: 701 },
    { x: 515, y: 505 },
    { x: 488, y: 475 },
    { x: 487, y: 433 },
    { x: 491, y: 418 },
  ],
  O: [
    { x: 483, y: 434 },
    { x: 483, y: 473 },
    { x: 274, y: 747 },
    { x: 266, y: 748 },
    { x: 194, y: 528 },
    { x: 160, y: 424 },
    { x: 159, y: 419 },
    { x: 423, y: 431 },
    { x: 466, y: 433 },
  ],
  C: [
    { x: 327, y: 656 },
    { x: 351, y: 598 },
    { x: 382, y: 526 },
    { x: 418, y: 495 },
    { x: 422, y: 493 },
    { x: 418, y: 500 },
    { x: 343, y: 629 },
    { x: 329, y: 653 },
  ],
  "T3-H": [
    { x: 704, y: 748 },
    { x: 510, y: 748 },
    { x: 507, y: 734 },
    { x: 466, y: 539 },
    { x: 455, y: 486 },
    { x: 457, y: 481 },
    { x: 485, y: 477 },
    { x: 545, y: 543 },
    { x: 694, y: 708 },
    { x: 712, y: 728 },
    { x: 705, y: 747 },
  ],
  PD: [
    { x: 478, y: 139 },
    { x: 483, y: 139 },
    { x: 483, y: 215 },
    { x: 478, y: 215 },
  ],
  "T2-C": [
    { x: 492, y: 746 },
    { x: 287, y: 748 },
    { x: 289, y: 742 },
    { x: 324, y: 668 },
    { x: 424, y: 496 },
    { x: 429, y: 490 },
    { x: 433, y: 506 },
    { x: 488, y: 729 },
  ],
};

const getDuvalTriangleImageXY = (pTop, pRight, pLeft) => {
  const top = Number(pTop) || 0;
  const right = Number(pRight) || 0;
  const left = Number(pLeft) || 0;
  const total = top + right + left;
  if (total <= 0) return null;

  const nTop = (top / total) * 100;
  const nRight = (right / total) * 100;
  const nLeft = (left / total) * 100;

  return {
    x: (nTop / 100) * 500 + (nRight / 100) * 972 + (nLeft / 100) * 28,
    y: (nTop / 100) * 55 + (nRight / 100) * 928 + (nLeft / 100) * 928,
  };
};

const normalizePentagonFaultKey = (fault) => {
  if (fault === "T2-H") return "T2-C";
  return fault || "N";
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

const getPolygonCentroid = (points) => {
  if (!points?.length) return null;
  if (points.length < 3) {
    const count = points.length;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / count,
      y: points.reduce((sum, point) => sum + point.y, 0) / count,
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
      x: points.reduce((sum, point) => sum + point.x, 0) / count,
      y: points.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }

  return {
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
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

const getDuvalPentagonImageXY = (pH2, pCH4, pC2H6, pC2H4, pC2H2) => {
  const h2 = Number(pH2) || 0;
  const ch4 = Number(pCH4) || 0;
  const c2h6 = Number(pC2H6) || 0;
  const c2h4 = Number(pC2H4) || 0;
  const c2h2 = Number(pC2H2) || 0;
  const total = h2 + ch4 + c2h6 + c2h4 + c2h2;
  if (total <= 0) return null;

  const pcts = [
    (h2 / total) * 100,
    (c2h2 / total) * 100,
    (c2h4 / total) * 100,
    (c2h6 / total) * 100,
    (ch4 / total) * 100,
  ];
  const cx = 488;
  const cy = 433;
  const r = 224;
  const ang = [90, 18, -54, -126, 162].map((a) => (a * Math.PI) / 180);
  let x = cx;
  let y = cy;

  pcts.forEach((p, i) => {
    x += (p / 100) * r * 0.85 * Math.cos(ang[i]);
    y -= (p / 100) * r * 0.85 * Math.sin(ang[i]);
  });

  const rawPoint = { x, y };
  const pentagonFault = normalizePentagonFaultKey(getDuvalFaultP1(h2, ch4, c2h6, c2h4, c2h2));
  const zonePolygon = DUVAL_PENTAGON_ZONE_POLYGONS[pentagonFault];
  if (!zonePolygon) return rawPoint;

  const zoneCenter = getPolygonCentroid(zonePolygon);
  if (!zoneCenter) return rawPoint;

  const adjustedPoint = {
    x: zoneCenter.x + Math.max(-42, Math.min(42, rawPoint.x - zoneCenter.x)),
    y: zoneCenter.y + Math.max(-52, Math.min(52, rawPoint.y - zoneCenter.y)),
  };

  return keepPointInsidePolygon(adjustedPoint, zoneCenter, zonePolygon);
};

const getDuvalFaultForMode = (point = {}, modeKey = "t1") => {
  if (modeKey === "t4") {
    return point.duval_t4 || getDuvalFaultT4(Number(point.pH2) || 0, Number(point.pCH4) || 0, Number(point.pC2H6) || 0);
  }
  if (modeKey === "t5") {
    return point.duval_t5 || getDuvalFaultT5(Number(point.pCH4) || 0, Number(point.pC2H4) || 0, Number(point.pC2H6) || 0);
  }
  if (modeKey === "p1") {
    const hasPentagonInputs = ["pH2", "pCH4", "pC2H6", "pC2H4", "pC2H2"].every((key) => point?.[key] != null);
    const computedFault = hasPentagonInputs
      ? getDuvalFaultP1(
        Number(point.pH2) || 0,
        Number(point.pCH4) || 0,
        Number(point.pC2H6) || 0,
        Number(point.pC2H4) || 0,
        Number(point.pC2H2) || 0,
      )
      : point.duval_p1;
    return normalizePentagonFaultKey(computedFault || point.duval_p1 || "N");
  }
  return point.duval_t1 || point.duval_fault || point.fault || getDuvalFault(Number(point.pCH4) || 0, Number(point.pC2H4) || 0, Number(point.pC2H2) || 0);
};

// ============================================================
// K-MEANS CLUSTERING (JS fallback)
// ============================================================
const euclidean = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const normalize = (data) => {
  if (data.length === 0) return { normalized: [], mins: [], maxs: [] };
  const dims = data[0].length;
  const mins = Array(dims).fill(Infinity);
  const maxs = Array(dims).fill(-Infinity);
  data.forEach(row => row.forEach((v, i) => { mins[i] = Math.min(mins[i], v); maxs[i] = Math.max(maxs[i], v); }));
  const normalized = data.map(row => row.map((v, i) => maxs[i] - mins[i] === 0 ? 0 : (v - mins[i]) / (maxs[i] - mins[i])));
  return { normalized, mins, maxs };
};
const kMeans = (data, k, maxIter = 50) => {
  if (data.length < k) return { assignments: data.map((_, i) => i % k), centroids: data.slice(0, k) };
  const { normalized } = normalize(data);
  const dims = normalized[0].length;
  let centroids = [];
  const used = new Set();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * normalized.length);
    if (!used.has(idx)) { used.add(idx); centroids.push([...normalized[idx]]); }
  }
  let assignments = new Array(normalized.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const newAssign = normalized.map(point => {
      let minDist = Infinity, closest = 0;
      centroids.forEach((c, ci) => { const d = euclidean(point, c); if (d < minDist) { minDist = d; closest = ci; } });
      return closest;
    });
    const newCentroids = centroids.map((_, ci) => {
      const members = normalized.filter((_, i) => newAssign[i] === ci);
      if (members.length === 0) return centroids[ci];
      return Array(dims).fill(0).map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length);
    });
    if (JSON.stringify(newAssign) === JSON.stringify(assignments)) break;
    assignments = newAssign;
    centroids = newCentroids;
  }
  return { assignments, centroids };
};

const linearRegress = (points) => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.[1] || 0 };
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sy = points.reduce((s, p) => s + p[1], 0);
  const sxy = points.reduce((s, p) => s + p[0] * p[1], 0);
  const sxx = points.reduce((s, p) => s + p[0] * p[0], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx) || 0;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
const Badge = ({ condition }) => {
  const s = CONDITION_STYLES[condition] || CONDITION_STYLES.unknown;
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <UIBadge
          variant="outline"
          className="cursor-help border-current/30 bg-transparent"
          style={{ background: s.bg, borderColor: s.border, color: s.text }}
        >
          {s.label}
        </UIBadge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] leading-snug">
        <div className="font-semibold" style={{ color: s.text }}>{s.label} condition</div>
        <div className="text-muted-foreground mt-1">{s.description}</div>
      </TooltipContent>
    </UITooltip>
  );
};

const Stat = ({ label, value, sub, color }) => (
  <Card variant="elevated" className="relative overflow-hidden p-4 min-w-[160px] flex-1">
    {/* Brand-tinted top accent bar */}
    <span
      className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70"
      style={{
        background: `linear-gradient(90deg, transparent, ${color || "hsl(var(--ui-brand))"}, transparent)`,
      }}
    />
    <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-1.5">
      {label}
    </div>
    <div
      className="text-[28px] font-bold font-mono leading-none"
      style={{ color: color || "hsl(var(--ui-foreground))" }}
    >
      {value}
    </div>
    {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
  </Card>
);

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  step,
  options,
  allowCustom = false,
  placeholder,
  style: sty,
  required,
  disabled = false,
}) => {
  const listId = useId();
  const normalizedOptions = (options || [])
    .map((option) => (typeof option === "string"
      ? { value: option, label: option }
      : { value: option?.value ?? "", label: option?.label ?? option?.value ?? "" }))
    .filter((option) => option.value);
  const showDatalist = allowCustom && normalizedOptions.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-1" style={sty}>
      {label && (
        <FieldLabel className="text-xs font-medium normal-case tracking-normal text-primary-dim">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </FieldLabel>
      )}
      {allowCustom ? (
        <>
          <UITextInput
            type={type}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            step={step}
            list={showDatalist ? listId : undefined}
          />
          {showDatalist && (
            <datalist id={listId}>
              {normalizedOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </datalist>
          )}
        </>
      ) : normalizedOptions.length > 0 ? (
        <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <UITextInput
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          step={step}
        />
      )}
    </div>
  );
};

const SearchableSelect = ({
  label,
  value,
  placeholder = "Search...",
  options = [],
  onChange,
  disabled = false,
  className,
  triggerClassName,
}) => (
  <UISearchableSelect
    label={label}
    value={value}
    placeholder={placeholder}
    options={options}
    onChange={onChange}
    disabled={disabled}
    className={className}
    triggerClassName={triggerClassName}
  />
);

// Legacy adapter — delegates to the shadcn-style Button primitive so every
// existing <Btn variant="..." /> callsite picks up the new glass styling
// without needing edits across the 7000-line file.
const BTN_VARIANT_MAP = {
  primary: "glass-brand",
  secondary: "glass",
  danger: "danger",
  success: "success",
  warning: "warning",
};
const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, style: sty, className: cx }) => (
  <Button
    variant={BTN_VARIANT_MAP[variant] || "glass-brand"}
    size={size}
    onClick={onClick}
    disabled={disabled}
    style={sty}
    className={cx}
  >
    {children}
  </Button>
);

const Spinner = ({ size = 16 }) => (
  <span className="spinner" style={{ width: size, height: size }} />
);

// Legacy adapter — delegates to the shadcn-style Dialog primitive (Radix-backed,
// with focus trap, ESC handling, scroll-lock, ARIA). Existing callsites keep
// using the same <Modal open onClose title subtitle maxWidth> signature.
const Modal = ({ open, title, subtitle, onClose, children, maxWidth = 1100 }) => (
  <Dialog open={!!open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
    <DialogContent maxWidth={maxWidth} {...(subtitle ? {} : { "aria-describedby": undefined })}>
      <DialogHeader>
        <div className="min-w-0">
          {title && <DialogTitle>{title}</DialogTitle>}
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </div>
        <DialogCloseIcon />
      </DialogHeader>
      <div className="p-5">{children}</div>
    </DialogContent>
  </Dialog>
);

// Transformer names are sometimes stored as "TX2 Sample Type : Oil".
// Extract just the identifier before " Sample Type".
const parseTxDisplayName = (tx) => {
  const name = tx?.name || "";
  const idx = name.toLowerCase().indexOf(" sample type");
  return idx > 0 ? name.slice(0, idx).trim() : (name || tx?.id || "-");
};

// Serial numbers are sometimes stored as "99356 Sampling Point : Rain Tank".
// Extract just the number part before " Sampling Point".
const parseSerialDisplay = (tx) => {
  const s = tx?.serialNumber || "";
  const idx = s.toLowerCase().indexOf(" sampling point");
  return idx > 0 ? s.slice(0, idx).trim() : (s || "-");
};

// Extract sampling point from the serial number string, fall back to testType.
const parseSamplingPoint = (tx, testType) => {
  const s = tx?.serialNumber || "";
  const m = s.match(/sampling point\s*:\s*(.+)/i);
  if (m) return m[1].trim();
  return testType || "Maintank";
};

const LIFETIME_BANDS = [
  { max: 50,  color: "#22c55e", label: "Normal" },
  { max: 75,  color: "#f59e0b", label: "Moderate" },
  { max: 90,  color: "#f97316", label: "Significant" },
  { max: 100, color: "#ef4444", label: "Critical" },
];

const lifetimeBand = (pct) => LIFETIME_BANDS.find((b) => pct <= b.max) || LIFETIME_BANDS[3];

function LifetimeUsageSection({ lifePctFuran, lifePctMethanol }) {
  const items = [
    { label: "Lifetime Used — DP from Furan (2-FAL)", pct: lifePctFuran },
    { label: "Lifetime Used — DP from Methanol", pct: lifePctMethanol },
  ];
  return (
    <div className="bg-surface-input border border-border rounded-xl p-3.5">
      <div className="section-label mb-2.5">Estimated Lifetime Usage</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
        {items.map(({ label, pct }) => {
          const band = pct != null ? lifetimeBand(pct) : null;
          return (
            <div key={label} className="bg-surface-card border border-border rounded-md px-2.5 py-2.5">
              <div className="text-primary-muted text-[10px] mb-1.5">{label}</div>
              {pct != null ? (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[18px] font-bold font-mono" style={{ color: band.color }}>{pct}%</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${band.color}22`, color: band.color }}>{band.label}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: band.color }} />
                  </div>
                </>
              ) : (
                <div className="text-primary-muted text-[13px] font-mono">N/A</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-primary-muted mt-2">Based on reference data: initial DP ≈ 629, end-of-life DP ≈ 166. 2-FAL in ppb via Chendong correlation.</div>
    </div>
  );
}

// ============================================================
// MAIN APPLICATION
// ============================================================
export default function TransformerAssetML({
  user,
  onLogout,
  colorMode: controlledColorMode,
  toggleColorMode: controlledToggleColorMode,
  colorModeVars: controlledColorModeVars,
}) {
  const [internalColorMode, setInternalColorMode] = useState(getInitialColorMode);
  const [tab, setTab] = useState("dashboard");
  const [transformers, setTransformers] = useState(SAMPLE_TRANSFORMERS);
  const [results, setResults] = useState(() => generateSampleResults());
  const [oilBrands, setOilBrands] = useState(() => mergeOilBrandCatalog(createDefaultOilBrandCatalog(), SAMPLE_TRANSFORMERS));
  const [selectedTx, setSelectedTx] = useState(null);
  const [assetModalTxId, setAssetModalTxId] = useState(null);
  const [assetDetailView, setAssetDetailView] = useState("dga");
  const [diagnosticDate, setDiagnosticDate] = useState("");
  const [diagnosticDuvalMode, setDiagnosticDuvalMode] = useState("t1");
  const [showAddTx, setShowAddTx] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddResult, setShowAddResult] = useState(false);
  const [resultEditorMode, setResultEditorMode] = useState("dga");
  const [editTx, setEditTx] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [viewResult, setViewResult] = useState(null);
  const [viewResultMode, setViewResultMode] = useState("dga");
  const [expandedSites, setExpandedSites] = useState({});
  const [selectedExportRows, setSelectedExportRows] = useState({});
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfSections, setPdfSections] = useState({
    ieee: true, duvalT1: true, duvalT4: true, duvalT5: true,
    duvalP1: true, duvalH1: true, rogers: true, keyGas: true,
    radar: true, duvalDiagram: false,
  });
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const diagnosticsRef = useRef(null);
  const [filterSite, setFilterSite] = useState("");
  const [filterVoltage, setFilterVoltage] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assetSitePage, setAssetSitePage] = useState(1);
  const SITES_PER_PAGE = 10;
  const [clusterK, setClusterK] = useState(3);
  const [clusterResults, setClusterResults] = useState(null);
  const [clusterViewMode, setClusterViewMode] = useState("projection2d");

  // --- ML Backend state ---
  const [backendStatus, setBackendStatus] = useState(null); // null=checking, object=health, false=down
  const [predictionTx, setPredictionTx] = useState("");
  const [predSiteQuery, setPredSiteQuery] = useState("");
  const [predTxLabel, setPredTxLabel] = useState("");
  const [predMonths, setPredMonths] = useState(12);
  const [predModels, setPredModels] = useState(["arima"]); // multi-select array
  const [predTests, setPredTests] = useState(DEFAULT_PREDICTION_TEST_KEYS);
  const [mlPredictions, setMlPredictions] = useState(null); // { [modelKey]: predictionResult }
  const [mlCompareResults, setMlCompareResults] = useState(null); // all model results for comparison
  const [ensembleMode, setEnsembleMode] = useState("off"); // "off" | "avg" | "weighted"
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);
  const [faultDiagramView, setFaultDiagramView] = useState("t1"); // "t1" | "t4" | "t5" | "p1"
  const [anomalyMode, setAnomalyMode] = useState("dga");
  const [anomalySiteQuery, setAnomalySiteQuery] = useState("");
  const [anomalyTx, setAnomalyTx] = useState("");
  const [anomalyResults, setAnomalyResults] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyError, setAnomalyError] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [oilBrandError, setOilBrandError] = useState("");
  const [oilBrandSaving, setOilBrandSaving] = useState(false);
  const [importingAsset, setImportingAsset] = useState(false);
  const [importError, setImportError] = useState("");
  const [importDraft, setImportDraft] = useState(null);
  const [importDraftRowIndex, setImportDraftRowIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "transformer"|"result"|"oilBrand", id, name }
  const [desktopStorageInfo, setDesktopStorageInfo] = useState(null);
  const [desktopStorageError, setDesktopStorageError] = useState("");
  const [trendsView, setTrendsView] = useState("sparkline"); // "sparkline" | "charts"
  const [trendAssessmentHistory, setTrendAssessmentHistory] = useState([]);
  const [trendsSiteQuery, setTrendsSiteQuery] = useState("");
  const [trendsTxQuery, setTrendsTxQuery] = useState("");
  const [trendsSerialQuery, setTrendsSerialQuery] = useState("");
  const [diagSiteQuery, setDiagSiteQuery] = useState("");
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [managedUsers, setManagedUsers] = useState([]);
  const [userMgmtLoading, setUserMgmtLoading] = useState(false);
  const [userMgmtError, setUserMgmtError] = useState("");
  const [userEditId, setUserEditId] = useState("");
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", status: "approved" });
  const isSuperadmin = user?.role === "superadmin" || user?.name === "ChM. Ts. Hadi Fauzi";
  const isDesktopRuntime = api.isElectronRuntime();

  const colorMode =
    controlledColorMode === "dark" || controlledColorMode === "light"
      ? controlledColorMode
      : internalColorMode;
  const colorModeVars = controlledColorModeVars || COLOR_MODES[colorMode] || COLOR_MODES.dark;
  const toggleColorMode = controlledToggleColorMode || (() => {
    setInternalColorMode((prev) => (prev === "dark" ? "light" : "dark"));
  });

  const applyStoragePayload = useCallback((storage = {}) => {
    const nextTransformers = storage?.transformers || [];
    setTransformers(nextTransformers);
    setResults(storage?.results || []);
    setOilBrands(mergeOilBrandCatalog(storage?.oilBrands || [], nextTransformers));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    applyColorMode(colorMode, colorModeVars);
  }, [colorMode, colorModeVars]);

  useEffect(() => {
    if (!isDesktopRuntime) return undefined;

    let cancelled = false;

    const loadDesktopStorageInfo = async () => {
      try {
        const info = await api.getDesktopStorageInfo();
        if (cancelled) return;
        setDesktopStorageInfo(info || null);
        setDesktopStorageError("");
      } catch (err) {
        if (cancelled) return;
        setDesktopStorageError(err.message || "Failed to load Electron database location.");
      }
    };

    loadDesktopStorageInfo();
    return () => { cancelled = true; };
  }, [isDesktopRuntime]);

  // Check backend + load persisted storage on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const health = await api.checkHealth();
      if (cancelled) return;
      setBackendStatus(health || false);
      if (!health) return;

      try {
        let storage = await api.getStorage();
        if (cancelled) return;
        const hasStoredData = (storage?.transformers?.length || 0) > 0 || (storage?.results?.length || 0) > 0;

        // First run: seed sqlite with sample data so all CRUD actions persist immediately.
        if (!hasStoredData) {
          const sampleResults = generateSampleResults();
          await api.bootstrapStorage(SAMPLE_TRANSFORMERS, sampleResults);
          storage = await api.getStorage();
          if (cancelled) return;
        }

        applyStoragePayload(storage);
      } catch (err) {
        setDataError(err.message || "Failed to load local database.");
      }
    };

    init();
    return () => { cancelled = true; };
  }, [applyStoragePayload]);

  const backendOnline = backendStatus && backendStatus.status === "healthy";
  const hasArima = backendStatus?.capabilities?.arima;
  const hasLstm = backendStatus?.capabilities?.lstm;
  const hasXgboost = backendStatus?.capabilities?.xgboost;
  const hasLightgbm = backendStatus?.capabilities?.lightgbm;
  const hasNatureHybrid = backendStatus?.capabilities?.nature_hybrid;
  const hasFaultPrediction = backendStatus?.capabilities?.fault_prediction;
  const hasClustering = backendStatus?.capabilities?.clustering;
  const hasShapSimilarity = backendStatus?.capabilities?.shap_similarity;

  const openDesktopStorageDirectory = async () => {
    try {
      setDesktopStorageError("");
      const result = await api.openDesktopStorageDirectory();
      if (!result?.ok) {
        setDesktopStorageError(result?.error || "Failed to open Electron database folder.");
      }
    } catch (err) {
      setDesktopStorageError(err.message || "Failed to open Electron database folder.");
    }
  };

  const oilBrandOptions = useMemo(
    () => oilBrands.map((item) => ({
      value: item.name,
      label: item.oilType ? `${item.name} - ${item.oilType}` : item.name,
    })),
    [oilBrands],
  );

  useEffect(() => {
    let cancelled = false;
    const txId = selectedTx || transformers[0]?.id || "";
    if (tab !== "trends" || !txId || !backendOnline) {
      setTrendAssessmentHistory([]);
      return () => { cancelled = true; };
    }

    const loadTrendAssessmentHistory = async () => {
      try {
        const response = await api.getAiAssessmentHistory(txId, 500);
        if (!cancelled) {
          setTrendAssessmentHistory(response?.items || []);
        }
      } catch {
        if (!cancelled) {
          setTrendAssessmentHistory([]);
        }
      }
    };

    loadTrendAssessmentHistory();
    return () => { cancelled = true; };
  }, [tab, selectedTx, transformers, backendOnline]);

  // Derived
  const sites = useMemo(() => [...new Set(transformers.map(t => t.site))], [transformers]);
  const filteredTx = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transformers.filter(t =>
      (!filterSite || t.site === filterSite) &&
      (!filterVoltage || t.voltage === filterVoltage) &&
      (!filterBrand || t.brand === filterBrand) &&
      (!q || (t.name || "").toLowerCase().includes(q) || (t.mnemonic || "").toLowerCase().includes(q) || (t.serialNumber || "").toLowerCase().includes(q) || (t.id || "").toLowerCase().includes(q))
    );
  }, [transformers, filterSite, filterVoltage, filterBrand, searchQuery]);

  const assetSiteGroups = useMemo(() => {
    const map = {};
    filteredTx.forEach(t => {
      const s = (t.site || "").trim() || "Unknown Site";
      if (!map[s]) map[s] = [];
      map[s].push(t);
    });
    return Object.keys(map).sort().map(s => ({ site: s, items: map[s] }));
  }, [filteredTx]);

  const assetSiteTotalPages = Math.max(1, Math.ceil(assetSiteGroups.length / SITES_PER_PAGE));
  const pagedAssetSiteGroups = assetSiteGroups.slice((assetSitePage - 1) * SITES_PER_PAGE, assetSitePage * SITES_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => { setAssetSitePage(1); }, [filterSite, filterVoltage, filterBrand, searchQuery]);

  useEffect(() => {
    if (!assetModalTxId) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setAssetModalTxId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [assetModalTxId]);

  const latestResults = useMemo(() => {
    const map = {};
    results.forEach(r => {
      if (!map[r.transformerId] || r.date > map[r.transformerId].date) map[r.transformerId] = r;
    });
    return map;
  }, [results]);

  const conditionSummary = useMemo(() => {
    const summary = { good: 0, fair: 0, poor: 0, veryPoor: 0 };
    Object.values(latestResults).forEach(r => { const c = getOverallCondition(r); summary[c]++; });
    return summary;
  }, [latestResults]);

  const resultCountByTx = useMemo(() => {
    const counts = {};
    results.forEach(r => {
      counts[r.transformerId] = (counts[r.transformerId] || 0) + 1;
    });
    return counts;
  }, [results]);
  const anomalyRecordCountByMode = useMemo(() => {
    const counts = { dga: {}, oil: {} };
    results.forEach((row) => {
      if (hasAnomalyMeasurementData(row, "dga")) {
        counts.dga[row.transformerId] = (counts.dga[row.transformerId] || 0) + 1;
      }
      if (hasAnomalyMeasurementData(row, "oil")) {
        counts.oil[row.transformerId] = (counts.oil[row.transformerId] || 0) + 1;
      }
    });
    return counts;
  }, [results]);
  const linkedOilBrandCount = useMemo(
    () => transformers.filter((transformer) => normalizeCatalogValue(transformer.oilBrand)).length,
    [transformers],
  );
  const unresolvedOilBrandTransformers = useMemo(
    () => transformers.filter((transformer) => !normalizeCatalogValue(transformer.oilBrand)),
    [transformers],
  );

  const transformerPickerOptions = useMemo(
    () => transformers.map(t => ({ value: t.id, label: formatTxPickerLabel(t) })),
    [transformers]
  );
  const transformerSerialOptions = useMemo(
    () => transformers.map((t) => ({
      value: t.id,
      label: `${(t.serialNumber || "No Serial").trim()} | ${formatTxPickerLabel(t)}`,
    })),
    [transformers]
  );

  // --- ML Predictions cascading pickers: Site → Transformer → Serial ---
  const predSiteOptions = useMemo(
    () => [...new Set(transformers.map(t => (t.site || "").trim()).filter(Boolean))].sort().map(s => ({ value: s, label: s })),
    [transformers]
  );
  const predTxsInSite = useMemo(
    () => predSiteQuery ? transformers.filter(t => (t.site || "").trim() === predSiteQuery) : transformers,
    [transformers, predSiteQuery]
  );
  const predTxLabelOptions = useMemo(() => {
    const labels = [...new Set(predTxsInSite.map(t => (t.mnemonic || t.name || t.id || "").trim()))].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, "")) || 0;
      const nb = parseInt(b.replace(/\D/g, "")) || 0;
      return na - nb || a.localeCompare(b);
    });
    return labels.map(l => ({ value: l, label: l }));
  }, [predTxsInSite]);
  const predFilteredTxs = useMemo(() => {
    if (!predTxLabel) return predTxsInSite;
    return predTxsInSite.filter(t => (t.mnemonic || t.name || t.id || "").trim() === predTxLabel);
  }, [predTxsInSite, predTxLabel]);
  const predSerialOptions = useMemo(
    () => predFilteredTxs.map(t => ({ value: t.id, label: (t.serialNumber || "-").trim() })),
    [predFilteredTxs]
  );

  // Auto-select when only one option remains after filtering
  useEffect(() => {
    if (predTxLabelOptions.length === 1 && !predTxLabel) setPredTxLabel(predTxLabelOptions[0].value);
  }, [predTxLabelOptions, predTxLabel]);
  useEffect(() => {
    if (predSerialOptions.length === 1 && !predictionTx) setPredictionTx(predSerialOptions[0].value);
  }, [predSerialOptions, predictionTx]);

  const hasFaultRfSelected = predModels.includes("fault_rf");
  const activePredTests = hasFaultRfSelected && predModels.length === 1 ? DEFAULT_PREDICTION_TEST_KEYS : predTests;

  const togglePredModel = useCallback((modelId) => {
    setPredModels(prev => {
      if (prev.includes(modelId)) {
        const next = prev.filter(m => m !== modelId);
        return next.length === 0 ? [modelId] : next; // keep at least one
      }
      return [...prev, modelId];
    });
  }, []);

  const togglePredictionTest = useCallback((testKey) => {
    if (hasFaultRfSelected && predModels.length === 1) return;
    setPredTests((prev) => (
      prev.includes(testKey)
        ? prev.filter((key) => key !== testKey)
        : [...prev, testKey]
    ));
  }, [hasFaultRfSelected, predModels.length]);

  // Forms
  const emptyTx = { id: "", name: "", mnemonic: "", serialNumber: "", brand: "", maker: "", voltage: "", loadMVA: "", site: "", dateEnergized: "", dateManufactured: "", oilBrand: "", oilType: "", paperType: DEFAULT_PAPER_TYPE };
  const [txForm, setTxForm] = useState(emptyTx);
  const [oilBrandForm, setOilBrandForm] = useState({ ...emptyOilBrand });
  const [oilBrandEditId, setOilBrandEditId] = useState("");
  const emptyResult = {
    transformerId: "",
    date: new Date().toISOString().split("T")[0],
    H2: "",
    CH4: "",
    C2H2: "",
    C2H4: "",
    C2H6: "",
    CO: "",
    CO2: "",
    O2: "",
    N2: "",
    moisture: "",
    bdv: "",
    acidity: "",
    ift: "",
    color: "",
    powerFactor: "",
    notes: "",
    ...OIL_TEST_EXTRA_DEFAULTS,
  };
  const [resultForm, setResultForm] = useState(emptyResult);
  const getDefaultResultForm = () => ({ ...emptyResult, date: new Date().toISOString().split("T")[0] });
  const resultDpPreview = useMemo(() => ({
    dpFromFuran: estimateDpFromFuran(resultForm.fal2),
    dpFromMethanol: estimateDpFromMethanol(resultForm.methanol),
  }), [resultForm.fal2, resultForm.methanol]);
  const matchedImportDraftTransformer = useMemo(() => (
    importDraft?.matchedTransformerId
      ? transformers.find((item) => item.id === importDraft.matchedTransformerId) || null
      : null
  ), [importDraft?.matchedTransformerId, transformers]);
  const activeImportDraftRow = importDraft?.resultRows?.[Math.min(importDraftRowIndex, Math.max((importDraft?.resultRows?.length || 1) - 1, 0))] || null;
  const importDraftDpPreview = useMemo(() => ({
    dpFromFuran: estimateDpFromFuran(activeImportDraftRow?.fal2),
    dpFromMethanol: estimateDpFromMethanol(activeImportDraftRow?.methanol),
  }), [activeImportDraftRow?.fal2, activeImportDraftRow?.methanol]);

  const updateImportDraftTransformerField = useCallback((key, value) => {
    setImportDraft((prev) => {
      if (!prev) return prev;

      const nextTransformer = {
        ...prev.transformer,
        [key]: value,
      };

      if (key === "brand" || key === "maker") {
        const resolvedBrandFields = resolveImportedBrandAndMaker(nextTransformer.brand, nextTransformer.maker);
        nextTransformer.brand = resolvedBrandFields.brand;
        nextTransformer.maker = resolvedBrandFields.maker;
      }

      if (key === "dateManufactured" && !nextTransformer.dateEnergized) {
        nextTransformer.dateEnergized = resolveImportedDateEnergized(nextTransformer.dateEnergized, nextTransformer.dateManufactured);
      }

      return {
        ...prev,
        transformer: nextTransformer,
      };
    });
  }, []);

  const handleImportDraftOilBrandSelection = useCallback((value) => {
    const normalizedBrand = normalizeCatalogValue(value);
    const selectedOilBrand = oilBrands.find((item) => isSameCatalogValue(item.name, normalizedBrand));
    setImportDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transformer: {
          ...prev.transformer,
          oilBrand: normalizedBrand,
          oilType: normalizeCatalogValue(selectedOilBrand?.oilType || prev.transformer.oilType || ""),
        },
      };
    });
  }, [oilBrands]);

  const updateImportDraftResultField = useCallback((rowIndex, key, value) => {
    setImportDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        resultRows: prev.resultRows.map((row, index) => (
          index === rowIndex
            ? { ...row, [key]: value }
            : row
        )),
      };
    });
  }, []);

  const saveTx = async () => {
    const normalizedTransformerId = `${txForm.id || ""}`.trim();
    if (!txForm.name || (editTx && !normalizedTransformerId)) return;

    const selectedOilBrand = oilBrands.find((item) => isSameCatalogValue(item.name, txForm.oilBrand));
    const transformerIdForSave = editTx ? normalizedTransformerId : (normalizedTransformerId || generateNextTransformerId(transformers));
    const payload = {
      ...txForm,
      id: transformerIdForSave,
      loadMVA: Number(txForm.loadMVA) || 0,
      mnemonic: txForm.mnemonic || "",
      serialNumber: txForm.serialNumber || "",
      oilBrand: normalizeCatalogValue(txForm.oilBrand),
      oilType: normalizeCatalogValue(selectedOilBrand?.oilType || txForm.oilType),
      paperType: normalizeCatalogValue(txForm.paperType) || DEFAULT_PAPER_TYPE,
    };

    try {
      const previousTransformerId = editTx?.id || "";
      let savedTransformer = payload;
      let nextTransformers;
      if (backendOnline) {
        savedTransformer = editTx
          ? await api.updateTransformer(editTx.id, payload)
          : await api.createTransformer(payload);
        nextTransformers = editTx
          ? transformers.map((transformer) => (transformer.id === editTx.id ? savedTransformer : transformer))
          : [...transformers, savedTransformer];
      } else if (editTx) {
        nextTransformers = transformers.map((transformer) => (transformer.id === editTx.id ? payload : transformer));
      } else {
        nextTransformers = [...transformers, payload];
      }

      const renamedTransformerId = Boolean(editTx && previousTransformerId !== savedTransformer.id);
      if (renamedTransformerId) {
        setResults((prev) => prev.map((result) => (
          result.transformerId === previousTransformerId
            ? { ...result, transformerId: savedTransformer.id }
            : result
        )));
        setSelectedTx((prev) => (prev === previousTransformerId ? savedTransformer.id : prev));
        setAssetModalTxId((prev) => (prev === previousTransformerId ? savedTransformer.id : prev));
        setPredictionTx((prev) => (prev === previousTransformerId ? savedTransformer.id : prev));
        setResultForm((prev) => (
          prev.transformerId === previousTransformerId
            ? { ...prev, transformerId: savedTransformer.id }
            : prev
        ));
        setViewResult((prev) => (
          prev?.transformerId === previousTransformerId
            ? { ...prev, transformerId: savedTransformer.id }
            : prev
        ));
        setEditResult((prev) => (
          prev?.transformerId === previousTransformerId
            ? { ...prev, transformerId: savedTransformer.id }
            : prev
        ));
      }

      setTransformers(nextTransformers);
      setOilBrands(mergeOilBrandCatalog(oilBrands, nextTransformers));
      setDataError(null);
      setTxForm(emptyTx);
      setShowAddTx(false);
      setEditTx(null);
    } catch (err) {
      setDataError(err.message || "Failed to save transformer.");
    }
  };

  const deleteTx = async (id) => {
    try {
      if (backendOnline) {
        await api.deleteTransformer(id);
      }
      const nextTransformers = transformers.filter((transformer) => transformer.id !== id);
      setTransformers(nextTransformers);
      setResults((prev) => prev.filter((result) => result.transformerId !== id));
      setOilBrands(mergeOilBrandCatalog(oilBrands, nextTransformers));
      setDataError(null);
    } catch (err) {
      setDataError(err.message || "Failed to delete transformer.");
    }
  };

  const confirmDeleteTx = (id) => {
    const tx = transformers.find(t => t.id === id);
    setDeleteConfirm({ type: "transformer", id, name: tx ? `${tx.name} (${tx.mnemonic})` : id });
  };

  const resetOilBrandForm = useCallback(() => {
    setOilBrandForm({ ...emptyOilBrand });
    setOilBrandEditId("");
    setOilBrandError("");
  }, []);

  const refreshOilBrandCatalog = async (transformerSnapshot = transformers) => {
    if (!backendOnline) {
      setOilBrands(mergeOilBrandCatalog(oilBrands, transformerSnapshot));
      return;
    }

    try {
      const response = await api.getOilBrands();
      setOilBrands(mergeOilBrandCatalog(response?.items || [], transformerSnapshot));
      setOilBrandError("");
    } catch (err) {
      setOilBrandError(err.message || "Failed to refresh oil-brand catalog.");
    }
  };

  const handleOilBrandSelection = useCallback((brandName) => {
    const match = oilBrands.find((item) => isSameCatalogValue(item.name, brandName));
    setTxForm((prev) => ({
      ...prev,
      oilBrand: brandName,
      oilType: normalizeCatalogValue(match?.oilType || prev.oilType),
    }));
  }, [oilBrands]);

  const startEditOilBrand = (item) => {
    setOilBrandForm({
      id: item.id,
      name: item.name,
      oilType: item.oilType || "",
      notes: item.notes || "",
    });
    setOilBrandEditId(item.id);
    setOilBrandError("");
  };

  const saveOilBrand = async () => {
    const normalizedName = normalizeCatalogValue(oilBrandForm.name);
    if (!normalizedName) {
      setOilBrandError("Oil brand name is required.");
      return;
    }

    const payload = {
      ...oilBrandForm,
      name: normalizedName,
      oilType: normalizeCatalogValue(oilBrandForm.oilType),
      notes: `${oilBrandForm.notes || ""}`.trim(),
    };
    const previousBrand = oilBrands.find((item) => item.id === oilBrandEditId) || null;

    try {
      setOilBrandSaving(true);
      if (backendOnline) {
        if (oilBrandEditId) {
          await api.updateOilBrand(oilBrandEditId, payload);
        } else {
          await api.createOilBrand(payload);
        }
        const storage = await api.getStorage();
        applyStoragePayload(storage);
      } else {
        const saved = oilBrandEditId
          ? { ...previousBrand, ...payload, id: oilBrandEditId }
          : { ...payload, id: `local-oil-brand-${Date.now()}`, transformerCount: 0 };
        const nextTransformers = previousBrand
          ? transformers.map((transformer) => {
              if (!isSameCatalogValue(transformer.oilBrand, previousBrand.name)) return transformer;
              return {
                ...transformer,
                oilBrand: saved.name,
                oilType: saved.oilType || transformer.oilType,
              };
            })
          : transformers;
        const nextOilBrands = oilBrandEditId
          ? oilBrands.map((item) => (item.id === oilBrandEditId ? saved : item))
          : [...oilBrands, saved];
        setTransformers(nextTransformers);
        setOilBrands(mergeOilBrandCatalog(nextOilBrands, nextTransformers));
      }

      if (previousBrand && isSameCatalogValue(txForm.oilBrand, previousBrand.name)) {
        setTxForm((prev) => (
          ({ ...prev, oilBrand: normalizedName, oilType: payload.oilType || prev.oilType })
        ));
      }

      setOilBrandError("");
      resetOilBrandForm();
    } catch (err) {
      setOilBrandError(err.message || "Failed to save oil brand.");
    } finally {
      setOilBrandSaving(false);
    }
  };

  const deleteOilBrandEntry = async (id) => {
    const target = oilBrands.find((item) => item.id === id);
    if (!target) return;

    try {
      if (backendOnline) {
        await api.deleteOilBrand(id);
        const response = await api.getOilBrands();
        setOilBrands(mergeOilBrandCatalog(response?.items || [], transformers));
      } else {
        const nextOilBrands = oilBrands.filter((item) => item.id !== id);
        setOilBrands(mergeOilBrandCatalog(nextOilBrands, transformers));
      }
      if (isSameCatalogValue(txForm.oilBrand, target.name)) {
        setTxForm((prev) => ({ ...prev, oilBrand: "" }));
      }
      if (oilBrandEditId === id) {
        resetOilBrandForm();
      }
      setOilBrandError("");
    } catch (err) {
      setOilBrandError(err.message || "Failed to delete oil brand.");
    }
  };

  const confirmDeleteOilBrand = (item) => {
    if (Number(item.transformerCount || 0) > 0) {
      setOilBrandError(`Oil brand '${item.name}' is still linked to ${item.transformerCount} transformer(s).`);
      return;
    }
    setDeleteConfirm({ type: "oilBrand", id: item.id, name: item.name });
  };

  const saveResult = async () => {
    if (!resultForm.transformerId || !resultForm.date) return;
    const parsed = { ...resultForm, id: editResult ? editResult.id : resultForm.id };
    GASES.forEach(g => { parsed[g.key] = parseFloat(parsed[g.key]) || 0; });
    const numericKeys = new Set([
      "O2",
      "N2",
      "moisture",
      "bdv",
      "acidity",
      "ift",
      "powerFactor",
      ...OIL_TEST_NUMERIC_KEYS,
    ]);
    numericKeys.forEach((k) => { parsed[k] = parseFloat(parsed[k]) || 0; });
    OIL_TEST_TEXT_KEYS.forEach((k) => { parsed[k] = parsed[k] || ""; });
    parsed.color = parsed.color || "";
    parsed.notes = parsed.notes || "";
    parsed.dpFromFuran = estimateDpFromFuran(parsed.fal2);
    parsed.dpFromMethanol = estimateDpFromMethanol(parsed.methanol);

    try {
      if (backendOnline) {
        const saved = editResult
          ? await api.updateResult(editResult.id, parsed)
          : await api.createResult(parsed);

        setResults(prev => {
          const next = editResult
            ? prev.map(r => (r.id === editResult.id ? saved : r))
            : [...prev, saved];
          return next.sort((a, b) => a.date.localeCompare(b.date));
        });
      } else if (editResult) {
        setResults(prev => prev.map(r => (r.id === editResult.id ? parsed : r)).sort((a, b) => a.date.localeCompare(b.date)));
      } else {
        parsed.id = parsed.id || `R-${Date.now()}`;
        setResults(prev => [...prev, parsed].sort((a, b) => a.date.localeCompare(b.date)));
      }

      setDataError(null);
      setResultForm(getDefaultResultForm());
      setShowAddResult(false);
      setEditResult(null);
    } catch (err) {
      setDataError(err.message || "Failed to save DGA result.");
    }
  };

  const saveAssessmentToResult = useCallback(async (resultId, draftText, options = {}) => {
    const current = results.find((row) => row.id === resultId);
    if (!current) {
      throw new Error("Selected DGA result not found.");
    }

    const stamp = new Date().toISOString().split("T")[0];
    const statusLabel = options.approved ? "Approved" : "Draft";
    const startMarker = "[AI_ASSESSMENT_START]";
    const endMarker = "[AI_ASSESSMENT_END]";
    const existingNotes = String(current.notes || "");
    const notesWithoutAi = existingNotes.replace(/\[AI_ASSESSMENT_START\][\s\S]*?\[AI_ASSESSMENT_END\]/g, "").trim();
    const aiBlock = [
      startMarker,
      `Status: ${statusLabel}`,
      `Updated: ${stamp}`,
      draftText.trim(),
      endMarker,
    ].join("\n");
    const nextNotes = [notesWithoutAi, aiBlock].filter(Boolean).join("\n\n");
    const payload = { ...current, notes: nextNotes };

    let savedResult = payload;
    if (backendOnline) {
      savedResult = await api.updateResult(resultId, payload);
      setResults((prev) => prev.map((row) => (row.id === resultId ? savedResult : row)).sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      setResults((prev) => prev.map((row) => (row.id === resultId ? payload : row)).sort((a, b) => a.date.localeCompare(b.date)));
    }

    let savedHistory = null;
    if (backendOnline && options.approved) {
      const historyPayload = {
        id: options.historyId || undefined,
        resultId,
        transformerId: current.transformerId,
        assessmentText: draftText.trim(),
        source: options.source || "manual_edit",
        status: "approved",
      };
      savedHistory = options.historyId
        ? await api.updateAiAssessmentHistory(options.historyId, historyPayload)
        : await api.createAiAssessmentHistory(historyPayload);
    }

    setDataError(null);
    return { result: savedResult, history: savedHistory };
  }, [backendOnline, results]);

  const deleteResult = async (id) => {
    try {
      if (backendOnline) {
        await api.deleteResult(id);
      }
      setResults(prev => prev.filter(r => r.id !== id));
      setDataError(null);
    } catch (err) {
      setDataError(err.message || "Failed to delete DGA result.");
    }
  };

  const confirmDeleteResult = (id) => {
    setDeleteConfirm({ type: "result", id, name: `Result ${id}` });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "transformer") {
      await deleteTx(deleteConfirm.id);
    } else if (deleteConfirm.type === "oilBrand") {
      await deleteOilBrandEntry(deleteConfirm.id);
    } else {
      await deleteResult(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const resetImportDraft = useCallback(() => {
    setImportDraft(null);
    setImportDraftRowIndex(0);
  }, []);

  const closeImportModal = useCallback(() => {
    if (importingAsset) return;
    setShowImportModal(false);
    setImportError("");
    resetImportDraft();
  }, [importingAsset, resetImportDraft]);

  const findMatchingTransformerForImport = useCallback((transformerPatch = {}) => {
    const normalizedId = normalizeImportLookupValue(transformerPatch.id);
    if (normalizedId) {
      const transformerById = transformers.find((item) => normalizeImportLookupValue(item.id) === normalizedId);
      if (transformerById) return transformerById;
    }

    const normalizedSite = normalizeImportLookupValue(transformerPatch.site);
    const identityCandidates = [
      { key: "serialNumber", value: normalizeImportLookupValue(transformerPatch.serialNumber) },
      { key: "mnemonic", value: normalizeImportLookupValue(transformerPatch.mnemonic) },
      { key: "name", value: normalizeImportLookupValue(transformerPatch.name) },
    ].filter((candidate) => candidate.value);

    for (const candidate of identityCandidates) {
      const exactMatch = transformers.find((item) => (
        normalizeImportLookupValue(item[candidate.key]) === candidate.value
        && (!normalizedSite || normalizeImportLookupValue(item.site) === normalizedSite)
      ));
      if (exactMatch) return exactMatch;

      const looseMatch = transformers.find((item) => normalizeImportLookupValue(item[candidate.key]) === candidate.value);
      if (looseMatch) return looseMatch;
    }

    return null;
  }, [transformers]);

  const importTransformerReport = useCallback(async (file) => {
    if (!file) return;

    setImportingAsset(true);
    setImportError("");
    setDataError(null);
    setStatusMessage("");

    try {
      const imported = await extractAssetImportFromFile(file);
      const importedTransformerPatch = imported.transformerPatch || {};
      const matchedTransformer = findMatchingTransformerForImport(importedTransformerPatch);
      const importedTransformerLookupId = normalizeCatalogValue(importedTransformerPatch.id)
        || buildImportedTransformerId(importedTransformerPatch, imported.fileName || file.name);
      const importedTransformerId = matchedTransformer?.id || generateNextTransformerId(transformers);
      const inferredTransformerName = normalizeCatalogValue(importedTransformerPatch.name)
        || matchedTransformer?.name
        || normalizeCatalogValue(importedTransformerPatch.mnemonic)
        || normalizeCatalogValue(importedTransformerPatch.serialNumber)
        || normalizeCatalogValue(imported.fileName ? imported.fileName.replace(/\.[^.]+$/, "") : "")
        || importedTransformerLookupId
        || importedTransformerId
        || "Imported Transformer";
      const preferredOilBrand = normalizeCatalogValue(importedTransformerPatch.oilBrand || matchedTransformer?.oilBrand || "");
      const selectedOilBrand = oilBrands.find((item) => isSameCatalogValue(item.name, preferredOilBrand));
      const resolvedBrandFields = resolveImportedBrandAndMaker(
        importedTransformerPatch.brand || matchedTransformer?.brand || "",
        importedTransformerPatch.maker || matchedTransformer?.maker || "",
      );
      const resolvedDateManufactured = importedTransformerPatch.dateManufactured || matchedTransformer?.dateManufactured || "";
      const resolvedDateEnergized = resolveImportedDateEnergized(
        importedTransformerPatch.dateEnergized || matchedTransformer?.dateEnergized || "",
        resolvedDateManufactured,
      );

      const transformerPayload = {
        ...emptyTx,
        ...(matchedTransformer || {}),
        ...importedTransformerPatch,
        id: importedTransformerId,
        name: inferredTransformerName,
        loadMVA: Number(importedTransformerPatch.loadMVA ?? matchedTransformer?.loadMVA) || 0,
        brand: resolvedBrandFields.brand,
        maker: resolvedBrandFields.maker,
        voltage: normalizeCatalogValue(importedTransformerPatch.voltage || matchedTransformer?.voltage || ""),
        site: normalizeCatalogValue(importedTransformerPatch.site || matchedTransformer?.site || ""),
        mnemonic: normalizeCatalogValue(importedTransformerPatch.mnemonic || matchedTransformer?.mnemonic || ""),
        serialNumber: normalizeCatalogValue(importedTransformerPatch.serialNumber || matchedTransformer?.serialNumber || ""),
        dateEnergized: resolvedDateEnergized,
        dateManufactured: resolvedDateManufactured,
        oilBrand: preferredOilBrand,
        oilType: normalizeCatalogValue(importedTransformerPatch.oilType || selectedOilBrand?.oilType || matchedTransformer?.oilType || ""),
        paperType: normalizeCatalogValue(importedTransformerPatch.paperType || matchedTransformer?.paperType || DEFAULT_PAPER_TYPE) || DEFAULT_PAPER_TYPE,
      };

      const importedResultRows = mergeImportedResultRows((imported.resultPatches || []).map((row) => ({
        ...row,
        transformerId: importedTransformerId,
        date: row.date || new Date().toISOString().split("T")[0],
        testType: row.testType || "Routine",
      })));

      setImportDraft({
        sourceFileName: imported.fileName || file.name,
        matchedTransformerId: matchedTransformer?.id || "",
        transformer: transformerPayload,
        resultRows: importedResultRows,
      });
      setImportDraftRowIndex(0);
    } catch (error) {
      setImportError(error?.message || "Failed to import the selected file.");
    } finally {
      setImportingAsset(false);
    }
  }, [emptyTx, findMatchingTransformerForImport, oilBrands, transformers]);

  const submitImportDraft = useCallback(async () => {
    if (!importDraft) return;

    const draftTransformer = importDraft.transformer || {};
    const matchedTransformer = importDraft.matchedTransformerId
      ? transformers.find((item) => item.id === importDraft.matchedTransformerId) || null
      : null;
    const normalizedTransformerId = `${draftTransformer.id || ""}`.trim();

    if (!draftTransformer.name || (!backendOnline && !normalizedTransformerId)) {
      setImportError("Transformer TX No and generated ID are required before importing.");
      return;
    }

    const selectedOilBrand = oilBrands.find((item) => isSameCatalogValue(item.name, draftTransformer.oilBrand));
    const resolvedBrandFields = resolveImportedBrandAndMaker(draftTransformer.brand, draftTransformer.maker);
    const transformerPayload = {
      ...emptyTx,
      ...(matchedTransformer || {}),
      ...draftTransformer,
      id: matchedTransformer ? (normalizedTransformerId || matchedTransformer.id) : (normalizedTransformerId || generateNextTransformerId(transformers)),
      loadMVA: Number(draftTransformer.loadMVA) || 0,
      mnemonic: draftTransformer.mnemonic || "",
      serialNumber: draftTransformer.serialNumber || "",
      brand: resolvedBrandFields.brand,
      maker: resolvedBrandFields.maker,
      dateEnergized: resolveImportedDateEnergized(draftTransformer.dateEnergized, draftTransformer.dateManufactured),
      oilBrand: normalizeCatalogValue(draftTransformer.oilBrand),
      oilType: normalizeCatalogValue(selectedOilBrand?.oilType || draftTransformer.oilType),
      paperType: normalizeCatalogValue(draftTransformer.paperType) || DEFAULT_PAPER_TYPE,
    };

    setImportingAsset(true);
    setImportError("");
    setDataError(null);
    setStatusMessage("");

    try {
      const previousTransformerId = matchedTransformer?.id || "";
      let savedTransformer = transformerPayload;
      let nextTransformers = transformers;
      let nextResults = [...results];
      let createdResultCount = 0;
      let updatedResultCount = 0;

      if (backendOnline) {
        savedTransformer = matchedTransformer
          ? await api.updateTransformer(matchedTransformer.id, transformerPayload)
          : await api.createTransformer(transformerPayload);
        nextTransformers = matchedTransformer
          ? transformers.map((item) => (item.id === matchedTransformer.id ? savedTransformer : item))
          : [...transformers, savedTransformer];
      } else {
        savedTransformer = transformerPayload;
        nextTransformers = matchedTransformer
          ? transformers.map((item) => (item.id === matchedTransformer.id ? savedTransformer : item))
          : [...transformers, savedTransformer];
      }

      const renamedTransformerId = Boolean(matchedTransformer && previousTransformerId && previousTransformerId !== savedTransformer.id);
      if (renamedTransformerId) {
        nextResults = nextResults.map((row) => (
          row.transformerId === previousTransformerId
            ? { ...row, transformerId: savedTransformer.id }
            : row
        ));
      }

      const existingResultsByDate = new Map(
        nextResults
          .filter((row) => row.transformerId === savedTransformer.id)
          .map((row) => [row.date, row]),
      );
      const numericKeys = new Set([
        "O2",
        "N2",
        "moisture",
        "bdv",
        "acidity",
        "ift",
        "powerFactor",
        ...OIL_TEST_NUMERIC_KEYS,
      ]);
      const today = new Date().toISOString().split("T")[0];

      for (let index = 0; index < (importDraft.resultRows || []).length; index += 1) {
        const importedRow = importDraft.resultRows[index];
        const existingRow = existingResultsByDate.get(importedRow.date) || null;
        const payload = {
          ...getDefaultResultForm(),
          ...(existingRow || {}),
          ...importedRow,
          transformerId: savedTransformer.id,
          id: existingRow?.id || importedRow.id || `R-${savedTransformer.id}-${Date.now()}-${index}`,
          date: importedRow.date || existingRow?.date || today,
          testType: importedRow.testType || existingRow?.testType || "Routine",
        };

        GASES.forEach((gas) => {
          payload[gas.key] = parseFloat(payload[gas.key]) || 0;
        });
        numericKeys.forEach((key) => {
          payload[key] = parseFloat(payload[key]) || 0;
        });
        OIL_TEST_TEXT_KEYS.forEach((key) => {
          payload[key] = payload[key] || "";
        });
        payload.color = payload.color || "";
        payload.notes = payload.notes || "";
        payload.dpFromFuran = estimateDpFromFuran(payload.fal2);
        payload.dpFromMethanol = estimateDpFromMethanol(payload.methanol);

        if (backendOnline) {
          const savedRow = existingRow
            ? await api.updateResult(existingRow.id, payload)
            : await api.createResult(payload);
          nextResults = existingRow
            ? nextResults.map((row) => (row.id === existingRow.id ? savedRow : row))
            : [...nextResults, savedRow];
          existingResultsByDate.set(savedRow.date, savedRow);
        } else {
          nextResults = existingRow
            ? nextResults.map((row) => (row.id === existingRow.id ? payload : row))
            : [...nextResults, payload];
          existingResultsByDate.set(payload.date, payload);
        }

        if (existingRow) {
          updatedResultCount += 1;
        } else {
          createdResultCount += 1;
        }
      }

      nextResults = [...nextResults].sort((left, right) => left.date.localeCompare(right.date));

      setTransformers(nextTransformers);
      setResults(nextResults);
      setOilBrands(mergeOilBrandCatalog(oilBrands, nextTransformers));
      resetImportDraft();
      setShowImportModal(false);
      setImportError("");
      setAssetDetailView("dga");
      setSelectedTx(savedTransformer.id);
      setAssetModalTxId(savedTransformer.id);
      setPredictionTx((prev) => ((renamedTransformerId && prev === previousTransformerId) ? savedTransformer.id : prev));
      setResultForm((prev) => (
        renamedTransformerId && prev.transformerId === previousTransformerId
          ? { ...prev, transformerId: savedTransformer.id }
          : prev
      ));
      setViewResult((prev) => (
        renamedTransformerId && prev?.transformerId === previousTransformerId
          ? { ...prev, transformerId: savedTransformer.id }
          : prev
      ));
      setEditResult((prev) => (
        renamedTransformerId && prev?.transformerId === previousTransformerId
          ? { ...prev, transformerId: savedTransformer.id }
          : prev
      ));
      if (savedTransformer.site) {
        setExpandedSites((prev) => ({ ...prev, [`asset:${savedTransformer.site}`]: true }));
      }
      setTab("assets");

      const importedResultCount = createdResultCount + updatedResultCount;
      setStatusMessage(
        importedResultCount > 0
          ? `Imported ${savedTransformer.name || savedTransformer.id} from ${importDraft.sourceFileName}. ${createdResultCount} result row(s) created and ${updatedResultCount} updated.`
          : `Imported transformer details for ${savedTransformer.name || savedTransformer.id} from ${importDraft.sourceFileName}.`,
      );
    } catch (error) {
      setImportError(error?.message || "Failed to import the selected file.");
    } finally {
      setImportingAsset(false);
    }
  }, [backendOnline, emptyTx, getDefaultResultForm, importDraft, oilBrands, resetImportDraft, results, transformers]);

  const handleImportDrop = useCallback(async (acceptedFiles, fileRejections) => {
    if (fileRejections?.length) {
      setImportError("Upload one report in Excel, PDF, PNG, JPG, JPEG, WEBP, or BMP format.");
      return;
    }

    const selectedFile = acceptedFiles?.[0];
    if (selectedFile) {
      await importTransformerReport(selectedFile);
    }
  }, [importTransformerReport]);

  const {
    getRootProps: getImportDropzoneRootProps,
    getInputProps: getImportDropzoneInputProps,
    isDragActive: isImportDragActive,
    isDragAccept: isImportDragAccept,
    isDragReject: isImportDragReject,
    open: openImportFilePicker,
  } = useDropzone({
    accept: IMPORTABLE_FILE_TYPES,
    disabled: importingAsset,
    maxFiles: 1,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDrop: handleImportDrop,
  });

  useEffect(() => {
    if (!showImportModal || importingAsset || importDraft) {
      return undefined;
    }

    const handlePaste = async (event) => {
      const clipboardItems = Array.from(event.clipboardData?.items ?? []);
      const imageItem = clipboardItems.find((item) => String(item.type ?? "").toLowerCase().startsWith("image/"));

      if (!imageItem) {
        return;
      }

      const pastedFile = imageItem.getAsFile();
      if (!pastedFile) {
        setImportError("The pasted image could not be read from the clipboard.");
        return;
      }

      event.preventDefault();
      await importTransformerReport(pastedFile);
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [importDraft, importTransformerReport, importingAsset, showImportModal]);

  const closeResultModal = () => {
    setShowAddResult(false);
    setEditResult(null);
    setResultForm(getDefaultResultForm());
  };

  const openAddResultModal = (mode = "dga") => {
    setResultEditorMode(mode);
    setEditResult(null);
    setResultForm(getDefaultResultForm());
    setShowAddResult(true);
  };

  const openEditResultModal = (result, mode = "dga") => {
    setResultEditorMode(mode);
    setResultForm({ ...getDefaultResultForm(), ...result });
    setEditResult(result);
    setShowAddResult(true);
  };

  const closeViewResultModal = useCallback(() => {
    setViewResult(null);
  }, []);

  const openViewResultModal = useCallback((result, mode = "dga") => {
    if (!result) return;
    setViewResultMode(mode);
    setViewResult(result);
  }, []);

  const getAssessmentText = useCallback((result) => {
    const notes = String(result?.notes || "").trim();
    if (!notes) return "";
    const aiBlock = notes.match(/\[AI_ASSESSMENT_START\]([\s\S]*?)\[AI_ASSESSMENT_END\]/);
    if (!aiBlock) return notes;
    const body = String(aiBlock[1] || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("Status:") && !line.startsWith("Updated:"))
      .join(" ");
    return body || notes;
  }, []);

  const buildViewResultInfo = useCallback((result, mode = "dga") => {
    const tx = transformers.find((item) => item.id === result?.transformerId);
    const info = [
      { label: "Site", value: tx?.site || "-" },
      { label: "Transformer", value: tx?.name || result?.transformerId || "-" },
      { label: "Serial No.", value: tx?.serialNumber || "-" },
      { label: "Mnemonic / TX No", value: tx ? getTxMnemonicOrId(tx) : result?.transformerId || "-" },
      { label: "Date", value: result?.date || "-" },
      { label: "Test Type", value: result?.testType || "Routine" },
    ];
    if (mode === "dga") {
      info.push({ label: "TDCG", value: `${getTDCG(result)} ppm` });
    }
    return { tx, info };
  }, [transformers]);

  const printResultDetails = useCallback((result, mode = viewResultMode) => {
    if (!result) return;

    const { info } = buildViewResultInfo(result, mode);
    const dpFromFuran = Number(result.dpFromFuran) || estimateDpFromFuran(result.fal2);
    const dpFromMethanol = Number(result.dpFromMethanol) || estimateDpFromMethanol(result.methanol);
    const lifePctFuran = estimateLifetimeUsedPct(dpFromFuran);
    const lifePctMethanol = estimateLifetimeUsedPct(dpFromMethanol);
    const title = mode === "oil" ? "Oil Test Result Details" : "DGA Result Details";
    const subtitle = mode === "oil"
      ? "Oil test sample detail report."
      : "DGA sample detail report.";
    const assessmentText = getAssessmentText(result);
    const cond = getOverallCondition(result);
    const duval = getDuvalFault(result.CH4, result.C2H4, result.C2H2);

    const renderCards = (items, getValue, getColor) => `
      <div class="grid">
        ${items.map((item) => `
          <div class="card">
            <div class="label">${escapeHtml(item.label)}</div>
            <div class="value"${getColor?.(item) ? ` style="color:${getColor(item)}"` : ""}>${escapeHtml(getValue(item))}</div>
          </div>
        `).join("")}
      </div>
    `;

    const infoHtml = renderCards(info, (item) => item.value);
    const oilSectionHtml = OIL_TEST_FORM_SECTIONS.map((section) => `
      <section>
        <h3>${escapeHtml(section.title)}</h3>
        ${renderCards(
          section.fields,
          (item) => item.type === "number" ? formatOilTestValue(item.key, result[item.key], 2) : (result[item.key] || "-")
        )}
      </section>
    `).join("");
    const dpHtml = renderCards(
      [
        { label: "DP from Furan (2-FAL)", value: mode === "oil" ? formatTestValue(dpFromFuran, 0) : dpFromFuran },
        { label: "DP from Methanol", value: mode === "oil" ? formatTestValue(dpFromMethanol, 0) : dpFromMethanol },
      ],
      (item) => item.value
    );

    const lifetimeItems = [
      { label: "Lifetime Used — DP from Furan (2-FAL)", pct: lifePctFuran },
      { label: "Lifetime Used — DP from Methanol", pct: lifePctMethanol },
    ];
    const lifetimeHtml = `
      <div class="lifetime-grid">
        ${lifetimeItems.map(({ label, pct }) => {
          const band = pct != null ? (LIFETIME_BANDS.find((b) => pct <= b.max) || LIFETIME_BANDS[3]) : null;
          return `
            <div class="lifetime-card">
              <div class="label">${escapeHtml(label)}</div>
              ${pct != null ? `
                <div style="margin-top:6px">
                  <span class="lifetime-pct" style="color:${band.color}">${pct}%</span>
                  <span class="lifetime-badge" style="background:${band.color}22;color:${band.color}">${band.label}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${pct}%;background:${band.color}"></div>
                </div>
              ` : `<div class="value">N/A</div>`}
            </div>`;
        }).join("")}
      </div>
      <div class="lifetime-note">Based on reference data: initial DP ≈ 629, end-of-life DP ≈ 166. 2-FAL in ppb via Chendong correlation.</div>
    `;

    const dgaHtml = mode === "dga" ? `
      <section>
        <h3>Status</h3>
        <div class="stack">
          <div class="note"><strong>IEEE Condition:</strong> ${escapeHtml(CONDITION_STYLES[cond].label)}</div>
          <div class="note"><strong>Duval Fault:</strong> ${escapeHtml(duval)} (${escapeHtml(FAULT_LABELS[duval] || "Unknown fault")})</div>
        </div>
      </section>
      <section>
        <h3>Assessment</h3>
        <div class="note">${escapeHtml(assessmentText || "No assessment.")}</div>
      </section>
      <section>
        <h3>Dissolved Gas Analysis (ppm)</h3>
        ${renderCards(
          [...GASES, { key: "O2", label: "O2" }, { key: "N2", label: "N2" }],
          (item) => Number(result[item.key]) || 0,
          (item) => item.color
        )}
      </section>
    ` : `
      <section>
        <h3>Key Oil Indicators</h3>
        ${renderCards(
          ASSET_OIL_RESULT_COLUMNS,
          (column) => formatTestValue(getOilColumnValue(result, column.key), column.digits),
          (column) => column.color
        )}
      </section>
      <section>
        <h3>Notes</h3>
        <div class="note">${escapeHtml(result.notes || "No notes.")}</div>
      </section>
    `;

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; background: #ffffff; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            h2 { margin: 0 0 20px; font-size: 13px; font-weight: 500; color: #6b7280; }
            h3 { margin: 0 0 10px; font-size: 14px; }
            section { margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
            .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; background: #f9fafb; break-inside: avoid; }
            .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
            .value { font-size: 13px; font-weight: 600; color: #111827; white-space: pre-wrap; word-break: break-word; }
            .note { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; background: #f9fafb; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
            .stack { display: grid; gap: 10px; }
            .lifetime-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
            .lifetime-card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; background: #f9fafb; break-inside: avoid; }
            .lifetime-pct { font-size: 20px; font-weight: 700; font-family: monospace; }
            .lifetime-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 999px; margin-left: 6px; }
            .progress-track { height: 6px; background: #e5e7eb; border-radius: 999px; margin-top: 8px; overflow: hidden; }
            .progress-fill { height: 100%; border-radius: 999px; }
            .lifetime-note { font-size: 10px; color: #9ca3af; margin-top: 8px; }
            @media print {
              body { margin: 14px; }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <h2>${escapeHtml(subtitle)}</h2>
          <section>
            <h3>Sample Information</h3>
            ${infoHtml}
          </section>
          ${dgaHtml}
          ${oilSectionHtml}
          <section>
            <h3>Estimate DP (Degree Of Polymerization)</h3>
            ${dpHtml}
          </section>
          <section>
            <h3>Estimated Lifetime Usage</h3>
            ${lifetimeHtml}
          </section>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank", "width=960,height=900");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onafterprint = () => printWindow.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [buildViewResultInfo, getAssessmentText, viewResultMode]);

  const renderResultEditorHeaderFields = () => {
    const selectedTxObj = transformers.find((item) => item.id === resultForm.transformerId);
    const resultSite = selectedTxObj?.site || resultForm._site || "";
    const txAtSite = transformers.filter((item) => item.site === resultSite);

    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-4">
        <Input
          label="Site"
          value={resultSite}
          onChange={(value) => {
            setResultForm((prev) => ({ ...prev, _site: value, transformerId: "" }));
          }}
          options={[...new Set(transformers.map((item) => item.site))].filter(Boolean).map((site) => ({ value: site, label: site }))}
          required
        />
        <Input
          label="Mnemonic / TX No"
          value={resultForm.transformerId}
          onChange={(value) => setResultForm((prev) => ({ ...prev, transformerId: value }))}
          options={txAtSite.map((item) => ({ value: item.id, label: getTxMnemonicOrId(item) }))}
          required
          disabled={!resultSite}
        />
        <Input
          label="Date"
          value={resultForm.date}
          onChange={(value) => setResultForm((prev) => ({ ...prev, date: value }))}
          type="date"
          required
        />
        <Input
          label="Test Type"
          value={resultForm.testType}
          onChange={(value) => setResultForm((prev) => ({ ...prev, testType: value }))}
          options={TEST_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
        />
      </div>
    );
  };

  const renderResultEditorOilSections = () => (
    <>
      {OIL_TEST_FORM_SECTIONS.map((section) => (
        <div key={section.title} className="bg-surface-input border border-border rounded-xl p-3.5 mb-3.5">
          <div className="section-label mb-2.5">
            {section.title}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {section.fields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                value={resultForm[field.key] ?? ""}
                onChange={(value) => setResultForm((prev) => ({ ...prev, [field.key]: value }))}
                type={field.type === "number" ? "number" : "text"}
                step={field.type === "number" ? getOilTestInputStep(field.key, 2) : undefined}
                options={field.key === "copperCorrosive" ? COPPER_CORROSIVE_OPTIONS.map((value) => ({ value, label: value })) : undefined}
                placeholder={field.type === "number" ? "0" : ""}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const renderResultEditorDpSection = () => (
    <div className="bg-surface-input border border-border rounded-xl p-3.5 mb-3.5">
      <div className="section-label mb-2.5">
        Estimate DP (Degree Of Polymerization)
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Input label="DP from Furan (2-FAL)" value={resultDpPreview.dpFromFuran} onChange={() => {}} type="number" disabled />
        <Input label="DP from Methanol" value={resultDpPreview.dpFromMethanol} onChange={() => {}} type="number" disabled />
      </div>
    </div>
  );

  const renderDgaResultEditor = () => (
    <>
      {renderResultEditorHeaderFields()}

      <div className="bg-surface-input border border-border rounded-xl p-3.5 mb-3.5">
        <div className="section-label mb-2.5">
          Dissolved Gas Analysis (ppm)
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          {GASES.map((gas) => (
            <Input
              key={gas.key}
              label={gas.label}
              value={resultForm[gas.key]}
              onChange={(value) => setResultForm((prev) => ({ ...prev, [gas.key]: value }))}
              type="number"
              placeholder="0"
            />
          ))}
          <Input label="O2" value={resultForm.O2} onChange={(value) => setResultForm((prev) => ({ ...prev, O2: value }))} type="number" placeholder="0" />
          <Input label="N2" value={resultForm.N2} onChange={(value) => setResultForm((prev) => ({ ...prev, N2: value }))} type="number" placeholder="0" />
        </div>
      </div>

      {renderResultEditorOilSections()}
      {renderResultEditorDpSection()}

      <Input label="Notes" value={resultForm.notes} onChange={(value) => setResultForm((prev) => ({ ...prev, notes: value }))} placeholder="Any observations..." />
      <div className="flex gap-2 mt-4 justify-end">
        <Btn variant="secondary" onClick={closeResultModal}>Cancel</Btn>
        <Btn onClick={saveResult}>{editResult ? "Update Result" : "Save Result"}</Btn>
      </div>
    </>
  );

  const renderOilResultEditor = () => (
    <>
      {renderResultEditorHeaderFields()}
      {renderResultEditorOilSections()}
      {renderResultEditorDpSection()}

      <Input label="Notes" value={resultForm.notes} onChange={(value) => setResultForm((prev) => ({ ...prev, notes: value }))} placeholder="Any observations..." />
      <div className="flex gap-2 mt-4 justify-end">
        <Btn variant="secondary" onClick={closeResultModal}>Cancel</Btn>
        <Btn onClick={saveResult}>{editResult ? "Update Result" : "Save Result"}</Btn>
      </div>
    </>
  );

  const renderImportDraftOilSections = () => {
    if (!activeImportDraftRow) return null;

    return (
      <>
        {OIL_TEST_FORM_SECTIONS.map((section) => (
          <div key={section.title} className="bg-surface-input border border-border rounded-xl p-3.5">
            <div className="section-label mb-2.5">{section.title}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {section.fields.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  value={activeImportDraftRow[field.key] ?? ""}
                  onChange={(value) => updateImportDraftResultField(importDraftRowIndex, field.key, value)}
                  type={field.type === "number" ? "number" : "text"}
                  step={field.type === "number" ? getOilTestInputStep(field.key, 2) : undefined}
                  options={field.key === "copperCorrosive" ? COPPER_CORROSIVE_OPTIONS.map((value) => ({ value, label: value })) : undefined}
                  placeholder={field.type === "number" ? "0" : ""}
                />
              ))}
            </div>
          </div>
        ))}
      </>
    );
  };

  const renderImportDraftReview = () => {
    if (!importDraft) return null;

    const transformer = importDraft.transformer || emptyTx;
    const matchedResultRows = matchedImportDraftTransformer
      ? results.filter((row) => row.transformerId === matchedImportDraftTransformer.id)
      : [];
    const matchedResultByDate = new Map(matchedResultRows.map((row) => [row.date, row]));
    const importDgaKeys = [...GASES.map((gas) => gas.key), "O2", "N2"];
    const importOilKeys = IMPORTED_RESULT_KEYS.filter((key) => key !== "date" && !importDgaKeys.includes(key));

    return (
      <div className="flex flex-col gap-4">
        <div className="text-primary-dim text-sm leading-6">
          Review the parsed transformer details and imported result rows below. Nothing will be written to the
          database until you click <span className="text-primary font-semibold">Submit Import</span>.
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <div className="bg-surface-input border border-border rounded-xl px-3.5 py-3">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Source File</div>
            <div className="text-primary text-sm font-semibold mt-1">{importDraft.sourceFileName || "Imported report"}</div>
          </div>
          <div className="bg-surface-input border border-border rounded-xl px-3.5 py-3">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Import Target</div>
            <div className="text-primary text-sm font-semibold mt-1">
              {matchedImportDraftTransformer ? "Update existing transformer" : "Create new transformer"}
            </div>
            <div className="text-primary-dim text-xs mt-1">
              {matchedImportDraftTransformer
                ? `${matchedImportDraftTransformer.site || "Unknown Site"} - ${getTxMnemonicOrId(matchedImportDraftTransformer)}`
                : "A new transformer record will be created when you submit."}
            </div>
          </div>
          <div className="bg-surface-input border border-border rounded-xl px-3.5 py-3">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Detected Result Rows</div>
            <div className="text-primary text-sm font-semibold mt-1">
              {importDraft.resultRows?.length || 0} row{(importDraft.resultRows?.length || 0) !== 1 ? "s" : ""}
            </div>
            <div className="text-primary-dim text-xs mt-1">
              Imported rows are merged by sampling date after you confirm.
            </div>
          </div>
        </div>

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="section-label mb-2.5">Transformer Details</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <Input label="Site" value={transformer.site} onChange={(value) => updateImportDraftTransformerField("site", value)} placeholder="e.g. SJ Kenyir" />
            <Input label="Mnemonic" value={transformer.mnemonic} onChange={(value) => updateImportDraftTransformerField("mnemonic", value)} placeholder="e.g. KNYR GT1" />
            <Input label="TX No" value={transformer.name} onChange={(value) => updateImportDraftTransformerField("name", value)} required placeholder="e.g. GT1" />
            <Input label="Serial Number" value={transformer.serialNumber} onChange={(value) => updateImportDraftTransformerField("serialNumber", value)} placeholder="e.g. 712059-1" />
            <Input label="Load mVA" value={transformer.loadMVA} onChange={(value) => updateImportDraftTransformerField("loadMVA", value)} type="number" placeholder="0" />
            <Input label="Voltage/kV" value={transformer.voltage} onChange={(value) => updateImportDraftTransformerField("voltage", value)} options={VOLTAGE_CLASSES} allowCustom />
            <Input label="Brand" value={transformer.brand} onChange={(value) => updateImportDraftTransformerField("brand", value)} options={BRANDS} />
            <Input label="Maker" value={transformer.maker} onChange={(value) => updateImportDraftTransformerField("maker", value)} placeholder="e.g. Hitachi" />
            <Input label="Oil Type" value={transformer.oilType} onChange={(value) => updateImportDraftTransformerField("oilType", value)} options={OIL_TYPES} />
            <Input label="Oil Brand" value={transformer.oilBrand} onChange={handleImportDraftOilBrandSelection} options={oilBrandOptions} />
            <Input label="Paper Type" value={transformer.paperType || DEFAULT_PAPER_TYPE} onChange={(value) => updateImportDraftTransformerField("paperType", value)} options={PAPER_TYPES} />
            <Input label="Year Energize" value={transformer.dateEnergized} onChange={(value) => updateImportDraftTransformerField("dateEnergized", value)} type="date" />
            <Input
              label="ID"
              value={transformer.id}
              onChange={(value) => updateImportDraftTransformerField("id", value)}
              required={Boolean(matchedImportDraftTransformer)}
              disabled={!matchedImportDraftTransformer}
              placeholder={matchedImportDraftTransformer ? "Transformer ID" : "Auto-generated on submit"}
            />
          </div>
          {!matchedImportDraftTransformer && (
            <div className="text-primary-muted text-[11px] mt-2">
              New transformer IDs follow the format <span className="font-mono">TX-DDMMYY-XX</span>.
            </div>
          )}
        </div>

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="section-label">Imported Result Rows</div>
              <div className="text-primary-dim text-xs mt-1">
                Select a row to review and edit the parsed DGA and oil values before saving.
              </div>
            </div>
          </div>

          {importDraft.resultRows?.length ? (
            <div className="flex gap-2 flex-wrap">
              {importDraft.resultRows.map((row, index) => {
                const hasDgaValues = importDgaKeys.some((key) => hasImportedValue(row[key]));
                const hasOilValues = importOilKeys.some((key) => hasImportedValue(row[key]));
                const existingRow = matchedResultByDate.get(row.date);
                const isActive = index === Math.min(importDraftRowIndex, Math.max(importDraft.resultRows.length - 1, 0));

                return (
                  <button
                    key={`${row.date || "row"}-${index}`}
                    type="button"
                    onClick={() => setImportDraftRowIndex(index)}
                    className="rounded-xl border px-3 py-2 text-left transition-colors min-w-[170px]"
                    style={{
                      borderColor: isActive ? "var(--accent)" : "var(--border)",
                      background: isActive ? "var(--primary-soft)" : "var(--bg-card)",
                    }}
                  >
                    <div className="text-primary text-sm font-semibold">{row.date || `Row ${index + 1}`}</div>
                    <div className="text-primary-dim text-[11px] mt-1">
                      {[hasDgaValues ? "DGA" : null, hasOilValues ? "Oil" : null, existingRow ? "Update existing" : "New row"].filter(Boolean).join(" | ")}
                    </div>
                    <div className="text-primary-muted text-[11px] mt-1">
                      {countImportedResultFields(row)} imported field{countImportedResultFields(row) !== 1 ? "s" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="alert-warning">
              No DGA or oil result rows were detected in this file. You can still correct the transformer details and
              submit the transformer record.
            </div>
          )}
        </div>

        {activeImportDraftRow && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              <Input
                label="Date"
                value={activeImportDraftRow.date}
                onChange={(value) => updateImportDraftResultField(importDraftRowIndex, "date", value)}
                type="date"
                required
              />
              <Input
                label="Test Type"
                value={activeImportDraftRow.testType}
                onChange={(value) => updateImportDraftResultField(importDraftRowIndex, "testType", value)}
                options={TEST_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
              />
            </div>

            <div className="bg-surface-input border border-border rounded-xl p-3.5">
              <div className="section-label mb-2.5">Dissolved Gas Analysis (ppm)</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                {GASES.map((gas) => (
                  <Input
                    key={gas.key}
                    label={gas.label}
                    value={activeImportDraftRow[gas.key]}
                    onChange={(value) => updateImportDraftResultField(importDraftRowIndex, gas.key, value)}
                    type="number"
                    placeholder="0"
                  />
                ))}
                <Input label="O2" value={activeImportDraftRow.O2} onChange={(value) => updateImportDraftResultField(importDraftRowIndex, "O2", value)} type="number" placeholder="0" />
                <Input label="N2" value={activeImportDraftRow.N2} onChange={(value) => updateImportDraftResultField(importDraftRowIndex, "N2", value)} type="number" placeholder="0" />
              </div>
            </div>

            {renderImportDraftOilSections()}

            <div className="bg-surface-input border border-border rounded-xl p-3.5">
              <div className="section-label mb-2.5">Estimate DP (Degree Of Polymerization)</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                <Input label="DP from Furan (2-FAL)" value={importDraftDpPreview.dpFromFuran} onChange={() => {}} type="number" disabled />
                <Input label="DP from Methanol" value={importDraftDpPreview.dpFromMethanol} onChange={() => {}} type="number" disabled />
              </div>
            </div>

            <Input
              label="Notes"
              value={activeImportDraftRow.notes}
              onChange={(value) => updateImportDraftResultField(importDraftRowIndex, "notes", value)}
              placeholder="Any observations..."
            />
          </>
        )}

        <div className="flex gap-2 mt-1 justify-end flex-wrap">
          <Btn variant="secondary" onClick={() => { resetImportDraft(); setImportError(""); }} disabled={importingAsset}>Back to Upload</Btn>
          <Btn variant="secondary" onClick={closeImportModal} disabled={importingAsset}>Cancel</Btn>
          <Btn onClick={submitImportDraft} disabled={importingAsset}>
            <span className="inline-flex items-center gap-1.5">
              {importingAsset ? <Spinner size={14} /> : <Upload size={14} />}
              {importingAsset ? "Submitting..." : "Submit Import"}
            </span>
          </Btn>
        </div>
      </div>
    );
  };

  const renderDgaResultDetail = () => {
    if (!viewResult) return null;
    const { info } = buildViewResultInfo(viewResult, "dga");
    const cond = getOverallCondition(viewResult);
    const duval = getDuvalFault(viewResult.CH4, viewResult.C2H4, viewResult.C2H2);
    const dpFromFuran = Number(viewResult.dpFromFuran) || estimateDpFromFuran(viewResult.fal2);
    const dpFromMethanol = Number(viewResult.dpFromMethanol) || estimateDpFromMethanol(viewResult.methanol);
    const lifePctFuran = estimateLifetimeUsedPct(dpFromFuran);
    const lifePctMethanol = estimateLifetimeUsedPct(dpFromMethanol);
    const assessmentText = getAssessmentText(viewResult);

    return (
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
          {info.map((item) => (
            <div key={item.label} className="bg-surface-input border border-border rounded-lg px-3 py-2.5">
              <div className="text-primary-muted text-[10px] uppercase tracking-wider">{item.label}</div>
              <div className="text-primary text-xs font-semibold mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Badge condition={cond} />
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border" style={{ background: `${FAULT_COLORS[duval]}22`, borderColor: FAULT_COLORS[duval], color: FAULT_COLORS[duval] }}>
            Duval {duval}
          </span>
        </div>

        <div className="bg-surface-input border border-border rounded-lg p-3">
          <div className="text-primary-muted text-[10px] uppercase tracking-wider mb-1">Assessment</div>
          <div className="text-primary-dim text-xs leading-relaxed">{assessmentText || "No assessment."}</div>
        </div>

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="section-label mb-2.5">Dissolved Gas Analysis (ppm)</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            {GASES.map((g) => (
              <div key={g.key} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                <div className="text-primary-muted text-[10px]">{g.label}</div>
                <div className="text-primary text-[13px] font-mono mt-0.5">{Number(viewResult[g.key]) || 0}</div>
              </div>
            ))}
            {["O2", "N2"].map((item) => (
              <div key={item} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                <div className="text-primary-muted text-[10px]">{item}</div>
                <div className="text-primary text-[13px] font-mono mt-0.5">{Number(viewResult[item]) || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {OIL_TEST_FORM_SECTIONS.map((section) => (
          <div key={section.title} className="bg-surface-input border border-border rounded-xl p-3.5">
            <div className="section-label mb-2.5">{section.title}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              {section.fields.map((item) => (
                <div key={item.key} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                  <div className="text-primary-muted text-[10px]">{item.label}</div>
                  <div className={`text-primary text-[13px] mt-0.5 ${item.type === "number" ? "font-mono" : ""}`}>
                    {item.type === "number" ? formatOilTestValue(item.key, viewResult[item.key], 2) : (viewResult[item.key] || "-")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="section-label mb-2.5">Estimate DP (Degree Of Polymerization)</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
            {[["DP from Furan (2-FAL)", dpFromFuran], ["DP from Methanol", dpFromMethanol]].map(([label, val]) => (
              <div key={label} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                <div className="text-primary-muted text-[10px]">{label}</div>
                <div className="text-primary text-[13px] font-mono mt-0.5">{val}</div>
              </div>
            ))}
          </div>
        </div>

        <LifetimeUsageSection lifePctFuran={lifePctFuran} lifePctMethanol={lifePctMethanol} />

        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={closeViewResultModal}>Close</Btn>
          <Btn variant="secondary" onClick={() => printResultDetails(viewResult, "dga")}>
            <span className="inline-flex items-center gap-1.5"><Printer size={13} /> Print</span>
          </Btn>
          <Btn onClick={() => { closeViewResultModal(); openEditResultModal(viewResult, "dga"); }}>Edit This Result</Btn>
        </div>
      </div>
    );
  };

  const renderOilResultDetail = () => {
    if (!viewResult) return null;
    const { info } = buildViewResultInfo(viewResult, "oil");
    const dpFromFuran = Number(viewResult.dpFromFuran) || estimateDpFromFuran(viewResult.fal2);
    const dpFromMethanol = Number(viewResult.dpFromMethanol) || estimateDpFromMethanol(viewResult.methanol);
    const lifePctFuran = estimateLifetimeUsedPct(dpFromFuran);
    const lifePctMethanol = estimateLifetimeUsedPct(dpFromMethanol);

    return (
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
          {info.map((item) => (
            <div key={item.label} className="bg-surface-input border border-border rounded-lg px-3 py-2.5">
              <div className="text-primary-muted text-[10px] uppercase tracking-wider">{item.label}</div>
              <div className="text-primary text-xs font-semibold mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="section-label mb-2.5">Key Oil Indicators</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            {ASSET_OIL_RESULT_COLUMNS.map((column) => (
              <div key={column.key} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                <div className="text-primary-muted text-[10px]">{column.label}</div>
                <div className="text-[13px] font-mono mt-0.5" style={{ color: column.color }}>
                  {formatTestValue(getOilColumnValue(viewResult, column.key), column.digits)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {OIL_TEST_FORM_SECTIONS.map((section) => (
          <div key={section.title} className="bg-surface-input border border-border rounded-xl p-3.5">
            <div className="section-label mb-2.5">{section.title}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              {section.fields.map((item) => (
                <div key={item.key} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                  <div className="text-primary-muted text-[10px]">{item.label}</div>
                  <div className={`text-primary text-[13px] mt-0.5 ${item.type === "number" ? "font-mono" : ""}`}>
                    {item.type === "number" ? formatOilTestValue(item.key, viewResult[item.key], 2) : (viewResult[item.key] || "-")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-surface-input border border-border rounded-xl p-3.5">
          <div className="section-label mb-2.5">Estimate DP (Degree Of Polymerization)</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
            {[["DP from Furan (2-FAL)", dpFromFuran], ["DP from Methanol", dpFromMethanol]].map(([label, val]) => (
              <div key={label} className="bg-surface-card border border-border rounded-md px-2.5 py-2">
                <div className="text-primary-muted text-[10px]">{label}</div>
                <div className="text-primary text-[13px] font-mono mt-0.5">{formatTestValue(val, 0)}</div>
              </div>
            ))}
          </div>
        </div>

        <LifetimeUsageSection lifePctFuran={lifePctFuran} lifePctMethanol={lifePctMethanol} />

        <div className="bg-surface-input border border-border rounded-lg p-3">
          <div className="text-primary-muted text-[10px] uppercase tracking-wider mb-1">Notes</div>
          <div className="text-primary-dim text-xs leading-relaxed">{viewResult.notes || "No notes."}</div>
        </div>

        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={closeViewResultModal}>Close</Btn>
          <Btn variant="secondary" onClick={() => printResultDetails(viewResult, "oil")}>
            <span className="inline-flex items-center gap-1.5"><Printer size={13} /> Print</span>
          </Btn>
          <Btn onClick={() => { closeViewResultModal(); openEditResultModal(viewResult, "oil"); }}>Edit This Result</Btn>
        </div>
      </div>
    );
  };

  const resetUserForm = () => {
    setUserEditId("");
    setUserForm({ name: "", email: "", password: "", status: "approved" });
  };

  const loadManagedUsers = useCallback(async () => {
    if (!isSuperadmin || !user?.id) return;
    setUserMgmtLoading(true);
    setUserMgmtError("");
    try {
      const payload = await api.listUsers(user.id);
      setManagedUsers(payload?.items || []);
    } catch (err) {
      setUserMgmtError(err.message || "Failed to load users.");
    } finally {
      setUserMgmtLoading(false);
    }
  }, [isSuperadmin, user?.id]);

  const openUserManagementModal = async () => {
    setShowUserMgmt(true);
    resetUserForm();
    await loadManagedUsers();
  };

  const startEditUser = (managedUser) => {
    setUserEditId(managedUser.id);
    setUserMgmtError("");
    setUserForm({
      name: managedUser.name || "",
      email: managedUser.email || "",
      password: "",
      status: managedUser.status || "approved",
    });
  };

  const saveManagedUser = async () => {
    if (!user?.id) return;
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setUserMgmtError("Name and email are required.");
      return;
    }
    if (!userEditId && (!userForm.password || userForm.password.length < 6)) {
      setUserMgmtError("Password must be at least 6 characters for new users.");
      return;
    }

    setUserMgmtLoading(true);
    setUserMgmtError("");
    try {
      if (userEditId) {
        await api.updateUserByAdmin(user.id, userEditId, {
          name: userForm.name,
          email: userForm.email,
          status: userForm.status,
          ...(userForm.password ? { password: userForm.password } : {}),
        });
      } else {
        await api.createUserByAdmin(user.id, {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
        });
      }
      resetUserForm();
      await loadManagedUsers();
    } catch (err) {
      setUserMgmtError(err.message || "Failed to save user.");
    } finally {
      setUserMgmtLoading(false);
    }
  };

  const approveUser = async (targetUserId) => {
    if (!user?.id) return;
    setUserMgmtLoading(true);
    setUserMgmtError("");
    try {
      await api.approveUserByAdmin(user.id, targetUserId);
      await loadManagedUsers();
    } catch (err) {
      setUserMgmtError(err.message || "Failed to approve user.");
    } finally {
      setUserMgmtLoading(false);
    }
  };

  const deleteUser = async (managedUser) => {
    if (!user?.id) return;
    if (!window.confirm(`Delete user ${managedUser.name}?`)) return;
    setUserMgmtLoading(true);
    setUserMgmtError("");
    try {
      await api.deleteUserByAdmin(user.id, managedUser.id);
      if (userEditId === managedUser.id) {
        resetUserForm();
      }
      await loadManagedUsers();
    } catch (err) {
      setUserMgmtError(err.message || "Failed to delete user.");
    } finally {
      setUserMgmtLoading(false);
    }
  };

  // ============================================================
  // ML PREDICTION HANDLER
  // ============================================================
  const runSingleModel = useCallback(async (modelId, tx, txResults, selectedTests) => {
    if (modelId === "linear") {
      const baseDate = new Date(txResults[0].date).getTime();
      const testForecasts = {};
      selectedTests.forEach((testKey) => {
        const points = txResults.map(r => [(new Date(r.date).getTime() - baseDate) / (30 * 24 * 3600000), Number(r[testKey]) || 0]);
        const { slope, intercept } = linearRegress(points);
        const lastMonth = points[points.length - 1][0];
        const forecast = [];
        for (let m = 0; m <= predMonths; m++) {
          const month = lastMonth + m;
          const predicted = Math.max(0, slope * month + intercept);
          const lastDate = new Date(txResults[txResults.length - 1].date);
          lastDate.setMonth(lastDate.getMonth() + m);
          forecast.push({ month: m, date: lastDate.toISOString().split("T")[0], value: Math.round(predicted * 100) / 100, lower: Math.round(Math.max(0, predicted * 0.8) * 100) / 100, upper: Math.round(predicted * 1.2 * 100) / 100 });
        }
        testForecasts[testKey] = {
          gas: testKey,
          current_value: Number(txResults[txResults.length - 1][testKey]) || 0,
          forecasted_values: forecast,
          trend: slope > 0.5 ? "increasing" : slope < -0.5 ? "decreasing" : "stable",
          slope_per_month: Math.round(slope * 1000) / 1000,
          model_confidence: 0.3,
          diagnostics: { method: "linear_regression" },
        };
      });
      return {
        transformer_id: predictionTx,
        model_type: "linear",
        forecasts: testForecasts,
        overall_risk: "low",
        risk_summary: "Linear regression estimate - use ARIMA/LSTM for better accuracy.",
        recommendation: "Connect Python backend for ARIMA/LSTM/XGBoost/LightGBM/Fault RF predictions with confidence intervals.",
        historicalData: txResults,
      };
    } else if (modelId === "nature_hybrid") {
      const resp = await api.predictNatureHybrid(tx, txResults, predMonths, selectedTests);
      return { ...resp, historicalData: txResults };
    } else if (modelId === "arima") {
      const resp = await api.predictArima(tx, txResults, predMonths, selectedTests);
      return { ...resp, historicalData: txResults };
    } else if (modelId === "lstm") {
      const resp = await api.predictLstm(tx, txResults, predMonths, selectedTests);
      return { ...resp, historicalData: txResults };
    } else if (modelId === "xgboost") {
      const resp = await api.predictXgboost(tx, txResults, predMonths, selectedTests);
      return { ...resp, historicalData: txResults };
    } else if (modelId === "lightgbm") {
      const resp = await api.predictLightgbm(tx, txResults, predMonths, selectedTests);
      return { ...resp, historicalData: txResults };
    } else if (modelId === "fault_rf") {
      const resp = await api.predictFaultRf(tx, txResults, predMonths);
      return { ...resp, historicalData: txResults };
    }
    return null;
  }, [predictionTx, predMonths]);

  const runMLPrediction = useCallback(async () => {
    if (!predictionTx) return;
    const hasFaultRf = predModels.includes("fault_rf");
    const selectedTests = hasFaultRf && predModels.length === 1 ? DEFAULT_PREDICTION_TEST_KEYS : activePredTests;
    if (!selectedTests.length) {
      setMlError("Select at least one test parameter before running prediction.");
      return;
    }
    const tx = transformers.find(t => t.id === predictionTx);
    const txResults = results.filter(r => r.transformerId === predictionTx).sort((a, b) => a.date.localeCompare(b.date));
    if (!tx || txResults.length === 0) {
      setMlError("Need at least 1 DGA record for prediction.");
      return;
    }

    setMlLoading(true);
    setMlError(null);
    setMlPredictions(null);
    setMlCompareResults(null);

    try {
      const allResults = {};
      const errors = [];
      for (const modelId of predModels) {
        try {
          const result = await runSingleModel(modelId, tx, txResults, selectedTests);
          if (result) allResults[modelId] = result;
        } catch (err) {
          errors.push(`${modelId.toUpperCase()}: ${err.message || "failed"}`);
        }
      }

      if (Object.keys(allResults).length === 0) {
        setMlError(errors.join("; ") || "All models failed.");
        return;
      }
      if (errors.length > 0) {
        setMlError(`Some models failed: ${errors.join("; ")}`);
      }

      // Set the first successful result as primary (for profile card, risk banner, fault_rf)
      const firstKey = predModels.find(m => allResults[m]) || Object.keys(allResults)[0];
      setMlPredictions(allResults[firstKey]);
      setMlCompareResults(Object.keys(allResults).length > 1 ? allResults : null);
    } catch (err) {
      setMlError(err.message || "ML prediction failed.");
    } finally {
      setMlLoading(false);
    }
  }, [predictionTx, predModels, predMonths, transformers, results, activePredTests, runSingleModel]);

  // ============================================================
  // ANOMALY DETECTION HANDLER
  // ============================================================
  const getAnomalyHistoryForMode = useCallback((transformerId, mode = "dga") => (
    results
      .filter((row) => row.transformerId === transformerId && hasAnomalyMeasurementData(row, mode))
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [results]);

  const runAnomalyDetection = useCallback(async () => {
    if (!anomalyTx) return;
    const anomalyMeta = ANOMALY_MODE_OPTIONS.find((option) => option.key === anomalyMode) || ANOMALY_MODE_OPTIONS[0];
    const tx = transformers.find(t => t.id === anomalyTx);
    const txResults = getAnomalyHistoryForMode(anomalyTx, anomalyMode);
    if (!tx || txResults.length < 5) {
      setAnomalyError(anomalyMeta.minRecordsMessage);
      return;
    }
    setAnomalyLoading(true);
    setAnomalyError(null);
    setAnomalyResults(null);
    try {
      const resp = await api.detectAnomalies(tx, txResults, 0.1, anomalyMode);
      setAnomalyResults(resp);
    } catch (err) {
      setAnomalyError(err.message || "Anomaly detection failed.");
    } finally {
      setAnomalyLoading(false);
    }
  }, [anomalyMode, anomalyTx, getAnomalyHistoryForMode, transformers]);

  // ============================================================
  // CLUSTERING (with backend fallback)
  // ============================================================
  const runClustering = useCallback(async () => {
    const txWithResults = transformers.filter(t => latestResults[t.id]);
    if (txWithResults.length < clusterK) return;

    if (backendOnline && hasClustering) {
      try {
        const latestMap = {};
        txWithResults.forEach(t => {
          const r = latestResults[t.id];
          latestMap[t.id] = { date: r.date, H2: r.H2, CH4: r.CH4, C2H2: r.C2H2, C2H4: r.C2H4, C2H6: r.C2H6, CO: r.CO, CO2: r.CO2 };
        });
        const resp = await api.cluster(txWithResults, latestMap, clusterK);
        // Map backend response to component format
        setClusterResults({
          data: resp.assignments.map(a => {
            const tx = txWithResults.find(t => t.id === a.transformer_id);
            const r = latestResults[a.transformer_id];
            return {
              ...tx, cluster: a.cluster, result: r,
              age: parseFloat(getAge(tx.dateEnergized)),
              tdcg: getTDCG(r),
              duval: getDuvalFault(r.CH4, r.C2H4, r.C2H2),
              pca_x: a.pca_x, pca_y: a.pca_y, pca_z: a.pca_z,
            };
          }),
          k: clusterK,
          cluster_stats: resp.cluster_stats,
          pca_variance: resp.pca_variance_explained,
          source: "python",
        });
      } catch {
        // Fall back to JS clustering
        runJsClustering(txWithResults);
      }
    } else {
      runJsClustering(txWithResults);
    }
  }, [transformers, latestResults, clusterK, backendOnline, hasClustering]);

  const runJsClustering = (txWithResults) => {
    const features = txWithResults.map(t => {
      const r = latestResults[t.id];
      const age = parseFloat(getAge(t.dateEnergized));
      return [r.H2, r.CH4, r.C2H2, r.C2H4, r.C2H6, r.CO, r.CO2, age, t.loadMVA || 0];
    });
    const { assignments, centroids } = kMeans(features, clusterK);
    setClusterResults({
      data: txWithResults.map((t, i) => ({
        ...t, cluster: assignments[i], result: latestResults[t.id],
        age: parseFloat(getAge(t.dateEnergized)),
        tdcg: getTDCG(latestResults[t.id]),
        duval: getDuvalFault(latestResults[t.id].CH4, latestResults[t.id].C2H4, latestResults[t.id].C2H2),
      })),
      centroids, k: clusterK, source: "javascript",
    });
  };

  // ============================================================
  // BACKEND STATUS INDICATOR
  // ============================================================
  const capabilityStatusText = (available) => (available ? "Available" : "Not installed");

  const BackendIndicator = () => (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span
        className="w-2 h-2 rounded-full"
        style={{
          background: backendStatus === null ? "var(--warning)" : backendOnline ? "var(--success)" : "var(--danger)",
          boxShadow: backendOnline ? "0 0 6px var(--success)" : "none",
        }}
      />
      <span className="text-primary-muted">
        {backendStatus === null ? "Checking backend..." : backendOnline ? "Python ML Backend Online" : "Backend Offline - JS Fallback"}
      </span>
      {backendOnline && (
        <span className="text-primary-muted text-[10px] max-w-[560px] leading-relaxed">
          [Nature Hybrid: {capabilityStatusText(hasNatureHybrid)} | ARIMA: {capabilityStatusText(hasArima)} | LSTM: {capabilityStatusText(hasLstm)} | XGBoost: {capabilityStatusText(hasXgboost)} | LightGBM: {capabilityStatusText(hasLightgbm)} | Fault RF: {capabilityStatusText(hasFaultPrediction)} | Clustering: {capabilityStatusText(hasClustering)} | SHAP Similarity: {capabilityStatusText(hasShapSimilarity)}]
        </span>
      )}
    </div>
  );

  const DesktopStoragePanel = () => {
    if (!isDesktopRuntime) return null;

    const databasePath = desktopStorageInfo?.databasePath || backendStatus?.storage?.database_url || "";
    const runtimeLabel = desktopStorageInfo?.mode === "packaged" ? "Packaged Electron app" : "Electron development mode";

    return (
      <div className="glass-card p-4" style={{ borderColor: "var(--accent)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[260px] flex-1">
            <div className="text-primary text-sm font-semibold">Desktop transformer database</div>
            <div className="text-primary-dim text-xs mt-1 leading-relaxed">
              Transformer add, edit, and delete actions are saved to the local SQLite database used by Electron.
            </div>
            <div className="text-primary-muted text-[11px] mt-2">{runtimeLabel}</div>
            <div className="mt-2 rounded-lg px-3 py-2 text-[11px] font-mono break-all" style={{ background: "var(--bg-input)", color: "var(--accent)" }}>
              {databasePath || "Loading database location..."}
            </div>
            {desktopStorageError && <div className="alert-error mt-3">{desktopStorageError}</div>}
          </div>
          <Btn size="sm" variant="secondary" onClick={openDesktopStorageDirectory}>
            Open DB Folder
          </Btn>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <div className="flex flex-col gap-5 animate-fade-in">
      <DesktopStoragePanel />
      <div className="flex gap-3 flex-wrap">
        <Stat label="Total Transformers" value={transformers.length} sub={`${sites.length} sites`} />
        <Stat label="Good Condition" value={conditionSummary.good} color="var(--success)" />
        <Stat label="Fair" value={conditionSummary.fair} color="var(--accent)" />
        <Stat label="Poor / V.Poor" value={conditionSummary.poor + conditionSummary.veryPoor} color="var(--danger)" sub={conditionSummary.veryPoor > 0 ? `${conditionSummary.veryPoor} critical` : ""} />
        <Stat label="Total DGA Records" value={results.length} />
      </div>

      <div className="flex gap-4 flex-wrap">
        <Card variant="glass" className="p-5 flex-1 min-w-[320px]">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Fleet Condition Overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 18, right: 24, bottom: 18, left: 24 }}>
              <Pie
                data={[
                  { name: "Good", value: conditionSummary.good, fill: "#4ade80" },
                  { name: "Fair", value: conditionSummary.fair, fill: "#60a5fa" },
                  { name: "Poor", value: conditionSummary.poor, fill: "#fbbf24" },
                  { name: "V.Poor", value: conditionSummary.veryPoor, fill: "#f87171" },
                ].filter(d => d.value > 0)}
                cx="50%"
                cy="52%"
                innerRadius={55}
                outerRadius={82}
                paddingAngle={3}
                dataKey="value"
                label={({ cx, cy, midAngle, outerRadius, name, value, fill }) => {
                  const radian = Math.PI / 180;
                  const labelRadius = outerRadius + 10;
                  const x = cx + labelRadius * Math.cos(-midAngle * radian);
                  const y = cy + labelRadius * Math.sin(-midAngle * radian);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={fill}
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {`${name}: ${value}`}
                    </text>
                  );
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--ui-popover) / 0.95)",
                  border: "1px solid hsl(var(--ui-border))",
                  color: "hsl(var(--ui-foreground))",
                  borderRadius: 8,
                  backdropFilter: "blur(12px)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card variant="glass" className="p-5 flex-1 min-w-[320px]">
          <h3 className="text-sm font-semibold mb-4 text-foreground">By Voltage Class</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={VOLTAGE_CLASSES.map(v => ({ voltage: v, count: transformers.filter(t => t.voltage === v).length }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ui-border))" />
              <XAxis dataKey="voltage" tick={{ fill: "hsl(var(--ui-muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--ui-muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--ui-popover) / 0.95)",
                  border: "1px solid hsl(var(--ui-border))",
                  color: "hsl(var(--ui-foreground))",
                  borderRadius: 8,
                  backdropFilter: "blur(12px)",
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--ui-brand))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card variant="glass" className="p-5">
        <h3 className="text-sm font-semibold mb-4 text-foreground">By Maker / Manufacturer</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={(() => {
            const counts = {};
            transformers.forEach(t => { const b = t.brand || "Unknown"; counts[b] = (counts[b] || 0) + 1; });
            return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([maker, count]) => ({ maker, count }));
          })()}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--ui-border))" />
            <XAxis dataKey="maker" tick={{ fill: "hsl(var(--ui-muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--ui-muted-foreground))", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--ui-popover) / 0.95)",
                border: "1px solid hsl(var(--ui-border))",
                color: "hsl(var(--ui-foreground))",
                borderRadius: 8,
                backdropFilter: "blur(12px)",
              }}
            />
            <Bar dataKey="count" fill="hsl(258 85% 65%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card variant="glass" className="p-5">
        <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
          <TriangleAlert size={16} className="text-warning" />
          Transformers Requiring Attention
        </h3>
        {transformers.filter(t => {
          const r = latestResults[t.id];
          return r && ["poor", "veryPoor"].includes(getOverallCondition(r));
        }).map(t => {
          const r = latestResults[t.id];
          const cond = getOverallCondition(r);
          return (
            <div key={t.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
              <Badge condition={cond} />
              <span className="text-[13px] font-medium text-foreground">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.site} | {t.voltage}</span>
              <span className="text-xs text-muted-foreground ml-auto">TDCG: {getTDCG(r)} ppm</span>
              <span className="text-xs text-foreground/70">Duval: {FAULT_LABELS[getDuvalFault(r.CH4, r.C2H4, r.C2H2)]}</span>
            </div>
          );
        })}
        {transformers.filter(t => latestResults[t.id] && ["poor", "veryPoor"].includes(getOverallCondition(latestResults[t.id]))).length === 0 &&
          <div className="text-sm text-emerald-400 flex items-center gap-2 py-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            All transformers in acceptable condition
          </div>
        }
      </Card>

      <Card variant="glass" className="p-5">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Site Summary</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {sites.map(site => {
            const siteTx = transformers.filter(t => t.site === site);
            const worst = siteTx.reduce((w, t) => {
              const r = latestResults[t.id];
              if (!r) return w;
              const c = getOverallCondition(r);
              const order = { good: 0, fair: 1, poor: 2, veryPoor: 3 };
              return order[c] > order[w] ? c : w;
            }, "good");
            return (
              <div key={site} className="rounded-lg p-3 border border-border bg-card/40 backdrop-blur-sm hover:border-brand/40 hover:bg-muted/30 transition-all duration-150">
                <div className="text-[13px] font-semibold mb-1 text-foreground">{site}</div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{siteTx.length} transformer{siteTx.length !== 1 ? "s" : ""}</span>
                  <Badge condition={worst} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );

  // ============================================================
  // RENDER: ASSETS
  // ============================================================
  const renderAssets = () => (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="glass-card p-4" style={{ overflow: "visible" }}>
        <div className="flex justify-between items-center flex-wrap gap-2.5">
          <div className="flex gap-2 flex-wrap items-center">
            <Input value={searchQuery} onChange={setSearchQuery} placeholder="Search name, mnemonic, serial no..." style={{ minWidth: 220 }} />
            <SearchableSelect
              value={filterSite}
              onChange={setFilterSite}
              placeholder="All Sites"
              options={["", ...sites].map((site) => ({ value: site, label: site || "All Sites" }))}
              className="min-w-[140px]"
            />
            <SearchableSelect
              value={filterVoltage}
              onChange={setFilterVoltage}
              placeholder="All Voltages"
              options={["", ...VOLTAGE_CLASSES].map((voltage) => ({ value: voltage, label: voltage || "All Voltages" }))}
              className="min-w-[120px]"
            />
            <SearchableSelect
              value={filterBrand}
              onChange={setFilterBrand}
              placeholder="All Brands"
              options={["", ...BRANDS].map((brand) => ({ value: brand, label: brand || "All Brands" }))}
              className="min-w-[120px]"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Btn variant="secondary" onClick={() => { setImportError(""); setShowImportModal(true); }}>
              <span className="inline-flex items-center gap-1.5">
                <Upload size={14} />
                Import
              </span>
            </Btn>
            <Btn onClick={() => { setTxForm({ ...emptyTx, id: generateNextTransformerId(transformers) }); setEditTx(null); setShowAddTx(true); }}>+ Add Transformer</Btn>
          </div>
        </div>
      </div>
      <div className="text-primary-muted text-xs px-1">
        Showing {pagedAssetSiteGroups.length} of {assetSiteGroups.length} site{assetSiteGroups.length !== 1 ? "s" : ""} ({filteredTx.length} transformer{filteredTx.length !== 1 ? "s" : ""} total) &mdash; Page {assetSitePage} of {assetSiteTotalPages}
      </div>
      {showAddTx && (
        <div className="glass-card p-5" style={{ borderColor: "var(--accent)" }}>
          <h3 className="text-accent text-sm mb-4">{editTx ? "Edit" : "New"} Transformer</h3>
          <div className="grid grid-cols-6 gap-3">
            <Input label="Site" value={txForm.site} onChange={v => setTxForm(p => ({ ...p, site: v }))} placeholder="e.g. Melawati Mall" />
            <Input label="Mnemonic" value={txForm.mnemonic} onChange={v => setTxForm(p => ({ ...p, mnemonic: v }))} placeholder="e.g. MPT1" />
            <Input label="TX No" value={txForm.name} onChange={v => setTxForm(p => ({ ...p, name: v }))} required placeholder="e.g. T1" />
            <Input label="Serial Number" value={txForm.serialNumber} onChange={v => setTxForm(p => ({ ...p, serialNumber: v }))} placeholder="e.g. P/220/2014/30563" />
            <Input label="Load mVA" value={txForm.loadMVA} onChange={v => setTxForm(p => ({ ...p, loadMVA: v }))} type="number" />
            <Input label="Voltage/kV" value={txForm.voltage} onChange={v => setTxForm(p => ({ ...p, voltage: v }))} options={VOLTAGE_CLASSES} allowCustom />
          </div>
          <div className="grid grid-cols-6 gap-3 mt-3">
            <Input label="Brand" value={txForm.brand} onChange={v => setTxForm(p => ({ ...p, brand: v }))} options={BRANDS} />
            <Input label="Maker" value={txForm.maker} onChange={v => setTxForm(p => ({ ...p, maker: v }))} placeholder="e.g. ABB Power Grids" />
            <Input label="Oil Type" value={txForm.oilType} onChange={v => setTxForm(p => ({ ...p, oilType: v }))} options={OIL_TYPES} />
            <Input label="Oil Brand" value={txForm.oilBrand} onChange={handleOilBrandSelection} options={oilBrandOptions} />
            <Input label="Paper Type" value={txForm.paperType || DEFAULT_PAPER_TYPE} onChange={v => setTxForm(p => ({ ...p, paperType: v }))} options={PAPER_TYPES} />
            <Input label="Year Energize" value={txForm.dateEnergized} onChange={v => setTxForm(p => ({ ...p, dateEnergized: v }))} type="date" />
            <Input
              label="ID"
              value={txForm.id}
              onChange={v => setTxForm(p => ({ ...p, id: v }))}
              required={Boolean(editTx)}
              disabled={!editTx}
              placeholder={editTx ? "Transformer ID" : "Auto-generated on save"}
            />
          </div>
          <div className="text-primary-muted text-[11px] mt-2">
            Oil Brand uses the master catalog below so diagnostics, AI assessment, and prediction similarity stay aligned.
          </div>
          <div className="text-primary-muted text-[11px] mt-1">
            Paper Type is used as transformer metadata so paper-ageing context and ML similarity stay more accurate.
          </div>
          {!editTx && (
            <div className="text-primary-muted text-[11px] mt-1">
              New transformer IDs are generated automatically in the format <span className="font-mono">TX-DDMMYY-XX</span>.
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Btn onClick={saveTx}>{editTx ? "Update" : "Save"}</Btn>
            <Btn variant="secondary" onClick={() => { setShowAddTx(false); setEditTx(null); setTxForm(emptyTx); }}>Cancel</Btn>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {pagedAssetSiteGroups.map(group => (
          <div key={group.site} className="glass-card overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
              onClick={() => setExpandedSites(prev => ({ ...prev, [`asset:${group.site}`]: !prev[`asset:${group.site}`] }))}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>{group.site}</span>
                <span className="text-primary-muted text-xs">({group.items.length} transformer{group.items.length !== 1 ? "s" : ""})</span>
              </div>
              <span className="text-primary-muted text-xs">{expandedSites[`asset:${group.site}`] ? "▲" : "▼"}</span>
            </button>
            {expandedSites[`asset:${group.site}`] && (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr className="border-b-2 border-border">
                    {["Mnemonic", "TX No", "Serial Number", "Brand/Maker", "Oil", "Voltage", "MVA", "Age (yrs)", "Condition", "TDCG", "Actions"].map(h => (
                      <th key={`${group.site}-${h}`} className="table-header">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {group.items.map(t => {
                      const r = latestResults[t.id];
                      const cond = r ? getOverallCondition(r) : "unknown";
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-border cursor-pointer hover:bg-surface-hover transition-colors"
                          onClick={() => {
                            if (assetModalTxId === t.id) {
                              setAssetModalTxId(null);
                              if (selectedTx === t.id) setSelectedTx(null);
                              return;
                            }
                            setSelectedTx(t.id);
                            setAssetModalTxId(t.id);
                            setAssetDetailView("dga");
                          }}
                        >
                          <td className="table-cell font-mono text-xs" style={{ color: "var(--accent)" }}>{t.mnemonic}</td>
                          <td className="table-cell text-primary font-medium">{t.name}</td>
                          <td className="table-cell font-mono text-xs">{t.serialNumber}</td>
                          <td className="table-cell">{t.brand}<br /><span className="text-[11px] text-primary-muted">{t.maker}</span></td>
                          <td className="table-cell text-[11px]">
                            <div>{t.oilType || "-"}</div>
                            <div className="text-[11px] text-primary-muted">{t.oilBrand || "Oil brand not set"}</div>
                            <div className="text-[11px] text-primary-muted">{t.paperType || DEFAULT_PAPER_TYPE}</div>
                          </td>
                          <td className="table-cell text-primary">{t.voltage}</td>
                          <td className="table-cell text-primary">{t.loadMVA}</td>
                          <td className="table-cell text-primary font-mono">{getAge(t.dateEnergized)}</td>
                          <td className="table-cell"><Badge condition={cond} /></td>
                          <td className="table-cell text-primary font-mono">{r ? getTDCG(r) : "-"}</td>
                          <td className="table-cell" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Btn size="sm" variant="secondary" onClick={() => { setTxForm({ ...emptyTx, ...t, paperType: t.paperType || DEFAULT_PAPER_TYPE }); setEditTx(t); setShowAddTx(true); }}><Pencil size={13} /></Btn>
                              <Btn size="sm" variant="danger" onClick={() => confirmDeleteTx(t.id)}><Trash2 size={13} /></Btn>
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
        ))}
      </div>
      {assetSiteTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <Btn size="sm" variant="secondary" disabled={assetSitePage <= 1} onClick={() => setAssetSitePage(p => Math.max(1, p - 1))}>Previous</Btn>
          {Array.from({ length: assetSiteTotalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${p === assetSitePage ? "bg-accent text-white" : "text-primary-dim hover:bg-surface-hover"}`}
              onClick={() => setAssetSitePage(p)}
            >{p}</button>
          ))}
          <Btn size="sm" variant="secondary" disabled={assetSitePage >= assetSiteTotalPages} onClick={() => setAssetSitePage(p => Math.min(assetSiteTotalPages, p + 1))}>Next</Btn>
        </div>
      )}
      {assetModalTxId && (() => {
        const t = transformers.find(x => x.id === assetModalTxId);
        const txResults = results.filter(r => r.transformerId === assetModalTxId).sort((a, b) => b.date.localeCompare(a.date));
        const oilHistory = txResults.map((r) => ({
          ...r,
          dpFromFuranResolved: Number(r.dpFromFuran) || estimateDpFromFuran(r.fal2),
          dpFromMethanolResolved: Number(r.dpFromMethanol) || estimateDpFromMethanol(r.methanol),
        }));
        if (!t) return null;
        return (
          <div className="modal-overlay" onClick={() => setAssetModalTxId(null)}>
            <div className="modal-content p-5 max-w-[960px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-accent text-base font-bold">{t.name} - Detail</h3>
              <Btn size="sm" variant="secondary" onClick={() => setAssetModalTxId(null)}>Close</Btn>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5 mb-4">
              {[
                ["Site", t.site], ["Mnemonic", t.mnemonic], ["Serial Number", t.serialNumber],
                ["Brand", t.brand], ["Maker", t.maker], ["Oil Brand", t.oilBrand || "-"], ["Oil Type", t.oilType || "-"], ["Paper Type", t.paperType || DEFAULT_PAPER_TYPE],
                ["Voltage", t.voltage], ["Load", `${t.loadMVA} MVA`], ["Year Energize", t.dateEnergized],
                ["Age", `${getAge(t.dateEnergized)} years`],
              ].map(([label, value]) => (
                <div key={label}><span className="text-primary-muted text-[11px]">{label}:</span><div className="text-primary">{value}</div></div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h4 className="text-primary text-[13px] mr-auto">
                {assetDetailView === "dga" ? "DGA History" : "Oil Testing History"} ({txResults.length} records)
              </h4>
              <Btn
                size="sm"
                variant={assetDetailView === "dga" ? "primary" : "secondary"}
                onClick={() => setAssetDetailView("dga")}
              >
                DGA Results
              </Btn>
              <Btn
                size="sm"
                variant={assetDetailView === "oil" ? "primary" : "secondary"}
                onClick={() => setAssetDetailView("oil")}
              >
                Oil Testing Results
              </Btn>
            </div>

            <div className="overflow-x-auto">
              {assetDetailView === "dga" ? (
                <table className="w-full border-collapse text-xs">
                  <thead><tr>{["Date", ...GASES.map(g => g.label), "TDCG", "Status"].map(h => (
                    <th key={h} className="text-primary-muted p-1.5 text-right text-[10px] uppercase">{h}</th>
                  ))}</tr></thead>
                  <tbody>{txResults.map(r => {
                    const cond = getOverallCondition(r);
                    return (
                      <tr key={r.id} className="border-b border-border">
                        <td className="text-primary-dim p-1.5 text-right whitespace-nowrap">{r.date}</td>
                        {GASES.map(g => {
                          const c = getCondition(g.key, r[g.key]);
                          const cs = CONDITION_STYLES[c];
                          return <td key={g.key} className="p-1.5 text-right font-mono" style={{ color: cs.text }}>{r[g.key]}</td>;
                        })}
                        <td className="text-primary p-1.5 text-right font-mono font-semibold">{getTDCG(r)}</td>
                        <td className="p-1.5 text-right"><Badge condition={cond} /></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead><tr>{["Date", "Test Type", ...ASSET_OIL_RESULT_COLUMNS.map(c => c.label), "Status"].map(h => (
                    <th key={h} className="text-primary-muted p-1.5 text-right text-[10px] uppercase">{h}</th>
                  ))}</tr></thead>
                  <tbody>{oilHistory.map(r => {
                    const cond = getOverallCondition(r);
                    return (
                      <tr key={r.id} className="border-b border-border">
                        <td className="text-primary-dim p-1.5 text-right whitespace-nowrap">{r.date}</td>
                        <td className="text-primary p-1.5 text-right">{r.testType || "Routine"}</td>
                        {ASSET_OIL_RESULT_COLUMNS.map((col) => {
                          const value = col.key === "dpFromFuran"
                            ? r.dpFromFuranResolved
                            : col.key === "dpFromMethanol"
                              ? r.dpFromMethanolResolved
                              : r[col.key];
                          return (
                            <td key={col.key} className="p-1.5 text-right font-mono" style={{ color: col.color }}>
                              {formatTestValue(value, col.digits)}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-right"><Badge condition={cond} /></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
            </div>
            </div>
          </div>
        );
      })()}

      <div className="glass-card p-5" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h3 className="text-accent text-sm">Oil Brand Master</h3>
            <div className="text-primary-dim text-xs mt-1">
              Central oil-brand catalog used by transformer editing, diagnostics context, AI assessment, and prediction similarity.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn variant="secondary" onClick={() => refreshOilBrandCatalog()} disabled={oilBrandSaving}>Refresh Catalog</Btn>
            <Btn variant="secondary" onClick={resetOilBrandForm} disabled={oilBrandSaving}>{oilBrandEditId ? "Cancel Edit" : "New Brand"}</Btn>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mt-4">
          <div className="bg-surface-input border border-border rounded-lg px-3 py-2.5">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Catalog Brands</div>
            <div className="text-primary text-lg font-semibold mt-1">{oilBrands.length}</div>
          </div>
          <div className="bg-surface-input border border-border rounded-lg px-3 py-2.5">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Linked Transformers</div>
            <div className="text-primary text-lg font-semibold mt-1">{linkedOilBrandCount}</div>
          </div>
          <div className="bg-surface-input border border-border rounded-lg px-3 py-2.5">
            <div className="text-primary-muted text-[10px] uppercase tracking-wider">Need Manual Mapping</div>
            <div className="text-lg font-semibold mt-1" style={{ color: unresolvedOilBrandTransformers.length ? "#f59e0b" : "var(--success)" }}>
              {unresolvedOilBrandTransformers.length}
            </div>
          </div>
        </div>

        {unresolvedOilBrandTransformers.length > 0 && (
          <div
            className="mt-4 rounded-lg border px-3 py-3"
            style={{ borderColor: "rgba(245, 158, 11, 0.45)", background: "rgba(245, 158, 11, 0.08)" }}
          >
            <div className="text-[12px] font-semibold" style={{ color: "#f59e0b" }}>
              Automatic backfill could not determine oil brand for {unresolvedOilBrandTransformers.length} transformer(s).
            </div>
            <div className="text-primary-dim text-xs mt-1">
              Current stored data does not contain an explicit oil brand for these records. Open the transformer editor to assign them.
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {unresolvedOilBrandTransformers.map((transformer) => (
                <button
                  key={transformer.id}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setTxForm({ ...emptyTx, ...transformer, paperType: transformer.paperType || DEFAULT_PAPER_TYPE });
                    setEditTx(transformer);
                    setShowAddTx(true);
                  }}
                >
                  {getTxMnemonicOrId(transformer)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(180px,1fr)_minmax(220px,2fr)_auto] gap-3 mt-4 items-end">
          <Input
            label="Brand Name"
            value={oilBrandForm.name}
            onChange={(value) => setOilBrandForm((prev) => ({ ...prev, name: value }))}
            required
            placeholder="e.g. Shell Diala S4 ZX-I"
            disabled={oilBrandSaving}
          />
          <Input
            label="Default Oil Type"
            value={oilBrandForm.oilType}
            onChange={(value) => setOilBrandForm((prev) => ({ ...prev, oilType: value }))}
            options={OIL_TYPES}
            disabled={oilBrandSaving}
          />
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-primary-dim text-xs font-medium">Notes</label>
            <input
              className="input-field"
              value={oilBrandForm.notes}
              onChange={(event) => setOilBrandForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional catalog note"
              disabled={oilBrandSaving}
            />
          </div>
          <div className="flex gap-2">
            <Btn onClick={saveOilBrand} disabled={oilBrandSaving}>{oilBrandEditId ? "Update Brand" : "Add Brand"}</Btn>
            {oilBrandEditId && <Btn variant="secondary" onClick={resetOilBrandForm} disabled={oilBrandSaving}>Cancel</Btn>}
          </div>
        </div>

        {oilBrandError && <div className="alert-error mt-4">{oilBrandError}</div>}

        <div className="overflow-x-auto mt-4 border border-border rounded-lg">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-card">
                {["Brand Name", "Default Oil Type", "Linked Transformers", "Actions"].map((header) => (
                  <th key={header} className="table-header">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oilBrands.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="table-cell">
                    <div className="text-primary font-medium">{item.name}</div>
                    {item.notes && <div className="text-[11px] text-primary-muted mt-0.5">{item.notes}</div>}
                  </td>
                  <td className="table-cell text-primary">{item.oilType || "-"}</td>
                  <td className="table-cell text-primary font-mono">{item.transformerCount || 0}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <Btn size="sm" variant="secondary" onClick={() => startEditOilBrand(item)} disabled={oilBrandSaving}><Pencil size={13} /></Btn>
                      <Btn size="sm" variant="danger" onClick={() => confirmDeleteOilBrand(item)} disabled={oilBrandSaving || Number(item.transformerCount || 0) > 0}><Trash2 size={13} /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {oilBrands.length === 0 && (
            <div className="p-4 text-primary-dim text-sm">No oil brands available yet.</div>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================
  // EXCEL EXPORT HELPERS
  // ============================================================
  const toggleExportRow = (key, rowId) => {
    setSelectedExportRows(prev => {
      const set = new Set(prev[key] || []);
      if (set.has(rowId)) set.delete(rowId); else set.add(rowId);
      return { ...prev, [key]: [...set] };
    });
  };
  const toggleExportAll = (key, allIds) => {
    setSelectedExportRows(prev => {
      const current = new Set(prev[key] || []);
      const allSelected = allIds.every(id => current.has(id));
      return { ...prev, [key]: allSelected ? [] : [...allIds] };
    });
  };

  const exportDgaToExcel = (transformerLabel, site, items, selectedIds) => {
    const rowsToExport = selectedIds && selectedIds.length > 0
      ? items.filter(({ result }) => selectedIds.includes(result.id))
      : items;

    const dgaGasKeys = ["H2", "O2", "N2", "CH4", "CO", "CO2", "C2H4", "C2H6", "C2H2"];
    const baseHeaders = ["No.", "Sampling Date", "Date Received", "Mnemonic", "Site", "TX No.", "Oil Type", "Date Manufactured", "Sampling Point", "Serial Number", "Load MVA", "Voltage/KV", "Maker", "Year Built"];
    const row1 = [...baseHeaders.map(() => ""), ...Array(dgaGasKeys.length).fill("")];
    baseHeaders.forEach((h, i) => { row1[i] = h; });
    row1[baseHeaders.length] = "DGA (ppm)";

    const row2 = [...baseHeaders.map(() => ""), ...dgaGasKeys];

    const ws = XLSX.utils.aoa_to_sheet([row1, row2]);

    // Merge "DGA (ppm)" header across all gas columns
    ws["!merges"] = [
      { s: { r: 0, c: baseHeaders.length }, e: { r: 0, c: baseHeaders.length + dgaGasKeys.length - 1 } },
      ...baseHeaders.map((_, i) => ({ s: { r: 0, c: i }, e: { r: 1, c: i } })),
    ];

    const dataRows = rowsToExport.map(({ result: row, tx }, idx) => {
      const yearBuilt = tx?.dateManufactured ? new Date(tx.dateManufactured).getFullYear() || "" : "";
      return [
        idx + 1,
        row.date || "",
        row.date || "",
        tx?.mnemonic || "",
        tx?.site || site || "",
        parseTxDisplayName(tx) || row.transformerId || "",
        tx?.oilType || "",
        tx?.dateManufactured || "",
        parseSamplingPoint(tx, row.testType),
        parseSerialDisplay(tx),
        tx?.loadMVA ?? "",
        tx?.voltage || "",
        tx?.maker || "",
        yearBuilt,
        ...dgaGasKeys.map(k => row[k] ?? ""),
      ];
    });
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 2 });

    // Set column widths
    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
      ...dgaGasKeys.map(() => ({ wch: 8 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DGA Results");
    XLSX.writeFile(wb, `DGA_${site}_${transformerLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportOilToExcel = (transformerLabel, site, items, selectedIds) => {
    const rowsToExport = selectedIds && selectedIds.length > 0
      ? items.filter(({ result }) => selectedIds.includes(result.id))
      : items;

    const oilColLabels = [...ASSET_OIL_RESULT_COLUMNS.map(c => c.label), "Life Used (%)"];
    const baseHeaders = ["No.", "Sampling Date", "Date Received", "Mnemonic", "Site", "TX No.", "Oil Type", "Date Manufactured", "Sampling Point", "Serial Number", "Load MVA", "Voltage/KV", "Maker", "Year Built"];
    const row1 = [...baseHeaders.map(() => ""), ...Array(oilColLabels.length).fill("")];
    baseHeaders.forEach((h, i) => { row1[i] = h; });
    row1[baseHeaders.length] = "Oil Test Results";

    const row2 = [...baseHeaders.map(() => ""), ...oilColLabels];

    const ws = XLSX.utils.aoa_to_sheet([row1, row2]);

    ws["!merges"] = [
      { s: { r: 0, c: baseHeaders.length }, e: { r: 0, c: baseHeaders.length + oilColLabels.length - 1 } },
      ...baseHeaders.map((_, i) => ({ s: { r: 0, c: i }, e: { r: 1, c: i } })),
    ];

    const dataRows = rowsToExport.map(({ result: row, tx }, idx) => {
      const yearBuilt = tx?.dateManufactured ? new Date(tx.dateManufactured).getFullYear() || "" : "";
      const exDpFuran = Number(row.dpFromFuran) || estimateDpFromFuran(row.fal2);
      const exLifePct = estimateLifetimeUsedPct(exDpFuran);
      return [
        idx + 1,
        row.date || "",
        row.date || "",
        tx?.mnemonic || "",
        tx?.site || site || "",
        parseTxDisplayName(tx) || row.transformerId || "",
        tx?.oilType || "",
        tx?.dateManufactured || "",
        parseSamplingPoint(tx, row.testType),
        parseSerialDisplay(tx),
        tx?.loadMVA ?? "",
        tx?.voltage || "",
        tx?.maker || "",
        yearBuilt,
        ...ASSET_OIL_RESULT_COLUMNS.map(col => getOilColumnValue(row, col.key) ?? ""),
        exLifePct != null ? exLifePct : "",
      ];
    });
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 2 });

    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
      ...ASSET_OIL_RESULT_COLUMNS.map(() => ({ wch: 14 })),
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Oil Results");
    XLSX.writeFile(wb, `Oil_${site}_${transformerLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ============================================================
  // PDF EXPORT FOR DIAGNOSTICS
  // ============================================================
  const PDF_DUVAL_DIAGRAM_OPTIONS = [
    { key: "duvalT1", mode: "t1", label: "Duval Triangle 1 Diagram", title: "Duval Triangle 1 Snapshot" },
    { key: "duvalT4", mode: "t4", label: "Duval Triangle 4 Diagram", title: "Duval Triangle 4 Snapshot" },
    { key: "duvalT5", mode: "t5", label: "Duval Triangle 5 Diagram", title: "Duval Triangle 5 Snapshot" },
    { key: "duvalP1", mode: "p1", label: "Duval Pentagon Diagram", title: "Duval Pentagon Snapshot" },
    { key: "duvalH1", mode: "h1", label: "Duval Heptagon Diagram", title: "Duval Heptagon Snapshot" },
  ];
  const PDF_SECTION_OPTIONS = [
    { key: "ieee", label: "IEEE C57.104 Overall" },
    ...PDF_DUVAL_DIAGRAM_OPTIONS.map(({ key, label }) => ({ key, label })),
    { key: "rogers", label: "Rogers Ratio" },
    { key: "keyGas", label: "Key Gas Method" },
    { key: "radar", label: "Gas Profile Radar" },
    { key: "duvalDiagram", label: "Duval Diagnostic Panel (Full)" },
  ];
  const PDF_VISUAL_SECTION_SELECTORS = {
    radar: "[data-pdf-section='radar']",
    duvalDiagram: "[data-pdf-section='duvalDiagram']",
    ...Object.fromEntries(PDF_DUVAL_DIAGRAM_OPTIONS.map(({ key }) => [key, `[data-pdf-diagram-capture='${key}']`])),
  };
  const DUVAL_MODE_LABELS = {
    t1: "Duval Triangle 1",
    t4: "Duval Triangle 4",
    t5: "Duval Triangle 5",
    p1: "Duval Pentagon",
    h1: "Duval Heptagon",
  };
  const PDF_CAPTURE_THEME_VARS = COLOR_MODES.light;

  const generateDiagnosticsPdf = async () => {
    setPdfGenerating(true);
    try {
      const container = diagnosticsRef.current;
      if (!container) return;

      const txId = selectedTx || transformers[0]?.id;
      const tx = transformers.find(t => t.id === txId);
      const txResults = results
        .filter((row) => row.transformerId === txId)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!tx || txResults.length === 0) return;

      const defaultDate = txResults[txResults.length - 1]?.date || "";
      const hasSelectedDate = txResults.some((row) => row.date === diagnosticDate);
      const activeDate = hasSelectedDate ? diagnosticDate : defaultDate;
      const r = txResults.find((row) => row.date === activeDate) || txResults[txResults.length - 1];
      if (!r) return;

      const txResultsUpToDate = txResults.filter((row) => row.date <= activeDate);
      const duvalModeLabel = DUVAL_MODE_LABELS[diagnosticDuvalMode] || "Diagnostics";
      const getFaultForDateLabel = (row) => getDgaWorkbenchFaultForMode(row, tx, diagnosticDuvalMode);
      const activeDuvalFault = getFaultForDateLabel(r);
      const rogers = getRogersRatio(r);
      const keyGas = getKeyGas(r);
      const cond = getOverallCondition(r);
      const workbenchOilType = resolveDgaWorkbenchOilType(tx);
      const workbenchAnalysis = getDgaWorkbenchAnalysisForResult(r, tx);
      const workbenchFaultZones = workbenchAnalysis?.faultZones || {};
      const workbenchTriangleZoneKey = DGA_WORKBENCH_TRIANGLE_ZONE_KEYS[workbenchOilType] || "triangle1";
      const workbenchPentagonZoneKey = DGA_WORKBENCH_PENTAGON_ZONE_KEYS[workbenchOilType] || "pentagon";
      const gasValues = {
        H2: Number(r.H2) || 0,
        CH4: Number(r.CH4) || 0,
        C2H2: Number(r.C2H2) || 0,
        C2H4: Number(r.C2H4) || 0,
        C2H6: Number(r.C2H6) || 0,
        CO: Number(r.CO) || 0,
        CO2: Number(r.CO2) || 0,
      };
      const buildModeRows = (keys) => {
        const total = keys.reduce((sum, key) => sum + (gasValues[key] || 0), 0);
        return keys.map((key) => ({
          key,
          pct: total > 0 ? ((gasValues[key] / total) * 100) : 0,
          ppm: gasValues[key],
        }));
      };
      const heptagonPct = computeHeptagonPercentages(gasValues);
      const heptagonRows = heptagonPct
        ? Object.entries(heptagonPct)
            .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
            .slice(0, 3)
            .map(([key, pct]) => ({ key, pct: Number(pct) || 0, ppm: gasValues[key] || 0 }))
        : [
            { key: "H2", pct: 0, ppm: gasValues.H2 },
            { key: "CH4", pct: 0, ppm: gasValues.CH4 },
            { key: "CO", pct: 0, ppm: gasValues.CO },
          ];
      const duvalSummaryCards = [
        { key: "t1", title: getDgaTriangleSummaryTitle(workbenchOilType), fault: workbenchFaultZones[workbenchTriangleZoneKey] || "ND", rows: buildModeRows(["CH4", "C2H4", "C2H2"]) },
        { key: "t4", title: "Duval Triangle 4", fault: workbenchFaultZones.triangle4 || "ND", rows: buildModeRows(["H2", "CH4", "C2H6"]) },
        { key: "t5", title: "Duval Triangle 5", fault: workbenchFaultZones.triangle5 || "ND", rows: buildModeRows(["CH4", "C2H4", "C2H6"]) },
        { key: "p1", title: getDgaPentagonSummaryTitle(workbenchOilType), fault: workbenchFaultZones[workbenchPentagonZoneKey] || "ND", rows: buildModeRows(["H2", "CH4", "C2H6", "C2H4", "C2H2"]).slice(0, 3) },
        { key: "h1", title: "Duval Heptagon", fault: workbenchAnalysis?.heptagon?.zone || workbenchFaultZones.heptagon || "ND", rows: heptagonRows },
      ];
      const keyGasInfo = GASES.find((g) => g.key === keyGas.gas);
      const keyGasPpm = gasValues[keyGas.gas] || 0;
      const keyGasTdcg = getTDCG(r);
      const keyGasShare = keyGasTdcg > 0 ? (keyGasPpm / keyGasTdcg) * 100 : 0;
      const keyGasRanking = Object.entries({
        H2: gasValues.H2,
        CH4: gasValues.CH4,
        C2H2: gasValues.C2H2,
        C2H4: gasValues.C2H4,
        C2H6: gasValues.C2H6,
        CO: gasValues.CO,
      })
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, 3)
        .map(([key, ppm]) => ({
          key,
          ppm: Number(ppm) || 0,
        }));
      const safeFilenamePart = (value) =>
        String(value || "")
          .trim()
          .replace(/[^\w-]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "") || "item";
      const formatRatio = (numerator, denominator) => {
        const top = Number(numerator) || 0;
        const bottom = Number(denominator) || 0;
        return bottom > 0 ? (top / bottom).toFixed(3) : "N/A";
      };
      const captureVisualSnapshot = async (sectionKey) => {
        const selector = PDF_VISUAL_SECTION_SELECTORS[sectionKey];
        if (!selector) return null;
        const el = container.querySelector(selector);
        if (!el) return null;
        const applyLightCaptureTheme = (target) => {
          Object.entries(PDF_CAPTURE_THEME_VARS).forEach(([key, value]) => {
            target.style.setProperty(key, value);
          });
          target.style.colorScheme = "light";
          target.style.background = PDF_CAPTURE_THEME_VARS["--bg-card"];
          target.style.borderColor = PDF_CAPTURE_THEME_VARS["--border"];
          target.style.boxShadow = "none";

          target.querySelectorAll("[data-duval-container], .glass-card").forEach((node) => {
            node.style.setProperty("--bg-card", PDF_CAPTURE_THEME_VARS["--bg-card"]);
            node.style.setProperty("--bg-input", PDF_CAPTURE_THEME_VARS["--bg-input"]);
            node.style.setProperty("--bg-hover", PDF_CAPTURE_THEME_VARS["--bg-hover"]);
            node.style.setProperty("--border", PDF_CAPTURE_THEME_VARS["--border"]);
            node.style.setProperty("--text", PDF_CAPTURE_THEME_VARS["--text"]);
            node.style.setProperty("--text-dim", PDF_CAPTURE_THEME_VARS["--text-dim"]);
            node.style.setProperty("--text-muted", PDF_CAPTURE_THEME_VARS["--text-muted"]);
            node.style.background = sectionKey === "radar" ? "#ffffff" : PDF_CAPTURE_THEME_VARS["--bg-card"];
            node.style.borderColor = PDF_CAPTURE_THEME_VARS["--border"];
            node.style.boxShadow = "none";
          });
        };
        const canvas = await html2canvas(el, {
          backgroundColor: PDF_CAPTURE_THEME_VARS["--bg"],
          scale: 2,
          useCORS: true,
          allowTaint: true,
          onclone: (clonedDoc) => {
            clonedDoc.body.style.background = PDF_CAPTURE_THEME_VARS["--bg"];
            const clonedTarget = clonedDoc.querySelector(selector);
            if (clonedTarget) applyLightCaptureTheme(clonedTarget);
          },
        });
        return {
          src: canvas.toDataURL("image/png"),
          aspectRatio: canvas.height / canvas.width,
        };
      };

      const captureSectionKeys = [
        "radar",
        "duvalDiagram",
        ...PDF_DUVAL_DIAGRAM_OPTIONS.map(({ key }) => key),
      ];
      const capturedImages = Object.fromEntries(await Promise.all(
        captureSectionKeys.map(async (sectionKey) => ([
          sectionKey,
          pdfSections[sectionKey] ? await captureVisualSnapshot(sectionKey) : null,
        ]))
      ));

      const sectionCards = [];

      if (pdfSections.ieee) {
        sectionCards.push({
          title: "IEEE C57.104 Overall",
          badge: CONDITION_STYLES[cond].label,
          badgeColor: CONDITION_STYLES[cond].text,
          badgeDetail: `TDCG ${formatTestValue(keyGasTdcg, 0)} ppm`,
          subtitle: "Overall dissolved gas condition based on the current sample.",
          lines: [
            `Active Duval result: ${activeDuvalFault} - ${getDgaFaultLabel(activeDuvalFault)}`,
            `Dominant gases: ${keyGasRanking.map((item) => `${item.key} ${formatTestValue(item.ppm, 1)} ppm`).join(", ")}`,
            `Sample count available: ${txResults.length}`,
          ],
          note: "This block summarizes the same diagnosis already shown on-screen, but formatted for PDF review.",
        });
      }

      if (pdfSections.rogers) {
        sectionCards.push({
          title: "Rogers Ratio",
          badge: rogers,
          badgeColor: getDgaFaultColor(activeDuvalFault),
          badgeDetail: "Ratio-based fault interpretation",
          subtitle: "Calculated directly from the selected test sample.",
          lines: [
            `CH4/H2 = ${formatRatio(r.CH4, r.H2)}`,
            `C2H2/C2H4 = ${formatRatio(r.C2H2, r.C2H4)}`,
            `C2H4/C2H6 = ${formatRatio(r.C2H4, r.C2H6)}`,
          ],
          note: "Ratios return N/A when the denominator is zero.",
        });
      }

      if (pdfSections.keyGas) {
        sectionCards.push({
          title: "Key Gas Method",
          badge: keyGasInfo?.label || keyGas.gas,
          badgeColor: keyGasInfo?.color || "#06b6d4",
          badgeDetail: keyGas.fault,
          subtitle: "Dominant gas concentration and its contribution to TDCG.",
          lines: [
            `Dominant gas concentration: ${formatTestValue(keyGasPpm, 1)} ppm`,
            `Share of TDCG: ${formatTestValue(keyGasShare, 1)}% of ${formatTestValue(keyGasTdcg, 1)} ppm`,
            `Top gases: ${keyGasRanking.map((item) => `${item.key} ${formatTestValue(item.ppm, 1)} ppm`).join(", ")}`,
          ],
          note: "Useful for quick triage when one gas strongly dominates the profile.",
        });
      }

      const gasReadings = GASES.map((gas) => {
        const ppm = Number(r[gas.key]) || 0;
        const condition = getCondition(gas.key, ppm);
        const share = keyGasTdcg > 0 ? (ppm / keyGasTdcg) * 100 : 0;
        return {
          label: gas.label,
          value: `${formatTestValue(ppm, 1)} ppm`,
          share: `${formatTestValue(share, 1)}%`,
          status: CONDITION_STYLES[condition].label,
          statusColor: CONDITION_STYLES[condition].text,
          limit: IEEE_LIMITS[gas.key]?.poor ? `${formatTestValue(IEEE_LIMITS[gas.key].poor, 0)} ppm` : "-",
        };
      });

      const visuals = [];
      PDF_DUVAL_DIAGRAM_OPTIONS.forEach(({ key, title }) => {
        if (!pdfSections[key] || !capturedImages[key]) return;
        visuals.push({
          title,
          caption: `Diagram-only snapshot up to ${activeDate} with the latest plotted point highlighted.`,
          image: capturedImages[key],
        });
      });
      if (pdfSections.duvalDiagram && capturedImages.duvalDiagram) {
        visuals.push({
          title: `${duvalModeLabel} Snapshot`,
          caption: `Full live diagnostics panel captured up to ${activeDate}.`,
          image: capturedImages.duvalDiagram,
        });
      }
      if (pdfSections.radar && capturedImages.radar) {
        visuals.push({
          title: "Gas Profile Radar",
          caption: "Current gas profile against the IEEE C57.104 poor-limit envelope.",
          image: capturedImages.radar,
        });
      }

      const historyRows = pdfSections.duvalDiagram
        ? [...txResultsUpToDate]
            .slice(-6)
            .reverse()
            .map((row) => {
              const fault = getFaultForDateLabel(row);
              const rowCondition = getOverallCondition(row);
              return {
                date: row.date,
                fault,
                faultLabel: getDgaFaultLabel(fault),
                faultColor: getDgaFaultColor(fault),
                condition: CONDITION_STYLES[rowCondition].label,
                tdcg: `${formatTestValue(getTDCG(row), 1)} ppm`,
              };
            })
        : [];

      const reportPayload = {
        title: "Transformer Diagnostic Report",
        subtitle: `${tx.site || "-"} | ${tx.mnemonic || tx.name || "-"} | ${activeDate || "-"}`,
        generatedAt: `${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        hero: {
          badge: activeDuvalFault,
          badgeColor: getDgaFaultColor(activeDuvalFault),
          context: duvalModeLabel,
        },
        footerLabel: `${tx.site || "-"} / ${tx.mnemonic || tx.name || "-"} / ${activeDate || "-"}`,
        filename: `Diagnostic_${safeFilenamePart(tx.site)}_${safeFilenamePart(tx.mnemonic || tx.name)}_${safeFilenamePart(activeDate)}.pdf`,
        kpis: [
          {
            label: "Overall Condition",
            value: CONDITION_STYLES[cond].label,
            helper: `IEEE + DGA concentration review`,
            accentColor: CONDITION_STYLES[cond].text,
          },
          {
            label: "Active Fault",
            value: activeDuvalFault,
            helper: getDgaFaultLabel(activeDuvalFault),
            accentColor: getDgaFaultColor(activeDuvalFault),
          },
          {
            label: "Dominant Gas",
            value: keyGasInfo?.label || keyGas.gas,
            helper: `${formatTestValue(keyGasPpm, 1)} ppm | ${formatTestValue(keyGasShare, 1)}% of TDCG`,
            accentColor: keyGasInfo?.color || "#06b6d4",
          },
          {
            label: "Samples on Record",
            value: String(txResults.length),
            helper: `Selected sample: ${activeDate || "-"}`,
            accentColor: "#0f6cbd",
          },
        ],
        assetMeta: [
          { label: "Site", value: tx.site || "-" },
          { label: "Transformer", value: tx.name || tx.mnemonic || "-" },
          { label: "Mnemonic", value: tx.mnemonic || "-" },
          { label: "Serial Number", value: tx.serialNumber || "-" },
          { label: "Voltage", value: tx.voltage || "-" },
          { label: "Load", value: tx.loadMVA ? `${tx.loadMVA} MVA` : "-" },
          { label: "Maker", value: tx.maker || "-" },
          { label: "Oil Brand", value: tx.oilBrand || "-" },
          { label: "Oil Type", value: tx.oilType || "-" },
          { label: "Paper Type", value: tx.paperType || DEFAULT_PAPER_TYPE },
          { label: "Selected Test Date", value: activeDate || "-" },
        ],
        gasReadings,
        sectionCards,
        visuals,
        historyRows,
        notes: [
          `Active diagnostic mode: ${duvalModeLabel}.`,
          PDF_DUVAL_DIAGRAM_OPTIONS.some(({ key }) => pdfSections[key])
            ? `Diagram-only captures included: ${PDF_DUVAL_DIAGRAM_OPTIONS.filter(({ key }) => pdfSections[key]).map(({ title }) => title.replace(" Snapshot", "")).join(", ")}.`
            : "No diagram-only Duval captures were selected.",
          pdfSections.duvalDiagram
            ? "The full Duval diagnostics panel was also embedded from the live diagnostics view."
            : "The full Duval diagnostics panel snapshot was not included.",
        ],
      };

      const { blob, filename } = await generateDiagnosticsPdfReport(reportPayload);
      const pdfUrl = URL.createObjectURL(blob);
      const previewWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!previewWindow) {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setPdfGenerating(false);
      setShowPdfModal(false);
    }
  };

  // ============================================================
  // RENDER: DGA RESULTS
  // ============================================================
  const [dgaSearch, setDgaSearch] = useState({ site: "", transformer: "", serial: "" });
  const [oilSearch, setOilSearch] = useState({ site: "", transformer: "", serial: "" });

  const renderResults = () => {
    const filteredResults = [...results]
      .map((result) => ({ result, tx: transformers.find((t) => t.id === result.transformerId) }))
      .filter(({ result, tx }) => {
        if (!tx) return !dgaSearch.site && !dgaSearch.transformer && !dgaSearch.serial;
        const siteMatch = !dgaSearch.site || (tx.site || "").toLowerCase().includes(dgaSearch.site.toLowerCase());
        const txMatch = !dgaSearch.transformer || (tx.name || "").toLowerCase().includes(dgaSearch.transformer.toLowerCase()) || (tx.mnemonic || "").toLowerCase().includes(dgaSearch.transformer.toLowerCase());
        const serialMatch = !dgaSearch.serial || (tx.serialNumber || "").toLowerCase().includes(dgaSearch.serial.toLowerCase());
        return siteMatch && txMatch && serialMatch;
      })
      .sort((a, b) => (b.result.date || "").localeCompare(a.result.date || ""));

    const siteGroups = Object.entries(
      filteredResults.reduce((acc, item) => {
        const site = item.tx?.site || "Unassigned Site";
        if (!acc[site]) acc[site] = [];
        acc[site].push(item);
        return acc;
      }, {})
    )
      .map(([site, items]) => {
        const transformerMap = {};
        items.forEach((item) => {
          const transformerId = item.tx?.id || item.result.transformerId || "Unknown TX";
          const transformerLabel = (item.tx?.name || item.tx?.mnemonic || item.result.transformerId || "Unknown TX").trim();
          if (!transformerMap[transformerId]) {
            transformerMap[transformerId] = { transformerId, transformerLabel, items: [] };
          }
          transformerMap[transformerId].items.push(item);
        });
        const transformerGroups = Object.values(transformerMap).sort((a, b) =>
          a.transformerLabel.localeCompare(b.transformerLabel, undefined, { numeric: true, sensitivity: "base" })
        );
        return {
          site,
          items,
          latest: items[0]?.result || null,
          transformerCount: new Set(items.map((entry) => entry.tx?.id || entry.result.transformerId)).size,
          transformerGroups,
        };
      })
      .sort((a, b) => (b.latest?.date || "").localeCompare(a.latest?.date || "") || a.site.localeCompare(b.site));

    return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-primary text-base font-semibold">DGA Test Results</h3>
          <Btn onClick={() => openAddResultModal("dga")}>+ Add Result</Btn>
      </div>

      {/* Search Box */}
      <div className="glass-card px-4 py-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-[1_1_180px] min-w-[150px]">
            <label className="section-label block">Search Site</label>
            <input value={dgaSearch.site} onChange={e => setDgaSearch(p => ({ ...p, site: e.target.value }))} placeholder="All sites" className="input-field" />
          </div>
          <div className="flex-[1_1_200px] min-w-[150px]">
            <label className="section-label block">Search Transformer</label>
            <input value={dgaSearch.transformer} onChange={e => setDgaSearch(p => ({ ...p, transformer: e.target.value }))} placeholder="Name or mnemonic" className="input-field" />
          </div>
          <div className="flex-[1_1_180px] min-w-[150px]">
            <label className="section-label block">Search Serial No.</label>
            <input value={dgaSearch.serial} onChange={e => setDgaSearch(p => ({ ...p, serial: e.target.value }))} placeholder="Serial number" className="input-field" />
          </div>
          {(dgaSearch.site || dgaSearch.transformer || dgaSearch.serial) && (
            <button onClick={() => setDgaSearch({ site: "", transformer: "", serial: "" })} className="btn btn-secondary btn-sm whitespace-nowrap">
              Clear
            </button>
          )}
          <span className="text-primary-muted text-[11px] self-center">
            {filteredResults.length} of {results.length} results
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {siteGroups.map((group) => {
          const latest = group.latest;
          const latestDuval = latest ? getDuvalFault(latest.CH4, latest.C2H4, latest.C2H2) : "N";
          const isExpanded = Boolean(expandedSites[group.site]);

          return (
            <div key={group.site} className="glass-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedSites((prev) => ({ ...prev, [group.site]: !prev[group.site] }))}
                className="w-full bg-transparent border-none px-3 py-2.5 flex justify-between items-center cursor-pointer text-left text-primary"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>{group.site}</div>
                  <div className="text-primary-muted text-[11px]">
                    {group.items.length} samples | {group.transformerCount} transformer{group.transformerCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                  <span className="text-primary-muted text-[11px]">Latest: {latest?.date || "-"}</span>
                  <span className="text-primary text-[11px] font-mono font-bold">
                    TDCG {latest ? getTDCG(latest) : "-"}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: FAULT_COLORS[latestDuval] }}>
                    Duval {latestDuval}
                  </span>
                  <ArrowRight size={14} className="transition-transform duration-200 text-primary-dim" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-2.5 py-2 pb-3 flex flex-col gap-1.5">
                  {group.transformerGroups.map(({ transformerId, transformerLabel, items: transformerItems }) => {
                    const transformerKey = `dga:${group.site}:${transformerId}`;
                    const isTransformerExpanded = Boolean(expandedSites[transformerKey]);
                    const exportKey = `dga:${group.site}:${transformerId}`;
                    const selectedIds = selectedExportRows[exportKey] || [];
                    const allRowIds = transformerItems.map(({ result }) => result.id);
                    const allSelected = allRowIds.length > 0 && allRowIds.every(id => selectedIds.includes(id));
                    return (
                      <div key={transformerId} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors">
                          <button
                            type="button"
                            className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-left flex-1"
                            onClick={() => setExpandedSites(prev => ({ ...prev, [transformerKey]: !prev[transformerKey] }))}
                          >
                            <span className="text-xs font-bold text-primary">{transformerLabel}</span>
                            <span className="text-primary-muted text-[11px]">{transformerItems.length} record{transformerItems.length !== 1 ? "s" : ""}</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              title="Export to Excel"
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors"
                              style={{ borderColor: "#22c55e", color: "#22c55e", background: "#22c55e18" }}
                              onClick={(e) => { e.stopPropagation(); exportDgaToExcel(transformerLabel, group.site, transformerItems, selectedIds); }}
                            >
                              <Download size={12} /> Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                            </button>
                            <button type="button" className="bg-transparent border-none cursor-pointer text-primary-muted text-[10px]" onClick={() => setExpandedSites(prev => ({ ...prev, [transformerKey]: !prev[transformerKey] }))}>{isTransformerExpanded ? "▲" : "▼"}</button>
                          </div>
                        </div>
                        {isTransformerExpanded && (
                          <div className="border-t border-border overflow-x-auto">
                            <table className="border-collapse table-auto text-[10px]" style={{ minWidth: "100%" }}>
                              <thead>
                                <tr className="bg-surface-input">
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] border-b border-border text-center whitespace-nowrap sticky left-0 bg-surface-input z-10" style={{ minWidth: 32 }}>
                                    <input type="checkbox" checked={allSelected} onChange={() => toggleExportAll(exportKey, allRowIds)} title="Select all" />
                                  </th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-center whitespace-nowrap" style={{ minWidth: 36 }}>No.</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 90 }}>Date</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 100 }}>Transformer</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 120 }}>Oil Type</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 110 }}>Serial No.</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 100 }}>Sampling Point</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 110 }}>Status</th>
                                  {GASES.map((g) => (
                                    <th key={g.key} className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 60 }}>{g.label}</th>
                                  ))}
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 50 }}>O2</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 50 }}>N2</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 60 }}>TDCG</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-center whitespace-nowrap" style={{ minWidth: 72 }}>Duval</th>
                                  <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-center whitespace-nowrap" style={{ minWidth: 90 }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transformerItems.map(({ result: row, tx }, rowIdx) => {
                                  const duval = getDuvalFault(row.CH4, row.C2H4, row.C2H2);
                                  const isRowSelected = selectedIds.includes(row.id);
                                  return (
                                    <tr key={row.id} className="border-b border-border hover:bg-surface-hover transition-colors" style={isRowSelected ? { background: "rgba(34,197,94,0.08)" } : undefined}>
                                      <td className="px-2 py-1 text-center sticky left-0 bg-surface-card z-10" style={{ minWidth: 32 }}>
                                        <input type="checkbox" checked={isRowSelected} onChange={() => toggleExportRow(exportKey, row.id)} />
                                      </td>
                                      <td className="text-primary-dim px-2 py-1 text-center font-mono" style={{ minWidth: 36 }}>{rowIdx + 1}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 90 }}>{row.date}</td>
                                      <td className="px-2 py-1 text-left whitespace-nowrap" style={{ color: "var(--accent)", minWidth: 100 }}>{parseTxDisplayName(tx) || row.transformerId}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 120 }}>{tx?.oilType || "-"}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left font-mono whitespace-nowrap" style={{ minWidth: 110 }}>{parseSerialDisplay(tx)}</td>
                                      <td className="text-primary px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 100 }}>{parseSamplingPoint(tx, row.testType)}</td>
                                      <td className="px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 110 }}>
                                        {row.testType ? (() => { const b = getTestTypeBadge(row.testType); return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold leading-tight border" style={{ background: b.bg, color: b.color, borderColor: b.border }}>{row.testType}</span>; })() : <span className="text-primary-muted text-[9px]">-</span>}
                                      </td>
                                      {GASES.map((g) => {
                                        const cs = CONDITION_STYLES[getCondition(g.key, row[g.key])];
                                        return <td key={`${row.id}-${g.key}`} className="px-2 py-1 text-right font-mono whitespace-nowrap" style={{ color: cs.text, minWidth: 60 }}>{row[g.key]}</td>;
                                      })}
                                      <td className="text-primary-dim px-2 py-1 text-right font-mono whitespace-nowrap" style={{ minWidth: 50 }}>{row.O2 || "-"}</td>
                                      <td className="text-primary-dim px-2 py-1 text-right font-mono whitespace-nowrap" style={{ minWidth: 50 }}>{row.N2 || "-"}</td>
                                      <td className="text-primary px-2 py-1 text-right font-mono font-bold whitespace-nowrap" style={{ minWidth: 60 }}>{getTDCG(row)}</td>
                                      <td className="px-2 py-1 text-center whitespace-nowrap" style={{ minWidth: 72 }}>
                                        <span className="inline-flex items-center justify-center min-w-[42px] px-2 py-0.5 rounded-full text-[10px] font-bold leading-tight border" style={{ borderColor: FAULT_COLORS[duval] || "var(--accent)", color: FAULT_COLORS[duval] || "var(--accent)", background: `${FAULT_COLORS[duval] || "var(--accent)"}22` }}>
                                          {duval}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-center whitespace-nowrap" style={{ minWidth: 90 }}>
                                        <div className="flex gap-1 justify-center items-center flex-nowrap">
                                          <Btn size="sm" variant="secondary" onClick={() => openViewResultModal(row, "dga")} style={{ padding: "3px 6px", minWidth: 0 }}><Eye size={11} /></Btn>
                                          <Btn size="sm" variant="secondary" onClick={() => openEditResultModal(row, "dga")} style={{ padding: "3px 6px", minWidth: 0 }}><Pencil size={11} /></Btn>
                                          <Btn size="sm" variant="danger" onClick={() => confirmDeleteResult(row.id)} style={{ padding: "3px 6px", minWidth: 0 }}><Trash2 size={11} /></Btn>
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
            </div>
          );
        })}
        {siteGroups.length === 0 && (
          <div className="glass-card p-3.5 text-primary-dim text-xs">
            No DGA results match the current filters.
          </div>
        )}
      </div>

    </div>
  );
};

  const renderOilResults = () => {
    const filteredResults = [...results]
      .map((result) => ({ result, tx: transformers.find((t) => t.id === result.transformerId) }))
      .filter(({ result, tx }) => {
        if (!tx) return !oilSearch.site && !oilSearch.transformer && !oilSearch.serial;
        const siteMatch = !oilSearch.site || (tx.site || "").toLowerCase().includes(oilSearch.site.toLowerCase());
        const txMatch = !oilSearch.transformer || (tx.name || "").toLowerCase().includes(oilSearch.transformer.toLowerCase()) || (tx.mnemonic || "").toLowerCase().includes(oilSearch.transformer.toLowerCase());
        const serialMatch = !oilSearch.serial || (tx.serialNumber || "").toLowerCase().includes(oilSearch.serial.toLowerCase());
        return siteMatch && txMatch && serialMatch;
      })
      .sort((a, b) => (b.result.date || "").localeCompare(a.result.date || ""));

    const siteGroups = Object.entries(
      filteredResults.reduce((acc, item) => {
        const site = item.tx?.site || "Unassigned Site";
        if (!acc[site]) acc[site] = [];
        acc[site].push(item);
        return acc;
      }, {})
    )
      .map(([site, items]) => {
        const transformerMap = {};
        items.forEach((item) => {
          const transformerId = item.tx?.id || item.result.transformerId || "Unknown TX";
          const transformerLabel = (item.tx?.name || item.tx?.mnemonic || item.result.transformerId || "Unknown TX").trim();
          if (!transformerMap[transformerId]) {
            transformerMap[transformerId] = { transformerId, transformerLabel, items: [] };
          }
          transformerMap[transformerId].items.push(item);
        });
        const transformerGroups = Object.values(transformerMap).sort((a, b) =>
          a.transformerLabel.localeCompare(b.transformerLabel, undefined, { numeric: true, sensitivity: "base" })
        );
        return {
          site,
          items,
          latest: items[0]?.result || null,
          transformerCount: new Set(items.map((entry) => entry.tx?.id || entry.result.transformerId)).size,
          transformerGroups,
        };
      })
      .sort((a, b) => (b.latest?.date || "").localeCompare(a.latest?.date || "") || a.site.localeCompare(b.site));

    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <h3 className="text-primary text-base font-semibold">Oil Testing Results</h3>
          <Btn onClick={() => openAddResultModal("oil")}>+ Add Oil Result</Btn>
        </div>

        <div className="glass-card px-4 py-3">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-[1_1_180px] min-w-[150px]">
              <label className="section-label block">Search Site</label>
              <input value={oilSearch.site} onChange={e => setOilSearch(p => ({ ...p, site: e.target.value }))} placeholder="All sites" className="input-field" />
            </div>
            <div className="flex-[1_1_200px] min-w-[150px]">
              <label className="section-label block">Search Transformer</label>
              <input value={oilSearch.transformer} onChange={e => setOilSearch(p => ({ ...p, transformer: e.target.value }))} placeholder="Name or mnemonic" className="input-field" />
            </div>
            <div className="flex-[1_1_180px] min-w-[150px]">
              <label className="section-label block">Search Serial No.</label>
              <input value={oilSearch.serial} onChange={e => setOilSearch(p => ({ ...p, serial: e.target.value }))} placeholder="Serial number" className="input-field" />
            </div>
            {(oilSearch.site || oilSearch.transformer || oilSearch.serial) && (
              <button onClick={() => setOilSearch({ site: "", transformer: "", serial: "" })} className="btn btn-secondary btn-sm whitespace-nowrap">
                Clear
              </button>
            )}
            <span className="text-primary-muted text-[11px] self-center">
              {filteredResults.length} of {results.length} results
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {siteGroups.map((group) => {
            const latest = group.latest;
            const expandKey = `oil:${group.site}`;
            const isExpanded = Boolean(expandedSites[expandKey]);

            return (
              <div key={`oil-${group.site}`} className="glass-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedSites((prev) => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                  className="w-full bg-transparent border-none px-3 py-2.5 flex justify-between items-center cursor-pointer text-left text-primary"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>{group.site}</div>
                    <div className="text-primary-muted text-[11px]">
                      {group.items.length} samples | {group.transformerCount} transformer{group.transformerCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap justify-end">
                    <span className="text-primary-muted text-[11px]">Latest: {latest?.date || "-"}</span>
                    <span className="text-[11px] font-mono" style={{ color: ASSET_OIL_RESULT_COLUMNS[0].color }}>
                      Moisture {formatTestValue(latest?.moisture, 1)}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: ASSET_OIL_RESULT_COLUMNS[2].color }}>
                      Acidity {formatOilTestValue("acidity", latest?.acidity, 3)}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: ASSET_OIL_RESULT_COLUMNS[3].color }}>
                      IFT {formatTestValue(latest?.ift, 1)}
                    </span>
                    <ArrowRight size={14} className="transition-transform duration-200 text-primary-dim" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-2.5 py-2 pb-3 flex flex-col gap-1.5">
                    {group.transformerGroups.map(({ transformerId, transformerLabel, items: transformerItems }) => {
                      const transformerKey = `oil:${group.site}:${transformerId}`;
                      const isTransformerExpanded = Boolean(expandedSites[transformerKey]);
                      const oilExportKey = `oil:${group.site}:${transformerId}`;
                      const oilSelectedIds = selectedExportRows[oilExportKey] || [];
                      const oilAllRowIds = transformerItems.map(({ result }) => result.id);
                      const oilAllSelected = oilAllRowIds.length > 0 && oilAllRowIds.every(id => oilSelectedIds.includes(id));
                      return (
                        <div key={transformerId} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors">
                            <button
                              type="button"
                              className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-left flex-1"
                              onClick={() => setExpandedSites(prev => ({ ...prev, [transformerKey]: !prev[transformerKey] }))}
                            >
                              <span className="text-xs font-bold text-primary">{transformerLabel}</span>
                              <span className="text-primary-muted text-[11px]">{transformerItems.length} record{transformerItems.length !== 1 ? "s" : ""}</span>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Export to Excel"
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors"
                                style={{ borderColor: "#22c55e", color: "#22c55e", background: "#22c55e18" }}
                                onClick={(e) => { e.stopPropagation(); exportOilToExcel(transformerLabel, group.site, transformerItems, oilSelectedIds); }}
                              >
                                <Download size={12} /> Excel {oilSelectedIds.length > 0 ? `(${oilSelectedIds.length})` : ""}
                              </button>
                              <button type="button" className="bg-transparent border-none cursor-pointer text-primary-muted text-[10px]" onClick={() => setExpandedSites(prev => ({ ...prev, [transformerKey]: !prev[transformerKey] }))}>{isTransformerExpanded ? "▲" : "▼"}</button>
                            </div>
                          </div>
                          {isTransformerExpanded && (
                            <div className="border-t border-border overflow-x-auto">
                              <table className="border-collapse table-auto text-[10px]" style={{ minWidth: "100%" }}>
                                <thead>
                                  <tr className="bg-surface-input">
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] border-b border-border text-center whitespace-nowrap sticky left-0 bg-surface-input z-10" style={{ minWidth: 32 }}>
                                      <input type="checkbox" checked={oilAllSelected} onChange={() => toggleExportAll(oilExportKey, oilAllRowIds)} title="Select all" />
                                    </th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-center whitespace-nowrap" style={{ minWidth: 36 }}>No.</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 90 }}>Date</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 140 }}>Transformer</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 120 }}>Oil Type</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 110 }}>Serial No.</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 100 }}>Sampling Point</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-left whitespace-nowrap" style={{ minWidth: 110 }}>Status</th>
                                    {ASSET_OIL_RESULT_COLUMNS.map((c) => (
                                      <th key={c.key} className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 80 }}>{c.label}</th>
                                    ))}
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-right whitespace-nowrap" style={{ minWidth: 80 }}>Life Used %</th>
                                    <th className="text-primary-muted px-2 py-1.5 text-[9px] uppercase tracking-wide border-b border-border text-center whitespace-nowrap" style={{ minWidth: 90 }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transformerItems.map(({ result: row, tx }, rowIdx) => {
                                    const isOilRowSelected = oilSelectedIds.includes(row.id);
                                    const rowDpFuran = Number(row.dpFromFuran) || estimateDpFromFuran(row.fal2);
                                    const rowLifePct = estimateLifetimeUsedPct(rowDpFuran);
                                    const rowBand = rowLifePct != null ? (LIFETIME_BANDS.find((b) => rowLifePct <= b.max) || LIFETIME_BANDS[3]) : null;
                                    return (
                                    <tr key={row.id} className="border-b border-border hover:bg-surface-hover transition-colors" style={isOilRowSelected ? { background: "rgba(34,197,94,0.08)" } : undefined}>
                                      <td className="px-2 py-1 text-center sticky left-0 bg-surface-card z-10" style={{ minWidth: 32 }}>
                                        <input type="checkbox" checked={isOilRowSelected} onChange={() => toggleExportRow(oilExportKey, row.id)} />
                                      </td>
                                      <td className="text-primary-dim px-2 py-1 text-center font-mono" style={{ minWidth: 36 }}>{rowIdx + 1}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 90 }}>{row.date}</td>
                                      <td className="px-2 py-1 text-left whitespace-nowrap" style={{ color: "var(--accent)", minWidth: 100 }}>{parseTxDisplayName(tx) || row.transformerId}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 120 }}>{tx?.oilType || "-"}</td>
                                      <td className="text-primary-dim px-2 py-1 text-left font-mono whitespace-nowrap" style={{ minWidth: 110 }}>{parseSerialDisplay(tx)}</td>
                                      <td className="text-primary px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 100 }}>{parseSamplingPoint(tx, row.testType)}</td>
                                      <td className="px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 110 }}>
                                        {row.testType ? (() => { const b = getTestTypeBadge(row.testType); return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold leading-tight border" style={{ background: b.bg, color: b.color, borderColor: b.border }}>{row.testType}</span>; })() : <span className="text-primary-muted text-[9px]">-</span>}
                                      </td>
                                      {ASSET_OIL_RESULT_COLUMNS.map((column) => (
                                        <td key={`${row.id}-${column.key}`} className="px-2 py-1 text-right font-mono whitespace-nowrap" style={{ color: column.color, minWidth: 80 }}>
                                          {formatTestValue(getOilColumnValue(row, column.key), column.digits)}
                                        </td>
                                      ))}
                                      <td className="px-2 py-1 text-right whitespace-nowrap font-mono font-bold" style={{ color: rowBand?.color ?? "var(--text-muted)", minWidth: 80 }}>
                                        {rowLifePct != null ? `${rowLifePct}%` : "N/A"}
                                      </td>
                                      <td className="px-2 py-1 text-center whitespace-nowrap" style={{ minWidth: 90 }}>
                                        <div className="flex gap-1 justify-center items-center flex-nowrap">
                                          <Btn size="sm" variant="secondary" onClick={() => openViewResultModal(row, "oil")} style={{ padding: "3px 6px", minWidth: 0 }}><Eye size={11} /></Btn>
                                          <Btn size="sm" variant="secondary" onClick={() => openEditResultModal(row, "oil")} style={{ padding: "3px 6px", minWidth: 0 }}><Pencil size={11} /></Btn>
                                          <Btn size="sm" variant="danger" onClick={() => confirmDeleteResult(row.id)} style={{ padding: "3px 6px", minWidth: 0 }}><Trash2 size={11} /></Btn>
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
              </div>
            );
          })}
          {siteGroups.length === 0 && (
            <div className="glass-card p-3.5 text-primary-dim text-xs">
              No oil test results match the current filters.
            </div>
          )}
        </div>

      </div>
    );
  };

  // ============================================================
  // RENDER: DIAGNOSTICS
  // ============================================================
  const renderDiagnostics = () => {
    const txId = selectedTx || transformers[0]?.id;
    const tx = transformers.find(t => t.id === txId);
    const txResults = results
      .filter((row) => row.transformerId === txId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!tx || txResults.length === 0) return <div className="text-primary-dim">No data available.</div>;

    const defaultDate = txResults[txResults.length - 1]?.date || "";
    const hasSelectedDate = txResults.some((row) => row.date === diagnosticDate);
    const activeDate = hasSelectedDate ? diagnosticDate : defaultDate;
    const r = txResults.find((row) => row.date === activeDate) || txResults[txResults.length - 1];
    const txResultsUpToDate = txResults.filter((row) => row.date <= activeDate);

    const getFaultForDateLabel = (row) => getDgaWorkbenchFaultForMode(row, tx, diagnosticDuvalMode);
    const activeDuvalFault = getFaultForDateLabel(r);
    const rogers = getRogersRatio(r);
    const keyGas = getKeyGas(r);
    const cond = getOverallCondition(r);
    const workbenchOilType = resolveDgaWorkbenchOilType(tx);
    const workbenchAnalysis = getDgaWorkbenchAnalysisForResult(r, tx);
    const workbenchFaultZones = workbenchAnalysis?.faultZones || {};
    const workbenchTriangleZoneKey = DGA_WORKBENCH_TRIANGLE_ZONE_KEYS[workbenchOilType] || "triangle1";
    const workbenchPentagonZoneKey = DGA_WORKBENCH_PENTAGON_ZONE_KEYS[workbenchOilType] || "pentagon";
    const gasValues = {
      H2: Number(r.H2) || 0,
      CH4: Number(r.CH4) || 0,
      C2H2: Number(r.C2H2) || 0,
      C2H4: Number(r.C2H4) || 0,
      C2H6: Number(r.C2H6) || 0,
      CO: Number(r.CO) || 0,
      CO2: Number(r.CO2) || 0,
    };
    const buildModeRows = (keys) => {
      const total = keys.reduce((sum, key) => sum + (gasValues[key] || 0), 0);
      return keys.map((key) => ({
        key,
        pct: total > 0 ? ((gasValues[key] / total) * 100) : 0,
        ppm: gasValues[key],
      }));
    };
    const heptagonPct = computeHeptagonPercentages(gasValues);
    const heptagonRows = heptagonPct
      ? Object.entries(heptagonPct)
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, 3)
        .map(([key, pct]) => ({ key, pct: Number(pct) || 0, ppm: gasValues[key] || 0 }))
      : [
        { key: "H2", pct: 0, ppm: gasValues.H2 },
        { key: "CH4", pct: 0, ppm: gasValues.CH4 },
        { key: "CO", pct: 0, ppm: gasValues.CO },
      ];
    const duvalSummaryCards = [
      { key: "t1", title: getDgaTriangleSummaryTitle(workbenchOilType), fault: workbenchFaultZones[workbenchTriangleZoneKey] || "ND", rows: buildModeRows(["CH4", "C2H4", "C2H2"]) },
      { key: "t4", title: "Duval Triangle 4", fault: workbenchFaultZones.triangle4 || "ND", rows: buildModeRows(["H2", "CH4", "C2H6"]) },
      { key: "t5", title: "Duval Triangle 5", fault: workbenchFaultZones.triangle5 || "ND", rows: buildModeRows(["CH4", "C2H4", "C2H6"]) },
      { key: "p1", title: getDgaPentagonSummaryTitle(workbenchOilType), fault: workbenchFaultZones[workbenchPentagonZoneKey] || "ND", rows: buildModeRows(["H2", "CH4", "C2H6", "C2H4", "C2H2"]).slice(0, 3) },
      { key: "h1", title: "Duval Heptagon", fault: workbenchAnalysis?.heptagon?.zone || workbenchFaultZones.heptagon || "ND", rows: heptagonRows },
    ];
    const keyGasInfo = GASES.find((g) => g.key === keyGas.gas);
    const keyGasPpm = gasValues[keyGas.gas] || 0;
    const keyGasTdcg = getTDCG(r);
    const keyGasShare = keyGasTdcg > 0 ? (keyGasPpm / keyGasTdcg) * 100 : 0;
    const keyGasRanking = Object.entries({
      H2: gasValues.H2,
      CH4: gasValues.CH4,
      C2H2: gasValues.C2H2,
      C2H4: gasValues.C2H4,
      C2H6: gasValues.C2H6,
      CO: gasValues.CO,
    })
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .slice(0, 3)
      .map(([key, ppm]) => ({
        key,
        ppm: Number(ppm) || 0,
      }));
    const dateOptions = [...txResults]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((row) => {
        const fault = getFaultForDateLabel(row);
        return {
          value: row.date,
          label: `${row.date} - ${fault} (${getDgaFaultLabel(fault)})`,
        };
      });
    const getWorkbenchFaultForDiagramPoint = (point, modeKey) => getDgaWorkbenchFaultForMode({
      date: point?.date,
      H2: point?.pH2,
      CH4: point?.pCH4,
      C2H2: point?.pC2H2,
      C2H4: point?.pC2H4,
      C2H6: point?.pC2H6,
      CO: point?.CO,
      CO2: point?.CO2,
    }, tx, modeKey);

    const allDiagSites = [...new Set(transformers.map(t => (t.site || "").trim()).filter(Boolean))].sort();
    const diagTxsInSite = diagSiteQuery ? transformers.filter(t => (t.site || "").trim() === diagSiteQuery) : transformers;
    const diagTxOptions = diagTxsInSite.map(t => ({ value: t.id, label: `${t.mnemonic || t.name} — ${t.site}` }));
    const diagSerialOptions = diagTxsInSite.map(t => ({ value: t.id, label: `${t.serialNumber || "-"} (${t.mnemonic || t.name})` }));
    const diagSiteOptions = allDiagSites.map(s => ({ value: s, label: s }));

    return (
      <div className="flex flex-col gap-4" ref={diagnosticsRef}>
        <div className="glass-card p-4" style={{ overflow: "visible" }}>
          <div className="flex justify-between items-center mb-3">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide">Select Transformer</div>
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors"
              style={{ borderColor: "#22c55e", color: "#22c55e", background: "#22c55e18" }}
            >
              <Download size={14} /> View as PDF
            </button>
          </div>
          <div className="flex gap-3 flex-wrap items-start">
            <div className="flex-[1_1_200px] min-w-[180px]">
              <SearchableSelect
                label="1. Site"
                value={diagSiteQuery}
                placeholder="Select site..."
                options={diagSiteOptions}
                onChange={v => { setDiagSiteQuery(v); setSelectedTx(null); setDiagnosticDate(""); }}
              />
            </div>
            <div className="flex-[1_1_220px] min-w-[180px]">
              <SearchableSelect
                label="2. Transformer (Name / Mnemonic)"
                value={txId || ""}
                placeholder="Select transformer..."
                options={diagTxOptions}
                onChange={v => { setSelectedTx(v); setDiagnosticDate(""); }}
              />
            </div>
            <div className="flex-[1_1_220px] min-w-[180px]">
              <SearchableSelect
                label="3. Serial Number"
                value={txId || ""}
                placeholder="Select by serial no..."
                options={diagSerialOptions}
                onChange={v => { setSelectedTx(v); setDiagnosticDate(""); }}
              />
            </div>
            <div className="flex-[1_1_220px] min-w-[180px]">
              <Input label="Diagnostic Date" value={activeDate} onChange={setDiagnosticDate} options={dateOptions} style={{ width: "100%" }} />
            </div>
            {tx && (
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-5"
                onClick={() => { setSelectedTx(null); setDiagSiteQuery(""); setDiagnosticDate(""); }}
              >✕ Clear</button>
            )}
          </div>
          {diagSiteQuery && (
            <div className="mt-2 text-[11px] text-accent">✓ {diagTxsInSite.length} transformer(s) in {diagSiteQuery}</div>
          )}
        </div>
        <div className="text-primary-dim text-xs">
          Viewing diagnostics for <span className="text-primary font-semibold">{activeDate}</span>:
          {" "}
          <span className="font-bold" style={{ color: getDgaFaultColor(activeDuvalFault) }}>{activeDuvalFault}</span>
          {" "}
          <span>({getDgaFaultLabel(activeDuvalFault)})</span>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex flex-nowrap gap-3 min-w-max">
          {/* IEEE C57.104 */}
          <div className="glass-card p-4 flex-none w-[220px]" data-pdf-section="ieee">
            <div className="section-label mb-2">IEEE C57.104 Overall</div>
            <Badge condition={cond} />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {GASES.map(g => {
                const gc = getCondition(g.key, r[g.key]);
                const cs = CONDITION_STYLES[gc];
                return (
                  <div key={g.key} className="flex justify-between px-2 py-1 rounded" style={{ background: cs.bg }}>
                    <span className="text-primary-dim text-xs">{g.label}</span>
                    <span className="text-xs font-mono font-semibold" style={{ color: cs.text }}>{r[g.key]} ppm</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 px-2 py-1.5 bg-surface-input rounded flex justify-between">
              <span className="text-primary-dim text-xs">TDCG</span>
              <span className="text-primary text-sm font-mono font-bold">{getTDCG(r)} ppm</span>
            </div>
          </div>

          {duvalSummaryCards.map((card) => (
            <div key={card.key} className="glass-card p-4 flex-none w-[220px]" data-pdf-section={card.key === "t1" ? "duvalT1" : card.key === "t4" ? "duvalT4" : card.key === "t5" ? "duvalT5" : card.key === "p1" ? "duvalP1" : card.key === "h1" ? "duvalH1" : undefined}>
              <div className="section-label mb-2">{card.title}</div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: getDgaFaultColor(card.fault) }} />
                <span className="text-primary text-lg font-bold">{card.fault}</span>
                <span className="text-primary-dim text-[13px]">- {getDgaFaultLabel(card.fault)}</span>
              </div>
              <div className="text-xs text-primary-dim leading-relaxed">
                {card.rows.map((row) => (
                  <div key={`${card.key}-${row.key}`} className="mb-0.5">
                    {row.key}: {row.pct.toFixed(1)}% <span className="text-primary-muted">({row.ppm.toFixed(1)} ppm)</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Rogers */}
          <div className="glass-card p-4 flex-none w-[220px]" data-pdf-section="rogers">
            <div className="section-label mb-2">Rogers Ratio</div>
            <div className="text-primary text-base font-semibold mb-2">{rogers}</div>
            <div className="text-xs text-primary-dim leading-relaxed">
              CH4/H2 = {(r.CH4 / r.H2).toFixed(3)}<br />
              C2H2/C2H4 = {r.C2H4 > 0 ? (r.C2H2 / r.C2H4).toFixed(3) : "N/A"}<br />
              C2H4/C2H6 = {r.C2H6 > 0 ? (r.C2H4 / r.C2H6).toFixed(3) : "N/A"}
            </div>
          </div>

          {/* Key Gas */}
          <div className="glass-card p-4 flex-none w-[230px]" data-pdf-section="keyGas">
            <div className="section-label mb-2">Key Gas Method</div>
            <div className="text-primary text-base font-semibold mb-2">{keyGas.fault}</div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="bg-surface-input border border-border rounded px-2 py-1.5">
                <div className="text-primary-muted text-[9px] uppercase tracking-[0.04em] leading-tight break-words">Dominant Gas</div>
                <div className="text-accent text-xs font-semibold mt-0.5">{keyGasInfo?.label || keyGas.gas}</div>
              </div>
              <div className="bg-surface-input border border-border rounded px-2 py-1.5">
                <div className="text-primary-muted text-[9px] uppercase tracking-[0.04em] leading-tight break-words">Conc.</div>
                <div className="text-primary text-xs font-mono font-semibold mt-0.5">{keyGasPpm.toFixed(1)} ppm</div>
              </div>
              <div className="bg-surface-input border border-border rounded px-2 py-1.5 col-span-2">
                <div className="text-primary-muted text-[9px] uppercase tracking-[0.04em] leading-tight break-words">Share of TDCG</div>
                <div className="text-primary text-xs font-semibold mt-0.5">{keyGasShare.toFixed(1)}% of {keyGasTdcg.toFixed(1)} ppm</div>
              </div>
            </div>
            <div className="text-xs text-primary-dim leading-relaxed">
              {keyGasRanking.map((item) => (
                <div key={`key-gas-${item.key}`} className="mb-0.5">
                  {item.key}: {item.ppm.toFixed(1)} ppm
                </div>
              ))}
            </div>
          </div>

          {/* Gas Profile Radar */}
          <div className="glass-card p-4 flex-none w-[275px]" data-pdf-section="radar">
            <div className="section-label mb-0">Gas Profile Radar - IEEE C57.104:2018</div>
            <ResponsiveContainer width="100%" height={259}>
              <RadarChart
                outerRadius="68%"
                data={GASES.filter(g => g.key !== "CO2").map(g => ({
                  gas: g.label,
                  actual: Math.round((r[g.key] / IEEE_LIMITS[g.key].poor) * 1000) / 10,
                  ppm: r[g.key],
                  limit: 100,
                }))}
              >
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="gas" tick={{ fill: "var(--text-dim)", fontSize: 13 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tickCount={4} tick={{ fill: "var(--text-muted)", fontSize: 10 }} unit="%" />
                <Radar name="DGA Reading" dataKey="actual" stroke="#06b6d4" strokeWidth={2} fill="#06b6d4" fillOpacity={0.25} />
                <Radar name="IEEE Limit (Cond. 3)" dataKey="limit" stroke="#f97316" strokeWidth={2} fill="#f97316" fillOpacity={0.06} strokeDasharray="5 3" />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name, p) => {
                    if (name === "DGA Reading") return [`${v.toFixed(1)}%  (${p.payload.ppm} ppm)`, name];
                    return [`${v}%  (action level)`, name];
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>

        <div data-pdf-section="duvalDiagram">
          <DGAWorkbenchPanel
            transformer={tx}
            oilTests={txResultsUpToDate}
            selectedTestId={r?.id}
            selectedDate={activeDate}
            colorMode={colorMode}
          />
        </div>
        <div
          aria-hidden="true"
          style={{ position: "fixed", left: "-10000px", top: 0, width: 920, pointerEvents: "none", zIndex: -1 }}
        >
          {PDF_DUVAL_DIAGRAM_OPTIONS.map((option) => (
            <div
              key={`pdf-diagram-${option.key}`}
              data-pdf-diagram-capture={option.key}
              style={{ width: option.mode === "p1" ? 760 : 740, marginBottom: 24 }}
            >
              <DiagnosticsDuvalPanel
                txResults={txResultsUpToDate}
                duvalImageConfig={DUVAL_IMAGE_CONFIG}
                getDuvalFaultForMode={getWorkbenchFaultForDiagramPoint}
                getDuvalTriangleImageXY={getDuvalTriangleImageXY}
                getDuvalPentagonImageXY={getDuvalPentagonImageXY}
                faultLabels={FAULT_LABELS}
                faultColors={FAULT_COLORS}
                activeMode={option.mode}
                diagramOnly
              />
            </div>
          ))}
        </div>

        {/* PDF Export Modal */}
        <Modal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          title="Export Diagnostics to PDF"
          subtitle="Select the sections you want to include in your PDF report."
        >
          <div className="flex flex-col gap-3">
            <div className="text-primary-muted text-[11px] uppercase tracking-wide mb-1">Select Sections</div>
            <div className="text-primary-dim text-xs">
              Duval diagram options export only the plotted diagram area. Use the full panel option if you also want the right-side details card.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PDF_SECTION_OPTIONS.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-surface-hover transition-colors" style={pdfSections[opt.key] ? { borderColor: "#22c55e", background: "#22c55e12" } : undefined}>
                  <input
                    type="checkbox"
                    checked={!!pdfSections[opt.key]}
                    onChange={() => setPdfSections(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                  />
                  <span className="text-primary text-xs">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="text-[11px] text-accent cursor-pointer bg-transparent border-none"
                onClick={() => setPdfSections(Object.fromEntries(PDF_SECTION_OPTIONS.map(o => [o.key, true])))}
              >Select All</button>
              <button
                type="button"
                className="text-[11px] text-primary-muted cursor-pointer bg-transparent border-none"
                onClick={() => setPdfSections(Object.fromEntries(PDF_SECTION_OPTIONS.map(o => [o.key, false])))}
              >Deselect All</button>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <Btn variant="secondary" onClick={() => setShowPdfModal(false)}>Cancel</Btn>
              <Btn
                onClick={generateDiagnosticsPdf}
                disabled={pdfGenerating || !Object.values(pdfSections).some(Boolean)}
                style={{ background: "#22c55e", borderColor: "#22c55e" }}
              >
                {pdfGenerating ? "Generating..." : "Generate PDF"}
              </Btn>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================
  // RENDER: TRENDS
  // ============================================================
  const renderTrends = () => {
    const txId = selectedTx || transformers[0]?.id;
    const tx = transformers.find(t => t.id === txId);
    const txResults = results.filter(r => r.transformerId === txId).sort((a, b) => a.date.localeCompare(b.date));

    // --- Searchable selector data ---
    const allSites = [...new Set(transformers.map(t => (t.site || "").trim()).filter(Boolean))].sort();
    const txsInSite = trendsSiteQuery ? transformers.filter(t => (t.site || "").trim() === trendsSiteQuery) : transformers;
    const txOptions = txsInSite.map(t => ({ value: t.id, label: `${t.mnemonic || t.name} — ${t.site}` }));
    const serialOptions = txsInSite.map(t => ({ value: t.id, label: `${t.serialNumber || "-"} (${t.mnemonic || t.name})` }));
    const siteOptions = allSites.map(s => ({ value: s, label: s }));

    const trendsTabs = [
      { id: "sparkline", label: "Sparkline Trends", icon: TrendingUp },
      { id: "charts", label: "Data Chart Trending", icon: BarChart3 },
    ];

    return (
      <div className="flex flex-col gap-4">
        {/* Transformer selector */}
        <div className="glass-card p-4" style={{ overflow: "visible" }}>
          <div className="text-primary-muted text-[11px] uppercase tracking-wide mb-3">Select Transformer</div>
          <div className="flex gap-3 flex-wrap items-start">
            <div className="flex-[1_1_200px] min-w-[180px]">
              <SearchableSelect
                label="1. Site"
                value={trendsSiteQuery}
                placeholder="Select site..."
                options={siteOptions}
                onChange={v => { setTrendsSiteQuery(v); setSelectedTx(null); }}
              />
            </div>
            <div className="flex-[1_1_220px] min-w-[180px]">
              <SearchableSelect
                label="2. Transformer (Name / Mnemonic)"
                value={txId || ""}
                placeholder="Select transformer..."
                options={txOptions}
                onChange={v => setSelectedTx(v)}
              />
            </div>
            <div className="flex-[1_1_220px] min-w-[180px]">
              <SearchableSelect
                label="3. Serial Number"
                value={txId || ""}
                placeholder="Select by serial no..."
                options={serialOptions}
                onChange={v => setSelectedTx(v)}
              />
            </div>
            {tx && (
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-5"
                onClick={() => { setSelectedTx(null); setTrendsSiteQuery(""); }}
              >✕ Clear</button>
            )}
          </div>
          {trendsSiteQuery && (
            <div className="mt-2 text-[11px] text-accent">✓ {txsInSite.length} transformer(s) in {trendsSiteQuery}</div>
          )}
        </div>

        {/* Sub-tab switcher */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {trendsTabs.map((t) => {
            const Icon = t.icon;
            const active = trendsView === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrendsView(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  border: active ? "1px solid var(--accent-border-strong)" : "1px solid rgba(148,163,184,0.14)",
                  background: active ? "var(--primary-soft)" : "rgba(15,23,42,0.52)",
                  color: active ? "var(--accent)" : "var(--text-dim, #94a3b8)",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tx ? (
          trendsView === "sparkline" ? (
            <DataTrendingV2 records={txResults} transformer={tx} approvedHistory={trendAssessmentHistory} />
          ) : (
            <DataChartTrending records={txResults} transformer={tx} approvedHistory={trendAssessmentHistory} />
          )
        ) : (
          <div className="text-primary-dim p-5">Select a transformer to view trend history.</div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER: CLUSTERING
  // ============================================================
  const renderClustering = () => {
    const CLUSTER_COLORS = ["#38bdf8", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308"];
    const hasPca3D = clusterResults?.source === "python"
      && clusterResults.data.some((point) => Number.isFinite(point.pca_z))
      && new Set(clusterResults.data.map((point) => Number(point.pca_z).toFixed(4))).size > 1;
    const chart2dLabel = clusterResults?.source === "python" ? "PCA 2D Projection" : "TDCG vs Age";
    const chartTitle = clusterViewMode === "cluster3d" ? "3D Cluster Graph" : chart2dLabel;
    const chart3dAxes = hasPca3D
      ? [
          { key: "pca_x", label: "PC1" },
          { key: "pca_y", label: "PC2" },
          { key: "pca_z", label: "PC3" },
        ]
      : [
          { key: "age", label: "Age (years)" },
          { key: "tdcg", label: "TDCG (ppm)" },
          { key: "loadMVA", label: "Load MVA" },
        ];

    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card p-5">
          <h3 className="text-primary text-sm mb-2 flex items-center gap-2">
            <Bot size={16} style={{ color: "var(--accent)" }} />
            K-Means Clustering
          </h3>
          <p className="text-primary-dim text-xs mb-4 leading-relaxed">
            Groups transformers by DGA gas pattern similarity. Uses {backendOnline && hasClustering ? "Python scikit-learn (StandardScaler + PCA)" : "JavaScript K-Means"} backend.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <Input label="Number of Clusters (K)" value={clusterK} onChange={v => setClusterK(Math.max(2, Math.min(6, parseInt(v) || 2)))} type="number" />
            <Btn onClick={runClustering}>Run Clustering</Btn>
            {backendOnline && hasClustering && <span className="text-success text-[11px]">Using Python ML backend</span>}
          </div>
        </div>

        {clusterResults && (
          <>
            <div className="glass-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-primary text-sm">
                  Cluster Visualization - {chartTitle}
                </h3>
                <div
                  className="flex items-center gap-1 p-1 rounded-xl border border-border"
                  style={{ background: "rgba(15, 23, 42, 0.65)" }}
                >
                  <Btn
                    size="sm"
                    variant={clusterViewMode === "projection2d" ? "primary" : "secondary"}
                    onClick={() => setClusterViewMode("projection2d")}
                  >
                    {chart2dLabel}
                  </Btn>
                  <Btn
                    size="sm"
                    variant={clusterViewMode === "cluster3d" ? "primary" : "secondary"}
                    onClick={() => setClusterViewMode("cluster3d")}
                  >
                    3D Cluster Graph
                  </Btn>
                </div>
              </div>
              {clusterViewMode === "projection2d" ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey={clusterResults.source === "python" ? "pca_x" : "age"} name={clusterResults.source === "python" ? "PC1" : "Age (years)"} type="number" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                    <YAxis dataKey={clusterResults.source === "python" ? "pca_y" : "tdcg"} name={clusterResults.source === "python" ? "PC2" : "TDCG (ppm)"} type="number" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                    <Tooltip content={({ payload }) => {
                      if (!payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}`, padding: 10, borderRadius: 6, fontSize: 12, color: "var(--text)" }}>
                          <div style={{ fontWeight: 600 }}>{d.name}</div>
                          <div style={{ color: "var(--text-dim)" }}>Cluster {d.cluster + 1} | {d.voltage} | {d.loadMVA} MVA</div>
                          <div>Age: {d.age} yrs | TDCG: {d.tdcg} ppm</div>
                          <div>Duval: {FAULT_LABELS[d.duval]}</div>
                        </div>
                      );
                    }} />
                    {Array.from({ length: clusterResults.k }, (_, i) => (
                      <Scatter key={i} name={`Cluster ${i + 1}`} data={clusterResults.data.filter(d => d.cluster === i)} fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <>
                  <Cluster3DGraph
                    data={clusterResults.data}
                    colors={CLUSTER_COLORS}
                    axes={chart3dAxes}
                    height={360}
                    faultLabelMap={FAULT_LABELS}
                  />
                  <div className="flex flex-wrap gap-3 pt-2 text-[11px]">
                    {Array.from({ length: clusterResults.k }, (_, i) => (
                      <div key={`cluster-legend-${i}`} className="flex items-center gap-1.5 text-primary-dim">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                        />
                        Cluster {i + 1}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {clusterResults.pca_variance && clusterResults.source === "python" && (
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8 }}>
                  PCA Variance Explained: PC1={(clusterResults.pca_variance[0] * 100).toFixed(1)}%, PC2={(clusterResults.pca_variance[1] * 100).toFixed(1)}%
                  {clusterViewMode === "cluster3d" && clusterResults.pca_variance[2] !== undefined ? `, PC3=${(clusterResults.pca_variance[2] * 100).toFixed(1)}%` : ""}
                </div>
              )}
              {clusterViewMode === "cluster3d" && !hasPca3D && (
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8 }}>
                  3D axes are using Age, TDCG, and Load MVA because a third PCA component is not available in the current clustering result.
                </div>
              )}
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
              {Array.from({ length: clusterResults.k }, (_, ci) => {
                const members = clusterResults.data.filter(d => d.cluster === ci);
                if (members.length === 0) return null;
                const avgTDCG = (members.reduce((s, m) => s + m.tdcg, 0) / members.length).toFixed(0);
                const avgAge = (members.reduce((s, m) => s + m.age, 0) / members.length).toFixed(1);
                const faults = {};
                members.forEach(m => { faults[m.duval] = (faults[m.duval] || 0) + 1; });
                const dominantFault = Object.entries(faults).reduce((a, b) => a[1] > b[1] ? a : b, ["N", 0]);
                return (
                  <div key={ci} className="glass-card p-4" style={{ borderLeft: `4px solid ${CLUSTER_COLORS[ci]}` }}>
                    <div className="flex justify-between items-center mb-2.5">
                      <h4 className="text-sm font-bold" style={{ color: CLUSTER_COLORS[ci] }}>Cluster {ci + 1}</h4>
                      <span className="text-primary-dim text-xs">{members.length} transformer{members.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-xs">
                      <div><span className="text-primary-muted">Avg TDCG:</span> <span className="text-primary font-semibold">{avgTDCG} ppm</span></div>
                      <div><span className="text-primary-muted">Avg Age:</span> <span className="text-primary font-semibold">{avgAge} yrs</span></div>
                      <div className="col-span-2"><span className="text-primary-muted">Dominant Fault:</span> <span className="font-semibold" style={{ color: FAULT_COLORS[dominantFault[0]] }}>{FAULT_LABELS[dominantFault[0]]}</span></div>
                    </div>
                    <div className="max-h-80 overflow-y-auto pr-1">
                      {members.map((m) => {
                        const locationText = `${m.voltage} | ${m.site || "Unknown Site"}`;
                        return (
                          <div key={m.id} className="py-1 border-t border-border text-[11px] flex items-center justify-between gap-2">
                            <span className="text-primary min-w-0 truncate" title={m.name}>{m.name}</span>
                            <span className="text-primary-muted min-w-0 truncate text-right" title={locationText}>{locationText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass-card p-5">
              <h3 className="text-primary text-sm mb-3">Cluster Average Gas Profiles</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={GASES.filter(g => g.key !== "CO2").map(g => {
                  const d = { gas: g.label };
                  for (let ci = 0; ci < clusterResults.k; ci++) {
                    const members = clusterResults.data.filter(m => m.cluster === ci);
                    d[`C${ci + 1}`] = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.result[g.key], 0) / members.length) : 0;
                  }
                  return d;
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="gas" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Array.from({ length: clusterResults.k }, (_, i) => (
                    <Bar key={i} dataKey={`C${i + 1}`} name={`Cluster ${i + 1}`} fill={CLUSTER_COLORS[i]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    );
  };
  // ============================================================
  // RENDER: ML PREDICTIONS (ARIMA / LSTM / Linear)
  // ============================================================
  const renderPredictions = () => {
    const RISK_STYLES = {
      low: { bg: "#052e16", border: "#16a34a", text: "#4ade80", icon: CheckCircle2 },
      medium: { bg: "#1a2332", border: "#2563eb", text: "#60a5fa", icon: TriangleAlert },
      high: { bg: "#2d1b06", border: "#d97706", text: "#fbbf24", icon: TriangleAlert },
      critical: { bg: "#2d0606", border: "#dc2626", text: "#f87171", icon: Siren },
    };
    const fallbackSeriesColors = ["#38bdf8", "#22c55e", "#f97316", "#ef4444", "#a855f7", "#06b6d4", "#84cc16", "#f59e0b"];
    const MODEL_COLORS = { arima: "#38bdf8", lstm: "#f97316", xgboost: "#22c55e", lightgbm: "#a855f7", nature_hybrid: "#06b6d4", fault_rf: "#ef4444", linear: "#94a3b8" };
    // Smart decimal formatting: use 4 decimals for tiny values (acidity, pf), 1 for large values (ppm gases)
    const fmtVal = (v, metricKey) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return "-";
      const fixedDigits = getOilTestDisplayDigits(metricKey);
      if (fixedDigits !== undefined) {
        return n.toFixed(fixedDigits);
      }
      const abs = Math.abs(n);
      if (abs === 0) return "0";
      if (abs < 0.01) return n.toFixed(4);
      if (abs < 0.1) return n.toFixed(3);
      if (abs < 1) return n.toFixed(2);
      return n.toFixed(1);
    };
    const MODEL_DASH = { arima: "6 3", lstm: "8 4", xgboost: "4 2", lightgbm: "10 5", nature_hybrid: "3 6", fault_rf: "6 6", linear: "2 2" };
    const isComparing = mlCompareResults && Object.keys(mlCompareResults).length > 1;
    const forecastSeries = Object.entries(mlPredictions?.forecasts || {}).map(([key, forecast], idx) => {
      const meta = PREDICTION_TEST_META[key] || {};
      return {
        key,
        forecast,
        label: meta.label || key,
        color: meta.color || fallbackSeriesColors[idx % fallbackSeriesColors.length],
        unit: meta.unit || "value",
      };
    });

    return (
      <div className="flex flex-col gap-4">
        {/* Controls */}
        <div className="glass-card p-5">
          <h3 className="text-primary text-sm mb-2 flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--accent)" }} />
            ML Test Trend Prediction
          </h3>
          <p className="text-primary-dim text-xs mb-4 leading-relaxed">
            Select a prediction model, transformer, and test parameters to forecast trend behavior with confidence intervals. Predictions target the selected transformer while learning from similar transformers across all sites based on maker, brand, oil, paper insulation, voltage class, and load.
            {!backendOnline && " Start the Python backend for ARIMA/LSTM/XGBoost/LightGBM/Fault RF models."}
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div style={{ minWidth: 200 }}>
              <SearchableSelect
                label="Site"
                value={predSiteQuery}
                placeholder="Select site..."
                options={predSiteOptions}
                onChange={v => { setPredSiteQuery(v); setPredTxLabel(""); setPredictionTx(""); }}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <SearchableSelect
                label="Transformer"
                value={predTxLabel}
                placeholder="Select TX..."
                options={predTxLabelOptions}
                onChange={v => { setPredTxLabel(v); setPredictionTx(""); }}
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <SearchableSelect
                label="Serial No."
                value={predictionTx}
                placeholder="Select serial..."
                options={predSerialOptions}
                onChange={setPredictionTx}
              />
            </div>
            <Input label="Forecast Months" value={predMonths} onChange={v => setPredMonths(parseInt(v) || 12)} type="number" />
            <div className="flex flex-col gap-1">
              <label className="text-primary-dim text-xs font-medium">Models <span className="text-primary-muted font-normal">(click multiple to compare)</span></label>
              <div className="flex gap-1 flex-wrap">
                {[
                  { id: "arima", label: "ARIMA", available: backendOnline && hasArima },
                  { id: "lstm", label: "LSTM", available: backendOnline && hasLstm },
                  { id: "xgboost", label: "XGBoost", available: backendOnline && hasXgboost },
                  { id: "lightgbm", label: "LightGBM", available: backendOnline && hasLightgbm },
                  { id: "nature_hybrid", label: "Nature Hybrid", available: backendOnline && hasNatureHybrid },
                  { id: "fault_rf", label: "Fault RF", available: backendOnline && hasFaultPrediction },
                  { id: "linear", label: "Linear (JS)", available: true },
                ].map(m => (
                  <button key={m.id} onClick={() => m.available && togglePredModel(m.id)} disabled={!m.available}
                    className={`btn btn-sm font-semibold ${predModels.includes(m.id) ? "btn-primary" : "btn-secondary"}`}
                    style={{ opacity: m.available ? 1 : 0.4 }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <Btn onClick={runMLPrediction} disabled={!predictionTx || mlLoading || activePredTests.length === 0}>
              {mlLoading ? "Running..." : "Run Prediction"}
            </Btn>
            {predModels.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-primary-dim text-xs font-medium">Ensemble</label>
                <div className="flex gap-1">
                  <button onClick={() => setEnsembleMode("off")}
                    className={`btn btn-sm font-semibold ${ensembleMode === "off" ? "btn-primary" : "btn-secondary"}`}>
                    Off
                  </button>
                  <button onClick={() => setEnsembleMode("avg")}
                    className={`btn btn-sm font-semibold ${ensembleMode === "avg" ? "btn-primary" : "btn-secondary"}`}>
                    Average
                  </button>
                  <button onClick={() => setEnsembleMode("weighted")}
                    className={`btn btn-sm font-semibold ${ensembleMode === "weighted" ? "btn-primary" : "btn-secondary"}`}>
                    Weighted
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3.5 rounded-xl border border-white/10 bg-card/60 bg-glass-gradient p-3 shadow-glass backdrop-blur-md">
            <div className="flex justify-between items-center gap-2.5 flex-wrap mb-2">
              <div className="text-primary-dim text-xs font-semibold">
                Tests to Predict ({activePredTests.length} selected)
              </div>
              {!(hasFaultRfSelected && predModels.length === 1) ? (
                <div className="flex gap-1.5">
                  <Btn size="sm" variant="secondary" onClick={() => setPredTests(DEFAULT_PREDICTION_TEST_KEYS)}>Gas Only</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => setPredTests(PREDICTION_TESTS.map(t => t.key))}>Select All</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => setPredTests([])}>Clear</Btn>
                </div>
              ) : (
                <span className="text-warning text-[11px]">Fault RF uses fixed dissolved-gas inputs.</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PREDICTION_TESTS.map((test) => {
                const selected = activePredTests.includes(test.key);
                const locked = hasFaultRfSelected && predModels.length === 1;
                return (
                  <button
                    key={test.key}
                    type="button"
                    onClick={() => togglePredictionTest(test.key)}
                    disabled={locked}
                    className="pill-btn"
                    style={{
                      background: selected
                        ? `linear-gradient(135deg, ${test.color}2e 0%, ${test.color}14 100%)`
                        : "var(--accent-soft)",
                      color: selected ? test.color : "var(--text-dim)",
                      borderColor: selected ? `${test.color}88` : "var(--accent-border)",
                      fontWeight: selected ? 700 : 500,
                      opacity: locked && !selected ? 0.45 : 1,
                      backdropFilter: "blur(10px)",
                      boxShadow: selected
                        ? `inset 0 1px 0 ${test.color}22`
                        : "inset 0 1px 0 rgba(255,255,255,0.05)",
                    }}
                  >
                    {test.label}
                  </button>
                );
              })}
            </div>
          </div>
          {mlLoading && (
            <div className="flex items-center gap-2 mt-3 text-accent">
              <Spinner /> <span className="text-xs">Running {predModels.length > 1 ? `${predModels.length} models` : predModels[0] === "nature_hybrid" ? "Nature Hybrid" : predModels[0].toUpperCase()}{predModels.includes("lstm") ? " (LSTM may take 10-30s)" : ""}...</span>
            </div>
          )}
          {mlError && (
            <div className="alert-error mt-3">
              <span className="inline-flex items-center gap-1.5">
                <XCircle size={14} />
                {mlError}
              </span>
            </div>
          )}
        </div>

        {/* Results */}
        {mlPredictions && (
          <>
            {/* Risk Assessment Banner */}
            {mlPredictions.overall_risk && mlPredictions.model_type !== "linear" && (() => {
              const rs = RISK_STYLES[mlPredictions.overall_risk] || RISK_STYLES.low;
              const RiskIcon = rs.icon;
              return (
                <div style={{ background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <RiskIcon size={18} color={rs.text} />
                    <span style={{ color: rs.text, fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>
                      {mlPredictions.overall_risk} Risk - {mlPredictions.model_type.toUpperCase()} Model
                    </span>
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.6 }}>{mlPredictions.risk_summary}</div>
                  <div style={{ color: "var(--text)", fontSize: 12, marginTop: 8, fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Lightbulb size={14} color="var(--warning)" />
                    {mlPredictions.recommendation}
                  </div>
                </div>
              );
            })()}

            {/* Transformer Profile */}
            {(() => {
              const ptx = transformers.find(t => t.id === predictionTx);
              if (!ptx) return null;
              const age = getAge(ptx.dateEnergized);
              const infoItems = [
                { label: "Site", value: ptx.site },
                { label: "Transformer", value: ptx.name },
                { label: "Serial No.", value: ptx.serialNumber },
                { label: "Brand", value: ptx.brand },
                { label: "Maker", value: ptx.maker },
                { label: "Oil Brand", value: ptx.oilBrand, accent: true },
                { label: "Oil Type", value: ptx.oilType },
                { label: "Paper Type", value: ptx.paperType || DEFAULT_PAPER_TYPE },
                { label: "Voltage", value: ptx.voltage },
                { label: "Load", value: ptx.loadMVA ? `${ptx.loadMVA} MVA` : "" },
                { label: "Age", value: age ? `${age} years` : "" },
                { label: "Year Energized", value: ptx.dateEnergized },
              ];
              return (
                <div
                  className="glass-card p-4"
                  style={{ borderRadius: 8 }}
                >
                  <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 600 }}>Transformer Profile</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                    {infoItems.map(item => (
                      <div
                        key={item.label}
                        style={{
                          background: "linear-gradient(135deg, var(--accent-soft) 0%, rgba(255,255,255,0.02) 100%)",
                          border: "1px solid var(--accent-border)",
                          borderRadius: 6,
                          padding: "8px 10px",
                          backdropFilter: "blur(10px)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                        }}
                      >
                        <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>{item.label}</div>
                        <div style={{ color: item.accent ? "var(--accent)" : "var(--text)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{item.value || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {mlPredictions.model_type === "fault_rf" && (() => {
              const hasApiDuval = Array.isArray(mlPredictions.duval_points) && mlPredictions.duval_points.length > 0;
              const fallbackHistory = (mlPredictions.historicalData || []).map((r) => {
                const h2 = Number(r.H2) || 0;
                const ch4 = Number(r.CH4) || 0;
                const c2h6 = Number(r.C2H6) || 0;
                const c2h4 = Number(r.C2H4) || 0;
                const c2h2 = Number(r.C2H2) || 0;
                const pentTotal = h2 + ch4 + c2h6 + c2h4 + c2h2;
                return {
                  date: r.date,
                  type: "history",
                  month: 0,
                  fault: getDuvalFault(ch4, c2h4, c2h2),
                  duval_t1: getDuvalFault(ch4, c2h4, c2h2),
                  duval_t4: getDuvalFaultT4(h2, ch4, c2h6),
                  duval_t5: getDuvalFaultT5(ch4, c2h4, c2h6),
                  duval_p1: getDuvalFaultP1(h2, ch4, c2h6, c2h4, c2h2),
                  pH2: pentTotal > 0 ? (h2 / pentTotal) * 100 : 0,
                  pCH4: pentTotal > 0 ? (ch4 / pentTotal) * 100 : 0,
                  pC2H6: pentTotal > 0 ? (c2h6 / pentTotal) * 100 : 0,
                  pC2H4: pentTotal > 0 ? (c2h4 / pentTotal) * 100 : 0,
                  pC2H2: pentTotal > 0 ? (c2h2 / pentTotal) * 100 : 0,
                };
              });

              const duvalRaw = hasApiDuval ? mlPredictions.duval_points : fallbackHistory;
              const hasModeData = {
                t1: duvalRaw.some((p) => p?.pCH4 != null && p?.pC2H4 != null && p?.pC2H2 != null),
                t4: duvalRaw.some((p) => p?.pH2 != null && p?.pCH4 != null && p?.pC2H6 != null),
                t5: duvalRaw.some((p) => p?.pCH4 != null && p?.pC2H4 != null && p?.pC2H6 != null),
                p1: duvalRaw.some((p) => p?.pH2 != null && p?.pCH4 != null && p?.pC2H6 != null && p?.pC2H4 != null && p?.pC2H2 != null),
              };
              const activeDiagramKey = hasModeData[faultDiagramView] ? faultDiagramView : "t1";
              const activeDiagram = DUVAL_IMAGE_CONFIG[activeDiagramKey] || DUVAL_IMAGE_CONFIG.t1;

              const projectPoint = (p) => {
                if (activeDiagramKey === "p1") {
                  return getDuvalPentagonImageXY(p.pH2, p.pCH4, p.pC2H6, p.pC2H4, p.pC2H2);
                }
                if (activeDiagramKey === "t4") {
                  return getDuvalTriangleImageXY(p.pH2, p.pCH4, p.pC2H6);
                }
                if (activeDiagramKey === "t5") {
                  return getDuvalTriangleImageXY(p.pCH4, p.pC2H4, p.pC2H6);
                }
                return getDuvalTriangleImageXY(p.pCH4, p.pC2H4, p.pC2H2);
              };

              const duvalPoints = duvalRaw
                .map((p, idx) => {
                  const xy = projectPoint(p);
                  if (!xy) return null;
                  return { ...p, ...xy, idx };
                })
                .filter(Boolean);

              const pathD = duvalPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              const firstPoint = duvalPoints[0];
              const lastPoint = duvalPoints[duvalPoints.length - 1];
              const historyPoint = [...duvalRaw].filter((p) => p.type === "history").slice(-1)[0] || null;
              const latestForecastMonth = Math.max(...(mlPredictions.fault_forecast || []).map((f) => Number(f.month) || 0), 0);
              const HISTORY_COLOR = "var(--accent)";
              const FORECAST_COLOR = "#f59e0b";
              const LATEST_COLOR = "var(--danger)";
              const getIndicatorFault = (point, fallback = "N") =>
                point?.fault || point?.predicted_fault || getDuvalFaultForMode(point, activeDiagramKey) || fallback;

              return (
                <div style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                    Fault Classification Forecast (Random Forest)
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 10 }}>
                    Current fault: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{mlPredictions.current_fault || "N/A"}</span>
                  </div>

                  <div style={{ background: "var(--bg-input)", border: `1px solid ${"var(--border)"}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 600 }}>
                        {activeDiagram.modeName} Movement (History to Forecast)
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {Object.values(DUVAL_IMAGE_CONFIG).map((cfg) => {
                          const unavailable = !hasModeData[cfg.key];
                          const active = activeDiagramKey === cfg.key;
                          return (
                            <button
                              key={cfg.key}
                              type="button"
                              disabled={unavailable}
                              onClick={() => !unavailable && setFaultDiagramView(cfg.key)}
                              style={{
                                padding: "6px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                cursor: unavailable ? "not-allowed" : "pointer",
                                background: active ? "var(--accent)" : "var(--bg-input)",
                                color: active ? "var(--primary-foreground)" : unavailable ? "var(--text-muted)" : "var(--text)",
                                border: active ? "none" : `1px solid ${"var(--border)"}`,
                                opacity: unavailable ? 0.5 : 1,
                              }}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!hasModeData[faultDiagramView] && (
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 8 }}>
                        Selected Duval view has incomplete data. Showing Triangle 1.
                      </div>
                    )}

                    {duvalPoints.length > 1 ? (
                      <>
                        <div
                          style={{
                            position: "relative",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: `1px solid ${"var(--border)"}`,
                            background: "var(--bg-card)",
                            maxWidth: activeDiagramKey === "p1" ? 700 : 660,
                            margin: "0 auto",
                          }}
                        >
                          <img
                            src={activeDiagram.src}
                            alt={activeDiagram.modeName}
                            style={{
                              width: "100%",
                              display: "block",
                              background: "var(--bg-card)",
                              filter: activeDiagramKey === "p1"
                                ? "brightness(1.14) contrast(0.96)"
                                : "brightness(1.2) contrast(0.95)",
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
                            {pathD && (
                              <path
                                d={pathD}
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="6"
                                strokeDasharray="15 10"
                                strokeLinecap="round"
                                opacity="0.95"
                              />
                            )}

                            {duvalPoints.map((p, idx) => {
                              const isFinal = idx === duvalPoints.length - 1;
                              const isForecast = p.type === "forecast";
                              const fill = isFinal ? "var(--danger)" : isForecast ? "#f59e0b" : "var(--accent)";
                              return (
                                <g key={`${p.date}-${idx}`}>
                                  <circle cx={p.x} cy={p.y} r={isFinal ? 14 : 11} fill={fill} stroke="#ffffff" strokeWidth="3" />
                                  <circle cx={p.x} cy={p.y} r={isFinal ? 5 : 4} fill="#ffffff" />
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: 11 }}>
                          <span style={{ color: "var(--text-dim)" }}>
                            Start: <span style={{ color: "var(--text)" }}>{firstPoint?.date}</span> ({getIndicatorFault(firstPoint)})
                          </span>
                          <span style={{ color: "var(--text-dim)" }}>
                            End: <span style={{ color: "var(--text)" }}>{lastPoint?.date}</span> ({getIndicatorFault(lastPoint)})
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11 }}>
                          <span style={{ color: HISTORY_COLOR }}>* History</span>
                          <span style={{ color: FORECAST_COLOR }}>* Forecast</span>
                          <span style={{ color: LATEST_COLOR }}>* Latest point</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        Not enough Duval points to draw movement path.
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                    {historyPoint && (
                      <div
                        key="history-reference"
                        style={{
                          background: "var(--bg-input)",
                          border: `1px solid ${HISTORY_COLOR}`,
                          borderRadius: 6,
                          padding: 10,
                          boxShadow: `inset 0 0 0 1px ${HISTORY_COLOR}22`,
                        }}
                      >
                        <div style={{ color: HISTORY_COLOR, fontSize: 10, fontWeight: 700, marginBottom: 3 }}>History</div>
                        <div style={{ color: "var(--text-dim)", fontSize: 10, marginBottom: 4 }}>{historyPoint.date || "-"}</div>
                        <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>
                          {getIndicatorFault(historyPoint)}
                        </div>
                        <div style={{ color: "var(--text-dim)", fontSize: 10 }}>
                          {FAULT_LABELS[getIndicatorFault(historyPoint)] || "Unknown fault"}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 4 }}>
                          {activeDiagram.label}: {getDuvalFaultForMode(historyPoint, activeDiagramKey)} ({FAULT_LABELS[getDuvalFaultForMode(historyPoint, activeDiagramKey)] || "Unknown"})
                        </div>
                      </div>
                    )}
                    {(mlPredictions.fault_forecast || []).map((f) => {
                      const point = duvalRaw.find((p) => p.type === "forecast" && Number(p.month) === Number(f.month));
                      const modeFault = getDuvalFaultForMode(point, activeDiagramKey);
                      const rfFault = point?.fault || f.predicted_fault || "N";
                      const duvalFault = modeFault || "N";
                      const isLatestPoint = Number(f.month) === latestForecastMonth;
                      const pointRoleColor = isLatestPoint ? LATEST_COLOR : FORECAST_COLOR;
                      return (
                        <div
                          key={f.month}
                          style={{
                            background: "var(--bg-input)",
                            border: `1px solid ${pointRoleColor}`,
                            borderRadius: 6,
                            padding: 10,
                            boxShadow: `inset 0 0 0 1px ${pointRoleColor}22`,
                          }}
                        >
                          <div style={{ color: pointRoleColor, fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                            {isLatestPoint ? "Latest point" : "Forecast"}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10 }}>Month {f.month}</div>
                          <div style={{ color: "var(--text-dim)", fontSize: 10, marginBottom: 4 }}>{f.date}</div>
                          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>{f.predicted_fault}</div>
                          <div style={{ color: "var(--text-dim)", fontSize: 10 }}>{FAULT_LABELS[f.predicted_fault] || "Unknown fault"}</div>
                          <div style={{ color: "var(--accent)", fontSize: 10, marginTop: 4 }}>
                            RF Model: {rfFault} ({FAULT_LABELS[rfFault] || "Unknown"})
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
                            {activeDiagram.label}: {duvalFault} ({FAULT_LABELS[duvalFault] || "Unknown"})
                          </div>
                          <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
                            Confidence {(Number(f.confidence || 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {mlPredictions.model_type !== "fault_rf" && (
              <>
            {/* Forecast Summary Cards */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {forecastSeries.map((series) => {
                const { key, label, color, unit, forecast: fc } = series;
                const lastFc = fc.forecasted_values?.[fc.forecasted_values.length - 1];
                const futureVal = lastFc?.value || 0;
                const limit = IEEE_LIMITS[key];
                const futureCond = limit ? getCondition(key, futureVal) : "unknown";
                const TrendIcon = fc.trend === "increasing" ? TrendingUp : fc.trend === "decreasing" ? TrendingDown : ArrowRight;
                const trendColor = fc.trend === "increasing" ? "var(--danger)" : fc.trend === "decreasing" ? "var(--success)" : "var(--text-dim)";
                return (
                  <div key={key} className="glass-card p-3.5">
                    <div className="font-bold text-[13px] mb-1.5 inline-flex items-center gap-1.5" style={{ color }}>
                      {label}
                      <TrendIcon size={13} style={{ color: trendColor }} />
                    </div>
                    <div className="text-primary text-xs font-mono">Now: {fmtVal(fc.current_value, key)} {unit}</div>
                    <div className="text-xs font-mono" style={{ color: trendColor }}>+{predMonths}m: {fmtVal(futureVal, key)} {unit}</div>
                    {limit ? (
                      <div className="text-[11px] mt-1" style={{ color: CONDITION_STYLES[futureCond].text }}>-&gt; {CONDITION_STYLES[futureCond].label}</div>
                    ) : (
                      <div className="text-primary-muted text-[11px] mt-1">Custom test (no IEEE limit)</div>
                    )}
                    <div className="text-primary-muted text-[10px] mt-0.5">Rate: {fmtVal(fc.slope_per_month || 0, key)} {unit}/mo</div>
                    {fc.model_confidence != null && (
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] text-primary-muted">
                          <span>Confidence</span>
                          <span>{(fc.model_confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-[3px] bg-surface-input rounded-sm mt-0.5">
                          <div className="h-[3px] rounded-sm" style={{ width: `${fc.model_confidence * 100}%`, background: fc.model_confidence > 0.7 ? "var(--success)" : fc.model_confidence > 0.4 ? "var(--warning)" : "var(--danger)" }} />
                        </div>
                      </div>
                    )}
                    {fc.will_exceed_limit && (
                      <div className="text-danger text-[10px] mt-1 font-semibold inline-flex items-center gap-1">
                        <TriangleAlert size={12} />
                        Crosses {fc.will_exceed_limit} in {fc.months_to_exceed}mo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Forecast Charts with Confidence Bands — multi-model comparison overlay */}
            {forecastSeries.map((series) => {
              const { key, label, color, unit, forecast: fc } = series;
              const hist = mlPredictions.historicalData?.map(r => ({ date: r.date, actual: Number(r[key]) || 0, type: "historical" })) || [];

              // Build comparison model entries
              const compareModels = isComparing
                ? Object.entries(mlCompareResults).filter(([, res]) => res.forecasts?.[key]).map(([mId, res]) => ({ modelId: mId, fc: res.forecasts[key] }))
                : [{ modelId: mlPredictions.model_type, fc }];

              // Collect all forecast dates across all models
              const allDates = new Set(hist.map(h => h.date));
              compareModels.forEach(({ fc: mfc }) => (mfc.forecasted_values || []).forEach(p => allDates.add(p.date)));
              const sortedDates = [...allDates].sort();

              // Build merged chart data with model-specific columns
              const lastHistDate = hist.length > 0 ? hist[hist.length - 1].date : null;
              const lastHistVal = hist.length > 0 ? hist[hist.length - 1].actual : null;
              const chartData = sortedDates.map(date => {
                const histRow = hist.find(h => h.date === date);
                const isBridge = date === lastHistDate;
                const row = { date, actual: histRow ? histRow.actual : null };
                compareModels.forEach(({ modelId, fc: mfc }) => {
                  const fp = (mfc.forecasted_values || []).find(p => p.date === date);
                  if (fp) {
                    row[`pred_${modelId}`] = fp.value;
                    row[`upper_${modelId}`] = fp.upper;
                    row[`lower_${modelId}`] = fp.lower;
                  } else if (isBridge) {
                    // Bridge point: connect historical to forecast seamlessly
                    row[`pred_${modelId}`] = lastHistVal;
                    row[`upper_${modelId}`] = lastHistVal;
                    row[`lower_${modelId}`] = lastHistVal;
                  } else {
                    row[`pred_${modelId}`] = null;
                    row[`upper_${modelId}`] = null;
                    row[`lower_${modelId}`] = null;
                  }
                });

                // Ensemble: average or confidence-weighted average of all models
                if (isComparing && ensembleMode !== "off") {
                  const entries = compareModels
                    .map(({ modelId, fc: mfc }) => ({
                      pred: row[`pred_${modelId}`],
                      upper: row[`upper_${modelId}`],
                      lower: row[`lower_${modelId}`],
                      weight: Math.max(0.05, Number(mfc.model_confidence) || 0.1),
                    }))
                    .filter(e => e.pred != null);

                  if (entries.length > 0) {
                    if (ensembleMode === "weighted") {
                      const totalW = entries.reduce((s, e) => s + e.weight, 0);
                      row.ensemble_avg = entries.reduce((s, e) => s + e.pred * e.weight, 0) / totalW;
                      const uppersW = entries.filter(e => e.upper != null);
                      const lowersW = entries.filter(e => e.lower != null);
                      const totalWU = uppersW.reduce((s, e) => s + e.weight, 0);
                      const totalWL = lowersW.reduce((s, e) => s + e.weight, 0);
                      row.ensemble_upper = totalWU > 0 ? uppersW.reduce((s, e) => s + e.upper * e.weight, 0) / totalWU : null;
                      row.ensemble_lower = totalWL > 0 ? lowersW.reduce((s, e) => s + e.lower * e.weight, 0) / totalWL : null;
                    } else {
                      // Simple average
                      row.ensemble_avg = entries.reduce((s, e) => s + e.pred, 0) / entries.length;
                      const uppers = entries.filter(e => e.upper != null);
                      const lowers = entries.filter(e => e.lower != null);
                      row.ensemble_upper = uppers.length > 0 ? uppers.reduce((s, e) => s + e.upper, 0) / uppers.length : null;
                      row.ensemble_lower = lowers.length > 0 ? lowers.reduce((s, e) => s + e.lower, 0) / lowers.length : null;
                    }
                  }
                }

                return row;
              });

              const limit = IEEE_LIMITS[key];

              return (
                <div key={key} className="glass-card p-5">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <h4 style={{ color, fontSize: 13 }}>
                      {label} Forecast {isComparing ? (ensembleMode !== "off" ? `— Comparison + ${ensembleMode === "weighted" ? "Weighted" : "Average"} Ensemble` : "— Model Comparison") : `- ${mlPredictions.model_type.toUpperCase()}`}
                    </h4>
                    {isComparing ? (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        {compareModels.map(({ modelId }) => (
                          <span key={modelId} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                            <span style={{ display: "inline-block", width: 16, height: 3, background: MODEL_COLORS[modelId] || "#888", borderRadius: 2 }} />
                            <span style={{ color: MODEL_COLORS[modelId] || "#888", fontWeight: 600 }}>{modelId === "nature_hybrid" ? "Nature Hybrid" : modelId.toUpperCase()}</span>
                          </span>
                        ))}
                        {ensembleMode !== "off" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                            <span style={{ display: "inline-block", width: 16, height: 4, background: ensembleMode === "weighted" ? "#f472b6" : "#fbbf24", borderRadius: 2 }} />
                            <span style={{ color: ensembleMode === "weighted" ? "#f472b6" : "#fbbf24", fontWeight: 700 }}>{ensembleMode === "weighted" ? "WEIGHTED ENSEMBLE" : "ENSEMBLE AVG"}</span>
                          </span>
                        )}
                      </div>
                    ) : fc.diagnostics && (
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                        {fc.diagnostics.order ? `ARIMA(${fc.diagnostics.order.join(",")}) AIC=${fc.diagnostics.aic}` : ""}
                        {fc.diagnostics.method === "lstm" ? `LSTM R2=${fc.diagnostics.training_r2}` : ""}
                        {fc.diagnostics.method === "xgboost" ? `XGBoost R2=${fc.diagnostics.training_r2}` : ""}
                        {fc.diagnostics.method === "lightgbm" ? `LightGBM R2=${fc.diagnostics.training_r2}` : ""}
                        {fc.diagnostics.method === "linear_regression" ? "Linear Regression" : ""}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={isComparing ? 280 : 220}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fill: "var(--text-dim)", fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} domain={[0, "auto"]} />
                      <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, borderRadius: 8 }}
                        formatter={(val, name) => val != null ? [`${fmtVal(val, key)} ${unit}`, name] : ["-", name]} />
                      {/* Confidence band fills (rendered first so they appear behind lines) */}
                      {compareModels.map(({ modelId }) => {
                        const mColor = isComparing ? (MODEL_COLORS[modelId] || "#888") : color;
                        const bandOpacity = isComparing ? 0.07 : 0.12;
                        return [
                          <Area key={`band_upper_${modelId}`} type="monotone" dataKey={`upper_${modelId}`} stroke="none" fill={mColor} fillOpacity={bandOpacity} legendType="none" tooltipType="none" />,
                          <Area key={`band_lower_${modelId}`} type="monotone" dataKey={`lower_${modelId}`} stroke="none" fill="var(--bg-card)" fillOpacity={1} legendType="none" tooltipType="none" />,
                        ];
                      })}
                      <Line type="monotone" dataKey="actual" name="Historical" stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                      {compareModels.map(({ modelId }) => {
                        const mColor = isComparing ? (MODEL_COLORS[modelId] || "#888") : color;
                        const mName = isComparing ? (modelId === "nature_hybrid" ? "Nature Hybrid" : modelId.toUpperCase()) : "Forecast";
                        return [
                          <Line key={`pred_${modelId}`} type="monotone" dataKey={`pred_${modelId}`} name={mName} stroke={mColor} strokeWidth={2} strokeDasharray={MODEL_DASH[modelId] || "6 3"} dot={{ r: 2, fill: mColor }} connectNulls={false} />,
                          <Line key={`upper_${modelId}`} type="monotone" dataKey={`upper_${modelId}`} name={isComparing ? `${mName} Upper` : "Upper 95%"} stroke={mColor} strokeWidth={1} strokeDasharray="2 4" dot={false} connectNulls={false} opacity={0.4} />,
                          <Line key={`lower_${modelId}`} type="monotone" dataKey={`lower_${modelId}`} name={isComparing ? `${mName} Lower` : "Lower 95%"} stroke={mColor} strokeWidth={1} strokeDasharray="2 4" dot={false} connectNulls={false} opacity={0.4} />,
                        ];
                      })}
                      {/* Ensemble line — bold line on top */}
                      {isComparing && ensembleMode !== "off" && (() => {
                        const ensColor = ensembleMode === "weighted" ? "#f472b6" : "#fbbf24";
                        const ensName = ensembleMode === "weighted" ? "Weighted Ensemble" : "Ensemble Avg";
                        return [
                          <Area key="ens_band_upper" type="monotone" dataKey="ensemble_upper" stroke="none" fill={ensColor} fillOpacity={0.10} legendType="none" tooltipType="none" />,
                          <Area key="ens_band_lower" type="monotone" dataKey="ensemble_lower" stroke="none" fill="var(--bg-card)" fillOpacity={1} legendType="none" tooltipType="none" />,
                          <Line key="ens_avg" type="monotone" dataKey="ensemble_avg" name={ensName} stroke={ensColor} strokeWidth={3} dot={{ r: 3, fill: ensColor, stroke: "#000", strokeWidth: 1 }} connectNulls={false} />,
                          <Line key="ens_upper" type="monotone" dataKey="ensemble_upper" name={`${ensName} Upper`} stroke={ensColor} strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls={false} opacity={0.5} />,
                          <Line key="ens_lower" type="monotone" dataKey="ensemble_lower" name={`${ensName} Lower`} stroke={ensColor} strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls={false} opacity={0.5} />,
                        ];
                      })()}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {limit && (
                    <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
                      <span>{`Good: <=${limit.good}`}</span>
                      <span>{`Fair: <=${limit.fair}`}</span>
                      <span style={{ color: "var(--warning)" }}>{`Poor: <=${limit.poor}`}</span>
                      <span style={{ color: "var(--danger)" }}>V.Poor: &gt;{limit.veryPoor}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
            )}

            {/* Model info */}
            <div style={{ background: "var(--bg-input)", border: `1px solid ${"var(--border)"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={14} />
                Model Information {isComparing && `(${Object.keys(mlCompareResults).length} models compared${ensembleMode !== "off" ? (ensembleMode === "weighted" ? " + Weighted Ensemble" : " + Ensemble Avg") : ""})`}
              </div>
              {(() => {
                const MODEL_INFO = {
                  nature_hybrid: "Nature Hybrid: ARIMA-style base forecast for every test, with expert-rule correction applied only to non-gas oil-condition parameters such as IFT, acidity, PF, inhibitor, passivator, DBDS, moisture, BDV, methanol, and furans.",
                  arima: "ARIMA: Auto-tuned (p,d,q) order with ADF stationarity test. Statistical 95% confidence intervals. Best for linear/near-linear trends.",
                  lstm: "LSTM: 2-layer neural network (32->16 units) with dropout regularization. Captures non-linear patterns. Confidence bands based on training residuals.",
                  xgboost: "XGBoost: Gradient-boosted regression trees using lag features. Good for non-linear step changes and sparse transformer histories.",
                  lightgbm: "LightGBM: Leaf-wise gradient boosting on lag features. Efficient for non-linear trends and sparse historical DGA data.",
                  fault_rf: "Fault RF: Random Forest classifier trained on historical DGA-derived fault classes, then projected into future months using forecasted gas features.",
                  linear: "Linear Regression: Simple JS-based fallback. For production accuracy, start the Python backend and use ARIMA, LSTM, XGBoost, LightGBM, or Fault RF.",
                };
                const modelsToShow = isComparing ? Object.keys(mlCompareResults) : [mlPredictions.model_type];
                return [
                  ...modelsToShow.map(mId => (
                    <p key={mId} style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.6, margin: isComparing ? "6px 0" : 0 }}>
                      {isComparing && <span style={{ color: MODEL_COLORS[mId] || "var(--accent)", fontWeight: 700, marginRight: 6 }}>●</span>}
                      {MODEL_INFO[mId] || mId}
                    </p>
                  )),
                  isComparing && ensembleMode !== "off" && (
                    <p key="ensemble" style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.6, margin: "6px 0" }}>
                      <span style={{ color: ensembleMode === "weighted" ? "#f472b6" : "#fbbf24", fontWeight: 700, marginRight: 6 }}>●</span>
                      {ensembleMode === "weighted"
                        ? "Weighted Ensemble: Each model's prediction is weighted by its confidence score (R² or model_confidence). Models with higher accuracy have more influence on the final forecast, giving better results than simple averaging when model quality varies."
                        : "Ensemble Average: Combines predictions from all selected models by averaging their forecasted values at each time point. Where models converge, confidence is higher. The ensemble often outperforms any single model by reducing individual model bias."}
                    </p>
                  ),
                ];
              })()}
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER: ANOMALY DETECTION
  // ============================================================
  const renderAnomaly = () => {
    const anomalyMeta = ANOMALY_MODE_OPTIONS.find((option) => option.key === anomalyMode) || ANOMALY_MODE_OPTIONS[0];
    const anomalyCountsByTx = anomalyRecordCountByMode[anomalyMode] || {};
    const anomalyColumns = getAnomalyColumns(anomalyMode);
    const eligibleAnomalyTransformers = transformers.filter((transformer) => (anomalyCountsByTx[transformer.id] || 0) >= 5);
    const allAnomalySites = [...new Set(transformers.map((transformer) => (transformer.site || "").trim()).filter(Boolean))].sort();
    const anomalyTxsInSite = anomalySiteQuery
      ? eligibleAnomalyTransformers.filter((transformer) => (transformer.site || "").trim() === anomalySiteQuery)
      : eligibleAnomalyTransformers;
    const anomalyHistory = anomalyTx
      ? getAnomalyHistoryForMode(anomalyTx, anomalyMode)
      : [];
    const anomalySiteOptions = allAnomalySites.map((site) => ({ value: site, label: site }));
    const anomalyTxOptions = anomalyTxsInSite.map(t => ({
      value: t.id,
      label: `${t.mnemonic || t.name} — ${t.site} (${resultCountByTx[t.id] || 0} records)`,
    }));
    const anomalySerialOptions = anomalyTxsInSite.map(t => ({
      value: t.id,
      label: `${t.serialNumber || "-"} (${t.mnemonic || t.name})`,
    }));
    const resolveAnomalyResultRow = (anomalyRow) => anomalyHistory.find((row) => (
      row.date === anomalyRow.date
      && GASES.every((gas) => Number(row[gas.key]) === Number(anomalyRow.gases?.[gas.key]))
    )) || anomalyHistory.find((row) => row.date === anomalyRow.date) || null;
    const resolveCurrentAnomalyResultRow = (anomalyRow) => anomalyHistory.find((row) => (
      anomalyRow.result_id
      && row.id
      && row.id === anomalyRow.result_id
    )) || anomalyHistory.find((row) => (
      row.date === anomalyRow.date
      && anomalyColumns.every((column) => (
        Number(getAnomalyMeasurementValue(row, anomalyMode, column.key))
        === Number(anomalyRow.measurements?.[column.key])
      ))
    )) || resolveAnomalyResultRow(anomalyRow);

    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card p-5" style={{ overflow: "visible" }}>
        <h3 className="text-primary text-sm mb-2 flex items-center gap-2">
          <Siren size={16} style={{ color: "var(--danger)" }} />
          Anomaly Detection (Isolation Forest)
        </h3>
        <p className="text-primary-dim text-xs mb-4 leading-relaxed">
          {anomalyMeta.description}
          {!backendOnline && " Requires Python ML backend to be running."}
        </p>
        <div className="flex gap-2 flex-wrap mb-4">
          {ANOMALY_MODE_OPTIONS.map((option) => {
            const active = option.key === anomalyMode;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  if (option.key === anomalyMode) return;
                  setAnomalyMode(option.key);
                  setAnomalyResults(null);
                  setAnomalyError(null);
                  if (anomalyTx && ((anomalyRecordCountByMode[option.key]?.[anomalyTx] || 0) < 5)) {
                    setAnomalyTx("");
                  }
                }}
                className="px-3 py-2 rounded-lg border text-xs font-semibold transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--primary-soft)" : "var(--bg-card)",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="text-primary-muted text-[11px] uppercase tracking-wide mb-3">Select Transformer</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-[1_1_200px] min-w-[180px]">
            <SearchableSelect
              label="1. Site"
              value={anomalySiteQuery}
              placeholder="Select site..."
              options={anomalySiteOptions}
              onChange={v => {
                setAnomalySiteQuery(v);
                setAnomalyTx("");
                setAnomalyResults(null);
                setAnomalyError(null);
              }}
            />
          </div>
          <div className="flex-[1_1_220px] min-w-[180px]">
            <SearchableSelect
              label="2. Transformer (Name / Mnemonic)"
              value={anomalyTx}
              placeholder="Select transformer..."
              options={anomalyTxOptions}
              onChange={v => {
                setAnomalyTx(v);
                setAnomalyResults(null);
                setAnomalyError(null);
              }}
            />
          </div>
          <div className="flex-[1_1_220px] min-w-[180px]">
            <SearchableSelect
              label="3. Serial Number"
              value={anomalyTx}
              placeholder="Select by serial no..."
              options={anomalySerialOptions}
              onChange={v => {
                setAnomalyTx(v);
                setAnomalyResults(null);
                setAnomalyError(null);
              }}
            />
          </div>
          <Btn onClick={runAnomalyDetection} disabled={!anomalyTx || anomalyLoading || !backendOnline}>
            {anomalyLoading ? "Analyzing..." : backendOnline ? `Detect ${anomalyMeta.shortLabel} Anomalies` : "Backend Required"}
          </Btn>
          {(anomalySiteQuery || anomalyTx) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAnomalySiteQuery("");
                setAnomalyTx("");
                setAnomalyResults(null);
                setAnomalyError(null);
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
        {anomalySiteQuery && (
          <div className="mt-2 text-[11px] text-accent">
            ✓ {anomalyTxsInSite.length} transformer(s) with enough records in {anomalySiteQuery}
          </div>
        )}
        {anomalyLoading && (
          <div className="flex items-center gap-2 mt-3 text-accent">
            <Spinner /> <span className="text-xs">Running Isolation Forest on {anomalyMeta.shortLabel.toLowerCase()} history...</span>
          </div>
        )}
        {anomalyError && (
          <div className="alert-error mt-3">
            <span className="inline-flex items-center gap-1.5">
              <XCircle size={14} />
              {anomalyError}
            </span>
          </div>
        )}
      </div>

      {anomalyResults && (
        <>
          {/* Summary */}
          <div className="rounded-lg p-4 border" style={{
            background: anomalyResults.anomalies_detected > 0 ? "#2d0606" : "#052e16",
            borderColor: anomalyResults.anomalies_detected > 0 ? "#7f1d1d" : "#16a34a",
          }}>
            <div className="text-base font-bold mb-1 inline-flex items-center gap-2" style={{ color: anomalyResults.anomalies_detected > 0 ? "var(--danger)" : "var(--success)" }}>
              {anomalyResults.anomalies_detected > 0 ? <Siren size={16} /> : <CheckCircle2 size={16} />}
              {anomalyResults.anomalies_detected > 0 ? `${anomalyResults.anomalies_detected} Anomalies Detected` : "No Anomalies Detected"}
            </div>
            <div className="text-primary-dim text-xs">{anomalyResults.summary}</div>
          </div>

          {/* Anomaly Score Chart */}
          <div className="glass-card p-5">
            <h3 className="text-primary text-sm mb-3">{anomalyMeta.chartTitle}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={anomalyResults.results.map(r => ({
                ...r,
                score: -Number(r.anomaly_score || 0),
                fill: r.is_anomaly ? "#ef4444" : "var(--accent)",
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12, borderRadius: 8 }}
                  formatter={(val, name) => [(Number(val) || 0).toFixed(3), name]} />
                <Bar dataKey="score" name="Anomaly Score" radius={[3, 3, 0, 0]}>
                  {anomalyResults.results.map((r, i) => (
                    <Cell key={i} fill={r.is_anomaly ? "#ef4444" : "var(--accent)"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-[11px] text-primary-muted">
              <span className="inline-flex items-center gap-1"><Circle size={10} fill="var(--accent)" color="var(--accent)" /> Normal</span>
              <span className="inline-flex items-center gap-1"><Circle size={10} fill="#ef4444" color="#ef4444" /> Anomaly</span>
            </div>
          </div>

          {/* Anomaly detail table */}
          <div className="glass-card p-5">
            <h3 className="text-primary text-sm mb-3">{anomalyMeta.tableTitle}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr>
                  {["Date", "Status", "Score", ...anomalyColumns.map((column) => column.label), "Action"].map(h => (
                    <th key={h} className="text-primary-muted p-1.5 text-right text-[10px] uppercase border-b-2 border-border">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {anomalyResults.results.map((r, i) => {
                    const resultRow = resolveCurrentAnomalyResultRow(r);
                    return (
                      <tr key={i} className="border-b border-border" style={{ background: r.is_anomaly ? "rgba(239,68,68,0.08)" : "transparent" }}>
                        <td className="text-primary-dim p-1.5 text-right">{r.date}</td>
                        <td className="p-1.5 text-right">
                          <span className="font-semibold" style={{ color: r.is_anomaly ? "var(--danger)" : "var(--success)" }}>{r.is_anomaly ? "ANOMALY" : "Normal"}</span>
                        </td>
                        <td className="text-primary p-1.5 text-right font-mono">{Number(r.anomaly_score || 0).toFixed(3)}</td>
                        {anomalyColumns.map((column) => {
                          const rawValue = Number(r.measurements?.[column.key]) || 0;
                          const displayValue = anomalyMode === "oil"
                            ? formatTestValue(rawValue, column.digits ?? 1)
                            : rawValue;
                          const valueColor = anomalyMode === "oil"
                            ? column.color
                            : CONDITION_STYLES[getCondition(column.key, rawValue)].text;
                          return (
                            <td key={column.key} className="p-1.5 text-right font-mono" style={{ color: valueColor }}>
                              {displayValue}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-right">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                            <Btn
                              size="sm"
                              variant="secondary"
                              onClick={() => openViewResultModal(resultRow, anomalyMode)}
                              disabled={!resultRow}
                            >
                              <span className="inline-flex items-center gap-1"><Eye size={12} /> View Report</span>
                            </Btn>
                            <Btn
                              size="sm"
                              variant="secondary"
                              onClick={() => printResultDetails(resultRow, anomalyMode)}
                              disabled={!resultRow}
                            >
                              <span className="inline-flex items-center gap-1"><Printer size={12} /> Print</span>
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!backendOnline && (
        <div className="alert-warning">
          <div className="text-amber-400 text-xs font-semibold mb-1 inline-flex items-center gap-1.5">
            <TriangleAlert size={14} />
            Python Backend Required
          </div>
          <p className="text-amber-600 text-xs leading-relaxed m-0">
            Anomaly detection requires the Python ML backend with scikit-learn. Start it with:<br />
            <code className="bg-amber-900/30 px-1.5 py-0.5 rounded text-amber-300">run_server.bat</code>
          </p>
        </div>
      )}
    </div>
    );
  };

  const renderAIAssessment = () => (
    <AIAssessment
      transformers={transformers}
      results={results}
      selectedTx={selectedTx}
      onSelectTx={setSelectedTx}
      backendOnline={backendOnline}
      onViewResult={(resultId) => {
        const row = results.find((result) => result.id === resultId);
        if (row) openViewResultModal(row, "dga");
      }}
      onSaveAssessment={saveAssessmentToResult}
    />
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <TooltipProvider delayDuration={150}>
    <div
      className={`relative h-screen flex flex-col font-sans bg-background text-foreground transition-colors duration-200 ${colorMode === "dark" ? "dark" : ""}`}
      style={{ ...colorModeVars }}
    >
      {/* Ambient brand-glow backdrop — subtle radial that lifts the dark surface
          out of pure flatness and gives the panels something to "float" over. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50rem 32rem at 18% -10%, hsl(var(--ui-brand) / 0.08), transparent 65%), radial-gradient(40rem 28rem at 82% 110%, hsl(258 85% 65% / 0.06), transparent 70%)",
        }}
      />
      {/* Header — frosted glass surface with subtle bottom border */}
      <header className="shrink-0 border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight m-0">
            <span className="inline-flex items-center gap-2">
              <Zap size={20} className="text-brand" />
              Transformer Asset Management
            </span>
            <span className="text-sm font-normal ml-2 text-brand/90">+ ML Analytics</span>
          </h1>
          <div className="text-muted-foreground text-[11px] mt-1 tracking-wide">
            Machine Learning - DGA Pattern Analysis &amp; Fault Prediction
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {isSuperadmin && (
              <Button size="sm" variant="glass" onClick={openUserManagementModal}>
                <Users size={14} /> User Management
              </Button>
            )}
            {user && (
              <span className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-brand text-brand-foreground">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </span>
                {user.name}
              </span>
            )}
            {onLogout && (
              <Button size="sm" variant="danger" onClick={onLogout}>
                Sign Out
              </Button>
            )}
            <Button size="sm" variant="glass" onClick={toggleColorMode}>
              {colorMode === "dark" ? "Light" : "Dark"}
            </Button>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-muted-foreground text-[11px]">Fleet: {transformers.length} units</span>
            <span
              className={`w-2 h-2 rounded-full ${
                conditionSummary.veryPoor > 0
                  ? "bg-destructive"
                  : conditionSummary.poor > 0
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
          </div>
          <BackendIndicator />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="shrink-0">
        <nav className="overflow-x-auto border-b border-border bg-card/40 px-4 backdrop-blur-md">
          <TabsList className="h-auto w-max gap-1 border-0 bg-transparent p-0 shadow-none">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="h-auto gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-brand data-[state=active]:shadow-none"
                >
                  <TabIcon size={14} />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </nav>
      </Tabs>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-5 w-full">
        {dataError && (
          <Card variant="glass" className="mb-3 border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataError}
          </Card>
        )}
        {statusMessage && (
          <Card variant="glass" className="mb-3 border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {statusMessage}
          </Card>
        )}
        {tab === "dashboard" && renderDashboard()}
        {tab === "assets" && renderAssets()}
        {tab === "results" && renderResults()}
        {tab === "oil_results" && renderOilResults()}
        {tab === "diagnostics" && renderDiagnostics()}
        {tab === "trends" && renderTrends()}
        {tab === "clustering" && renderClustering()}
        {tab === "predictions" && renderPredictions()}
        {tab === "anomaly" && renderAnomaly()}
        {tab === "ai_assessment" && renderAIAssessment()}
      </main>

      <footer className="mt-2 border-t border-border bg-card/40 backdrop-blur-md py-4 px-6 flex items-center justify-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Developed by ChM. Ts. Hadi Fauzi
        </span>
        <Separator orientation="vertical" className="h-4" />
        <a
          href="https://www.linkedin.com/in/chm-hadi-fauzi/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#0a66c2]/60 bg-[#0a66c2]/10 px-3 py-1 text-[13px] font-semibold text-[#0a66c2] no-underline backdrop-blur-sm transition-colors hover:bg-[#0a66c2]/20"
        >
          <Linkedin size={15} className="shrink-0" />
          LinkedIn
        </a>
      </footer>

      <Modal
        open={Boolean(viewResult)}
        onClose={closeViewResultModal}
        title={viewResultMode === "oil" ? "Oil Test Result Details" : "DGA Result Details"}
        subtitle={viewResultMode === "oil" ? "Read-only oil test detail view for the selected sample." : "Read-only detail view for the selected test result."}
      >
        {viewResultMode === "oil" ? renderOilResultDetail() : renderDgaResultDetail()}
      </Modal>

      <Modal
        open={showAddResult}
        onClose={closeResultModal}
        title={`${editResult ? "Edit" : "Add"} ${resultEditorMode === "oil" ? "Oil Test Result" : "DGA Result"}`}
        subtitle={
          editResult
            ? `Update the selected ${resultEditorMode === "oil" ? "oil test" : "test"} record. Changes will update the shared result everywhere in the app.`
            : resultEditorMode === "oil"
              ? "Capture oil quality test data only."
              : "Capture complete DGA and oil quality data in one place."
        }
      >
        {resultEditorMode === "oil" ? renderOilResultEditor() : renderDgaResultEditor()}
      </Modal>

      <Modal
        open={showImportModal}
        onClose={closeImportModal}
        title="Import Transformer Report"
        subtitle="Import transformer details and DGA or oil-test results from Excel, PDF, or image files."
        maxWidth={1140}
      >
        <div className="flex flex-col gap-4">
          {!importDraft ? (
            <>
              <div className="text-primary-dim text-sm leading-6">
                Upload a transformer report first. The importer will read the file, prepare the transformer, DGA, and
                oil-test values, then open a review step so you can correct anything before it updates the database.
              </div>

              <div
                {...getImportDropzoneRootProps()}
                className="rounded-2xl border border-dashed px-6 py-8 text-center transition-colors"
                style={{
                  borderColor: isImportDragReject
                    ? "rgba(248, 113, 113, 0.85)"
                    : isImportDragAccept
                      ? "var(--accent-solid)"
                      : "var(--border)",
                  background: isImportDragAccept
                    ? "linear-gradient(135deg, var(--primary-soft) 0%, var(--bg-input) 100%)"
                    : isImportDragReject
                      ? "linear-gradient(135deg, rgba(127, 29, 29, 0.26) 0%, var(--bg-input) 100%)"
                      : "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-input) 100%)",
                }}
              >
                <input {...getImportDropzoneInputProps()} />
                <div className="mx-auto max-w-[520px] flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--primary-soft)", color: "var(--accent)" }}>
                    {importingAsset ? <Spinner size={18} /> : <Upload size={20} />}
                  </div>
                  <div className="text-primary text-base font-semibold">
                    {importingAsset ? "Reading import file..." : isImportDragActive ? "Drop the report here" : "Drag a report here or choose a file"}
                  </div>
                  <div className="text-primary-muted text-xs leading-6">
                    Supported formats: <span className="text-primary font-semibold">.xlsx</span>, <span className="text-primary font-semibold">.xls</span>, <span className="text-primary font-semibold">.xlsm</span>, <span className="text-primary font-semibold">.xlsb</span>, <span className="text-primary font-semibold">.pdf</span>, <span className="text-primary font-semibold">.png</span>, <span className="text-primary font-semibold">.jpg</span>, <span className="text-primary font-semibold">.jpeg</span>, <span className="text-primary font-semibold">.webp</span>, and <span className="text-primary font-semibold">.bmp</span>.
                  </div>
                  <div className="text-primary-muted text-[11px] leading-5">
                    Tip: keep this dialog open and press <span className="text-primary font-semibold">Ctrl+V</span> to paste a screenshot directly.
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center pt-1">
                    <Btn onClick={openImportFilePicker} disabled={importingAsset}>
                      <span className="inline-flex items-center gap-1.5">
                        {importingAsset ? <Spinner size={14} /> : <Upload size={14} />}
                        {importingAsset ? "Reading..." : "Choose File"}
                      </span>
                    </Btn>
                    <Btn variant="secondary" onClick={closeImportModal} disabled={importingAsset}>Cancel</Btn>
                  </div>
                </div>
              </div>
            </>
          ) : (
            renderImportDraftReview()
          )}

          {importError && (
            <div className="alert-error">{importError}</div>
          )}
        </div>
      </Modal>

      <Modal
        open={showUserMgmt}
        title="User Management"
        subtitle="Add, edit, delete, and approve user sign-ups"
        onClose={() => setShowUserMgmt(false)}
        maxWidth={980}
      >
        {!isSuperadmin ? (
          <div className="alert-error">Only superadmin can access this setting.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="input-field"
                placeholder="Full name"
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                className="input-field"
                type="password"
                placeholder={userEditId ? "New password (optional)" : "Password"}
                value={userForm.password}
                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <Select
                value={userForm.status}
                onValueChange={(v) => setUserForm((prev) => ({ ...prev, status: v }))}
                disabled={!userEditId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="disabled">disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Btn variant="primary" onClick={saveManagedUser} disabled={userMgmtLoading}>
                {userEditId ? "Update User" : "Add User"}
              </Btn>
              <Btn variant="secondary" onClick={resetUserForm} disabled={userMgmtLoading}>Reset</Btn>
              <Btn variant="secondary" onClick={loadManagedUsers} disabled={userMgmtLoading}>Refresh</Btn>
            </div>

            {userMgmtError && <div className="alert-error">{userMgmtError}</div>}

            <div className="overflow-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-card">
                    <th className="table-header text-left">Name</th>
                    <th className="table-header text-left">Email</th>
                    <th className="table-header text-left">Role</th>
                    <th className="table-header text-left">Status</th>
                    <th className="table-header text-left">Approved By</th>
                    <th className="table-header text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managedUsers.map((managedUser) => (
                    <tr key={managedUser.id} className="border-b border-border">
                      <td className="px-3 py-2">{managedUser.name}</td>
                      <td className="px-3 py-2">{managedUser.email}</td>
                      <td className="px-3 py-2">{managedUser.role || "user"}</td>
                      <td className="px-3 py-2">{managedUser.status || "pending"}</td>
                      <td className="px-3 py-2">{managedUser.approved_by || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Btn size="sm" variant="secondary" onClick={() => startEditUser(managedUser)}><Pencil size={13} /></Btn>
                          {managedUser.status !== "approved" && (
                            <Btn size="sm" variant="success" onClick={() => approveUser(managedUser.id)}><UserCheck size={13} /></Btn>
                          )}
                          <Btn
                            size="sm"
                            variant="danger"
                            onClick={() => deleteUser(managedUser)}
                            disabled={managedUser.name === "ChM. Ts. Hadi Fauzi"}
                          >
                            <Trash2 size={13} />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {managedUsers.length === 0 && !userMgmtLoading && (
                <div className="p-4 text-primary-dim text-sm">No users found.</div>
              )}
              {userMgmtLoading && (
                <div className="p-4 text-primary-dim text-sm">Loading users...</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} title="Confirm Delete" onClose={() => setDeleteConfirm(null)} maxWidth={480}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>!</div>
          <p className="text-primary" style={{ fontSize: 15, marginBottom: 8 }}>
            Are you sure you want to delete?
          </p>
          <p className="text-primary-dim" style={{ fontSize: 13, marginBottom: 24, wordBreak: "break-word" }}>
            <strong>{deleteConfirm?.name}</strong>
          </p>
          <p className="text-primary-dim" style={{ fontSize: 12, marginBottom: 24 }}>
            This action cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Btn variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={handleDeleteConfirm}>Yes, Delete</Btn>
          </div>
        </div>
      </Modal>
    </div>
    </TooltipProvider>
  );
}









