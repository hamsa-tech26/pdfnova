import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPdfV4OcrRetryRequest,
} from "../ocrRetryPlanner";

describe(
  "createPdfV4OcrRetryRequest",
  () => {
    it(
      "creates a rectangle OCR request for a large uncovered bottom region",
      () => {
        const request =
          createPdfV4OcrRetryRequest(
            {
              pageNumber: 1,
              imageDataUrl:
                "data:image/png;base64,test",
              width: 1200,
              height: 1600,
              source: "pdf-render",
            },
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

        expect(
          request?.rectangle,
        ).toEqual({
          left: 0,
          top: 800,
          width: 1200,
          height: 560,
        });
      },
    );
    it(
  "does not create a retry request when prepared and OCR pages do not match",
  () => {
    const request =
      createPdfV4OcrRetryRequest(
        {
          pageNumber: 1,
          imageDataUrl:
            "data:image/png;base64,test",
          width: 1200,
          height: 1600,
          source: "pdf-render",
        },
        {
          pageNumber: 2,
          text: "PDFNova",
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
          ],
          language: "eng",
          source: "ocr-tesseract",
        },
      );

    expect(request).toBeNull();
  },
);
  },
);