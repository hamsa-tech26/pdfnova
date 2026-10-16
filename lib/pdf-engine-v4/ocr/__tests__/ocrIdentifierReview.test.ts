import { describe, expect, it } from "vitest";
import type { PdfV4OcrWord } from "../ocrRecognizer";
import {
  comparePdfV4OcrIdentifierReadings,
  findPdfV4OcrIdentifierCandidates,
} from "../ocrIdentifierReview";

function word(text: string, x: number, y: number, confidence = 80): PdfV4OcrWord {
  return {
    text, confidence,
    bounds: { x0: x, y0: y, x1: x + Math.max(30, text.length * 10), y1: y + 20 },
    coordinateSpace: "rendered-image-pixels",
    source: "ocr-tesseract",
  };
}

describe("Release 58 conservative identifier reread selection", () => {
  const words = [
    word("Record", 30, 100), word("ID:", 110, 100),
    word("DC-T316", 160, 100, 72),
    word("Reference:", 30, 150),
    word("MAINT-160CT", 155, 150, 67),
    word("This", 30, 250),
    word("is", 85, 250),
    word("ordinary", 120, 250),
    word("text", 220, 250),
  ];

  it("selects only explicitly labelled identifier lines in image coordinates", () => {
    const regions = findPdfV4OcrIdentifierCandidates(words, 1000, 1400, 75);
    expect(regions).toHaveLength(2);
    expect(regions[0].primaryText).toBe("Record ID: DC-T316");
    expect(regions[1].primaryText).toBe("Reference: MAINT-160CT");
    expect(regions[0].rectangle.left).toBeGreaterThanOrEqual(0);
    expect(regions[0].rectangle.top).toBeGreaterThanOrEqual(0);
    expect(regions[0].rectangle.width).toBeGreaterThan(20);
  });

  it("bounds extra work and skips clear high-confidence identifiers", () => {
    expect(findPdfV4OcrIdentifierCandidates(words, 1000, 1400, 75, 1)).toHaveLength(1);
    expect(findPdfV4OcrIdentifierCandidates(words, 1000, 1400, 92)).toHaveLength(2);
    const crisp = words.map(w => ({ ...w, confidence: 97 }));
    expect(findPdfV4OcrIdentifierCandidates(crisp, 1000, 1400, 94)).toHaveLength(0);
    expect(findPdfV4OcrIdentifierCandidates(words, 0, 1400, 75)).toHaveLength(0);
  });

  it("rejects unbounded/invalid geometry rather than reading outside the page", () => {
    const invalid = [word("Record", -20, 100), word("ID:", 100, 100), word("DC-T316", 180, 100)];
    expect(findPdfV4OcrIdentifierCandidates(invalid, 1000, 1400, 60)).toHaveLength(0);
  });

  it("rejects label-only differences, field swaps, and case-only disagreement", () => {
    const c = findPdfV4OcrIdentifierCandidates(words, 1000, 1400, 75)[0];
    expect(comparePdfV4OcrIdentifierReadings(c, "RECORD ID DC-T316", 80)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(c, "Record ID: dc-t316", 80)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(c, "Invoice ID: DC-7316", 80)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(c, "DC-7316", 80)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(c, "Record ID: DC-7316", 80)?.status)
      .toBe("DIFFERENT_UNVERIFIED");
  });

  it("compares alternative characters without asserting a correction", () => {
    const candidate = findPdfV4OcrIdentifierCandidates(words, 1000, 1400, 75)[0];
    const diff = comparePdfV4OcrIdentifierReadings(candidate, "Record ID: DC-7316", 82);
    expect(diff).toMatchObject({
      primaryText: "Record ID: DC-T316",
      alternateText: "Record ID: DC-7316",
      status: "DIFFERENT_UNVERIFIED",
    });
    expect(candidate.primaryText).toBe("Record ID: DC-T316");
    expect(comparePdfV4OcrIdentifierReadings(candidate, "Record ID: DC-T316", 90)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(candidate, "Record ID: DC-7316", 45)).toBeNull();
    expect(comparePdfV4OcrIdentifierReadings(candidate, "X", 99)).toBeNull();
  });
});
