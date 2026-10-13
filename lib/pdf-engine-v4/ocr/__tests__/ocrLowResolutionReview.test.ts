import { describe, expect, it } from "vitest";
import type { PdfV4OcrWord } from "../ocrRecognizer";
import {
  shouldReviewLowResolutionOcr,
  planLowResolutionRetryRegion,
  acceptLowResolutionReviewCandidate,
  planLowResolutionIdentifierLine,
  acceptIdentifierLineReview,
} from "../ocrLowResolutionReview";
import { formatPdfV4OcrPageExport } from "../ocrTextExport";

function word(value: string, x: number, y: number): PdfV4OcrWord {
  return {
    text: value,
    confidence: 88,
    bounds: { x0: x, y0: y, x1: x + 62, y1: y + 24 },
    coordinateSpace: "rendered-image-pixels",
    source: "ocr-tesseract",
  };
}

describe("Low-resolution OCR retry is bounded and review-only", () => {
  it("triggers on clearly dropped initial letters in form labels", () => {
    const raw = "DELIVERY CONFIRMATION\nRecord ID: DC-T316\n" +
      "tems expected: 24\ntems received: 23\n" +
      "Damaged items: 2\nThe page contains other ordinary text.";
    expect(shouldReviewLowResolutionOcr(raw, 92)).toBe(true);
  });

  it("triggers on low confidence identifier without assuming particular characters", () => {
    expect(shouldReviewLowResolutionOcr(
      "Record ID: XY-AB90\nDetails of a package in a somewhat blurred scan.\nFinal note.",
      73,
    )).toBe(true);
    expect(shouldReviewLowResolutionOcr(
      "Record ID: XY-AB90\nDetails of a package in a clean scanned document.\nFinal note.",
      96,
    )).toBe(false);
  });

  it("does not trigger for short, healthy, or unstructured OCR pages", () => {
    expect(shouldReviewLowResolutionOcr("Welcome", 51)).toBe(false);
    expect(shouldReviewLowResolutionOcr(
      "A readable memo with an ordinary content area and multiple paragraphs " +
        "but no indication of identifier or text damage.", 58,
    )).toBe(false);
  });

  it("crops top-focused text while retaining contextual margins", () => {
    const words = Array.from({ length: 36 }, (_, i) =>
      word("word" + i, 180 + (i % 6) * 155, 170 + Math.floor(i / 6) * 75),
    );
    const crop = planLowResolutionRetryRegion({
      words, renderedWidth: 1785, renderedHeight: 2526,
    });
    expect(crop).not.toBeNull();
    expect(crop!.left).toBeLessThan(180);
    expect(crop!.top).toBeLessThan(170);
    expect(crop!.height).toBeLessThan(2526 * 0.6);
    expect(crop!.width).toBeGreaterThan(700);
  });

  it("rejects invalid/whole-page geometry and too-few words", () => {
    expect(planLowResolutionRetryRegion({
      words: [word("one", 140, 240)], renderedWidth: 1785, renderedHeight: 2526,
    })).toBeNull();
    const fullPage = Array.from({ length: 35 }, (_, i) =>
      word("test", 180, i * 65),
    );
    expect(planLowResolutionRetryRegion({
      words: fullPage, renderedWidth: 1785, renderedHeight: 2300,
    })).toBeNull();
  });

  it("keeps raw identifier unchanged and labels the alternative as unverified", () => {
    const raw = "Record ID: DC-T316\n" +
      "tems expected: 24\ntems received: 23\n" +
      "Oris iter is missing and two items have damaged corners.";
    const reRead = "Record ID: DC-7316\n" +
      "Items expected: 24\nItems received: 23\n" +
      "One item is missing and two items have damaged corners.";
    expect(acceptLowResolutionReviewCandidate(raw, reRead, 93)).toBe(reRead);
    expect(acceptLowResolutionReviewCandidate(raw, reRead, 43)).toBeNull();
    expect(acceptLowResolutionReviewCandidate(raw, raw, 94)).toBeNull();
    const formatted = formatPdfV4OcrPageExport({
      pageNumber: 1, text: raw, confidence: 89,
      renderedWidth: 1785, renderedHeight: 2526, words: [],
      detectedSkewRadians: null, language: "eng", source: "ocr-tesseract",
      lowResolutionReview: reRead,
    });
    expect(formatted).toContain("[OPTIONAL IMAGE-ENHANCED LOW-RES OCR - NOT VERIFIED]");
    expect(formatted).toContain("Raw OCR above is unchanged");
    expect(formatted.indexOf("Record ID: DC-T316")).toBeLessThan(
      formatted.indexOf("Record ID: DC-7316"),
    );
    expect((formatted.match(/Record ID: DC-7316/g) ?? [])).toHaveLength(1);
  });

  it("finds the source-image line of a record ID, not nearby body copy", () => {
    const words = [
      word("DELIVERY", 120, 60), word("CONFIRMATION", 265, 60),
      word("Record", 145, 220), word("ID:", 239, 220),
      word("DC-T316", 292, 220),
      word("Delivery", 145, 268), word("date:", 245, 268),
      word("03", 312, 268), word("September", 351, 268),
      word("2026", 493, 268),
      word("PACKAGE", 145, 420), word("SUMMARY", 300, 420),
    ];
    const region = planLowResolutionIdentifierLine({
      words, renderedWidth: 1785, renderedHeight: 2526,
    });
    expect(region).not.toBeNull();
    expect(region!.left).toBeLessThan(145);
    expect(region!.left + region!.width).toBeGreaterThan(354);
    expect(region!.top).toBeLessThan(220);
    expect(region!.top + region!.height).toBeLessThan(268);
    expect(region!.height).toBeLessThan(90);
  });

  it("refuses to guess an identifier if source geometry cannot isolate the ID line", () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      word("ordinary", 100 + (i % 3) * 100, 140 + i * 38),
    );
    expect(planLowResolutionIdentifierLine({
      words, renderedWidth: 1785, renderedHeight: 2526,
    })).toBeNull();
  });

  it("exposes a different identifier only as a separate unverified observation", () => {
    const baseline = "Record ID: DC-T316\nItems expected: 24\nItems received: 23";
    const read = "Record ID: DC-7316";
    expect(acceptIdentifierLineReview(baseline, read, 89)).toBe(read);
    expect(acceptIdentifierLineReview(baseline, "Record ID: DC-T316", 96)).toBeNull();
    expect(acceptIdentifierLineReview(baseline, read, 42)).toBeNull();
    expect(acceptIdentifierLineReview(baseline, "Record ID: DC-7316\nignore other lines", 89)).toBe(read);
    expect(acceptIdentifierLineReview("Record ID: AB-A123", "Invoice ID: XY-9988", 91)).toBeNull();
    const transcript = formatPdfV4OcrPageExport({
      pageNumber: 1, text: baseline, confidence: 90,
      renderedWidth: 1785, renderedHeight: 2526, words: [],
      detectedSkewRadians: null, language: "eng", source: "ocr-tesseract",
      lowResolutionIdentifierReview: read,
    });
    expect(transcript).toContain("[OPTIONAL TARGETED IDENTIFIER OCR - NOT VERIFIED]");
    expect(transcript).toContain("Neither interpretation is verified");
    expect(transcript.indexOf("DC-T316")).toBeLessThan(transcript.lastIndexOf("DC-7316"));
  });


});
