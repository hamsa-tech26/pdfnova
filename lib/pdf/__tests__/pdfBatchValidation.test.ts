import { describe, expect, it } from "vitest";
import { MAX_PDF_BATCH_BYTES, validatePdfBatch } from "../pdfBatchValidation";

const pdf = (name: string, size: number) => ({ name, size, type: "application/pdf" });

describe("lightweight PDF batch validation", () => {
  it("rejects invalid and oversized PDFs before lazy-loading the PDF parser", () => {
    expect(validatePdfBatch([], [{ name: "bad.txt", size: 10, type: "text/plain" }])).toContain("not a supported PDF");
    expect(validatePdfBatch([], [pdf("large.pdf", 25 * 1024 * 1024 + 1)])).toContain("25 MB");
    expect(validatePdfBatch([], [pdf("invalid.pdf", Number.NaN)])).toContain("25 MB");
  });

  it("enforces both count and total browser-memory budgets", () => {
    expect(validatePdfBatch([], Array.from({ length: 21 }, (_, i) => pdf(i + ".pdf", 10)))).toContain("no more than 20");
    expect(validatePdfBatch([pdf("old.pdf", MAX_PDF_BATCH_BYTES)], [pdf("new.pdf", 1)])).toContain("100 MB");
    expect(validatePdfBatch([], [pdf("good.pdf", 1024)])).toBeNull();
  });
});
