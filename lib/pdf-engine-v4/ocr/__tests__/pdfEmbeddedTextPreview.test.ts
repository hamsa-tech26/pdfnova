import { describe, expect, it } from "vitest";
import {
  reconstructEmbeddedPdfTextPreview,
  type EmbeddedPdfTextItem,
} from "../pdfEmbeddedTextPreview";

function item(text: string, x: number, y: number, width = 165): EmbeddedPdfTextItem {
  return { text, x, y, width };
}

describe("source-embedded PDF text review", () => {
  it("separates a main report and right-hand data sidebar in reading order", () => {
    const left = [
      "QUARTERLY SERVICE REVIEW",
      "Report code: QSR-26-Q3",
      "Prepared: 05 October 2026",
      "Executive summary",
      "The sample service unit completed 184 requests during the quarter.",
      "A total of 171 requests were closed within the target.",
      "Performance by month",
      "Month Received Closed",
      "July 58 54",
      "August 61 57",
      "September 65 60",
      "Key observations",
      "Follow-up cases should be reviewed weekly.",
    ].map((text, index) => item(text, 68, 60 + index * 21, 270));

    const right = [
      "AT A GLANCE",
      "184",
      "Requests received",
      "171",
      "Closed within target",
      "13",
      "Need follow-up",
      "Follow-up owners",
      "Operations: 5",
      "Field team: 4",
      "Records team: 4",
      "DATA NOTE",
      "Fictional figures for extraction and layout tests.",
    ].map((text, index) => item(text, 386, 60 + index * 20, 140));

    // Deliberately interleaved input, as can occur in PDF text content streams.
    const interleaved = left.flatMap((entry, i) => right[i] ? [entry, right[i]] : [entry]);
    const result = reconstructEmbeddedPdfTextPreview(interleaved, 595);
    expect(result).toContain("[EMBEDDED TEXT - LEFT CONTENT COLUMN]");
    expect(result).toContain("[EMBEDDED TEXT - RIGHT SIDEBAR]");
    expect(result).toContain("Executive summary");
    expect(result).toContain("AT A GLANCE");
    expect(result).toContain("Field team: 4");
    expect(result?.indexOf("September 65 60")).toBeLessThan(
      result!.indexOf("[EMBEDDED TEXT - RIGHT SIDEBAR]"),
    );
    expect(result?.indexOf("184\nRequests received\n171\nClosed within target")).toBeGreaterThan(
      result!.indexOf("[EMBEDDED TEXT - RIGHT SIDEBAR]"),
    );
  });

  it("does not invent preview text for scanned documents with no text layer", () => {
    expect(reconstructEmbeddedPdfTextPreview([], 595)).toBeNull();
    expect(reconstructEmbeddedPdfTextPreview([item("Hello", 50, 70)], 595)).toBeNull();
  });

  it("does not manufacture columns from one-column digital content", () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      item("Service report section " + (i + 1), 50, 70 + i * 18, 320),
    );
    const result = reconstructEmbeddedPdfTextPreview(lines, 595);
    expect(result).toContain("[EMBEDDED TEXT - VISUAL ROW ORDER, REVIEW LAYOUT]");
    expect(result).not.toContain("[EMBEDDED TEXT - RIGHT SIDEBAR]");
    expect(result).toContain("Service report section 15");
  });

  it("ignores off-page and non-finite item geometry", () => {
    const lines = Array.from({ length: 14 }, (_, i) =>
      item("Invoice section " + (i + 1), 70, 60 + i * 20, 230),
    );
    lines.push(item("FORGED SIDEBAR", Number.NaN, 100, 120));
    lines.push(item("OUTSIDE PAGE", 610, 200, 80));
    const result = reconstructEmbeddedPdfTextPreview(lines, 595);
    expect(result).not.toContain("FORGED SIDEBAR");
    expect(result).not.toContain("OUTSIDE PAGE");
  });
});
