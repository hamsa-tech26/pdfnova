import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  assertPageCopySafe,
  hasAcroFormDictionary,
  validatePdfBatch,
} from "../pdfInputSafety";

describe("pdfInputSafety", () => {
  it("caps multi-PDF browser batches by count and total bytes", () => {
    const pdf = (name: string, size: number) => ({
      name,
      size,
      type: "application/pdf",
    });

    expect(
      validatePdfBatch([], [pdf("a.pdf", 1024)]),
    ).toBeNull();

    expect(
      validatePdfBatch(
        [],
        Array.from({ length: 21 }, (_, index) =>
          pdf(`file-${index}.pdf`, 1024),
        ),
      ),
    ).toContain("no more than 20");

    expect(
      validatePdfBatch([], [
        pdf("a.pdf", 25 * 1024 * 1024),
        pdf("b.pdf", 25 * 1024 * 1024),
        pdf("c.pdf", 25 * 1024 * 1024),
        pdf("d.pdf", 25 * 1024 * 1024),
        pdf("e.pdf", 1),
      ]),
    ).toContain("100 MB combined");
  });

  it("detects an AcroForm dictionary without calling getForm", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();

    expect(hasAcroFormDictionary(pdf)).toBe(false);

    const form = pdf.getForm();
    form.createTextField("name");

    expect(hasAcroFormDictionary(pdf)).toBe(true);
  });

  it("blocks page-copy workflows that could silently damage forms", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    const field = form.createTextField("full_name");
    field.addToPage(page);

    expect(() =>
      assertPageCopySafe(pdf, "Merge PDF"),
    ).toThrow(/Flatten the form first/);
  });
});
