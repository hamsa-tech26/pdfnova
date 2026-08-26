import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculatePdfV4OcrVerticalCoverage,
  calculatePdfV4OcrVerticalEdgeGaps,
  selectPdfV4OcrRetryRegion,
} from "../ocrCoverageAnalyzer";

describe(
  "calculatePdfV4OcrVerticalCoverage",
  () => {
    it(
      "calculates vertical OCR coverage from detected words",
      () => {
        const coverage =
          calculatePdfV4OcrVerticalCoverage(
            {
              pageNumber: 1,
              text: "PDFNova Test",
              confidence: 95,
              renderedWidth: 1200,
              renderedHeight: 1600,
              words: [
                {
                  text: "PDFNova",
                  confidence: 95,
                  bounds: {
                    x0: 100,
                    y0: 200,
                    x1: 300,
                    y1: 260,
                  },
                  coordinateSpace:
                    "rendered-image-pixels",
                  source:
                    "ocr-tesseract",
                },
                {
                  text: "Test",
                  confidence: 95,
                  bounds: {
                    x0: 100,
                    y0: 800,
                    x1: 220,
                    y1: 900,
                  },
                  coordinateSpace:
                    "rendered-image-pixels",
                  source:
                    "ocr-tesseract",
                },
              ],
              language: "eng",
              source: "ocr-tesseract",
            },
          );

        expect(coverage.top).toBe(200);
        expect(coverage.bottom).toBe(900);
        expect(
          coverage.coveredHeight,
        ).toBe(700);

        expect(
          coverage.coverageRatio,
        ).toBeCloseTo(
          700 / 1600,
        );
      },
    );
    it(
  "returns zero coverage when OCR found no words",
  () => {
    const coverage =
      calculatePdfV4OcrVerticalCoverage(
        {
          pageNumber: 1,
          text: "",
          confidence: 0,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(coverage).toEqual({
      top: 0,
      bottom: 0,
      coveredHeight: 0,
      coverageRatio: 0,
    });
  },
);
it(
  "calculates top and bottom uncovered page gaps",
  () => {
    const gaps =
      calculatePdfV4OcrVerticalEdgeGaps(
        {
          pageNumber: 1,
          text: "PDFNova Test",
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [
            {
              text: "PDFNova",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 200,
                x1: 300,
                y1: 260,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
            {
              text: "Test",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 800,
                x1: 220,
                y1: 900,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
          ],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(gaps.topGap).toBe(
      200,
    );

    expect(gaps.bottomGap).toBe(
      700,
    );

    expect(
      gaps.topGapRatio,
    ).toBeCloseTo(
      200 / 1600,
    );

    expect(
      gaps.bottomGapRatio,
    ).toBeCloseTo(
      700 / 1600,
    );
  },
);
it(
  "selects a large bottom uncovered area as the retry region",
  () => {
    const region =
      selectPdfV4OcrRetryRegion(
        {
          pageNumber: 1,
          text: "PDFNova Test",
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [
            {
              text: "PDFNova",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 200,
                x1: 300,
                y1: 260,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
            {
              text: "Test",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 700,
                x1: 220,
                y1: 800,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
          ],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(region).toEqual({
      edge: "bottom",
      left: 0,
      top: 800,
      width: 1200,
      height: 800,
      gapRatio: 0.5,
    });
  },
);
it(
  "does not select a retry region when uncovered gaps are too small",
  () => {
    const region =
      selectPdfV4OcrRetryRegion(
        {
          pageNumber: 1,
          text: "PDFNova Test",
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [
            {
              text: "PDFNova",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 100,
                x1: 300,
                y1: 200,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
            {
              text: "Test",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 1300,
                x1: 220,
                y1: 1400,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
          ],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(region).toBeNull();
  },
);
it(
  "selects a large top uncovered area as the retry region",
  () => {
    const region =
      selectPdfV4OcrRetryRegion(
        {
          pageNumber: 1,
          text: "PDFNova Test",
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [
            {
              text: "PDFNova",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 800,
                x1: 300,
                y1: 900,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
            {
              text: "Test",
              confidence: 95,
              bounds: {
                x0: 100,
                y0: 1200,
                x1: 220,
                y1: 1300,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
          ],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(region).toEqual({
      edge: "top",
      left: 0,
      top: 0,
      width: 1200,
      height: 800,
      gapRatio: 0.5,
    });
  },
);
  },
);