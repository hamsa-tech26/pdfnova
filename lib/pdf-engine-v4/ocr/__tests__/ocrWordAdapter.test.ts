import {
  describe,
  expect,
  it,
} from "vitest";

import {
  adaptPdfV4OcrPageToPdfWords,
  adaptPdfV4OcrWordToPdfWord,
  adaptPdfV4OcrWordsToPdfWords,
  convertPdfV4OcrWordBounds,
} from "../ocrWordAdapter";

describe(
  "convertPdfV4OcrWordBounds",
  () => {
    it(
      "converts rendered-image coordinates into PDF coordinates",
      () => {
        const bounds =
          convertPdfV4OcrWordBounds(
            {
              text: "Test",
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
            1200,
            1600,
            600,
            800,
          );

        expect(bounds.x).toBe(50);
        expect(bounds.y).toBe(670);
        expect(bounds.width).toBe(100);
        expect(bounds.height).toBe(30);
      },
    );

    it(
      "returns zero bounds for invalid page dimensions",
      () => {
        const bounds =
          convertPdfV4OcrWordBounds(
            {
              text: "Test",
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
            0,
            1600,
            600,
            800,
          );

        expect(bounds).toEqual({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
      },
    );
        it(
      "adapts an OCR word into a PdfWord with OCR provenance",
      () => {
        const pdfWord =
          adaptPdfV4OcrWordToPdfWord(
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
            1,
            0,
            1200,
            1600,
            600,
            800,
          );

        expect(pdfWord.text).toBe(
          "PDFNova",
        );

        expect(pdfWord.pageNumber).toBe(
          1,
        );

        expect(pdfWord.bounds).toEqual({
          x: 50,
          y: 670,
          width: 100,
          height: 30,
        });

        expect(
          pdfWord.extractionProvenance,
        ).toEqual({
          source: "ocr-tesseract",
          confidence: 95,
        });
      },
    );
        it(
      "adapts all OCR words on a page into PdfWords",
      () => {
        const pdfWords =
          adaptPdfV4OcrWordsToPdfWords(
            [
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
                confidence: 90,
                bounds: {
                  x0: 320,
                  y0: 200,
                  x1: 420,
                  y1: 260,
                },
                coordinateSpace:
                  "rendered-image-pixels",
                source:
                  "ocr-tesseract",
              },
            ],
            1,
            1200,
            1600,
            600,
            800,
          );

        expect(pdfWords).toHaveLength(
          2,
        );

        expect(
          pdfWords.map(
            (word) => word.text,
          ),
        ).toEqual([
          "PDFNova",
          "Test",
        ]);

        expect(
          pdfWords[0]
            .extractionProvenance
            ?.source,
        ).toBe(
          "ocr-tesseract",
        );
      },
    );
        it(
      "adapts an OCR page using the matching PDF page dimensions",
      () => {
        const pdfWords =
          adaptPdfV4OcrPageToPdfWords(
            {
              pageNumber: 2,
              text: "PDFNova",
              confidence: 95,
              renderedWidth: 1200,
              renderedHeight: 1600,
              detectedSkewRadians: null,
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
            {
              pageNumber: 2,
              width: 600,
              height: 800,
              words: [],
              lines: [],
              blocks: [],
              textExtraction: {
                wordCount: 0,
                lineCount: 0,
                characterCount: 0,
                status: "none",
                qualityScore: 0,
              },
            },
          );

        expect(pdfWords).toHaveLength(
          1,
        );

        expect(
          pdfWords[0].pageNumber,
        ).toBe(2);

        expect(
          pdfWords[0].bounds,
        ).toEqual({
          x: 50,
          y: 670,
          width: 100,
          height: 30,
        });

        expect(
          pdfWords[0]
            .extractionProvenance,
        ).toEqual({
          source: "ocr-tesseract",
          confidence: 95,
        });
      },
    );
    it(
      "filters elongated OCR grid-line artifacts while preserving real content",
      () => {
        const pdfWords =
          adaptPdfV4OcrWordsToPdfWords(
            [
              {
                text: "|",
                confidence: 80,
                bounds: {
                  x0: 20,
                  y0: 100,
                  x1: 23,
                  y1: 150,
                },
                coordinateSpace:
                  "rendered-image-pixels",
                source:
                  "ocr-tesseract",
              },
              {
                text: "—",
                confidence: 80,
                bounds: {
                  x0: 40,
                  y0: 100,
                  x1: 100,
                  y1: 104,
                },
                coordinateSpace:
                  "rendered-image-pixels",
                source:
                  "ocr-tesseract",
              },
              {
                text: "-",
                confidence: 90,
                bounds: {
                  x0: 120,
                  y0: 100,
                  x1: 128,
                  y1: 112,
                },
                coordinateSpace:
                  "rendered-image-pixels",
                source:
                  "ocr-tesseract",
              },
              {
                text: "Functional",
                confidence: 95,
                bounds: {
                  x0: 150,
                  y0: 100,
                  x1: 260,
                  y1: 130,
                },
                coordinateSpace:
                  "rendered-image-pixels",
                source:
                  "ocr-tesseract",
              },
            ],
            1,
            1200,
            1600,
            600,
            800,
          );

        expect(
          pdfWords.map(
            (word) => word.text,
          ),
        ).toEqual([
          "-",
          "Functional",
        ]);
      },
    );
  },
);
