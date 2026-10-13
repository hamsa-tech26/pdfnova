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

  it("does not duplicate source text on one-column digital content", () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      item("Service report section " + (i + 1), 50, 70 + i * 18, 320),
    );
    const result = reconstructEmbeddedPdfTextPreview(lines, 595);
    expect(result).toBeNull();
  });

  it("ignores off-page and non-finite item geometry", () => {
    const lines = Array.from({ length: 14 }, (_, i) =>
      item("Invoice section " + (i + 1), 70, 60 + i * 20, 230),
    );
    lines.push(item("FORGED SIDEBAR", Number.NaN, 100, 120));
    lines.push(item("OUTSIDE PAGE", 610, 200, 80));
    const result = reconstructEmbeddedPdfTextPreview(lines, 595);
    expect(result).toBeNull(); // One-column content has no alternative transcript.
    expect(lines.some((candidate) => Number.isNaN(candidate.x))).toBe(true);
  });

  it("separates the real R55 quarterly fixture geometry, including its footer", () => {
    // Positions reproduced from the uploaded synthetic fixture's real
    // selectable text geometry (A4 points); no original PDF is committed.
    const left = [
      item("QUARTERLY SERVICE REVIEW", 68.4, 55.9, 287.1),
      item("Report code: QSR-26-Q3", 68.4, 85.5, 101.5),
      item("Prepared: 05 October 2026", 68.4, 97.5, 109.1),
      item("Executive summary", 68.4, 117.3, 112.7),
      item("The sample service unit completed 184 requests during the quarter.", 68.4, 143.4, 299.6),
      item("A total of 171 requests were closed within the internal target; 13", 68.4, 155.4, 281.8),
      item("require follow-up.", 68.4, 167.4, 76.7),
      item("Performance by month", 68.4, 187.3, 130.7),
      item("Month", 73.4, 213.4, 27.8),
      item("Received", 144.2, 213.4, 41.7),
      item("Closed", 215.1, 213.4, 31.1),
      item("July", 73.4, 237.4, 17.8),
      item("58", 144.2, 237.4, 11.1),
      item("54", 215.1, 237.4, 11.1),
      item("August", 73.4, 261.4, 31.1),
      item("61", 144.2, 261.4, 11.1),
      item("57", 215.1, 261.4, 11.1),
      item("September", 73.4, 285.4, 48.9),
      item("65", 144.2, 285.4, 11.1),
      item("60", 215.1, 285.4, 11.1),
      item("Key observations", 68.4, 311.3, 100),
      item("August closures improved by three compared with July.", 68.4, 337.6, 201.1),
      item("September had the highest intake.", 68.4, 347.6, 126.9),
      item("Follow-up cases should be reviewed weekly.", 68.4, 357.6, 162.9),
      item("SYNTHETIC TEST FIXTURE - NOT AN OFFICIAL DOCUMENT", 51, 806, 200),
    ];
    const right = [
      item("AT A GLANCE", 385.8, 56.3, 82),
      item("184", 385.8, 82.6, 15),
      item("Requests received", 385.8, 94.5, 74.5),
      item("171", 385.8, 112.6, 15),
      item("Closed within target", 385.8, 124.5, 79),
      item("13", 385.8, 142.6, 10),
      item("Need follow-up", 385.8, 154.5, 60),
      item("Follow-up owners", 385.8, 174.3, 102),
      item("Operations: 5", 385.8, 200.6, 48),
      item("Field team: 4", 385.8, 210.6, 46.2),
      item("Records team: 4", 385.8, 220.6, 58.7),
      item("DATA NOTE", 385.8, 238.3, 70),
      item("Fictional figures for extraction and", 385.8, 264.6, 120),
      item("layout tests.", 385.8, 274.6, 42.7),
      item("Page 1", 522.1, 806, 22.2),
    ];
    const grouped = reconstructEmbeddedPdfTextPreview(
      left.concat(right).sort((a, b) => a.y - b.y), 595.2756,
    );
    expect(grouped).toContain("[EMBEDDED TEXT - LEFT CONTENT COLUMN]");
    expect(grouped).toContain("Executive summary");
    expect(grouped).toContain("[EMBEDDED TEXT - RIGHT SIDEBAR]");
    expect(grouped).toContain("AT A GLANCE");
    expect(grouped).toContain("Field team: 4");
    expect(grouped?.indexOf("September 65 60")).toBeLessThan(
      grouped!.indexOf("[EMBEDDED TEXT - RIGHT SIDEBAR]"),
    );
  });

});
