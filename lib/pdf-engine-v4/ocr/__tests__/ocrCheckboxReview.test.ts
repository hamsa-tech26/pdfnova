import { describe, expect, it } from "vitest";
import type { PdfV4OcrPageResult, PdfV4OcrWord } from "../ocrRecognizer";
import {
  formatPdfV4OcrCheckboxCandidates,
  inspectPdfV4OcrCheckboxCandidates,
} from "../ocrCheckboxReview";
import { buildPdfV4OcrTextExport, formatPdfV4OcrPageExport } from "../ocrTextExport";

function word(text: string, x: number, y: number, confidence = 92): PdfV4OcrWord {
  return {
    text,
    confidence,
    bounds: { x0: x, x1: x + 40, y0: y, y1: y + 18 },
    source: "ocr-tesseract",
    coordinateSpace: "rendered-image-pixels",
  };
}
const header = [
  word("Pass", 600, 80),
  word("Fail", 700, 80),
  word("N/A", 800, 80),
];
const rows = [
  word("Floor", 50, 140), word("dry", 100, 140), word("X", 700, 140),
  word("Records", 50, 185), word("complete", 110, 185), word("X", 800, 185),
];

function page(words: PdfV4OcrWord[], text = "Pass Fail N/A\nFloor dry X\nRecords complete X"): PdfV4OcrPageResult {
  return {
    words,
    text,
    confidence: 90,
    pageNumber: 1,
    renderedWidth: 1000,
    renderedHeight: 1200,
    detectedSkewRadians: null,
    language: "eng",
    source: "ocr-tesseract",
  };
}

describe("Release 56B checklist evidence is never a verified status", () => {
  it("identifies positioned X marks and retains their label without claiming a verified selection", () => {
    const input = page([...header, ...rows]);
    const candidates = inspectPdfV4OcrCheckboxCandidates(input);
    expect(candidates).toEqual([
      {rowLabel: "Floor dry", alignedWith: "Fail", markerText: "X"},
      {rowLabel: "Records complete", alignedWith: "N/A", markerText: "X"},
    ]);
    const review = formatPdfV4OcrCheckboxCandidates(candidates);
    expect(review).toContain("Floor dry — OCR X appears near Fail (UNVERIFIED");
    const exportText = formatPdfV4OcrPageExport(input);
    expect(exportText).toContain("[CHECKBOX POSITION CLUES - NOT VERIFIED]");
    expect(exportText).toContain("Floor dry X"); // Original OCR remains unchanged.
    expect(exportText).toContain("statuses are NOT VERIFIED");
    expect(buildPdfV4OcrTextExport(input).warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Checkbox status UNKNOWN")]),
    );
  });

  it("refuses to assign status for two X marks in the same row", () => {
    const both = [
      ...header,
      word("Floor", 50, 140), word("dry", 100, 140),
      word("X", 600, 140), word("X", 700, 140),
    ];
    expect(inspectPdfV4OcrCheckboxCandidates(page(both))).toEqual([]);
  });

  it("refuses low-confidence X or X positioned between headers", () => {
    const lowConfidence = [
      ...header,
      word("Floor", 50, 140), word("dry", 100, 140),
      word("X", 700, 140, 30), word("Label", 70, 180),
    ];
    expect(inspectPdfV4OcrCheckboxCandidates(page(lowConfidence))).toEqual([]);
    const between = [
      ...header,
      word("Floor", 50, 140), word("dry", 100, 140),
      word("X", 650, 140), word("Label", 70, 180),
    ];
    expect(inspectPdfV4OcrCheckboxCandidates(page(between))).toEqual([]);
  });

  it("does not guess without exactly one geometric Pass/Fail/N/A heading", () => {
    const noHeading = page(rows);
    expect(inspectPdfV4OcrCheckboxCandidates(noHeading)).toEqual([]);
    const ambiguousHeading = page([...header, ...rows,
      word("Pass", 600, 400), word("Fail", 700, 400), word("N/A", 800, 400)]);
    expect(inspectPdfV4OcrCheckboxCandidates(ambiguousHeading)).toEqual([]);
  });

  it("rejects unsupported extreme input sizes and incomplete word geometry", () => {
    const words = [...header, ...rows];
    expect(inspectPdfV4OcrCheckboxCandidates({
      ...page(words), words: [...words, word("garbled", Number.NaN, 200)],
    })).toHaveLength(2);
    expect(inspectPdfV4OcrCheckboxCandidates({
      ...page(words), words: Array.from({length: 4001}, () => words[0]),
    })).toEqual([]);
  });
});
