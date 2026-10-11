import JSZip from "jszip";

/**
 * Genuine Office Open XML spreadsheet package. Cells are always inline strings:
 * PDF values are not reinterpreted as formulas, dates, or numeric identifiers.
 * This intentionally favours safety/precision over inferred Excel types.
 */
export type PdfXlsxTable = {
  name: string;
  rows: readonly (readonly unknown[])[];
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

function sheetXml(rows: readonly (readonly unknown[])[]): string {
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
  const data = rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length > MAX_COLUMNS) {
      throw new Error("Invalid table row.");
    }
    const cells = row.map((value, columnIndex) => {
      const label = cellColumn(columnIndex) + (rowIndex + 1);
      // An inline string is never an Excel formula, even when it starts with =+-@.
      return '<c r="' + label + '" t="inlineStr"><is><t xml:space="preserve">' +
        xmlSafe(value) + "</t></is></c>";
    }).join("");
    return '<row r="' + (rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  const range = "A1:" + cellColumn(width - 1) + rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="' + range + '"/>' +
    '<sheetData>' + data + '</sheetData></worksheet>';
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
    totalCells += table.rows.reduce((sum, row) => sum + row.length, 0);
    if (totalCells > MAX_CELLS) {
      throw new Error("Workbook exceeds 50,000 source cells.");
    }
  }
  const notes = (input.reviewNotes ?? []).slice(0, 30).map(note => note.slice(0, 500));
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
    contentOverrides + '</Types>');
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
    sheetRelationships + '</Relationships>');
  sheets.forEach((table, index) => {
    zip.file("xl/worksheets/sheet" + (index + 1) + ".xml", sheetXml(table.rows));
  });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE",
    compressionOptions: { level: 6 } });
}
