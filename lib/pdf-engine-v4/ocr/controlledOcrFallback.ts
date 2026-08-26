import type {
  PdfV4OcrDecision,
} from "./ocrDecision";

import {
  preparePdfV4OcrPages,
} from "./ocrPageRenderer";

import {
  recognizePdfV4OcrPages,
  recognizePdfV4OcrRegions,
  recognizePdfV4PreparedOcrPages,
  type PdfV4OcrPageResult,
  type PdfV4OcrRegionResult,
} from "./ocrRecognizer";

import {
  createPdfV4OcrRetryRequest,
} from "./ocrRetryPlanner";

import {
  preparePdfV4OcrRetryImage,
} from "./ocrRetryImagePreparer";

import {
  remapPdfV4OcrRetryWords,
} from "./ocrRetryWordAdapter";

export type PdfV4ControlledOcrResult = {
  attempted: boolean;
  decisionStatus:
    PdfV4OcrDecision["status"];
  processedPageNumbers: number[];
  pages: PdfV4OcrPageResult[];
  retryRegions: PdfV4OcrRegionResult[];
};

export async function runPdfV4ControlledOcr(
  file: File,
  decision: PdfV4OcrDecision,
): Promise<PdfV4ControlledOcrResult> {
  if (
    decision.status === "not-required" ||
    decision.status === "review"
  ) {
    return {
      attempted: false,
      decisionStatus: decision.status,
      processedPageNumbers: [],
      pages: [],
      retryRegions: [],
    };
  }

  const pageNumbers =
    decision.requiredPageNumbers;

  if (pageNumbers.length === 0) {
    return {
      attempted: false,
      decisionStatus: decision.status,
      processedPageNumbers: [],
      pages: [],
      retryRegions: [],
    };
  }

  const preparedPages =
    await preparePdfV4OcrPages(
      file,
      pageNumbers,
    );

  const pages =
    await recognizePdfV4OcrPages(
      preparedPages,
    );

    const retryRequests =
  pages.flatMap(
    (page) => {
      const preparedPage =
        preparedPages.find(
          (candidate) =>
            candidate.pageNumber ===
            page.pageNumber,
        );

      if (!preparedPage) {
        return [];
      }

      const request =
        createPdfV4OcrRetryRequest(
          preparedPage,
          page,
        );

      return request
        ? [request]
        : [];
    },
  );

  const preparedRetryImages =
  await Promise.all(
    retryRequests.map(
      (request) =>
        preparePdfV4OcrRetryImage(
          request.page.pageNumber,
          request.page.imageDataUrl,
          request.rectangle,
          2,
        ),
    ),
  );

  const retryCropPages =
  preparedRetryImages.length > 0
    ? await recognizePdfV4PreparedOcrPages(
        preparedRetryImages,
      )
    : [];

const retryRegions:
  PdfV4OcrRegionResult[] =
  retryCropPages.flatMap(
    (retryPage, index) => {
      const retryImage =
        preparedRetryImages[index];

      if (
        !retryImage ||
        retryImage.pageNumber !==
          retryPage.pageNumber
      ) {
        return [];
      }

      return [
        {
          pageNumber:
            retryPage.pageNumber,
          rectangle:
            retryImage.sourceRectangle,
          text:
            retryPage.text,
          confidence:
            retryPage.confidence,
          renderedWidth:
            retryImage.originalPageWidth,
          renderedHeight:
            retryImage.originalPageHeight,
          words:
  remapPdfV4OcrRetryWords(
    retryPage.words,
    retryImage,
  ),

debugImageDataUrl:
  retryImage.imageDataUrl,

language: "eng",
source: "ocr-tesseract",
        },
      ];
    },
  );

  return {
    attempted: true,
    decisionStatus: decision.status,
    processedPageNumbers:
      pages.map(
        (page) => page.pageNumber,
      ),
    pages,
retryRegions,
  };
}