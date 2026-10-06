import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  applyPdfMetadata,
  parseMetadataKeywords,
  readPdfMetadata,
} from "../metadataEditor";

describe("metadataEditor", () => {
  it("reads and updates common document metadata", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.setTitle("Old title");
    pdf.setAuthor("Old author");

    const before = readPdfMetadata(pdf);
    expect(before.title).toBe("Old title");
    expect(before.author).toBe("Old author");

    applyPdfMetadata(pdf, {
      title: "New title",
      author: "New author",
      subject: "Private report",
      keywords: "water, report, 2026",
      creator: "Kukureku",
      producer: "Kukureku",
    });

    const after = readPdfMetadata(pdf);
    expect(after.title).toBe("New title");
    expect(after.subject).toBe("Private report");
    expect(after.keywords).toContain("water");
    expect(after.keywords).toContain("report");
  });

  it("parses comma, semicolon, and newline separated keywords", () => {
    expect(parseMetadataKeywords("one, two; three\nfour")).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
  });
});
