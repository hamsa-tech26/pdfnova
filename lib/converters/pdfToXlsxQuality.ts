import type { LogicalTable, LogicalRow } from "../pdf-engine-v4/model/logicalTable";
import { inspectV4TableExport, tableToCsvRows } from "./v4TableExport";
import type { PdfXlsxInput } from "./pdfToXlsx";
import { hasCollapsedSerialAndIdColumns, reconstructConsecutiveNativeTable } from "./pdfToXlsxStructure";

/**
 * Release 60: auditable, fail-closed XLSX export for native-text logical tables.
 * The V4 pipeline may merge *confirmed* consecutive page continuations.
 * Never stitch distinct tables or guess merged-cell spans at this boundary.
 */
type NativePage = { pageNumber: number; textExtraction: { status: string } };
export type PdfV4XlsxExportSource = {
  document: { pages: readonly unknown[] };
  nativePageTextExtraction: readonly NativePage[];
  tables: readonly LogicalTable[];
};

function sourcePages(table: LogicalTable, pageCount: number): number[] {
  const numbers = table.rows.map(row => row.provenance?.pageNumber ?? table.pageNumber);
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > pageCount)) {
    throw new Error("A detected table has invalid page provenance; XLSX export was withheld.");
  }
  if (numbers.some((n, i) => i > 0 && n < numbers[i - 1])) {
    throw new Error("A detected table has out-of-order source pages; XLSX export was withheld.");
  }
  const pages = [...new Set(numbers)];
  if (pages.some((n, i) => i > 0 && n !== pages[i - 1] + 1)) {
    throw new Error("A table crosses nonconsecutive PDF pages; verify the source before exporting.");
  }
  if (pages.length > 1 && table.rows.some(row => !row.provenance)) {
    throw new Error("A multi-page table lacks row-level provenance; Excel export was withheld.");
  }
  return pages;
}

function checkRow(row: LogicalRow, width: number): number {
  const seen = new Set<number>();
  let populated = 0;
  for (const cell of row.cells) {
    if (!Number.isInteger(cell.columnIndex) || cell.columnIndex < 0 ||
        cell.columnIndex >= width || seen.has(cell.columnIndex)) {
      throw new Error("A table has duplicated or invalid cell columns; Excel export was withheld.");
    }
    seen.add(cell.columnIndex);
    if (String(cell.text ?? "").trim()) {
      populated++;
      if (cell.extractionProvenance &&
          cell.extractionProvenance.source !== "native-pdf") {
        throw new Error("OCR or mixed-source table cells are not supported by this Excel converter.");
      }
    }
  }
  return populated;
}

/** Reject overlapping filled cells instead of inventing merges or shifting data. */
function inspectOverlappingCells(table: LogicalTable): void {
  for (const row of table.rows) {
    const filled = row.cells.filter(c => c.text.trim() &&
      c.bounds && c.bounds.width > 0 && c.bounds.height > 0 &&
      Number.isFinite(c.bounds.x) && Number.isFinite(c.bounds.y));
    for (let i = 0; i < filled.length; i++) {
      for (let j = i + 1; j < filled.length; j++) {
        const a = filled[i].bounds, b = filled[j].bounds;
        const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        // Only significant intersection on the same line. Small OCR/renderer
        // bbox tolerance is not considered evidence of merged cells.
        if (overlap > Math.min(a.width, b.width) * 0.35 &&
            verticalOverlap > Math.min(a.height, b.height) * 0.5) {
          // Only a caption-derived multi-level header can use the finer
          // word-level collision check. Keep ordinary and data-row guards.
          const isCaptionHeader = row.rowIndex === 0 &&
            row.provenance?.blockId?.startsWith("caption-table-") === true &&
            filled[i].words.length > 0 && filled[j].words.length > 0;
          const wordsOverlap = filled[i].words.some(first =>
            filled[j].words.some(second => {
              const dx = Math.min(first.bounds.x + first.bounds.width,
                second.bounds.x + second.bounds.width) -
                Math.max(first.bounds.x, second.bounds.x);
              const dy = Math.min(first.bounds.y + first.bounds.height,
                second.bounds.y + second.bounds.height) -
                Math.max(first.bounds.y, second.bounds.y);
              return dx > Math.min(first.bounds.width, second.bounds.width) * 0.35 &&
                dy > Math.min(first.bounds.height, second.bounds.height) * 0.5;
            })
          );
          if (isCaptionHeader && !wordsOverlap) continue;
          throw new Error("Overlapping table cells suggest ambiguous layout or merged cells; XLSX export was withheld.");
        }
      }
    }
  }
}


/**
 * For a captioned two-unit median grid, use original header word geometry to
 * give each worksheet column an explicit unit. Reject ambiguous alternatives.
 * Body cells are never modified.
 */
function projectCaptionMedianUnits(
  table: LogicalTable,
  rows: string[][],
): string[][] {
  const head = table.rows[0];
  if (!head || !head.provenance?.blockId?.startsWith("caption-table-") ||
      !rows.length || rows[0].length < 5) return rows;
  const groups = head.cells.flatMap(cell => cell.words)
    .map(word => ({
      label: /^Median \((minutes|hours|seconds|days)\)$/i.exec(word.text.trim()),
      centerX: word.bounds.x + word.bounds.width / 2,
    }))
    .filter(item => item.label !== null)
    .sort((a, b) => a.centerX - b.centerX);
  if (groups.length !== 2 || groups[0].label?.[1] === groups[1].label?.[1])
    return rows;
  const threshold = (groups[0].centerX + groups[1].centerX) / 2;
  const headers = [...rows[0]];
  for (let column = 1; column < table.columnCount; column += 1) {
    const cell = head.cells.find(item => item.columnIndex === column);
    if (!cell) return rows;
    const yearWord = cell.words.find(word => /^WY\s+\d{4}$/i.test(word.text.trim()));
    if (!yearWord) return rows;
    const unit = (yearWord.bounds.x < threshold ? groups[0] : groups[1]).label?.[1];
    if (!unit) return rows;
    headers[column] = yearWord.text.trim() + " (" + unit.toLowerCase() + ")";
  }
  return [headers, ...rows.slice(1)];
}

export function preparePdfV4XlsxExport(source: PdfV4XlsxExportSource): PdfXlsxInput {
  const pageCount = source.document.pages.length;
  if (pageCount < 1 || pageCount > 25) {
    throw new Error("This converter supports 1–25 PDF pages.");
  }
  const nativePages = source.nativePageTextExtraction;
  if (nativePages.length !== pageCount ||
      new Set(nativePages.map(p => p.pageNumber)).size !== pageCount ||
      nativePages.some(p => !Number.isInteger(p.pageNumber) ||
        p.pageNumber < 1 || p.pageNumber > pageCount ||
        p.textExtraction.status !== "sufficient")) {
    throw new Error("This PDF has image-only or low-text pages. Scanned and mixed PDFs are not supported by this XLSX converter.");
  }
  if (!source.tables.length) {
    throw new Error("No reliable selectable-text table was detected. No empty XLSX was created.");
  }
  if (source.tables.length > 12) {
    throw new Error("This PDF exceeds the maximum of 12 detected tables.");
  }


  // Before trusting the engine's logical column count, verify whether a
  // repeated numeric serial and ID were silently merged into the same cell.
  // Reflow is allowed only for strongly aligned native source word positions
  // on *consecutive* pages with a proven serial sequence; otherwise refuse.
  const nativeOnly = source.tables.every(t =>
    Number.isFinite(t.confidence) && t.confidence >= 0.65 &&
    (!t.extractionProvenance || t.extractionProvenance.source === "native-pdf") &&
    t.rows.every(r => r.cells.every(c =>
      !String(c.text ?? "").trim() ||
      !c.extractionProvenance || c.extractionProvenance.source === "native-pdf")));
  // Reflow is never used for only part of a document: unaccounted source
  // pages could hide omitted rows or a conflicting additional table.
  const completePageCoverage = source.tables.length === pageCount &&
    source.tables.every((t, i) => t.pageNumber === i + 1);
  if (nativeOnly && completePageCoverage) {
    const recovered = reconstructConsecutiveNativeTable(source.tables);
    if (recovered) return recovered;
  }
  if (source.tables.some(hasCollapsedSerialAndIdColumns)) {
    throw new Error("Table columns are merged together (including the row number and identifier); XLSX export was withheld because source column separation cannot be verified.");
  }

  const covered = new Set<number>();
  const notes = [
    "UNVERIFIED: XLSX cells were reconstructed from PDF text positions; verify all rows, headings, blank cells, numbers and column order against the original PDF.",
    "For standard V4 exports, extracted cells remain literal text. Only the separate, verified eight-column native-table path may encode safe household/FHTC integers as Excel numbers; identifiers and formula-like source text remain literal. Merged-cell formatting and PDF layout are not recreated.",
  ];
  const tables = source.tables.map((table, index) => {
    const number = index + 1;
    if (!Number.isFinite(table.confidence) || table.confidence < 0.65 ||
        !Number.isInteger(table.columnCount) || table.columnCount < 2 ||
        table.columnCount > 128 || table.rows.length < 2 ||
        table.rows.length > 2000) {
      throw new Error("One or more tables have uncertain row or column structure. Export was withheld to prevent misleading XLSX data.");
    }
    if (table.extractionProvenance &&
        table.extractionProvenance.source !== "native-pdf") {
      throw new Error("OCR or mixed-source tables are not supported by this Excel converter.");
    }
    const pages = sourcePages(table, pageCount);
    pages.forEach(page => covered.add(page));
    const counts = table.rows.map(row => checkRow(row, table.columnCount));
    if (counts.every(n => n === 0)) {
      throw new Error("A table has no populated cells; Excel export was withheld.");
    }
    inspectOverlappingCells(table);
    const blankRows = counts.filter(n => n === 0).length;
    const partiallyFilled = counts.filter(n => n > 0 && n < table.columnCount).length;
    const diagnostics = inspectV4TableExport(table);
    const pageLabel = pages.length === 1 ? "Page " + pages[0] :
      "Pages " + pages[0] + "-" + pages[pages.length - 1];
    notes.push("Table " + number + " (" + pageLabel + "): " + table.rows.length +
      " extracted rows, " + table.columnCount + " columns. " +
      blankRows + " fully blank row(s), " + partiallyFilled + " partially filled row(s).");
    if (pages.length > 1) {
      notes.push("Table " + number + ": multi-page continuation was determined by the PDF table engine; review the boundary and possible duplicated/missing header rows.");
    }
    for (const warning of diagnostics.warnings) notes.push("Table " + number + ": " + warning);
    const extractedRows = tableToCsvRows(table);
    const rows = projectCaptionMedianUnits(table, extractedRows);
    if (rows !== extractedRows) {
      notes.push("Table " + number + ": two-unit median headings were projected from native source header labels and source word positions; verify grouped headers against the PDF.");
    }
    return { name: "Table " + number, rows };
  });
  const omitted = Array.from({ length: pageCount }, (_, i) => i + 1)
    .filter(p => !covered.has(p));
  if (omitted.length) {
    notes.push("No confidently detected table exported from page(s) " +
      omitted.join(", ") + "; inspect these source pages for omitted tables.");
  }
  return { tables, reviewNotes: notes };
}
