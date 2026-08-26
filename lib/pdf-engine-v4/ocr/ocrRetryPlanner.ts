import type {
  PdfV4PreparedOcrPage,
} from "./ocrPageRenderer";

import type {
  PdfV4OcrPageResult,
  PdfV4OcrRegionRequest,
} from "./ocrRecognizer";

import {
  selectPdfV4OcrRetryRegion,
} from "./ocrCoverageAnalyzer";

export function createPdfV4OcrRetryRequest(
  preparedPage: PdfV4PreparedOcrPage,
  ocrPage: PdfV4OcrPageResult,
): PdfV4OcrRegionRequest | null {
  if (
    preparedPage.pageNumber !==
    ocrPage.pageNumber
  ) {
    return null;
  }

  const region =
    selectPdfV4OcrRetryRegion(
      ocrPage,
    );

  if (!region) {
    return null;
  }

  return {
    page: preparedPage,
    rectangle: {
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
    },
  };
}
