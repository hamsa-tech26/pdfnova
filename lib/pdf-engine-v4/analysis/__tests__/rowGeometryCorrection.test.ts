import { describe, expect, it } from "vitest";
import type { PdfLine, PdfWord } from "../../model/types";
import type { LogicalRowCandidate } from "../adaptiveRowDetector";
import type { ColumnCandidate } from "../stableColumnDetector";
import { estimatePdfV4RowHorizontalDrift } from "../rowGeometryCorrection";

const column = (index: number): ColumnCandidate => ({
  id: "column-" + index, x: 45 + index * 110,
  minX: 40 + index * 110, maxX: 55 + index * 110,
  leftBoundary: index === 0 ? 15 : 100 + (index - 1) * 110,
  rightBoundary: 100 + index * 110,
  occurrences: 9, distinctLineCount: 9, averageDeviation: 2,
  stability: 0.95, confidence: 0.98, accepted: true, reason: "synthetic",
});
const columns = [column(0), column(1), column(2), column(3)];
function row(i: number, x: number, serial = String(i + 1)): LogicalRowCandidate {
  const bounds = { x, y: 800 - i * 25, width: 12, height: 10 };
  const word: PdfWord = {
    id: "w-" + i, text: serial, pageNumber: 1, bounds,
    font: { size: 10 }, rotation: 0,
    extractionProvenance: { source: "ocr-tesseract", confidence: 92 },
  };
  const line: PdfLine = {
    id: "l-" + i, pageNumber: 1, words: [word], bounds, text: serial,
  };
  return {
    id: "r-" + i, index: i, lines: [line], words: [word],
    startY: bounds.y, endY: bounds.y - 10, isNewRecord: true,
    score: 80, confidence: 0.9,
    breakdown: {serialNumber: 1, verticalGap: 1, leftAlignment: 1,
      emptyLeadingColumns: 0, wrappedText: 0},
    reason: "synthetic",
  };
}

describe("conservative row drift evidence", () => {
  it("supports modest, coherent per-row horizontal displacement", () => {
    const rows = Array.from({length: 9}, (_, i) => row(i, 40 + i * 2));
    const originalX = rows[8].words[0].bounds.x;
    const drifts = estimatePdfV4RowHorizontalDrift(rows, columns);
    expect(drifts.size).toBe(9);
    expect(drifts.get(8)).toBeGreaterThan(0);
    expect(drifts.get(0)).toBeLessThan(0);
    expect(rows[8].words[0].bounds.x).toBe(originalX);
  });

  it("rejects non-linear projection, absent serial anchors, and severe drift", () => {
    const jittered = Array.from({length: 9}, (_, i) =>
      row(i, 40 + (i % 2) * 18));
    const missing = Array.from({length: 9}, (_, i) => row(i, 40 + 2*i, "UNKNOWN"));
    const extreme = Array.from({length: 9}, (_, i) => row(i, 40 + 9*i));
    expect(estimatePdfV4RowHorizontalDrift(jittered, columns).size).toBe(0);
    expect(estimatePdfV4RowHorizontalDrift(missing, columns).size).toBe(0);
    expect(estimatePdfV4RowHorizontalDrift(extreme, columns).size).toBe(0);
  });
});