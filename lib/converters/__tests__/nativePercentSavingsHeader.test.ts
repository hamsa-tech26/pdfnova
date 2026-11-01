import { describe, expect, it } from "vitest";
import type { LogicalTable } from "../../pdf-engine-v4/model/logicalTable";
import type { PdfWord } from "../../pdf-engine-v4/model/types";
import { projectNativePercentSavingsHeader } from "../nativePercentSavingsHeader";

const headerWords: [string, number, number, number][][] = [
  [["Cycle", 129.23, 216.66, 26.62], ["Name", 128.93, 205.14, 27.29]],
  [["KI", 179.81, 216.66, 10.05], ["(1/km)", 170.09, 205.14, 29.49]],
  [["Distance", 210.41, 216.66, 41.75], ["(mi)", 222.11, 205.14, 18.33]],
  [["Improved", 262.92, 208.86, 45], ["Speed", 270.42, 197.4, 30.07]],
  [["Percent Fuel Savings", 323.93, 222.65, 101.1],
    ["Decreased", 318.78, 208.86, 50.63], ["Accel", 330.72, 197.4, 26.72]],
  [["Eliminate", 380.16, 208.86, 44.44], ["Stops", 388.5, 197.4, 27.84]],
  [["Decreased", 435.42, 208.86, 50.63], ["Idle", 452.1, 197.4, 17.21]],
];
const sourceRows = [
  headerWords.map(words => words.map(word => word[0]).join(" ")),
  ["2012_2", "3.30", "1.3", "5.9%", "9.5%", "29.2%", "17.4%"],
  ["2145_1", "0.68", "11.2", "2.4%", "0.1%", "9.5%", "2.7%"],
  ["4234_1", "0.59", "58.7", "8.5%", "1.3%", "8.5%", "3.3%"],
  ["2032_2", "0.17", "57.8", "21.7%", "0.3%", "2.7%", "1.2%"],
  ["4171_1", "0.07", "173.9", "58.1%", "1.6%", "2.1%", "0.5%"],
];

function table(): LogicalTable {
  const wordsByCell: PdfWord[][] = headerWords.map((source, column) =>
    source.map(([text, x, y, width], index) => ({
      id: "source-header-" + column + "-" + index,
      text, pageNumber: 1,
      bounds: { x, y, width, height: 10.02 },
      font: { size: 9 }, rotation: 0,
      extractionProvenance: { source: "native-pdf" },
    })));
  return {
    id: "native-table", pageNumber: 1, columnCount: 7,
    bounds: { x: 125, y: 140, width: 370, height: 95 }, confidence: 0.95,
    rows: sourceRows.map((values, rowIndex) => ({
      id: "source-row-" + rowIndex, rowIndex, confidence: 0.93,
      provenance: {
        pageNumber: 1,
        blockId: "native-captioned-short-numeric-1-source-1",
        originalRowIndex: rowIndex,
      },
      cells: values.map((text, columnIndex) => ({
        id: "source-cell-" + rowIndex + "-" + columnIndex,
        rowIndex, columnIndex, text, confidence: 0.92,
        words: rowIndex === 0 ? wordsByCell[columnIndex] : [],
        bounds: { x: 127 + 56 * columnIndex, y: 214 - 14 * rowIndex,
          width: 48, height: 12 },
      })),
    })),
  };
}

describe("source-geometry bounded percent-savings group header", () => {
  it("projects the original heading across exactly four source-aligned child labels", () => {
    const source = table();
    const original = JSON.stringify(source);
    const result = projectNativePercentSavingsHeader(source, sourceRows);
    expect(result.note).toContain("four geometrically aligned child labels");
    expect(result.rows[0]).toEqual([
      "Cycle Name", "KI (1/km)", "Distance (mi)",
      "Percent Fuel Savings / Improved Speed",
      "Percent Fuel Savings / Decreased Accel",
      "Percent Fuel Savings / Eliminate Stops",
      "Percent Fuel Savings / Decreased Idle",
    ]);
    expect(result.rows.slice(1)).toEqual(sourceRows.slice(1));
    expect(JSON.stringify(source)).toBe(original);
    expect(sourceRows[0][4]).toBe("Percent Fuel Savings Decreased Accel");
  });

  it("does not invent an absent parent or project across unknown/OCR words", () => {
    const absent = table();
    absent.rows[0].cells[4].words[0].text = "Unrelated caption";
    expect(projectNativePercentSavingsHeader(absent, sourceRows).note).toBeNull();
    const ocr = table();
    ocr.rows[0].cells[5].words[0].extractionProvenance = {source:"ocr-tesseract"};
    expect(projectNativePercentSavingsHeader(ocr, sourceRows).note).toBeNull();
    const unknown = table();
    delete unknown.rows[0].cells[3].words[0].extractionProvenance;
    expect(projectNativePercentSavingsHeader(unknown, sourceRows).note).toBeNull();
  });

  it("rejects column drift, fake super-header geometry and changed source labels", () => {
    const moved = table();
    moved.rows[0].cells[4].words[0].bounds.x += 45;
    expect(projectNativePercentSavingsHeader(moved, sourceRows).note).toBeNull();
    const low = table();
    low.rows[0].cells[4].words[0].bounds.y -= 15;
    expect(projectNativePercentSavingsHeader(low, sourceRows).note).toBeNull();
    const drift = table();
    drift.rows[0].cells[6].words[0].bounds.y -= 4;
    expect(projectNativePercentSavingsHeader(drift, sourceRows).note).toBeNull();
    const mismatch = sourceRows.map(row => [...row]);
    mismatch[0][3] = "Speculated Speed";
    expect(projectNativePercentSavingsHeader(table(), mismatch).note).toBeNull();
  });

  it("keeps the fail-closed path for unverified data, foreign blocks and row counts", () => {
    const badData = sourceRows.map(row => [...row]);
    badData[3][6] = "NA";
    expect(projectNativePercentSavingsHeader(table(), badData).note).toBeNull();
    const foreign = table();
    foreign.rows[0].provenance!.blockId = "general-article-prose";
    expect(projectNativePercentSavingsHeader(foreign, sourceRows).note).toBeNull();
    const shorter = table();
    shorter.rows.pop();
    expect(projectNativePercentSavingsHeader(shorter, sourceRows.slice(0, -1)).note).toBeNull();
  });
});
