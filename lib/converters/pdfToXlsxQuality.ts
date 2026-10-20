import type { LogicalTable, LogicalRow } from "../pdf-engine-v4/model/logicalTable";
import {describeNativePairedGroupHeaders} from "./nativeGroupedHeaderGuide";
import {estimatePdfTableColumnWidths} from "./pdfToXlsxReadability";
import {preserveNativeWideHeaderLines} from "./nativeWideHeaderLines";
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


type NativeHeaderWord = {
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
  extractionProvenance?: { source?: string };
};

/**
 * Retain source-visible multi-level units when flat XLSX columns would otherwise
 * have ambiguous duplicate labels. Use native source words only; never infer the
 * parent labels from numeric cell values, and leave uncertain cases unchanged.
 * These guards are intentionally narrower than generic PDF table recovery.
 */
function projectNativeGroupedHeaders(
  source: PdfV4XlsxExportSource,
  table: LogicalTable,
  rows: string[][],
): { rows: string[][]; note: string | null } {
  const header = table.rows[0];
  if (!header || !rows[0] || rows[0].length !== table.columnCount ||
      !table.rows.every(row => row.provenance?.pageNumber === table.pageNumber)) {
    return { rows, note: null };
  }
  const cells = header.cells;
  const words = cells.flatMap(cell => cell.words);
  // A source captioned table with one explicit Month super-header can have its
  // Month word assigned to only the October cell by the flat table engine.
  if (header.provenance?.blockId?.startsWith("caption-table-")) {
    const group = words.filter(word => word.text.trim() === "Month");
    const months = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i;
    const leaves = cells.flatMap(cell => cell.words
      .filter(word => months.test(word.text.trim()))
      .map(word => ({ column: cell.columnIndex, word })))
      .sort((a, b) => a.column - b.column);
    if (group.length === 1 && leaves.length >= 3 && leaves.length <= 12 &&
        leaves.every((leaf, i) => i === 0 || leaf.column === leaves[i - 1].column + 1) &&
        new Set(leaves.map(leaf => leaf.column)).size === leaves.length) {
      const center = (word: NativeHeaderWord) => word.bounds.x + word.bounds.width / 2;
      const groupCenter = center(group[0]);
      if (groupCenter > center(leaves[0].word) &&
          groupCenter < center(leaves[leaves.length - 1].word) &&
          leaves.every(({ column, word }) =>
            rows[0][column] === word.text.trim() ||
            rows[0][column] === "Month " + word.text.trim())) {
        const out = [...rows[0]];
        for (const { column, word } of leaves) out[column] = "Month / " + word.text.trim();
        return { rows: [out, ...rows.slice(1)],
          note: "Month group heading was preserved from native header words." };
      }
    }
  }

  // A more complex native table may retain its four lower-level headers while
  // the two upper-level measurement labels occupy a separate source line/block.
  // Recover ONLY when both original labels occur directly above that row.
  if (table.columnCount !== 6 || rows[0][0] !== "Calendar year" ||
      rows[0][1] !== "Water year" ||
      rows[0].slice(2).join("|") !==
        "Mean (range)|Standard deviation|Mean (range)|Standard deviation") {
    return { rows, note: null };
  }
  const page = source.document.pages[table.pageNumber - 1] as
    { words?: NativeHeaderWord[] } | undefined;
  const sourceWords = Array.isArray(page?.words) ? page.words : [];
  const labels = ["Total length (meters)", "Girth (meters)"];
  const groups = labels.map(label => sourceWords.filter(word =>
    word.text.trim() === label &&
    (!word.extractionProvenance || word.extractionProvenance.source === "native-pdf")));
  if (groups.some(group => group.length !== 1)) return { rows, note: null };
  const left = groups[0][0], right = groups[1][0];
  const center = (word: NativeHeaderWord) => word.bounds.x + word.bounds.width / 2;
  const threshold = (center(left) + center(right)) / 2;
  const headerCells = [2, 3, 4, 5].map(index => cells.find(cell => cell.columnIndex === index));
  if (center(left) >= center(right) || headerCells.some(cell => !cell ||
      cell.words.length < 1 || !cell.bounds)) return { rows, note: null };
  // Source PDF uses bottom-origin coordinates for the V4 word model; parent
  // headings must be close above the lower-level headings, not in body text.
  const top = Math.max(...headerCells.map(cell => cell!.bounds.y + cell!.bounds.height));
  if (groups.some(group => group[0].bounds.y < top ||
      group[0].bounds.y - top > 35)) return { rows, note: null };
  const columnCenters = headerCells.map(cell =>
    cell!.words.reduce((sum, word) => sum + center(word), 0) / cell!.words.length);
  if (!(columnCenters[0] < threshold && columnCenters[1] < threshold &&
        columnCenters[2] > threshold && columnCenters[3] > threshold)) {
    return { rows, note: null };
  }
  const newHeaders = [...rows[0]];
  for (let index = 2; index < 6; index++) {
    newHeaders[index] = (index < 4 ? left.text.trim() : right.text.trim()) +
      " / " + rows[0][index];
  }
  return { rows: [newHeaders, ...rows.slice(1)],
    note: "Length and girth measurement groups were preserved from native page header words." };
}

/** R134: Compact scientific rescues require a deliberate table selection;
 * the all-tables path must never silently certify their positional recovery. */
export function preparePdfV4XlsxExport(
  source: PdfV4XlsxExportSource,
  options?: { allowSelectedCompactGrid?: boolean },
): PdfXlsxInput {
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
  const needsExplicitReview=(id:string|undefined)=>!!id&&(
    id.startsWith("native-compact-grid-")||
    id.startsWith("native-captioned-text-grid-")||
    id.startsWith("native-caption-header-grid-"));
  const reviewOnlyTables=source.tables.filter(table=>table.rows.some(row=>
    needsExplicitReview(row.provenance?.blockId)));
  const excludedReviewCount=!options?.allowSelectedCompactGrid?
    reviewOnlyTables.length:0;
  if(excludedReviewCount){
    const standard=source.tables.filter(table=>!reviewOnlyTables.includes(table));
    // Never turn an entirely unverified new discovery into an unattended
    // workbook. But preserve all previously eligible native tables, without
    // silently counting unreviewed candidates as trusted source cells.
    if(standard.length===0)
      throw new Error("Only unverified new grid candidates were detected; choose an individual table and review its source before exporting.");
    source={...source,tables:standard};
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
    ...(excludedReviewCount ? ["REVIEW REQUIRED: "+excludedReviewCount+
      " newly recovered, unverified grid candidate(s) were explicitly omitted "+
      "from automatic Excel export. Existing eligible native tables alone "+
      "were exported. Select and inspect each omitted candidate separately "+
      "before considering its contents."] : []),
  ];
  const tables = source.tables.map((table, index) => {
    const number = index + 1;
    const captionedText=table.rows.some(row=>
      row.provenance?.blockId?.startsWith("native-captioned-text-grid-"));
    const scientificHeader=table.rows.some(row=>
      row.provenance?.blockId?.startsWith("native-caption-header-grid-"));
    if((captionedText||scientificHeader)&&table.rows.length<8)
      throw new Error("Captioned native scientific grid has too few reconstructed physical lines; Excel export was withheld.");
    if(table.rows.some(row=>needsExplicitReview(row.provenance?.blockId))){
      notes.push("Table "+number+": HIGH REVIEW PRIORITY: recovered native "+
        "scientific or captioned two-column text grid using repeated source "+
        "word positions only. Source table semantics, row and column labels, "+
        "blank cells and values have NOT been independently verified. "+
        "Compare EVERY cell against the original PDF before using the export.");
    }
    if(captionedText||scientificHeader)notes.push("Table "+number+
      ": Every source PDF physical text line is a separate Excel row. "+
      "Wrapped physical lines, multi-tier scientific headings and sparse "+
      "continuation lines may belong to one semantic record; no row "+
      "continuation, field identity or grouping has been verified. "+
      "Do not treat these rows as finalized spreadsheet records.");
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
    const inferredSymbols = table.rows.flatMap(row => row.cells)
      .filter(cell => (cell.nativeTextAdjustmentReasons?.length ?? 0) > 0);
    if (inferredSymbols.length) {
      notes.push("Table " + number + ": " + inferredSymbols.length +
        " native scientific label cell(s) contain Greek symbols inferred " +
        "from ambiguous font glyphs. Original extracted strings were retained " +
        "for audit; compare every inferred symbol with the visual PDF before use.");
    }
    if(table.columnCount===11 && table.rows.length>=11 &&
      table.rows[0]?.provenance?.blockId?.startsWith("dense-native-eleven-grid-")){
      notes.push("Table "+number+": A complex native eleven-column scientific "+
        "table header was reconstructed from multiple physical PDF lines. "+
        "The original header wording, column grouping and wrapped cell values "+
        "are NOT independently verified; compare them visually with the PDF.");
    }
    const extractedRows = tableToCsvRows(table);
    const medianRows = projectCaptionMedianUnits(table, extractedRows);
    if (medianRows !== extractedRows) {
      notes.push("Table " + number + ": two-unit median headings were projected from native source header labels and source word positions; verify grouped headers against the PDF.");
    }
    const grouped = projectNativeGroupedHeaders(source, table, medianRows);
    if (grouped.note) {
      notes.push("Table " + number + ": " + grouped.note +
        " Verify the source multi-level structure against the PDF.");
    }
    const wideHeader=preserveNativeWideHeaderLines(table,grouped.rows);
    if(wideHeader.headerWrapped)notes.push("Table "+number+
      ": "+wideHeader.wrappedCells+" source-native wide-table header cell(s) "+
      "retain original PDF physical line breaks in Excel; no header words, "+
      "semantic grouping, formulas or data positions were inferred. "+
      "Compare the original publisher header visually.");
    const headerGuide=describeNativePairedGroupHeaders(grouped.rows);
    // R94: freeze ordinary single-level source headings only with complete,
    // native-provenanced first-row labels plus evidence that later rows
    // contain numbers. Never infer missing labels or apply Excel auto-filters.
    const sourceFirst=table.rows[0];
    const headerWords=sourceFirst?.cells ?? [];
    const headerTexts=grouped.rows[0] ?? [];
    const sourceFirstHeader=pages.length===1 && !headerGuide &&
      !wideHeader.headerWrapped &&
      medianRows===extractedRows && grouped.rows===extractedRows &&
      table.rows.length>=3 &&
      headerTexts.length===table.columnCount &&
      headerWords.length===table.columnCount &&
      headerWords.every(cell=>cell.text.trim() &&
        cell.words.length>0 && cell.words.every(word=>
          word.extractionProvenance?.source==="native-pdf")) &&
      new Set(headerTexts.map(value=>String(value).trim().toLowerCase())).size===
        table.columnCount &&
      headerTexts.filter(value=>/[a-zA-Z]{2,}/.test(String(value))).length>=2 &&
      grouped.rows.slice(1).some(row=>
        row.some(value=>/^\s*[-+−]?\d/u.test(String(value))));
    if(sourceFirstHeader)notes.push("Table "+number+
      ": Source-native first row was frozen for Excel navigation, without an "+
      "automatic filter. Header semantics are NOT independently verified.");
    // Only original native words in both intact source header rows can
    // authorize Excel visual merges. Never move data or assume spans for OCR,
    // multi-page or projected/reworded headings.
    const nativePairedHeader=!!headerGuide && pages.length===1 &&
      medianRows===extractedRows && grouped.rows===extractedRows &&
      table.rows.slice(0,2).every(row =>
        row.provenance?.pageNumber===table.pageNumber &&
        row.cells.filter(cell=>cell.text.trim()).every(cell=>
          cell.words.length>0 && cell.words.every(word=>
            word.extractionProvenance?.source==="native-pdf")));
    if(nativePairedHeader){
      notes.push("Table "+number+": Native two-tier parent headings were visually merged "+
        "B1:C1, D1:E1 and F1:G1 in Excel. Both original header rows and every "+
        "source cell value retain their positions; this formatting is NOT "+
        "independent semantic verification. Review group boundaries in the PDF.");
    }
    if(headerGuide){
      for(const message of headerGuide.notes)notes.push(
        "Table "+number+": "+message,
      );
    }
    return { name: "Table " + number, rows: wideHeader.rows,
      columnWidths:estimatePdfTableColumnWidths(wideHeader.rows),
      ...(wideHeader.headerWrapped ? {nativeWideMultilineHeader:true} : {}),
      ...(nativePairedHeader ? {nativePairedHeader:true} : {}),
      ...(sourceFirstHeader ? {freezeSourceHeader:true} : {}) };
  });
  const omitted = Array.from({ length: pageCount }, (_, i) => i + 1)
    .filter(p => !covered.has(p));
  if (omitted.length) {
    notes.push("No confidently detected table exported from page(s) " +
      omitted.join(", ") + "; inspect these source pages for omitted tables.");
  }
  return { tables, reviewNotes: notes };
}
