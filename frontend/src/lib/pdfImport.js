import {
  IMPORTABLE_GAS_FIELDS,
  countImportedResultFields,
  countTransformerFields,
  extractFieldPatchesFromTextLines,
  getFieldMatchFromLabel,
  getResultFieldMatchesFromLabel,
  mergeResultPatches,
  parseNumericValue,
  replaceSubscriptDigits,
  RESULT_TEXT_FIELDS,
  cleanImportPatch,
} from "./assetImportShared.js";

const PDF_TABLE_TITLE = "dissolved gas analysis";
const LEGACY_PDF_ROW_FIELDS = ["H2", "O2", "N2", "CH4", "CO", "CO2", "C2H4", "C2H6", "C2H2", null];
const REPORT_PDF_ROW_FIELDS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2", "O2", "N2", "transformerAge"];
const MINIMUM_IMPORTED_FIELDS = 5;
const PDF_SECTION_TERMINATOR_VALUES = [
  "flag",
  "reference",
  "moisture content",
  "dielectric breakdown",
  "duval diagnostics",
  "active diagrams",
  "dga trending",
  "percent trending table",
  "oil quality",
];
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
const REPORT_TABLE_HEADER_MARKERS = ["id", "date", "h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2", "age", "fault zone"];
const LEGACY_TABLE_HEADER_MARKERS = ["date", "h2", "o2", "n2", "ch4", "co", "co2", "c2h4", "c2h6", "c2h2"];
const PDF_GROUP_SECTION_DEFINITIONS = [
  { aliases: ["furancompound", "furaniccompound"], fieldKeys: ["fol2", "hmf5", "fal2", "acf2", "mef5"] },
  { aliases: ["metalsinoil", "metalinoil"], fieldKeys: ["copperCu", "ironFe", "aluminumAl"] },
];
const PDF_IGNORED_SECTION_KEYS = new Set(["date", "notes", "testType"]);
const PDF_GAS_FIELD_KEYS = new Set(IMPORTABLE_GAS_FIELDS);
const PDF_TABLE_TITLE_MARKER = canonicalizePdfLookup(PDF_TABLE_TITLE);
const PDF_SECTION_TERMINATORS = new Set(PDF_SECTION_TERMINATOR_VALUES.map((value) => canonicalizePdfLookup(value)));
const NORMALIZED_REPORT_TABLE_HEADER_MARKERS = REPORT_TABLE_HEADER_MARKERS.map((marker) => canonicalizePdfLookup(marker));
const NORMALIZED_LEGACY_TABLE_HEADER_MARKERS = LEGACY_TABLE_HEADER_MARKERS.map((marker) => canonicalizePdfLookup(marker));

function normalisePdfToken(token) {
  return replaceSubscriptDigits(String(token ?? "")).trim().toLowerCase();
}

function canonicalizePdfLookup(value) {
  return replaceSubscriptDigits(String(value ?? ""))
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toIsoDateFromPdf(token) {
  const rawText = String(token ?? "").trim();
  const slashMatch = rawText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const dashMatch = rawText.match(/^(\d{2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (!dashMatch) {
    return "";
  }

  const [, day, monthLabel, rawYear] = dashMatch;
  const month = PDF_MONTH_LOOKUP[monthLabel.toLowerCase()];
  if (!month) {
    return "";
  }

  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
}

function isPdfSectionTerminator(token) {
  return PDF_SECTION_TERMINATORS.has(canonicalizePdfLookup(token));
}

function containsOrderedMarkers(text, markers) {
  let cursor = 0;

  return markers.every((marker) => {
    const index = text.indexOf(marker, cursor);
    if (index === -1) {
      return false;
    }

    cursor = index + marker.length;
    return true;
  });
}

function getPdfLineWindow(lines, startIndex, lineCount = 4) {
  return canonicalizePdfLookup(lines.slice(startIndex, startIndex + lineCount).join(" "));
}

function stripGasFieldsFromPatch(patch = {}) {
  return Object.entries(patch).reduce((nextPatch, [key, value]) => {
    if (!PDF_GAS_FIELD_KEYS.has(key)) {
      nextPatch[key] = value;
    }
    return nextPatch;
  }, {});
}

function findPdfTableStartIndex(lines) {
  const titleMatchIndex = lines.findIndex((_, index) => getPdfLineWindow(lines, index, 2).includes(PDF_TABLE_TITLE_MARKER));
  if (titleMatchIndex !== -1) {
    return titleMatchIndex;
  }

  return lines.findIndex((_, index) => {
    const nearbyText = getPdfLineWindow(lines, index, 3);
    return (
      containsOrderedMarkers(nearbyText, NORMALIZED_REPORT_TABLE_HEADER_MARKERS)
      || containsOrderedMarkers(nearbyText, NORMALIZED_LEGACY_TABLE_HEADER_MARKERS)
    );
  });
}

function detectRowFieldOrder(lines, sectionStartIndex) {
  const nearbyText = getPdfLineWindow(lines, sectionStartIndex, 4);
  return containsOrderedMarkers(nearbyText, NORMALIZED_REPORT_TABLE_HEADER_MARKERS)
    ? REPORT_PDF_ROW_FIELDS
    : LEGACY_PDF_ROW_FIELDS;
}

async function extractPdfTextData(file) {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
  ]);

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const words = textContent.items
      .map((item) => ({
        text: String(item.str ?? "").trim(),
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        width: Number(item.width ?? 0),
      }))
      .filter((item) => item.text);

    const rowThreshold = 3.5;
    const clusteredRows = [];
    const sortedWords = [...words].sort((left, right) => right.y - left.y || left.x - right.x);

    sortedWords.forEach((word) => {
      const matchingRow = clusteredRows.find((row) => Math.abs(word.y - row.centerY) <= rowThreshold);
      if (!matchingRow) {
        clusteredRows.push({ centerY: word.y, words: [word] });
        return;
      }

      matchingRow.words.push(word);
      matchingRow.centerY = matchingRow.words.reduce((sum, rowWord) => sum + rowWord.y, 0) / matchingRow.words.length;
    });

    clusteredRows
      .sort((left, right) => right.centerY - left.centerY)
      .forEach((row) => {
        const orderedWords = row.words.sort((left, right) => left.x - right.x);
        const line = orderedWords
          .reduce((parts, word, index) => {
            if (index === 0) {
              parts.push(word.text);
              return parts;
            }

            const previousWord = orderedWords[index - 1];
            const gap = word.x - (previousWord.x + previousWord.width);
            parts.push(gap > 12 ? "   " : " ");
            parts.push(word.text);
            return parts;
          }, [])
          .join("")
          .replace(/\s+/g, (match) => (match.length >= 3 ? "   " : " "))
          .trim();

        if (line) {
          lines.push(line);
        }
      });
  }

  return { lines };
}

function extractHistoryRowsFromLines(lines) {
  const sectionStartIndex = findPdfTableStartIndex(lines);
  if (sectionStartIndex === -1) {
    return [];
  }

  const rowFieldOrder = detectRowFieldOrder(lines, sectionStartIndex);
  const minimumValueCount = rowFieldOrder.filter(Boolean).length;
  const rows = [];

  for (let index = sectionStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isPdfSectionTerminator(line)) {
      break;
    }

    const datedLine = extractPdfDateAndTail(line);
    if (!datedLine) {
      continue;
    }

    const rawValues = datedLine.tail
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value && (parseNumericValue(value) != null || /^nil$/i.test(value)));
    if (rawValues.length < minimumValueCount) {
      continue;
    }

    const samplePatch = { date: datedLine.date };
    rowFieldOrder.forEach((fieldKey, fieldIndex) => {
      if (!fieldKey || rawValues[fieldIndex] == null) {
        return;
      }

      const numericValue = parseNumericValue(rawValues[fieldIndex]);
      if (numericValue != null) {
        samplePatch[fieldKey] = numericValue;
      }
    });

    const matchedFieldCount = rowFieldOrder.filter((fieldKey) => fieldKey && samplePatch[fieldKey] != null).length;
    if (matchedFieldCount >= MINIMUM_IMPORTED_FIELDS) {
      rows.push(cleanImportPatch(samplePatch));
    }
  }

  return rows;
}

function extractPdfDateAndTail(line) {
  const match = String(line ?? "").trim().match(/^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }

  const date = toIsoDateFromPdf(match[1]);
  if (!date) {
    return null;
  }

  return {
    date,
    tail: `${match[2] ?? ""}`.trim(),
  };
}

function isPdfSectionMetadataLine(line) {
  const normalized = normalisePdfToken(line);
  return normalized.startsWith("reference") || normalized.startsWith("method") || normalized.startsWith("standard");
}

function getPdfGroupSection(line) {
  const normalized = normalisePdfToken(line).replace(/[^a-z0-9]+/g, "");
  return PDF_GROUP_SECTION_DEFINITIONS.find((section) => section.aliases.some((alias) => normalized.includes(alias))) ?? null;
}

function getOrderedResultKeysFromLine(line, allowedKeys = null, options = {}) {
  const { excludeGasFields = false } = options;
  const matches = getResultFieldMatchesFromLabel(line, allowedKeys)
    .map((match) => match.key)
    .filter((key) => !PDF_IGNORED_SECTION_KEYS.has(key))
    .filter((key) => !excludeGasFields || !PDF_GAS_FIELD_KEYS.has(key));

  if (matches.includes("copperCorrosive") && !normalisePdfToken(line).includes(" cu ")) {
    return matches.filter((key) => key !== "copperCu");
  }

  return matches;
}

function detectPdfOilSection(line) {
  const groupSection = getPdfGroupSection(line);
  if (groupSection) {
    return {
      fieldKeys: getOrderedResultKeysFromLine(line, groupSection.fieldKeys, { excludeGasFields: true }).length
        ? getOrderedResultKeysFromLine(line, groupSection.fieldKeys, { excludeGasFields: true })
        : groupSection.fieldKeys,
    };
  }

  const groupedFieldKeys = PDF_GROUP_SECTION_DEFINITIONS
    .map((section) => getOrderedResultKeysFromLine(line, section.fieldKeys, { excludeGasFields: true }))
    .find((fieldKeys) => fieldKeys.length >= 2);
  if (groupedFieldKeys?.length) {
    return { fieldKeys: groupedFieldKeys };
  }

  const fieldMatch = getFieldMatchFromLabel(line);
  if (
    fieldMatch?.category !== "result"
    || PDF_IGNORED_SECTION_KEYS.has(fieldMatch.key)
    || PDF_GAS_FIELD_KEYS.has(fieldMatch.key)
  ) {
    return null;
  }

  return { fieldKeys: [fieldMatch.key] };
}

function parsePdfSectionRow(fieldKeys, tail) {
  if (!fieldKeys.length || !tail) {
    return {};
  }

  if (fieldKeys.length === 1) {
    const [fieldKey] = fieldKeys;

    if (RESULT_TEXT_FIELDS.has(fieldKey)) {
      const normalizedText = tail.replace(/\s+/g, " ").trim();
      return normalizedText ? { [fieldKey]: normalizedText } : {};
    }

    const numericValue = parseNumericValue(tail);
    return numericValue == null ? {} : { [fieldKey]: numericValue };
  }

  const numericValues = (tail.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((value) => parseNumericValue(value))
    .filter((value) => value != null);

  if (!numericValues.length) {
    return {};
  }

  return fieldKeys.reduce((rowPatch, fieldKey, index) => {
    if (numericValues[index] != null) {
      rowPatch[fieldKey] = numericValues[index];
    }
    return rowPatch;
  }, {});
}

function extractOilSectionRowsFromLines(lines) {
  const resultRows = [];
  let activeSectionFieldKeys = [];

  lines.forEach((line) => {
    const rawLine = `${line ?? ""}`.trim();
    if (!rawLine) {
      return;
    }

    if (isPdfSectionMetadataLine(rawLine)) {
      activeSectionFieldKeys = [];
      return;
    }

    const datedLine = extractPdfDateAndTail(rawLine);
    if (datedLine && activeSectionFieldKeys.length) {
      const rowPatch = cleanImportPatch(stripGasFieldsFromPatch({
        date: datedLine.date,
        ...parsePdfSectionRow(activeSectionFieldKeys, datedLine.tail),
      }));

      if (countImportedResultFields(rowPatch)) {
        resultRows.push(rowPatch);
      }
      return;
    }

    const detectedSection = detectPdfOilSection(rawLine);
    if (detectedSection?.fieldKeys?.length) {
      activeSectionFieldKeys = detectedSection.fieldKeys;
      return;
    }

    if (/^sampling\s+date\b/i.test(rawLine) && activeSectionFieldKeys.length) {
      const orderedFieldKeys = getOrderedResultKeysFromLine(rawLine, activeSectionFieldKeys);
      if (orderedFieldKeys.length) {
        activeSectionFieldKeys = orderedFieldKeys;
      }
      return;
    }

    if (!activeSectionFieldKeys.length) {
      return;
    }
  });

  return mergeResultPatches(resultRows);
}

function getLatestResultRowIndex(rows = []) {
  if (!rows.length) {
    return -1;
  }

  let latestIndex = 0;
  let latestDate = rows[0].date || "";

  rows.forEach((row, index) => {
    const currentDate = row.date || "";
    if (currentDate > latestDate) {
      latestIndex = index;
      latestDate = currentDate;
    }
  });

  return latestIndex;
}

function mergeSummaryResultIntoHistory(historyRows = [], summaryPatch = {}) {
  if (!countImportedResultFields(summaryPatch)) {
    return historyRows;
  }

  if (!historyRows.length) {
    return mergeResultPatches([summaryPatch]);
  }

  if (summaryPatch.date) {
    const existingIndex = historyRows.findIndex((row) => row.date === summaryPatch.date);
    if (existingIndex !== -1) {
      return historyRows.map((row, index) => (
        index === existingIndex
          ? cleanImportPatch({ ...summaryPatch, ...row, date: row.date || summaryPatch.date })
          : row
      ));
    }

    return mergeResultPatches([...historyRows, summaryPatch]);
  }

  if (historyRows.length === 1) {
    return [cleanImportPatch({ ...summaryPatch, ...historyRows[0], date: historyRows[0].date || summaryPatch.date })];
  }

  const latestIndex = getLatestResultRowIndex(historyRows);
  if (latestIndex === -1) {
    return mergeResultPatches([summaryPatch]);
  }

  return historyRows.map((row, index) => (
    index === latestIndex
      ? cleanImportPatch({ ...summaryPatch, ...row, date: row.date || summaryPatch.date })
      : row
  ));
}

export async function extractAssetImportFromPdfFile(file) {
  if (!file) {
    throw new Error("Choose a PDF report before importing.");
  }

  const { lines } = await extractPdfTextData(file);
  const historyRows = extractHistoryRowsFromLines(lines);
  const oilSectionRows = extractOilSectionRowsFromLines(lines);
  const { transformerPatch, resultPatch: extractedResultPatch } = extractFieldPatchesFromTextLines(lines);
  const resultPatch = historyRows.length ? stripGasFieldsFromPatch(extractedResultPatch) : extractedResultPatch;
  const resultPatches = mergeSummaryResultIntoHistory(
    mergeResultPatches([...historyRows, ...oilSectionRows]),
    resultPatch,
  );

  if (!countTransformerFields(transformerPatch) && resultPatches.length === 0) {
    throw new Error("The PDF does not contain readable transformer details, DGA values, or oil-test values.");
  }

  return {
    fileType: "pdf",
    fileName: file.name,
    transformerPatch,
    resultPatches,
  };
}
