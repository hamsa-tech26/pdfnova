import { PDFName, type PDFDocument } from "pdf-lib";

export type PdfFileLike = {
  name: string;
  size: number;
  type: string;
};

export const MAX_PDF_FILE_BYTES =
  25 * 1024 * 1024;

export const MAX_PDF_BATCH_BYTES =
  100 * 1024 * 1024;

export const MAX_PDF_BATCH_COUNT =
  20;

export function isPdfFileLike(
  file: Pick<PdfFileLike, "name" | "type">,
) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function validatePdfBatch(
  existingFiles: PdfFileLike[],
  addedFiles: PdfFileLike[],
) {
  if (addedFiles.length === 0) {
    return "Please select at least one PDF file.";
  }

  const unsupported = addedFiles.find(
    (file) => !isPdfFileLike(file),
  );

  if (unsupported) {
    return `${unsupported.name} is not a supported PDF file.`;
  }

  const oversized = addedFiles.find(
    (file) =>
      !Number.isFinite(file.size) ||
      file.size < 0 ||
      file.size > MAX_PDF_FILE_BYTES,
  );

  if (oversized) {
    return `${oversized.name} is larger than the 25 MB per-file limit.`;
  }

  const combined = [
    ...existingFiles,
    ...addedFiles,
  ];

  if (combined.length > MAX_PDF_BATCH_COUNT) {
    return `Choose no more than ${MAX_PDF_BATCH_COUNT} PDF files at a time.`;
  }

  const totalBytes = combined.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  if (totalBytes > MAX_PDF_BATCH_BYTES) {
    return "The selected PDFs exceed the 100 MB combined browser-processing limit.";
  }

  return null;
}

export function hasAcroFormDictionary(
  pdf: PDFDocument,
) {
  return Boolean(
    pdf.catalog.get(PDFName.of("AcroForm")),
  );
}

export function assertPageCopySafe(
  pdf: PDFDocument,
  operationLabel: string,
) {
  if (hasAcroFormDictionary(pdf)) {
    throw new Error(
      `${operationLabel} does not currently preserve interactive PDF form structure safely. Flatten the form first, then try again.`,
    );
  }
}
