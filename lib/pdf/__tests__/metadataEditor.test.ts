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

    const saved = await pdf.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const persisted = readPdfMetadata(reloaded);

    expect(persisted.title).toBe("New title");
    expect(persisted.author).toBe("New author");
    expect(persisted.subject).toBe("Private report");
    expect(persisted.creator).toBe("Kukureku");
    expect(persisted.producer).toBe("Kukureku");
    expect(persisted.keywords).toContain("2026");
  });

  it("clears common metadata fields safely", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.setTitle("Title");
    pdf.setAuthor("Author");

    applyPdfMetadata(pdf, {
      title: "",
      author: "",
      subject: "",
      keywords: "",
      creator: "",
      producer: "",
    });

    const saved = await pdf.save();
    const reloaded = await PDFDocument.load(saved, { updateMetadata: false });
    const metadata = readPdfMetadata(reloaded);

    expect(metadata.title).toBe("");
    expect(metadata.author).toBe("");
    expect(metadata.keywords).toBe("");
  });

  it("preserves comma-delimited keyword boundaries after PDF save and reload", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const values = {
      title: "QA keyword test",
      author: "Kukureku",
      subject: "",
      keywords: "kukureku, pdf, qa",
      creator: "",
      producer: "",
    };
    applyPdfMetadata(pdf, values);
    expect(readPdfMetadata(pdf).keywords).toBe(values.keywords);
    const saved = await pdf.save();
    const reopened = await PDFDocument.load(saved, { updateMetadata: false });
    expect(readPdfMetadata(reopened).keywords).toBe(values.keywords);

    applyPdfMetadata(reopened, {
      ...values,
      keywords: "one; two\nthree, four",
    });
    expect(readPdfMetadata(reopened).keywords).toBe("one, two, three, four");
    applyPdfMetadata(reopened, { ...values, keywords: "" });
    expect(readPdfMetadata(reopened).keywords).toBe("");
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
