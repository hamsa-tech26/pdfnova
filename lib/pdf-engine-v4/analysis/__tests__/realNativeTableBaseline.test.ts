import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { detectVisualBlocks } from "../visualBlockDetector";
import { detectTableRegionsForPage } from "../tableRegionDetector";
import { readPdfDocumentV4 } from "../../reader/pageReader";
import { analyzePdfV4 } from "../../pipeline/analyzePdfV4";
import { findNativeCaptionedShortNumericGrids } from "../nativeCaptionedShortNumericGrid";
import { preparePdfV4XlsxExport } from "../../../converters/pdfToXlsxQuality";
import { createPdfXlsxWorkbook } from "../../../converters/pdfToXlsx";
import { isScientificReviewOnlyTable } from "../../../converters/pdfToXlsxStructuralEvidence";
import { inspectPdfV4XlsxChoices, prepareSelectedPdfV4XlsxExport } from "../../../converters/pdfToXlsxSelection";

const referenceDirectory = process.env.KUKUREKU_TABLE_REFERENCE_DIR;

describe.skipIf(!referenceDirectory)("real source-first table recovery (opt-in public corpus)", () => {
  it("isolates NREL five native rows but withholds unattended export of its unverified grouped header", async () => {
    const bytes = await readFile(join(referenceDirectory!, "nrel.pdf"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82",
    );
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    const file = new File([bytes], "nrel.pdf", { type: "application/pdf" });
    const page = (await detectVisualBlocks(await readPdfDocumentV4(file))).pages[0];
    const detection = detectTableRegionsForPage(page.blocks);
    const full = await analyzePdfV4(file);
    expect(page.blocks).toHaveLength(1);
    expect(findNativeCaptionedShortNumericGrids(page.blocks)).toHaveLength(1);
    expect(detection.tableRegions.filter(region =>
      region.block.id.startsWith("native-captioned-short-numeric-"))).toHaveLength(1);
    expect(full.statistics.detectedColumnCount).toBe(7);
    expect(full.statistics.detectedRowCount).toBe(6);
    expect(full.tables).toHaveLength(1);
    const actual = full.tables[0].rows.map(row => row.cells.map(cell => cell.text));
    // Source-pinned local development reference, NOT independent blind review.
    expect(actual.slice(1)).toEqual([
      ["2012_2", "3.30", "1.3", "5.9%", "9.5%", "29.2%", "17.4%"],
      ["2145_1", "0.68", "11.2", "2.4%", "0.1%", "9.5%", "2.7%"],
      ["4234_1", "0.59", "58.7", "8.5%", "1.3%", "8.5%", "3.3%"],
      ["2032_2", "0.17", "57.8", "21.7%", "0.3%", "2.7%", "1.2%"],
      ["4171_1", "0.07", "173.9", "58.1%", "1.6%", "2.1%", "0.5%"],
    ]);
    expect(actual[0][4]).toContain("Percent Fuel Savings");
    expect(isScientificReviewOnlyTable(full.tables[0])).toBe(true);
    expect(inspectPdfV4XlsxChoices(full)[0].eligible).toBe(true);
    expect(inspectPdfV4XlsxChoices(full)[0].reason).toContain("REVIEW ONLY");
    const reviewedPlan = prepareSelectedPdfV4XlsxExport(full, 0);
    expect(reviewedPlan.tables).toHaveLength(1);
    expect(reviewedPlan.tables[0].rows.slice(1)).toEqual(actual.slice(1));
    expect(reviewedPlan.reviewNotes?.join(" ")).toContain("grouped/multilevel header");
    const archive = await JSZip.loadAsync(await createPdfXlsxWorkbook(reviewedPlan));
    const sheet = await archive.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('<dimension ref="A1:G6"/>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">2012_2</t>');
    expect(sheet).toContain('<c r="G6" t="inlineStr"><is><t xml:space="preserve">0.5%</t>');
    expect(sheet).not.toContain("<f>");
    expect(() => preparePdfV4XlsxExport(full)).toThrow(
      "Only unverified new grid candidates were detected",
    );
  });

  for (const [name, hash] of [
    ["fbi.pdf", "4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407"],
    ["usda.pdf", "4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb"],
    ["invoice.pdf", "0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b"],
  ]) {
    it("does not falsely admit a short numeric candidate for " + name, async () => {
      const bytes = await readFile(join(referenceDirectory!, name));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
      Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
      const file = new File([bytes], name, { type: "application/pdf" });
      const page = (await detectVisualBlocks(await readPdfDocumentV4(file))).pages[0];
      expect(findNativeCaptionedShortNumericGrids(page.blocks)).toHaveLength(0);
      const full = await analyzePdfV4(file);
      expect(full.tables.some(table => table.rows.some(row =>
        row.provenance?.blockId?.startsWith("native-captioned-short-numeric-")))).toBe(false);
    });
  }
});
