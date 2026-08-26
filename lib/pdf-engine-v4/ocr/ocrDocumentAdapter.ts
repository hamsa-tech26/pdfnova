import type {
  PdfDocumentModel,
} from "../model/types";

import type {
  PdfV4OcrPageResult,
} from "./ocrRecognizer";

import {
  reconstructPdfV4PageFromOcr,
} from "./ocrPageReconstructor";

export function applyPdfV4OcrPagesToDocument(
  document: PdfDocumentModel,
  ocrPages: PdfV4OcrPageResult[],
): PdfDocumentModel {
  if (ocrPages.length === 0) {
    return document;
  }

  const pages =
    document.pages.map(
      (page) => {
        const matchingOcrPage =
          ocrPages.find(
            (ocrPage) =>
              ocrPage.pageNumber ===
              page.pageNumber,
          );

        if (!matchingOcrPage) {
          return page;
        }

        return reconstructPdfV4PageFromOcr(
          matchingOcrPage,
          page,
        );
      },
    );

  return {
    ...document,
    pages,
  };
}