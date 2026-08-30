import type {
  PdfV4OcrPageResult,
} from "./ocrRecognizer";

export type PdfV4OcrVerticalCoverage = {
  top: number;
  bottom: number;
  coveredHeight: number;
  coverageRatio: number;
};

export type PdfV4OcrVerticalEdgeGaps = {
  topGap: number;
  bottomGap: number;
  topGapRatio: number;
  bottomGapRatio: number;
};

export type PdfV4OcrRetryRegion = {
  edge: "top" | "bottom";
  left: number;
  top: number;
  width: number;
  height: number;
  gapRatio: number;
};

export function calculatePdfV4OcrVerticalCoverage(
  page: PdfV4OcrPageResult,
): PdfV4OcrVerticalCoverage {
  if (
    page.words.length === 0 ||
    page.renderedHeight <= 0
  ) {
    return {
      top: 0,
      bottom: 0,
      coveredHeight: 0,
      coverageRatio: 0,
    };
  }

  const top =
    Math.min(
      ...page.words.map(
        (word) => word.bounds.y0,
      ),
    );

  const bottom =
    Math.max(
      ...page.words.map(
        (word) => word.bounds.y1,
      ),
    );

  const coveredHeight =
    Math.max(
      0,
      bottom - top,
    );

  return {
    top,
    bottom,
    coveredHeight,
    coverageRatio:
      Math.min(
        coveredHeight /
          page.renderedHeight,
        1,
      ),
  };
}
export function calculatePdfV4OcrVerticalEdgeGaps(
  page: PdfV4OcrPageResult,
): PdfV4OcrVerticalEdgeGaps {
  if (
    page.words.length === 0 ||
    page.renderedHeight <= 0
  ) {
    return {
      topGap: 0,
      bottomGap: 0,
      topGapRatio: 0,
      bottomGapRatio: 0,
    };
  }

  const coverage =
    calculatePdfV4OcrVerticalCoverage(
      page,
    );

  const topGap =
    Math.max(
      0,
      coverage.top,
    );

  const bottomGap =
    Math.max(
      0,
      page.renderedHeight -
        coverage.bottom,
    );

  return {
    topGap,
    bottomGap,
    topGapRatio:
      topGap /
      page.renderedHeight,
    bottomGapRatio:
      bottomGap /
      page.renderedHeight,
  };
}

export function selectPdfV4OcrRetryRegion(
  page: PdfV4OcrPageResult,
  minimumGapRatio = 0.2,
  maximumRegionRatio = 0.35,
): PdfV4OcrRetryRegion | null {
  if (
    page.renderedWidth <= 0 ||
    page.renderedHeight <= 0 ||
    page.words.length === 0
  ) {
    return null;
  }

  const gaps =
    calculatePdfV4OcrVerticalEdgeGaps(
      page,
    );

  if (
    gaps.topGapRatio <
      minimumGapRatio &&
    gaps.bottomGapRatio <
      minimumGapRatio
  ) {
    return null;
  }

  if (
    gaps.bottomGapRatio >=
    gaps.topGapRatio
  ) {
    const maximumRegionHeight =
  page.renderedHeight *
  maximumRegionRatio;

const regionHeight =
  Math.min(
    gaps.bottomGap,
    maximumRegionHeight,
  );

return {
  edge: "bottom",
  left: 0,
  top:
    page.renderedHeight -
    gaps.bottomGap,
  width: page.renderedWidth,
  height: regionHeight,
  gapRatio:
    gaps.bottomGapRatio,
};
  }

  return {
    edge: "top",
    left: 0,
    top: 0,
    width: page.renderedWidth,
    height: gaps.topGap,
    gapRatio:
      gaps.topGapRatio,
  };
}