import JSZip from "jszip";
import { describeNativePairedGroupHeaders } from "./nativeGroupedHeaderGuide";

/**
 * Genuine Office Open XML spreadsheet package. Values are inline strings by
 * default. Only explicitly opted-in verified metric columns can emit safe,
 * canonical nonnegative integer cells; identifiers and leading-zero values
 * remain literal strings. No PDF value is ever interpreted as a formula or date.
 */
export type PdfXlsxTable = {
  name: string;
  rows: readonly (readonly unknown[])[];
  /** Explicit opt-in: only canonical, safe integer cells in these columns are typed as numbers. */
  numericColumns?: readonly number[];
  /** Opt-in for verified tabular data; freezes the first row and adds an Excel filter. */
  freezeHeader?: boolean;
  /** Optional bounded widths for verified tables. */
  columnWidths?: readonly number[];
  /**
   * Release 91: visual-only OOXML grouped headers for source-verified native
   * 7-column, two-level 1 + 3×2 layouts. Never insert or infer cell values.
   * Export refuses this option unless the original two header rows match.
   */
  nativePairedHeader?: boolean;
  /** Native first-row labels are source-supported; cosmetic freeze, NO auto-filter. */
  freezeSourceHeader?: boolean;
};
export type PdfXlsxInput = {
  tables: readonly PdfXlsxTable[];
  reviewNotes?: readonly string[];
};

const MAX_SHEETS = 12;
const MAX_ROWS = 2000;
const MAX_COLUMNS = 128;
const MAX_CELLS = 50000;
const MAX_CELL_CHARACTERS = 10000;

function xmlSafe(value: unknown): string {
  const original = String(value ?? "");
  if (original.length > MAX_CELL_CHARACTERS) {
    throw new Error("A cell exceeds the 10,000-character safety limit.");
  }
  // XML 1.0 legal code points only, retaining all ordinary Unicode.
  return original.replace(
    /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
    "",
  ).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellColumn(index: number): string {
  let number = index + 1;
  let result = "";
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + number % 26) + result;
    number = Math.floor(number / 26);
  }
  return result;
}

function sheetXml(table: PdfXlsxTable): string {
  const rows = table.rows;
  if (rows.length === 0 || rows.length > MAX_ROWS) {
    throw new Error("Each exported table must contain 1–2,000 rows.");
  }
  const width = Math.max(0, ...rows.map(row => row.length));
  if (width === 0 || width > MAX_COLUMNS) {
    throw new Error("Each exported table must contain 1–128 columns.");
  }
  if (rows.length * width > MAX_CELLS) {
    throw new Error("Table exceeds the 50,000-cell spreadsheet safety limit.");
  }

  if (table.nativePairedHeader &&
      (width !== 7 || rows.length < 3 || table.freezeHeader ||
        !describeNativePairedGroupHeaders(rows as readonly (readonly string[])[]))) {
    throw new Error("Two-level native header merges lack safe matching source heading cells.");
  }
  if (table.freezeSourceHeader &&
      (table.nativePairedHeader || table.freezeHeader || rows.length < 3 ||
        !rows[0]?.length || rows[0].some(value=>!String(value??"").trim()))) {
    throw new Error("Source first-row header freeze requires a complete, unambiguous heading.");
  }
  const typed = new Set(table.numericColumns ?? []);
  if (typed.size !== (table.numericColumns?.length ?? 0) ||
      [...typed].some(index => !Number.isInteger(index) || index < 0 || index >= width)) {
    throw new Error("Invalid explicitly typed numeric column.");
  }
  if (table.columnWidths && (table.columnWidths.length !== width ||
      table.columnWidths.some(n => !Number.isFinite(n) || n < 8 || n > 55))) {
    throw new Error("Invalid bounded worksheet column widths.");
  }
  const data = rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length > MAX_COLUMNS) {
      throw new Error("Invalid table row.");
    }
    const cells = row.map((value, columnIndex) => {
      const label = cellColumn(columnIndex) + (rowIndex + 1);
      // Only explicit metric columns can become numbers. Canonical nonnegative
      // integers up to 15 digits avoid Excel precision loss and text coercion.
      // Identifiers, leading-zero codes and formula-like strings stay literal.
      const literal = String(value ?? "");
      if (rowIndex > 0 && typed.has(columnIndex) &&
          /^(?:0|[1-9][0-9]{0,14})$/.test(literal) &&
          Number.isSafeInteger(Number(literal))) {
        return '<c r="' + label + '" t="n"' +
          ((table.nativePairedHeader && rowIndex < 2) || (table.freezeSourceHeader && rowIndex===0) ? ' s="1"' : '') +
          '><v>' + literal + '</v></c>';
      }
      // Inline string cells cannot execute spreadsheet formulas.
      return '<c r="' + label + '" t="inlineStr"' +
        ((table.nativePairedHeader && rowIndex < 2) || (table.freezeSourceHeader && rowIndex===0) ? ' s="1"' : '') +
        '><is><t xml:space="preserve">' +
        xmlSafe(value) + "</t></is></c>";
    }).join("");
    return '<row r="' + (rowIndex + 1) + '"' +
      ((table.nativePairedHeader && rowIndex < 2) || (table.freezeSourceHeader && rowIndex===0) ? ' ht="30" customHeight="1"' : '') +
      '>' + cells + "</row>";
  }).join("");
  const range = "A1:" + cellColumn(width - 1) + rows.length;
  const view = table.nativePairedHeader ?
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' :
    (table.freezeHeader || table.freezeSourceHeader) && rows.length > 1 ?
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : "";
  const cols = table.columnWidths?.length ?
    '<cols>' + table.columnWidths.map((n, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) +
      '" width="' + n + '" customWidth="1"/>').join("") + '</cols>' : "";
  // Merge only the *visually blank* child parent-header cells (never data).
  // Every original XML value and both source header rows remain at their
  // original Excel coordinates. No header label is synthesized.
  const merges = table.nativePairedHeader ?
    '<mergeCells count="3"><mergeCell ref="B1:C1"/><mergeCell ref="D1:E1"/><mergeCell ref="F1:G1"/></mergeCells>' : "";
  const filter = table.freezeHeader && rows.length > 1 ?
    '<autoFilter ref="' + range + '"/>' : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="' + range + '"/>' + view + cols +
    '<sheetData>' + data + '</sheetData>' + merges + filter + '</worksheet>';
}

function safeSheetName(raw: string, index: number, existing: Set<string>): string {
  const base = raw.replace(/[\[\]:*?\/\\\u0000-\u001f]/g, " ").trim().slice(0, 31) ||
    "Table " + (index + 1);
  let name = base;
  let suffix = 2;
  while (existing.has(name.toLowerCase())) {
    const append = " (" + suffix++ + ")";
    name = base.slice(0, 31 - append.length) + append;
  }
  existing.add(name.toLowerCase());
  return name;
}

export async function createPdfXlsxWorkbook(input: PdfXlsxInput): Promise<Uint8Array> {
  if (!Array.isArray(input.tables) || input.tables.length === 0 ||
      input.tables.length > MAX_SHEETS) {
    throw new Error("Export requires 1–12 detected tables.");
  }
  let totalCells = 0;
  for (const table of input.tables) {
    if (!Array.isArray(table.rows)) throw new Error("Invalid table data.");
    totalCells += table.rows.reduce((sum: number, row: readonly unknown[]) => sum + row.length, 0);
    if (totalCells > MAX_CELLS) {
      throw new Error("Workbook exceeds 50,000 source cells.");
    }
  }
  // Never silently discard source-page omission or accuracy warnings.
  // The review sheet is bounded but omission is an explicit error.
  if ((input.reviewNotes?.length ?? 0) > 200) {
    throw new Error("Too many spreadsheet review notes; no notes were discarded.");
  }
  // A notes worksheet also counts against the workbook's worksheet limit.
  if (input.tables.length + (input.reviewNotes?.length ? 1 : 0) > MAX_SHEETS) {
    throw new Error("Too many tables to include the required review-notes worksheet.");
  }
  const notes = (input.reviewNotes ?? []).map(note => {
    const text = String(note);
    if (text.length > 500) {
      throw new Error("A review note exceeds 500 characters; export was withheld rather than truncating it.");
    }
    return text;
  });
  const hasNativeHeaderStyles = input.tables.some(table => table.nativePairedHeader || table.freezeSourceHeader);
  const sheets: PdfXlsxTable[] = [
    ...input.tables,
    ...(notes.length ? [{ name: "Review Notes", rows: [
      ["EXTRACTION NOT VERIFIED — verify against the source PDF"],
      ...notes.map(note => [note]),
    ] }] : []),
  ];
  const zip = new JSZip();
  const names = new Set<string>();
  const assigned = sheets.map((sheet, index) => safeSheetName(sheet.name, index, names));
  const workbookSheets = sheets.map((_, i) =>
    '<sheet name="' + xmlSafe(assigned[i]) + '" sheetId="' + (i + 1) +
    '" r:id="rId' + (i + 1) + '"/>',
  ).join("");
  const sheetRelationships = sheets.map((_, i) =>
    '<Relationship Id="rId' + (i + 1) + '" Type="' +
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
    ' Target="worksheets/sheet' + (i + 1) + '.xml"/>',
  ).join("");
  const contentOverrides = sheets.map((_, i) =>
    '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
    '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  ).join("");

  zip.file("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    contentOverrides +
    (hasNativeHeaderStyles ?
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' : '') +
    '</Types>');
  zip.file("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>');
  zip.file("xl/workbook.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + workbookSheets + '</sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRelationships +
    (hasNativeHeaderStyles ?
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' : '') +
    '</Relationships>');
  if (hasNativeHeaderStyles) {
    // Spreadsheet-compatible bold, wrapped two-row native group header style.
    // Default worksheet cells retain their existing unstyled values and types.
    zip.file("xl/styles.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
      '<alignment wrapText="1" vertical="center"/></xf></cellXfs>' +
      '</styleSheet>');
  }
  sheets.forEach((table, index) => {
    zip.file("xl/worksheets/sheet" + (index + 1) + ".xml", sheetXml(table));
  });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE",
    compressionOptions: { level: 6 } });
}
