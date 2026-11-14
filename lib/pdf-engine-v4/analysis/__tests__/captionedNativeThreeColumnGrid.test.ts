import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { analyzePdfV4 } from "../../pipeline/analyzePdfV4";
import { readPdfDocumentV4 } from "../../reader/pageReader";
import { detectVisualBlocks } from "../visualBlockDetector";
import { detectTableRegionsForPage } from "../tableRegionDetector";

async function threePageFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page1 = pdf.addPage([595, 842]);
  const page2 = pdf.addPage([595, 842]);
  const page3 = pdf.addPage([595, 842]);
  const draw = (page: typeof page1, text: string, x: number, y: number, strong = false) =>
    page.drawText(text, { x, y, size: 10, font: strong ? bold : font });
  draw(page1, "Two columns of narrative prose", 48, 780, true);
  for (let index = 0; index < 6; index++) {
    draw(page1, "Routine inspection and review notes are prose.", 48, 700 - index * 21);
    draw(page1, "The operating instructions are not table data.", 310, 700 - index * 21);
  }
  const four = (caption: string, headings: string[], rows: string[][], captionY: number) => {
    const xs = [66, 247, 338, 437];
    draw(page2, caption, 57, captionY, true);
    headings.forEach((value, i) => draw(page2, value, xs[i], captionY - 30, true));
    rows.forEach((row, n) => row.forEach((value, i) => {
      const y = captionY - 61 - n * 31.5;
      const x = i === 1 ? 321 - font.widthOfTextAtSize(value, 10) :
        i === 2 ? 419 - font.widthOfTextAtSize(value, 10) : xs[i];
      draw(page2, value, x, y);
    }));
  };
  four("TABLE A - Water Supply Summary",
    ["Scheme", "Households", "Target KLD", "Status"],
    [["Damcherra", "120", "8.40", "Active"],
     ["Khedacherra", "80", "5.60", "Active"],
     ["Juri", "60", "4.20", "Maintenance"],
     ["TOTAL", "260", "18.20", "-"]], 686);
  four("TABLE B - Material Cost Summary",
    ["Material", "Quantity", "Rate INR", "Amount INR"],
    [["32 mm pipe", "20", "150", "3000"],
     ["Valve", "4", "250", "1000"],
     ["Coupler", "10", "60", "600"],
     ["TOTAL", "34", "-", "4600"]], 494);
  draw(page3, "TABLE C - Routine Service Requests", 48, 710, true);
  ["Service", "Requests", "Result"].forEach((value, i) =>
    draw(page3, value, [59, 363.5, 500][i], 655, true));
  const rows = [
    ["Repair call", "12", "Closed"],
    ["Meter reading", "8", "Pending"],
    ["Water testing", "5", "Closed"],
    ["TOTAL", "25", "-"],
  ];
  rows.forEach((row, n) => {
    const y = 607 - n * 48;
    draw(page3, row[0], 59, y, n === 3);
    draw(page3, row[1], 413 - font.widthOfTextAtSize(row[1], 10), y, n === 3);
    draw(page3, row[2], 534 - font.widthOfTextAtSize(row[2], 10), y, n === 3);
  });
  return new File([new Uint8Array(await pdf.save())], "v4-multi-page.pdf", {
    type: "application/pdf",
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("captioned native three-column grid recovery", () => {
  it("keeps a prose-only page table-free and separates all three source tables", async () => {
    vi.stubGlobal("window", {});
    const result = await analyzePdfV4(await threePageFixture());
    expect(result.document.pages).toHaveLength(3);
    expect(result.tables.map(table => table.pageNumber)).toEqual([2, 2, 3]);
    const grids = result.tables.map(table =>
      table.rows.map(row => row.cells.map(cell => cell.text)));
    expect(grids).toEqual([
      [["Scheme", "Households", "Target KLD", "Status"],
       ["Damcherra", "120", "8.40", "Active"],
       ["Khedacherra", "80", "5.60", "Active"],
       ["Juri", "60", "4.20", "Maintenance"],
       ["TOTAL", "260", "18.20", "-"]],
      [["Material", "Quantity", "Rate INR", "Amount INR"],
       ["32 mm pipe", "20", "150", "3000"],
       ["Valve", "4", "250", "1000"],
       ["Coupler", "10", "60", "600"],
       ["TOTAL", "34", "-", "4600"]],
      [["Service", "Requests", "Result"],
       ["Repair call", "12", "Closed"],
       ["Meter reading", "8", "Pending"],
       ["Water testing", "5", "Closed"],
       ["TOTAL", "25", "-"]],
    ]);
    expect(result.statistics.populatedCellCount).toBe(55);
    const ids = result.tables.flatMap(table =>
      table.rows.flatMap(row =>
        row.cells.flatMap(cell => cell.words.map(word => word.id))));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not create a captioned three-column grid from ordinary two-column prose", async () => {
    vi.stubGlobal("window", {});
    const pdf = await threePageFixture();
    const document = detectVisualBlocks(await readPdfDocumentV4(pdf));
    const regions = detectTableRegionsForPage(document.pages[0].blocks);
    expect(regions.tableRegions.filter(region => region.analysis.isTable)).toHaveLength(0);
    expect(regions.regions.some(region =>
      region.block.id.startsWith("captioned-native-three-grid-"))).toBe(false);
  });
});
