export const IMPORTABLE_FILE_TYPES = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12": [".xlsb"],
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/bmp": [".bmp"],
};

export const IMPORTABLE_FILE_ACCEPT = Object.values(IMPORTABLE_FILE_TYPES).flat().join(",");
export const IMPORTABLE_GAS_FIELDS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2", "O2", "N2"];
export const GAS_IMPORT_MINIMUM_FIELDS = 5;

export const TRANSFORMER_FIELD_KEYS = [
  "id",
  "name",
  "mnemonic",
  "serialNumber",
  "brand",
  "maker",
  "voltage",
  "loadMVA",
  "site",
  "dateEnergized",
  "dateManufactured",
  "oilBrand",
  "oilType",
  "paperType",
];

export const RESULT_TEXT_FIELDS = new Set(["testType", "color", "copperCorrosive", "notes"]);
export const RESULT_NUMERIC_FIELDS = new Set([
  ...IMPORTABLE_GAS_FIELDS,
  "moisture",
  "bdv",
  "acidity",
  "ift",
  "powerFactor",
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
]);

export const RESULT_FIELD_KEYS = [
  "date",
  ...IMPORTABLE_GAS_FIELDS,
  "moisture",
  "bdv",
  "acidity",
  "ift",
  "color",
  "powerFactor",
  "testType",
  "flashPoint",
  "flashPointOpenCup",
  "firePointOpenCup",
  "inhibitor",
  "passivator",
  "copperCorrosive",
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
  "notes",
];

const GAS_LABEL_ALIASES = {
  H2: ["h2", "hydrogen", "hydrogenh2", "h2hydrogen"],
  CH4: ["ch4", "methane", "methanech4", "ch4methane"],
  C2H6: ["c2h6", "ethane", "ethanec2h6", "c2h6ethane"],
  C2H4: ["c2h4", "ethylene", "ethylenec2h4", "c2h4ethylene"],
  C2H2: ["c2h2", "acetylene", "acetylenec2h2", "c2h2acetylene"],
  CO: ["co", "carbonmonoxide", "carbonmonoxideco", "cocarbonmonoxide"],
  CO2: ["co2", "carbondioxide", "carbondioxideco2", "co2carbondioxide"],
  O2: ["o2", "oxygen", "oxygeno2", "o2oxygen"],
  N2: ["n2", "nitrogen", "nitrogenn2", "n2nitrogen"],
};
const GAS_LABEL_ALIAS_ENTRIES = Object.entries(GAS_LABEL_ALIASES);
const MAX_GAS_LABEL_TOKENS = 4;

export const RESULT_FIELD_ALIASES = {
  date: ["date", "samplingdate", "sampledate", "testdate", "reportdate"],
  moisture: ["moisture", "watercontent", "water", "moisturecontent"],
  bdv: ["bdv", "breakdownvoltage", "dielectricbreakdown", "breakdown"],
  acidity: ["acidity", "neutralizationnumber", "neutralisationnumber", "neutralizationvalue", "neutralisationvalue", "neutralizationvaluenv", "neutralisationvaluenv", "nn"],
  ift: ["ift", "interfacialtension", "interfacialtensionift"],
  color: ["color", "colour", "astmcolor"],
  powerFactor: ["powerfactor", "pf", "tandelta"],
  testType: ["testtype", "sampletype"],
  flashPoint: ["flashpoint"],
  flashPointOpenCup: ["flashpointopencup", "flashpointoc"],
  firePointOpenCup: ["firepointopencup", "firepointoc", "firepoint"],
  inhibitor: ["inhibitor", "oxidationinhibitor"],
  passivator: ["passivator"],
  copperCorrosive: ["coppercorrosive", "coppercorrosion", "coppercorrosiveiec", "potentiallycoppercorrosive", "potentiallycoppercorrosiveiec"],
  density: ["density"],
  dbds: ["dbds"],
  viscosity40: ["viscosity40", "viscosityat40c", "viscosity40c"],
  methanol: ["methanol"],
  pcb: ["pcb"],
  resistivity: ["resistivity"],
  specificGravity: ["specificgravity"],
  fol2: ["2fol", "fol2"],
  hmf5: ["5hmf", "hmf5"],
  fal2: ["2fal", "fal2", "furan", "2furfural"],
  acf2: ["2acf", "acf2"],
  mef5: ["5mef", "mef5"],
  copperCu: ["coppercu", "copper"],
  ironFe: ["ironfe", "iron"],
  aluminumAl: ["aluminumal", "aluminiumal", "aluminum", "aluminium"],
  notes: ["notes", "remark", "remarks", "observation", "observations"],
};

const TRANSFORMER_FIELD_ALIASES = {
  id: ["id", "transformerid", "assetid", "equipmentid"],
  name: ["txno", "transformerno", "transformernumber", "unit", "equipment", "tx"],
  mnemonic: ["mnemonic", "transformername", "txname"],
  serialNumber: ["serialnumber", "serialno", "sn", "serial"],
  brand: ["brand"],
  maker: ["maker", "manufacturer", "oem", "make"],
  voltage: ["voltage", "ratingkv", "nominalvoltage", "voltagekv", "kv"],
  loadMVA: ["mva", "loadmva", "capacitymva", "ratingmva", "powerrating"],
  site: ["site", "substation", "station", "location"],
  dateEnergized: ["dateenergized", "energizeddate", "datecommissioned", "commissioningdate", "commissioned"],
  dateManufactured: ["datemanufactured", "manufactureddate", "manufacturedate", "yearbuilt", "datebuilt"],
  oilBrand: ["oilbrand", "insulatingoilbrand"],
  oilType: ["oiltype", "insulatingoiltype", "dielectricfluidtype"],
  paperType: ["papertype", "paperinsulationtype", "insulationpaper", "insulationpapertype", "cellulosepaper", "kraftpaper", "krafpaper", "tup", "ddp"],
};

const SUBSCRIPT_DIGITS = {
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
};

const PDF_MONTH_LOOKUP = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function buildAliasEntries(aliasMap, category) {
  return Object.entries(aliasMap).flatMap(([key, aliases]) => (
    aliases.map((alias) => ({
      alias,
      category,
      key,
    }))
  ));
}

const FIELD_ALIAS_ENTRIES = [
  ...buildAliasEntries(GAS_LABEL_ALIASES, "result"),
  ...buildAliasEntries(RESULT_FIELD_ALIASES, "result"),
  ...buildAliasEntries(TRANSFORMER_FIELD_ALIASES, "transformer"),
].sort((left, right) => right.alias.length - left.alias.length);

const FIELD_ALIAS_LOOKUP = FIELD_ALIAS_ENTRIES.reduce((lookup, entry) => {
  lookup.set(entry.alias, { key: entry.key, category: entry.category });
  return lookup;
}, new Map());

export function replaceSubscriptDigits(value) {
  return String(value ?? "").replace(/[\u2080-\u2089]/g, (digit) => SUBSCRIPT_DIGITS[digit] ?? digit);
}

export function canonicalizeImportLabel(value) {
  return replaceSubscriptDigits(value)
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/results?|readings?|values?|content|concentration|analysis|report/gi, " ")
    .replace(/ppm|ppb|mgkoh\/g|mg\/kg|kg\/m3|mn\/m|gohm-?m|astm|iec|open cup|oc|@40c|40c|cst|ratio|kv|mva|%/gi, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function getImportLabelTokens(value) {
  return replaceSubscriptDigits(String(value ?? ""))
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getGasFieldKeysFromLabel(value, allowedKeys = null) {
  const tokens = getImportLabelTokens(value);
  if (!tokens.length) {
    return [];
  }

  const allowedKeySet = Array.isArray(allowedKeys) ? new Set(allowedKeys) : null;
  const consumedTokenIndexes = new Set();
  const gasKeys = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    let matchedKey = null;
    let matchedSpan = 0;

    for (let span = Math.min(MAX_GAS_LABEL_TOKENS, tokens.length - tokenIndex); span >= 1; span -= 1) {
      if (Array.from({ length: span }, (_, offset) => consumedTokenIndexes.has(tokenIndex + offset)).some(Boolean)) {
        continue;
      }

      const candidate = tokens.slice(tokenIndex, tokenIndex + span).join("");
      matchedKey = GAS_LABEL_ALIAS_ENTRIES.find(([key, aliases]) => (
        (!allowedKeySet || allowedKeySet.has(key)) && aliases.includes(candidate)
      ))?.[0] ?? null;

      if (matchedKey) {
        matchedSpan = span;
        break;
      }
    }

    if (!matchedKey || gasKeys.includes(matchedKey)) {
      continue;
    }

    gasKeys.push(matchedKey);
    for (let offset = 0; offset < matchedSpan; offset += 1) {
      consumedTokenIndexes.add(tokenIndex + offset);
    }
    tokenIndex += matchedSpan - 1;
  }

  return gasKeys;
}

export function getFieldMatchFromLabel(value) {
  const gasKeys = getGasFieldKeysFromLabel(value);

  if (gasKeys.length > 1) {
    return null;
  }

  if (gasKeys.length === 1) {
    return { key: gasKeys[0], category: "result" };
  }

  const normalized = canonicalizeImportLabel(value);

  if (!normalized) {
    return null;
  }

  const directMatch = FIELD_ALIAS_LOOKUP.get(normalized);
  if (directMatch) {
    return directMatch;
  }

  return FIELD_ALIAS_ENTRIES.find((entry) => normalized.includes(entry.alias) || entry.alias.includes(normalized)) ?? null;
}

export function getResultFieldMatchesFromLabel(value, allowedKeys = null) {
  const normalized = canonicalizeImportLabel(value);

  if (!normalized) {
    return [];
  }

  const allowedKeySet = Array.isArray(allowedKeys) ? new Set(allowedKeys) : null;

  return Object.entries(RESULT_FIELD_ALIASES)
    .filter(([key]) => !allowedKeySet || allowedKeySet.has(key))
    .map(([key, aliases]) => {
      let bestPosition = Number.POSITIVE_INFINITY;
      let bestAliasLength = -1;

      aliases.forEach((alias) => {
        const position = normalized.indexOf(alias);
        if (position === -1) {
          return;
        }

        if (position < bestPosition || (position === bestPosition && alias.length > bestAliasLength)) {
          bestPosition = position;
          bestAliasLength = alias.length;
        }
      });

      return bestPosition === Number.POSITIVE_INFINITY
        ? null
        : { key, category: "result", position: bestPosition, aliasLength: bestAliasLength };
    })
    .filter(Boolean)
    .sort((left, right) => left.position - right.position || right.aliasLength - left.aliasLength);
}

export function parseNumericValue(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(6));
  }

  const rawText = String(value).trim();
  const upperText = rawText.toUpperCase();
  const compactAlphaNumericText = upperText.replace(/[^A-Z0-9]/g, "");

  if (upperText === "0" || compactAlphaNumericText === "NIL" || compactAlphaNumericText === "0") {
    return 0;
  }

  const normalized = rawText.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized[0]);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(6)) : null;
}

export function formatDateToIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseExcelSerialDate(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const excelEpoch = Date.UTC(1899, 11, 30);
  return formatDateToIso(new Date(excelEpoch + (value * 86400000)));
}

export function parseDateValue(value) {
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return formatDateToIso(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return parseExcelSerialDate(value);
  }

  const rawText = String(value).trim();
  if (!rawText) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawText)) {
    return rawText;
  }

  if (/^\d{4}$/.test(rawText)) {
    return `${rawText}-01-01`;
  }

  const slashMatch = rawText.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const [, day, month, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dashMonthMatch = rawText.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (dashMonthMatch) {
    const [, day, monthLabel, rawYear] = dashMonthMatch;
    const month = PDF_MONTH_LOOKUP[monthLabel.toLowerCase()];
    if (!month) return "";
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const monthNameMatch = rawText.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthNameMatch) {
    const [, monthLabel, day, year] = monthNameMatch;
    const month = PDF_MONTH_LOOKUP[monthLabel.slice(0, 3).toLowerCase()];
    if (!month) return "";
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const parsedDate = new Date(rawText);
  return Number.isNaN(parsedDate.getTime()) ? "" : formatDateToIso(parsedDate);
}

export function isMeaningfulImportValue(value) {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim() !== "";
}

export function normalizeImportValue(key, rawValue) {
  if (rawValue == null || rawValue === "") {
    return null;
  }

  if (key === "date" || key === "dateEnergized" || key === "dateManufactured") {
    const parsedDate = parseDateValue(rawValue);
    return parsedDate || null;
  }

  if (key === "loadMVA") {
    const numericValue = parseNumericValue(rawValue);
    return numericValue == null ? null : numericValue;
  }

  if (RESULT_NUMERIC_FIELDS.has(key)) {
    return parseNumericValue(rawValue);
  }

  const normalizedText = `${rawValue}`.replace(/\s+/g, " ").trim();
  return normalizedText || null;
}

export function assignFieldValue(target, key, rawValue) {
  const normalizedValue = normalizeImportValue(key, rawValue);

  if (!isMeaningfulImportValue(normalizedValue) || isMeaningfulImportValue(target[key])) {
    return;
  }

  target[key] = normalizedValue;
}

export function countTransformerFields(patch = {}) {
  return TRANSFORMER_FIELD_KEYS.filter((key) => isMeaningfulImportValue(patch[key])).length;
}

export function countImportedResultFields(patch = {}) {
  return RESULT_FIELD_KEYS.filter((key) => key !== "date" && isMeaningfulImportValue(patch[key])).length;
}

export function cleanImportPatch(patch = {}) {
  return Object.entries(patch).reduce((accumulator, [key, value]) => {
    if (isMeaningfulImportValue(value)) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

export function mergeTransformerPatches(patches = []) {
  const mergedPatch = {};

  patches.forEach((patch) => {
    TRANSFORMER_FIELD_KEYS.forEach((key) => {
      assignFieldValue(mergedPatch, key, patch?.[key]);
    });
  });

  return cleanImportPatch(mergedPatch);
}

export function mergeResultPatches(resultPatches = []) {
  const mergedByDate = new Map();
  const today = formatDateToIso(new Date());

  resultPatches.forEach((patch, index) => {
    const cleanedPatch = cleanImportPatch(patch);
    if (!countImportedResultFields(cleanedPatch)) {
      return;
    }

    const dateKey = cleanedPatch.date || `${today}::${index}`;
    const existingPatch = mergedByDate.get(dateKey) || {};
    mergedByDate.set(dateKey, {
      ...existingPatch,
      ...cleanedPatch,
      date: cleanedPatch.date || existingPatch.date || today,
    });
  });

  return Array.from(mergedByDate.values());
}

function findNearestNonEmptyCell(row = [], startIndex, step) {
  for (let cursor = startIndex; cursor >= 0 && cursor < row.length; cursor += step) {
    if (isMeaningfulImportValue(row[cursor])) {
      return row[cursor];
    }
  }
  return null;
}

export function extractFieldPairsFromRows(rows = []) {
  const pairs = [];

  rows.forEach((row = [], rowIndex) => {
    row.forEach((cellValue, columnIndex) => {
      const cellText = `${cellValue ?? ""}`.trim();
      if (!cellText) {
        return;
      }

      const splitMatch = cellText.match(/^(.+?)[=:]\s*(.+)$/);
      if (splitMatch) {
        const match = getFieldMatchFromLabel(splitMatch[1]);
        if (match) {
          pairs.push({ key: match.key, value: splitMatch[2] });
          return;
        }
      }

      const fieldMatch = getFieldMatchFromLabel(cellText);
      if (!fieldMatch) {
        return;
      }

      const sameRowValue = findNearestNonEmptyCell(row, columnIndex + 1, 1);
      if (isMeaningfulImportValue(sameRowValue)) {
        pairs.push({ key: fieldMatch.key, value: sameRowValue });
        return;
      }

      const nextRowValue = rows[rowIndex + 1]?.[columnIndex];
      if (isMeaningfulImportValue(nextRowValue)) {
        pairs.push({ key: fieldMatch.key, value: nextRowValue });
      }
    });
  });

  return pairs;
}

function extractFieldPairsFromTextSegments(segments = []) {
  const pairs = [];

  for (let index = 0; index < segments.length; index += 1) {
    const rawSegment = `${segments[index] ?? ""}`.trim();
    if (!rawSegment) {
      continue;
    }

    const colonMatch = rawSegment.match(/^(.+?)[=:]\s*(.+)$/);
    if (colonMatch) {
      const match = getFieldMatchFromLabel(colonMatch[1]);
      if (match) {
        pairs.push({ key: match.key, value: colonMatch[2] });
        continue;
      }
    }

    const fieldMatch = getFieldMatchFromLabel(rawSegment);
    if (!fieldMatch) {
      continue;
    }

    const nextSegment = `${segments[index + 1] ?? ""}`.trim();
    if (!nextSegment) {
      continue;
    }

    const punctuatedValueMatch = nextSegment.match(/^[:=]\s*(.+)$/);
    if (punctuatedValueMatch) {
      pairs.push({ key: fieldMatch.key, value: punctuatedValueMatch[1] });
      index += 1;
      continue;
    }

    if ((nextSegment === ":" || nextSegment === "=") && segments[index + 2] != null) {
      const valueSegment = `${segments[index + 2] ?? ""}`.trim();
      if (valueSegment) {
        pairs.push({ key: fieldMatch.key, value: valueSegment });
        index += 2;
        continue;
      }
    }

    if (!getFieldMatchFromLabel(nextSegment)) {
      pairs.push({ key: fieldMatch.key, value: nextSegment });
      index += 1;
    }
  }

  return pairs;
}

export function extractFieldPairsFromTextLines(lines = []) {
  const pairs = [];

  lines.forEach((line, lineIndex) => {
    const rawLine = `${line ?? ""}`.trim();
    if (!rawLine) {
      return;
    }

    const tabOrGapSegments = rawLine.split(/\t+|\s{2,}/).map((segment) => segment.trim()).filter(Boolean);
    if (tabOrGapSegments.length >= 2) {
      const inlinePairs = extractFieldPairsFromTextSegments(tabOrGapSegments);
      if (inlinePairs.length) {
        inlinePairs.forEach((pair) => pairs.push(pair));
        return;
      }
    }

    const colonMatch = rawLine.match(/^(.+?)[=:]\s*(.+)$/);
    if (colonMatch) {
      const match = getFieldMatchFromLabel(colonMatch[1]);
      if (match) {
        pairs.push({ key: match.key, value: colonMatch[2] });
        return;
      }
    }

    const numericTailMatch = rawLine.match(/^(.+?)\s+(-?\d[\d,]*(?:\.\d+)?(?:\s*[A-Za-z/%-].*)?)$/);
    if (numericTailMatch) {
      const match = getFieldMatchFromLabel(numericTailMatch[1]);
      if (match) {
        pairs.push({ key: match.key, value: numericTailMatch[2] });
        return;
      }
    }

    const labelOnlyMatch = getFieldMatchFromLabel(rawLine);
    if (!labelOnlyMatch) {
      return;
    }

    const nextLine = `${lines[lineIndex + 1] ?? ""}`.trim();
    if (!nextLine || getFieldMatchFromLabel(nextLine)) {
      return;
    }

    pairs.push({ key: labelOnlyMatch.key, value: nextLine });
  });

  return pairs;
}

export function extractFieldPatchesFromPairs(pairs = []) {
  const transformerPatch = {};
  const resultPatch = {};

  pairs.forEach(({ key, value }) => {
    if (!key) {
      return;
    }

    if (TRANSFORMER_FIELD_KEYS.includes(key)) {
      assignFieldValue(transformerPatch, key, value);
      return;
    }

    assignFieldValue(resultPatch, key, value);
  });

  return {
    transformerPatch: cleanImportPatch(transformerPatch),
    resultPatch: cleanImportPatch(resultPatch),
  };
}

export function extractFieldPatchesFromTextLines(lines = []) {
  return extractFieldPatchesFromPairs(extractFieldPairsFromTextLines(lines));
}
