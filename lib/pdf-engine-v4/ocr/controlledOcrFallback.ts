import type {
  PdfV4OcrDecision,
} from "./ocrDecision";

import {
  preparePdfV4OcrPages,
} from "./ocrPageRenderer";

import {
  recognizePdfV4OcrPages,
  recognizePdfV4PreparedOcrPages,
  type PdfV4OcrPageResult,
  type PdfV4OcrRegionResult,
} from "./ocrRecognizer";

import {
  createPdfV4OcrRetryRequest,
} from "./ocrRetryPlanner";

import {
  isPdfV4OcrRetryRegionMeaningful,
  preparePdfV4OcrRetryImage,
} from "./ocrRetryImagePreparer";

import {
  remapPdfV4OcrRetryWords,
} from "./ocrRetryWordAdapter";

import {
  shouldApprovePdfV4OcrRetry,
} from "./ocrRetryApproval";

import {
  mergePdfV4OcrRetryWords,
} from "./ocrRetryWordMerge";

import {
  calculatePdfV4OcrVerticalCoverage,
} from "./ocrCoverageAnalyzer";

import {
  analyzePdfV4OcrReliability,
  type PdfV4OcrPageReliability,
} from "./ocrReliabilityAnalyzer";

export type PdfV4ControlledOcrResult = {
  attempted: boolean;
  decisionStatus:
    PdfV4OcrDecision["status"];
  processedPageNumbers: number[];
  pages: PdfV4OcrPageResult[];
  retryRegions: PdfV4OcrRegionResult[];
  reliability:
    PdfV4OcrPageReliability[];
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
      reliability: [],
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
      reliability: [],
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

  const usablePreparedRetryImages =
    preparedRetryImages.filter(
      (retryImage) =>
        isPdfV4OcrRetryRegionMeaningful(
          retryImage.sourceRectangle
            .height,
          retryImage.originalPageHeight,
        ),
    );

  const retryCropPages =
    usablePreparedRetryImages.length > 0
      ? await recognizePdfV4PreparedOcrPages(
          usablePreparedRetryImages,
        )
      : [];

  const retryRegions:
    PdfV4OcrRegionResult[] =
    retryCropPages.flatMap(
      (retryPage, index) => {
                const retryImage =
          usablePreparedRetryImages[
            index
          ];

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

  const pageMergeResults =
    pages.map(
      (page) => {
        const pageRetryRegions =
          retryRegions.filter(
            (region) =>
              region.pageNumber ===
              page.pageNumber,
          );

        const approvedRetryRegions =
          pageRetryRegions.filter(
            (region) =>
              shouldApprovePdfV4OcrRetry(
                {
                  confidence:
                    region.confidence,
                  wordCount:
                    region.words.length,
                },
              ),
          );

        const mergedWords =
          approvedRetryRegions.reduce(
            (
              currentWords,
              region,
            ) =>
              mergePdfV4OcrRetryWords(
                currentWords,
                region.words,
              ),
            page.words,
          );

        return {
          page,
          pageRetryRegions,
          approvedRetryRegions,
          mergedWords,
        };
      },
    );

  const pagesWithApprovedRetries =
    pageMergeResults.map(
      ({
        page,
        approvedRetryRegions,
        mergedWords,
      }) => {
        if (
          approvedRetryRegions.length ===
          0
        ) {
          return page;
        }

        return {
          ...page,
          words: mergedWords,
        };
      },
    );

  const reliability =
    pageMergeResults.map(
      ({
        page,
        pageRetryRegions,
        approvedRetryRegions,
        mergedWords,
      }) => {
        const coverage =
          calculatePdfV4OcrVerticalCoverage(
            page,
          );

        const retryConfidence =
          pageRetryRegions.length > 0
            ? Math.max(
                ...pageRetryRegions.map(
                  (region) =>
                    region.confidence,
                ),
              )
            : undefined;

        const retryWordCount =
          pageRetryRegions.length > 0
            ? pageRetryRegions.reduce(
                (
                  total,
                  region,
                ) =>
                  total +
                  region.words.length,
                0,
              )
            : undefined;

        const retryAddedWordCount =
          Math.max(
            0,
            mergedWords.length -
              page.words.length,
          );

        return analyzePdfV4OcrReliability(
          {
            pageNumber:
              page.pageNumber,

            primaryConfidence:
              page.confidence,
            primaryWordCount:
              page.words.length,

            retryAttempted:
              pageRetryRegions.length > 0,
            retryApproved:
              approvedRetryRegions.length >
              0,
            retryConfidence,
            retryWordCount,
            retryAddedWordCount,

            coverageRatio:
              coverage.coverageRatio,
          },
        );
      },
    );

  return {
    attempted: true,
    decisionStatus: decision.status,
    processedPageNumbers:
      pages.map(
        (page) =>
          page.pageNumber,
      ),
    pages:
      pagesWithApprovedRetries,
    retryRegions,
    reliability,
  };
}