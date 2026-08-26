import {
  describe,
  expect,
  it,
} from "vitest";

import {
  remapPdfV4OcrRetryWord,
  remapPdfV4OcrRetryWords,
} from "../ocrRetryWordAdapter";

describe(
  "remapPdfV4OcrRetryWord",
  () => {
    it(
      "maps retry-crop word coordinates back to the original rendered page",
      () => {
        const word =
          remapPdfV4OcrRetryWord(
            {
              text: "Table",
              confidence: 95,
              bounds: {
                x0: 200,
                y0: 100,
                x1: 400,
                y1: 180,
              },
              coordinateSpace:
                "rendered-image-pixels",
              source:
                "ocr-tesseract",
            },
            {
              pageNumber: 1,
              imageDataUrl:
                "data:image/png;base64,test",
              width: 2400,
height: 1600,
originalPageWidth: 1200,
originalPageHeight: 1600,
sourceRectangle: {
                left: 50,
                top: 900,
                width: 1200,
                height: 800,
              },
              retryScale: 2,
              source:
                "ocr-retry-crop",
            },
          );

        expect(
          word.bounds,
        ).toEqual({
          x0: 150,
          y0: 950,
          x1: 250,
          y1: 990,
        });
      },
    );
    it(
  "remaps all retry OCR words back to original page coordinates",
  () => {
    const words =
      remapPdfV4OcrRetryWords(
        [
          {
            text: "Table",
            confidence: 95,
            bounds: {
              x0: 200,
              y0: 100,
              x1: 400,
              y1: 180,
            },
            coordinateSpace:
              "rendered-image-pixels",
            source:
              "ocr-tesseract",
          },
          {
            text: "Data",
            confidence: 94,
            bounds: {
              x0: 500,
              y0: 200,
              x1: 700,
              y1: 280,
            },
            coordinateSpace:
              "rendered-image-pixels",
            source:
              "ocr-tesseract",
          },
        ],
        {
          pageNumber: 1,
          imageDataUrl:
            "data:image/png;base64,test",
          width: 2400,
          height: 1600,
          originalPageWidth: 1200,
          originalPageHeight: 1600,
          sourceRectangle: {
            left: 50,
            top: 900,
            width: 1200,
            height: 800,
          },
          retryScale: 2,
          source:
            "ocr-retry-crop",
        },
      );

    expect(words).toHaveLength(2);

    expect(
      words[1].bounds,
    ).toEqual({
      x0: 300,
      y0: 1000,
      x1: 400,
      y1: 1040,
    });
  },
);
  },
);