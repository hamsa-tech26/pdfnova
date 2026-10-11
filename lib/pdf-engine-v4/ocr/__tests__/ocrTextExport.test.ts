import { describe, expect, it } from "vitest";
import type { PdfV4OcrPageResult, PdfV4OcrWord } from "../ocrRecognizer";
import {
  buildPdfV4OcrTextExport,
  formatPdfV4OcrPageExport,
  suggestPdfV4OcrColumnPreview,
} from "../ocrTextExport";

function word(text: string, x: number, y: number): PdfV4OcrWord {
  return {
    text, confidence: 95,
    bounds: { x0: x, y0: y, x1: x + 42, y1: y + 17 },
    coordinateSpace: "rendered-image-pixels", source: "ocr-tesseract",
  };
}
function page(text: string, words: PdfV4OcrWord[] = [], confidence = 96): PdfV4OcrPageResult {
  return {
    pageNumber: 1, text, confidence, renderedWidth: 1000,
    renderedHeight: 1400, words, detectedSkewRadians: null,
    language: "eng", source: "ocr-tesseract",
  };
}

describe("Release 56 OCR review-safe export", () => {
  it("preserves original OCR text without quietly autocorrecting uncertain IDs", () => {
    const input = page("Record ID: DC-T316\nReference: MAINT-160CT");
    const output = buildPdfV4OcrTextExport(input);
    expect(output.text).toBe(input.text);
    expect(output.warnings.join(" ")).toContain("exact identifiers");
    expect(formatPdfV4OcrPageExport(input)).toContain(input.text);
    expect(formatPdfV4OcrPageExport(input)).not.toContain("DC-7316");
  });

  it("never infers checkbox statuses from flattened X markers", () => {
    const input = page("Check item Pass Fail N/A Comment\nFloor dry X Wet near valve\nLogbook updated X Not applicable");
    const output = buildPdfV4OcrTextExport(input);
    expect(output.warnings.join(" ")).toContain("Checkbox status UNKNOWN");
    expect(output.columnPreview).toBeNull();
    expect(output.text).not.toContain("Floor dry: Fail");
  });

  it("identifies low-confidence output without claiming corrections", () => {
    const result = buildPdfV4OcrTextExport(page("Faint scan", [], 52));
    expect(result.warnings.join(" ")).toContain("Low OCR confidence");
  });

  it("offers an additional column-grouped view when word geometry strongly supports two columns", () => {
    const words = Array.from({ length: 5 }, (_, row) => [
      word("Left", 30, 100 + row * 38),
      word("side", 82, 100 + row * 38),
      word(String(row + 1), 136, 100 + row * 38),
      word("Right", 730, 100 + row * 38),
      word("side", 788, 100 + row * 38),
      word(String(row + 1), 845, 100 + row * 38),
    ]).flat();
    const input = page("Left Right side interleaved", words);
    const result = suggestPdfV4OcrColumnPreview(input);
    expect(result).toContain("[LEFT COLUMN");
    expect(result).toContain("[RIGHT COLUMN");
    expect(result?.indexOf("Left side 5")).toBeLessThan(result!.indexOf("[RIGHT COLUMN"));
    expect(buildPdfV4OcrTextExport(input).text).toBe(input.text);
  });

  it("does not invent a column interpretation for a simple line of text", () => {
    const words = ["One", "ordinary", "line"].map((t, i) => word(t, 40 + i * 95, 100));
    expect(suggestPdfV4OcrColumnPreview(page("One ordinary line", words))).toBeNull();
  });
});
