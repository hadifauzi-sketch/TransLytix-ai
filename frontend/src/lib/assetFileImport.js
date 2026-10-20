import { IMPORTABLE_FILE_ACCEPT, IMPORTABLE_FILE_TYPES } from "./assetImportShared.js";
import { extractAssetImportFromWorkbookFile } from "./excelImport.js";
import { extractAssetImportFromImageFile, isImportableImageFile } from "./imageImport.js";
import { extractAssetImportFromPdfFile } from "./pdfImport.js";

function isPdfFile(file) {
  const fileName = String(file?.name ?? "").toLowerCase();
  const mimeType = String(file?.type ?? "").toLowerCase();
  return fileName.endsWith(".pdf") || mimeType === "application/pdf";
}

export async function extractAssetImportFromFile(file, options = {}) {
  if (!file) {
    throw new Error("Choose a report before importing.");
  }

  if (isPdfFile(file)) {
    return extractAssetImportFromPdfFile(file, options);
  }

  if (isImportableImageFile(file)) {
    return extractAssetImportFromImageFile(file, options);
  }

  return extractAssetImportFromWorkbookFile(file, options);
}

export { IMPORTABLE_FILE_ACCEPT, IMPORTABLE_FILE_TYPES };
