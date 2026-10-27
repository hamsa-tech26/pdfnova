import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { analyzePdfV4 } from "../../pipeline/analyzePdfV4";
import { isScientificReviewOnlyTable } from "../../../converters/pdfToXlsxStructuralEvidence";
import { preparePdfV4XlsxExport } from "../../../converters/pdfToXlsxQuality";

/**
 * Opt-in, independent publisher-data replay. Neither PDF nor XLSX is copied
 * into the repository. Supply the four original files in this directory to
 * reproduce row-level numerical checks on the government publication.
 * The workbook is external evidence, NOT certification of label/group fidelity.
 */
const referenceDirectory = process.env.KUKUREKU_TASK149_PUBLIC_DIR;

const sources = [
  {
    name: "September 2026",
    pdf: "kukureku-task149-cpi-sep-2026.pdf",
    workbook: "kukureku-task149-bls-table1-202609.xlsx",
    pdfHash: "d2fe7deb0ae83a869a37553c9d3934d3d5be4969cd3ca9763a4881df878bf66a",
    workbookHash: "d991b4ce1b370d23c692c00f54d652cfb7d53ccdd018355cbdb226d8fdc0ef4b",
  },
  {
    name: "August 2026",
    pdf: "kukureku-task149-cpi-aug-2026.pdf",
    workbook: "kukureku-task149-bls-table1-202608.xlsx",
    pdfHash: "658d7de6366114cb1638af490e14fe03cd1fab8faa8c9ce9aeba95c5b9a65e52",
    workbookHash: "30afa35be3f1151d417a08a759952a212a998cd9420f7216ce2d2404349b6ed2",
  },
] as const;

async function publisherNumericRows(bytes: Buffer): Promise<string[][]> {
  const zipped = await JSZip.loadAsync(bytes);
  const xml = await zipped.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!xml) throw new Error("Missing publisher workbook worksheet");
  const dataRows: string[][] = [];
  for (const row of xml.matchAll(/<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gu)) {
    const rowIndex = Number(row[1]);
    // The publisher's first table lists its body in rows 7–45; header
    // numerals above and footnotes below must never count as body values.
    if (rowIndex < 7 || rowIndex > 45) continue;
    const cells = new Map<string, string>();
    for (const cell of row[2].matchAll(/<c\s+r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/gu)) {
      const number = cell[2].match(/<v>([^<]+)<\/v>/u);
      if (number) cells.set(cell[1], number[1]);
    }
    const values = "CDEFGHIJK".split("").map(column => cells.get(column));
    if (values.every(value => value !== undefined && Number.isFinite(Number(value)))) {
      dataRows.push(values as string[]);
    }
  }
  return dataRows;
}

describe.skipIf(!referenceDirectory)("Task149 publisher-pinned native table source comparison", () => {
  for (const source of sources) {
    it(`${source.name}: 37 source rows and 333 independently published numeric cells`, async () => {
      const pdfBytes = await readFile(join(referenceDirectory!, source.pdf));
      const xlsxBytes = await readFile(join(referenceDirectory!, source.workbook));
      expect(createHash("sha256").update(pdfBytes).digest("hex")).toBe(source.pdfHash);
      expect(createHash("sha256").update(xlsxBytes).digest("hex")).toBe(source.workbookHash);
      const publication = await PDFDocument.load(pdfBytes);
      const isolatedPage = await PDFDocument.create();
      const [page] = await isolatedPage.copyPages(publication, [8]);
      isolatedPage.addPage(page);
      Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
      const renderedBytes = await isolatedPage.save();
      const browserFileBytes = new Uint8Array(renderedBytes.length);
      browserFileBytes.set(renderedBytes);
      const extracted = await analyzePdfV4(new File([browserFileBytes], source.pdf, { type: "application/pdf" }));
      const candidate = extracted.tables.find(table => table.rows.length === 38 &&
        table.columnCount === 10 && isScientificReviewOnlyTable(table));
      expect(candidate, "A source-bounded review-only grid must be detected").toBeDefined();
      const sourceValues = candidate!.rows.slice(1).map(row => row.cells.slice(1).map(cell => cell.text));
      const publisherValues = await publisherNumericRows(xlsxBytes);
      expect(publisherValues).toHaveLength(37);
      expect(sourceValues).toHaveLength(37);
      expect(sourceValues.every(row => row.length === 9)).toBe(true);
      const decimal = (value: string) => Number(value.trim().replaceAll(",", "").replaceAll("−", "-"));
      expect(sourceValues.map(row => row.map(decimal))).toEqual(publisherValues.map(row => row.map(decimal)));
      // Independent numeric agreement does NOT permit automatic export.
      expect(() => preparePdfV4XlsxExport({ ...extracted, tables: [candidate!] })).toThrow(
        "Only unverified new grid candidates were detected",
      );
    }, 60_000);
  }
});
