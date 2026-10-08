import type { LogicalTable } from "../model/logicalTable";
import type { PdfDocumentModel } from "../model/types";
import type { PdfV4OcrDecision } from "../ocr/ocrDecision";
import type { PdfV4ControlledOcrResult } from "../ocr/controlledOcrFallback";

export type Release37CheckState = "PASS_SCOPED" | "REVIEW_REQUIRED" | "NOT_VERIFIED";
export type Release37Check = {
  id: string;
  state: Release37CheckState;
  detail: string;
};
export type Release37Audit = {
  designation: "DIAGNOSTIC_ONLY_NOT_V4_STABLE";
  checks: Release37Check[];
  fileBytes: number;
  elapsedMs: number;
  pageCount: number;
  tableCount: number;
  correctedCellCount: number;
  nativePages: number[];
  requiredOcrPages: number[];
  actualOcrPages: number[];
};

/**
 * Runtime diagnostics, not a benchmark or an accuracy certificate.
 * These checks never rewrite original words, tables, or reference answers.
 */
export function createRelease37Audit(input: {
  nativeDocument: PdfDocumentModel;
  analyzedDocument: PdfDocumentModel;
  decision: PdfV4OcrDecision;
  ocrResult?: PdfV4ControlledOcrResult;
  tables: LogicalTable[];
  fileBytes: number;
  elapsedMs: number;
}): Release37Audit {
  const { nativeDocument, analyzedDocument, decision, ocrResult, tables } = input;
  const checks: Release37Check[] = [];
  const nativePages = nativeDocument.pages
    .filter(page => page.textExtraction.status === "sufficient")
    .map(page => page.pageNumber);
  const expectedOcr = new Set(decision.requiredPageNumbers);
  const actualOcrPages = ocrResult?.processedPageNumbers ?? [];
  const actualOcr = new Set(actualOcrPages);
  const unexpectedlyScanned = actualOcrPages.filter(page => !expectedOcr.has(page));
  const unprocessed = decision.requiredPageNumbers.filter(page => !actualOcr.has(page));
  const nativeLossPages = nativeDocument.pages.filter(page => {
    if (!nativePages.includes(page.pageNumber)) return false;
    const analyzed = analyzedDocument.pages.find(candidate => candidate.pageNumber === page.pageNumber);
    if (!analyzed) return true;
    const original = new Map(page.words.map(word => [word.id, word.text]));
    const reconstructed = new Map(analyzed.words.map(word => [word.id, word.text]));
    return [...original].some(([id, text]) => reconstructed.get(id) !== text);
  }).map(page => page.pageNumber);

  checks.push({
    id: "10.15-native-preservation",
    state: nativeLossPages.length ? "REVIEW_REQUIRED" : nativePages.length ? "PASS_SCOPED" : "NOT_VERIFIED",
    detail: nativeLossPages.length
      ? "Native text changed or disappeared on pages: " + nativeLossPages.join(", ")
      : nativePages.length
        ? "Native word IDs and original text preserved on " + nativePages.length + " native-text page(s)."
        : "No native-text pages available for preservation check.",
  });
  checks.push({
    id: "10.15-selective-ocr",
    state: unexpectedlyScanned.length || (ocrResult?.attempted && unprocessed.length)
      ? "REVIEW_REQUIRED"
      : decision.requiredPageNumbers.length && ocrResult?.attempted && !unprocessed.length
        ? "PASS_SCOPED" : "NOT_VERIFIED",
    detail: unexpectedlyScanned.length
      ? "OCR was attempted on pages not approved for OCR: " + unexpectedlyScanned.join(", ")
      : unprocessed.length
        ? "OCR not completed for requested pages: " + unprocessed.join(", ")
        : "Requested scanned pages: " + decision.requiredPageNumbers.length +
          "; processed: " + actualOcrPages.length + ". Low-text pages require review, not silent OCR.",
  });
  checks.push({
    id: "10.15-scanned-insets",
    state: "NOT_VERIFIED",
    detail: "Scanned image insertions inside pages with selectable text are not identified by the page-level OCR router. Manual review required.",
  });

  let structuralIssues = 0;
  let correctedCellCount = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      const indices = row.cells.map(cell => cell.columnIndex);
      if (new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= table.columnCount)) {
        structuralIssues++;
      }
      if (indices.length !== table.columnCount || row.cells.some(cell => !cell.text.trim())) structuralIssues++;
      for (const cell of row.cells) {
        if (cell.originalOcrText !== undefined && cell.originalOcrText !== cell.text) correctedCellCount++;
      }
    }
  }
  checks.push({
    id: "10.16-complex-table-structure",
    state: structuralIssues ? "REVIEW_REQUIRED" : "NOT_VERIFIED",
    detail: structuralIssues
      ? structuralIssues + " row-level structural warning(s); merged spans, irregular headers, gridless boundaries and forms still need geometry-grounded qualification."
      : "Regular column indexing observed. Merged spans, nested headers, irregular columns and gridless layouts are NOT independently verified.",
  });
  checks.push({
    id: "10.16-ocr-corrections",
    state: correctedCellCount ? "REVIEW_REQUIRED" : "NOT_VERIFIED",
    detail: correctedCellCount
      ? correctedCellCount + " corrected OCR cell(s) retain originalOcrText; verify against source before CSV export."
      : "No OCR cell adjustments recorded; correction fidelity not independently verified.",
  });

  let multiPageTables = 0;
  let nonMonotonic = 0;
  for (const table of tables) {
    const pageNumbers = table.rows.map(row => row.provenance?.pageNumber);
    if (new Set(pageNumbers.filter((page): page is number => page !== undefined)).size <= 1) continue;
    multiPageTables++;
    if (pageNumbers.some((page, i) =>
      page === undefined || (i > 0 && (page < (pageNumbers[i - 1] ?? 0) || page > (pageNumbers[i - 1] ?? 0) + 1))
    )) nonMonotonic++;
  }
  checks.push({
    id: "10.17-multipage-continuation",
    state: nonMonotonic ? "REVIEW_REQUIRED" : multiPageTables ? "PASS_SCOPED" : "NOT_VERIFIED",
    detail: nonMonotonic
      ? nonMonotonic + " merged table(s) contain missing, reversed or skipped page provenance."
      : multiPageTables
        ? multiPageTables + " merged table(s) have monotonic adjacent page provenance. Table identity and source content still require reference tests."
        : "No merged multi-page table observed.",
  });

  const nativeCharacters = nativeDocument.pages.flatMap(page => page.words.map(word => word.text)).join(" ");
  const detectedScripts = [
    /[\u0900-\u097F]/u.test(nativeCharacters) ? "Devanagari" : null,
    /[\u0980-\u09FF]/u.test(nativeCharacters) ? "Bengali" : null,
  ].filter(Boolean);
  checks.push({
    id: "10.18-multilingual-ocr",
    state: "NOT_VERIFIED",
    detail: "Browser OCR recognizer currently uses English (eng) only. " +
      (detectedScripts.length ? "Native PDF text includes " + detectedScripts.join(" / ") + "." :
        "Scanned non-English scripts cannot be reliably identified in this pipeline.") +
      " Hindi/Bengali scanned recognition is not certified.",
  });
  checks.push({
    id: "10.19-browser-performance",
    state: input.fileBytes > 25 * 1024 * 1024 ? "REVIEW_REQUIRED" : "NOT_VERIFIED",
    detail: "Measured " + Math.round(input.elapsedMs) + " ms at " + input.fileBytes + " bytes. " +
      "Main-thread blocking, peak heap, cancellation, page batching and 25 MB stress are NOT verified by this timing.",
  });
  checks.push({
    id: "10.20-stable-freeze",
    state: "NOT_VERIFIED",
    detail: "Requires independent consented/de-identified real-world document corpus, multilingual, geometry, performance and zero-critical-regression evidence.",
  });

  return {
    designation: "DIAGNOSTIC_ONLY_NOT_V4_STABLE",
    checks,
    fileBytes: input.fileBytes,
    elapsedMs: input.elapsedMs,
    pageCount: nativeDocument.pages.length,
    tableCount: tables.length,
    correctedCellCount,
    nativePages,
    requiredOcrPages: [...expectedOcr],
    actualOcrPages: [...actualOcr],
  };
}
