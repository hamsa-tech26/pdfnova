import type {
  PdfDocumentModel,
} from "../model/types";

export type PdfV4OcrDecisionStatus =
  | "not-required"
  | "page-selective"
  | "required"
  | "review";

export type PdfV4OcrDecision = {
  status: PdfV4OcrDecisionStatus;
  requiredPageNumbers: number[];
  reviewPageNumbers: number[];
  nativeTextPageNumbers: number[];
};

export function createPdfV4OcrDecision(
  document: Pick<
    PdfDocumentModel,
    "pages"
  >,
): PdfV4OcrDecision {
  const requiredPageNumbers =
    document.pages
      .filter(
        (page) =>
          page.textExtraction.status ===
          "none",
      )
      .map(
        (page) =>
          page.pageNumber,
      );

  const reviewPageNumbers =
    document.pages
      .filter(
        (page) =>
          page.textExtraction.status ===
          "low",
      )
      .map(
        (page) =>
          page.pageNumber,
      );

  const nativeTextPageNumbers =
    document.pages
      .filter(
        (page) =>
          page.textExtraction.status ===
          "sufficient",
      )
      .map(
        (page) =>
          page.pageNumber,
      );

  let status:
    PdfV4OcrDecisionStatus;

  if (
    requiredPageNumbers.length ===
      document.pages.length &&
    document.pages.length > 0
  ) {
    status = "required";
  } else if (
    requiredPageNumbers.length > 0
  ) {
    status = "page-selective";
  } else if (
    reviewPageNumbers.length > 0
  ) {
    status = "review";
  } else {
    status = "not-required";
  }

  return {
    status,
    requiredPageNumbers,
    reviewPageNumbers,
    nativeTextPageNumbers,
  };
}