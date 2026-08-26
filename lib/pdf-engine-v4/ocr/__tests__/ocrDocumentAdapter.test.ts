import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyPdfV4OcrPagesToDocument,
} from "../ocrDocumentAdapter";

describe(
  "applyPdfV4OcrPagesToDocument",
  () => {
    it(
      "replaces only matching OCR pages and preserves native pages",
      () => {
        const nativeWord = {
          id: "native-word-1",
          text: "Native",
          pageNumber: 1,
          bounds: {
            x: 10,
            y: 700,
            width: 40,
            height: 12,
          },
          font: {
            size: 12,
          },
          rotation: 0,
          extractionProvenance: {
            source: "native-pdf" as const,
          },
        };

        const document =
          applyPdfV4OcrPagesToDocument(
            {
              metadata: {
                fileName: "test.pdf",
                pageCount: 2,
              },
              confidence: 1,
              pages: [
                {
                  pageNumber: 1,
                  width: 600,
                  height: 800,
                  words: [nativeWord],
                  lines: [],
                  blocks: [],
                  textExtraction: {
                    wordCount: 1,
                    lineCount: 1,
                    characterCount: 6,
                    status: "sufficient",
                    qualityScore: 1,
                  },
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
              ],
            },
            [
              {
                pageNumber: 2,
                text: "OCR",
                confidence: 95,
                renderedWidth: 1200,
                renderedHeight: 1600,
                words: [
                  {
                    text: "OCR",
                    confidence: 95,
                    bounds: {
                      x0: 100,
                      y0: 200,
                      x1: 220,
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
            ],
          );

        expect(
          document.pages[0].words[0].text,
        ).toBe("Native");

        expect(
          document.pages[0]
            .words[0]
            .extractionProvenance
            ?.source,
        ).toBe("native-pdf");

        expect(
          document.pages[1].words,
        ).toHaveLength(1);

        expect(
          document.pages[1]
            .words[0]
            .extractionProvenance
            ?.source,
        ).toBe("ocr-tesseract");
      },
    );
  },
);