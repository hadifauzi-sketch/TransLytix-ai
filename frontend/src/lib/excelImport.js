import {
  GAS_IMPORT_MINIMUM_FIELDS,
  IMPORTABLE_GAS_FIELDS,
  assignFieldValue,
  cleanImportPatch,
  countImportedResultFields,
  countTransformerFields,
  extractFieldPairsFromRows,
  extractFieldPatchesFromPairs,
  getFieldMatchFromLabel,
  mergeResultPatches,
  mergeTransformerPatches,
  parseNumericValue,
} from "./assetImportShared.js";

const ELIMS_FALLBACK_RANGE = {
  headerRow: 13,
  valueRow: 14,
  startColumn: "P",
  endColumn: "X",
  order: ["H2", "O2", "N2", "CH4", "CO", "CO2", "C2H4", "C2H6", "C2H2"],
};

function isMeaningfulCellValue(value) {
  return String(value ?? "").trim() !== "";
}

function getHeaderMap(row = []) {
  const seenKeys = new Set();
  const headerMap = [];

  row.forEach((cellValue, columnIndex) => {
    const match = getFieldMatchFromLabel(cellValue);
    if (!match || seenKeys.has(match.key)) {
      return;
    }

    seenKeys.add(match.key);
    headerMap.push({
      columnIndex,
      key: match.key,
      category: match.category,
    });
  });

  return headerMap;
}

function looksLikeAnotherHeaderRow(row = [], headerMap = []) {
  const headerMatchCount = row.reduce((count, cellValue) => count + (getFieldMatchFromLabel(cellValue) ? 1 : 0), 0);
  return headerMatchCount >= Math.max(2, Math.floor(headerMap.length * 0.6));
}

function extractHeaderDrivenRecords(rows = []) {
  const records = [];

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const headerMap = getHeaderMap(rows[rowIndex]);
    const headerResultCount = headerMap.filter((item) => item.category === "result" && item.key !== "date").length;
    const headerTransformerCount = headerMap.filter((item) => item.category === "transformer").length;

    if (headerResultCount < 2 && headerTransformerCount < 2) {
      continue;
    }

    for (let valueRowIndex = rowIndex + 1; valueRowIndex < rows.length; valueRowIndex += 1) {
      const valueRow = rows[valueRowIndex] ?? [];

      if (!valueRow.some(isMeaningfulCellValue)) {
        if (records.length > 0) {
          break;
        }
        continue;
      }

      if (looksLikeAnotherHeaderRow(valueRow, headerMap)) {
        break;
      }

      const transformerPatch = {};
      const resultPatch = {};

      headerMap.forEach(({ columnIndex, key, category }) => {
        const cellValue = valueRow[columnIndex];
        if (!isMeaningfulCellValue(cellValue)) {
          return;
        }

        if (category === "transformer") {
          assignFieldValue(transformerPatch, key, cellValue);
          return;
        }

        assignFieldValue(resultPatch, key, cellValue);
      });

      if (countTransformerFields(transformerPatch) || countImportedResultFields(resultPatch)) {
        records.push({
          transformerPatch: cleanImportPatch(transformerPatch),
          resultPatch: cleanImportPatch(resultPatch),
        });
      } else if (valueRowIndex > rowIndex + 1) {
        break;
      }
    }
  }

  return records;
}

function extractElimsFallbackResultPatch(sheet, XLSX) {
  const startColumn = XLSX.utils.decode_col(ELIMS_FALLBACK_RANGE.startColumn);
  const endColumn = XLSX.utils.decode_col(ELIMS_FALLBACK_RANGE.endColumn);
  const headerRowIndex = ELIMS_FALLBACK_RANGE.headerRow - 1;
  const valueRowIndex = ELIMS_FALLBACK_RANGE.valueRow - 1;
  const resultPatch = {};

  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    const offset = columnIndex - startColumn;
    const fallbackGasKey = ELIMS_FALLBACK_RANGE.order[offset] ?? null;
    const headerAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
    const valueAddress = XLSX.utils.encode_cell({ r: valueRowIndex, c: columnIndex });
    const headerValue = sheet[headerAddress]?.w ?? sheet[headerAddress]?.v ?? null;
    const fieldMatch = getFieldMatchFromLabel(headerValue);
    const gasKey = fieldMatch?.key ?? fallbackGasKey;
    const numericValue = parseNumericValue(sheet[valueAddress]?.w ?? sheet[valueAddress]?.v ?? null);

    if (IMPORTABLE_GAS_FIELDS.includes(gasKey) && numericValue != null) {
      resultPatch[gasKey] = numericValue;
    }
  }

  return cleanImportPatch(resultPatch);
}

export async function extractAssetImportFromWorkbookFile(file) {
  if (!file) {
    throw new Error("Choose an Excel report before importing.");
  }

  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  if (!workbook.SheetNames.length) {
    throw new Error("This workbook does not contain any readable sheets.");
  }

  const transformerPatches = [];
  const resultPatches = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    extractHeaderDrivenRecords(rows).forEach((record) => {
      if (countTransformerFields(record.transformerPatch)) {
        transformerPatches.push(record.transformerPatch);
      }
      if (countImportedResultFields(record.resultPatch)) {
        resultPatches.push(record.resultPatch);
      }
    });

    const pairPatches = extractFieldPatchesFromPairs(extractFieldPairsFromRows(rows));
    if (countTransformerFields(pairPatches.transformerPatch)) {
      transformerPatches.push(pairPatches.transformerPatch);
    }
    if (countImportedResultFields(pairPatches.resultPatch)) {
      resultPatches.push(pairPatches.resultPatch);
    }

    const elimsFallbackPatch = extractElimsFallbackResultPatch(sheet, XLSX);
    const importedGasCount = IMPORTABLE_GAS_FIELDS.filter((field) => elimsFallbackPatch[field] != null).length;
    if (importedGasCount >= GAS_IMPORT_MINIMUM_FIELDS) {
      resultPatches.push(elimsFallbackPatch);
    }
  });

  const transformerPatch = mergeTransformerPatches(transformerPatches);
  const mergedResultPatches = mergeResultPatches(resultPatches);

  if (!countTransformerFields(transformerPatch) && mergedResultPatches.length === 0) {
    throw new Error(
      "No transformer details, DGA values, or oil-test values were found. The importer looks for labelled fields, table headers, and the ELIMS fallback range P14:X14.",
    );
  }

  return {
    fileType: "excel",
    fileName: file.name,
    transformerPatch,
    resultPatches: mergedResultPatches,
  };
}
