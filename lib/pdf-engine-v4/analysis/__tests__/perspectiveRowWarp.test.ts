import { describe, expect, it } from "vitest";
import type { PdfLine, PdfWord } from "../../model/types";
import type { LogicalRowCandidate } from "../adaptiveRowDetector";
import type { ColumnCandidate } from "../stableColumnDetector";
import {
  estimatePdfV4PerspectiveRowWarps,
  mapPdfV4PerspectiveAssignmentX,
} from "../perspectiveRowWarp";
import { buildSmartTableV4 } from "../smartCellBuilder";

const centers = [45, 155, 265, 375];
const columns: ColumnCandidate[] = centers.map((x, i) => ({
  id: "c-" + i, x, minX: x - 4, maxX: x + 4,
  leftBoundary: i === 0 ? 15 : (centers[i - 1] + x) / 2,
  rightBoundary: i === 3 ? 430 : (x + centers[i + 1]) / 2,
  occurrences: 9, distinctLineCount: 9, averageDeviation: 2,
  stability: 0.96, confidence: 0.97, accepted: true, reason: "test",
}));

function word(text: string, x: number, row: number): PdfWord {
  return {
    id: text + "-" + row, text, pageNumber: 1,
    bounds: { x, y: 800 - row * 26, width: text === "Normal" ? 40 : 12, height: 12 },
    font: { size: 12 }, rotation: 0,
    extractionProvenance: { source: "ocr-tesseract", confidence: 91 },
  };
}
function row(i: number, left: number, right: number, token = "Normal"): LogicalRowCandidate {
  const ratio = (right - left) / 335;
  const items = [
    word(String(i + 1), left, i),
    word("Station" + i, left + 115 * ratio, i),
    word("Functional" + i, left + 225 * ratio, i),
    word(token, right, i),
  ];
  const bounds = {
    x: left, y: 800 - i * 26,
    width: right - left + 40, height: 12,
  };
  const line: PdfLine = {
    id: "line-" + i, words: items, pageNumber: 1,
    text: items.map(w => w.text).join(" "), bounds,
  };
  return {
    id: "r-" + i, index: i, lines: [line], words: items,
    startY: bounds.y, endY: bounds.y - 12, isNewRecord: true,
    score: 80, confidence: 0.9, reason: "test",
    breakdown: { serialNumber: 1, verticalGap: 1, leftAlignment: 1,
      emptyLeadingColumns: 0, wrappedText: 0 },
  };
}
function perspective() {
  return Array.from({ length: 9 }, (_, i) =>
    row(i, 40 + (i - 4) * 0.5, 375 + (i - 4) * 7));
}

describe("Release 59 research-only perspective alignment", () => {
  it("estimates an invertible taper only when two independent coherent OCR anchors exist", () => {
    const rows = perspective();
    const original = rows[0].words[3].bounds.x;
    const warps = estimatePdfV4PerspectiveRowWarps(rows, columns);
    expect(warps.size).toBe(9);
    expect(mapPdfV4PerspectiveAssignmentX(original, warps.get(0)!)).toBeCloseTo(375, 4);
    expect(mapPdfV4PerspectiveAssignmentX(rows[8].words[3].bounds.x, warps.get(8)!))
      .toBeCloseTo(375, 4);
    // Never rewrite original PDF/OCR word evidence.
    expect(rows[0].words[3].bounds.x).toBe(original);
  });

  it("keeps experimental research separate from the current production cell builder", () => {
    const rows = perspective();
    const raw = buildSmartTableV4(1, rows, columns);
    const warps = estimatePdfV4PerspectiveRowWarps(rows, columns);
    // Production does NOT enable a perspective option. We must not reintroduce
    // an outdated flag or falsely assert that this currently repairs XLSX.
    expect(raw.table?.rows[0].cells[3].text).toBe("");
    expect(warps.size).toBe(9);
    expect(mapPdfV4PerspectiveAssignmentX(
      rows[0].words[3].bounds.x, warps.get(0)!,
    )).toBeCloseTo(375, 4);
    expect(rows[0].words[3].bounds.x).toBe(347);
  });

  it("refuses translation-only drift and undistorted row alignment", () => {
    const straight = Array.from({ length: 9 }, (_, i) => row(i, 40, 375));
    const translation = Array.from({ length: 9 }, (_, i) =>
      row(i, 40 + (i - 4) * 2, 375 + (i - 4) * 2));
    expect(estimatePdfV4PerspectiveRowWarps(straight, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(translation, columns).size).toBe(0);
  });

  it("refuses irregular/strong projective deformation", () => {
    const jitter = Array.from({ length: 9 }, (_, i) =>
      row(i, 40 + (i - 4) * 0.5, 375 + (i - 4) * 7 + (i % 2 ? 17 : -17)));
    const severe = Array.from({ length: 9 }, (_, i) =>
      row(i, 40 + (i - 4) * 0.5, 375 + (i - 4) * 12));
    expect(estimatePdfV4PerspectiveRowWarps(jitter, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(severe, columns).size).toBe(0);
  });

  it("refuses missing serials, truncated tables and non-OCR anchor data", () => {
    const missing = perspective().map((r, i) => i < 5 ? row(i, 40, 375, "Other") : r);
    const noSerial = perspective().map(r => ({
      ...r, lines: r.lines.map(line => ({
        ...line, words: line.words.map((w, j) => j === 0 ? { ...w, text: "??" } : w),
      })),
    }));
    const selectable = perspective().map(r => ({
      ...r, lines: r.lines.map(line => ({
        ...line, words: line.words.map(w => ({ ...w,
          extractionProvenance: { source: "native-pdf" as const, confidence: 91 },
        })),
      })),
    }));
    expect(estimatePdfV4PerspectiveRowWarps(missing, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(noSerial, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(selectable, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(perspective().slice(0, 5), columns).size).toBe(0);
  });

  it("refuses competing repetitive right-side tokens", () => {
    const rows = perspective().map(r => {
      const copy = word("Approved", r.lines[0].words[3].bounds.x + 14, r.index);
      return { ...r, lines: r.lines.map(line => ({
        ...line, words: [...line.words, copy],
      })) };
    });
    expect(estimatePdfV4PerspectiveRowWarps(rows, columns).size).toBe(0);
  });

  it("refuses non-monotonic serials and low confidence or overlapping columns", () => {
    const rows = perspective();
    const swapped = rows.map((r, i) => ({
      ...r, lines: r.lines.map(line => ({
        ...line, words: line.words.map((w, j) =>
          j === 0 && i === 6 ? { ...w, text: "2" } : w),
      })),
    }));
    expect(estimatePdfV4PerspectiveRowWarps(swapped, columns).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(rows,
      columns.map((c, i) => i === 2 ? { ...c, confidence: 0.3 } : c)).size).toBe(0);
    expect(estimatePdfV4PerspectiveRowWarps(rows,
      columns.map((c, i) => i === 2 ? { ...c, x: 159 } : c)).size).toBe(0);
  });
});
