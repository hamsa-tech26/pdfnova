import { PDFName, type PDFDocument } from "pdf-lib";

export {
  MAX_PDF_BATCH_BYTES,
  MAX_PDF_BATCH_COUNT,
  MAX_PDF_FILE_BYTES,
  isPdfFileLike,
  validatePdfBatch,
} from "./pdfBatchValidation";
export type { PdfFileLike } from "./pdfBatchValidation";

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
