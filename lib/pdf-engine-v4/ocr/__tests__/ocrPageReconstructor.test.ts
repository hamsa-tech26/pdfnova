import {
  describe,
  expect,
  it,
} from "vitest";

import {
  reconstructPdfV4PageFromOcr,
} from "../ocrPageReconstructor";

describe(
  "reconstructPdfV4PageFromOcr",
  () => {
    it(
      "reconstructs OCR words and lines into a PdfPageModel",
      () => {
        const page =
          reconstructPdfV4PageFromOcr(
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
                  confidence: 93,
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
              language: "eng",
              source: "ocr-tesseract",
            },
            {
              pageNumber: 1,
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

        expect(page.words).toHaveLength(
          2,
        );

        expect(page.lines).toHaveLength(
          1,
        );

        expect(page.lines[0].text).toBe(
          "PDFNova Test",
        );

        expect(
          page.words[0]
            .extractionProvenance
            ?.source,
        ).toBe(
          "ocr-tesseract",
        );
        expect(
  page.textExtraction.wordCount,
).toBe(2);

expect(
  page.textExtraction.lineCount,
).toBe(1);

expect(
  page.textExtraction.characterCount,
).toBe(11);

expect(
  page.textExtraction.status,
).toBe("low");

expect(
  page.textExtraction.qualityScore,
).toBeGreaterThan(0);
      },
    );
    it(
  "marks a sufficiently populated OCR page as sufficient",
  () => {
    const words = Array.from(
      { length: 20 },
      (_, index) => ({
        text: `Word${index + 1}`,
        confidence: 95,
        bounds: {
          x0:
            100 +
            (index % 10) * 90,
          y0:
            200 +
            Math.floor(index / 10) * 100,
          x1:
            160 +
            (index % 10) * 90,
          y1:
            240 +
            Math.floor(index / 10) * 100,
        },
        coordinateSpace:
          "rendered-image-pixels" as const,
        source:
          "ocr-tesseract" as const,
      }),
    );

    const page =
      reconstructPdfV4PageFromOcr(
        {
          pageNumber: 1,
          text: words
            .map((word) => word.text)
            .join(" "),
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words,
          language: "eng",
          source: "ocr-tesseract",
        },
        {
          pageNumber: 1,
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

    expect(
      page.textExtraction.wordCount,
    ).toBe(20);

    expect(
      page.textExtraction.status,
    ).toBe("sufficient");

    expect(
      page.textExtraction.qualityScore,
    ).toBeGreaterThan(0.8);
  },
);
it(
  "rejects reconstruction when OCR and PDF page numbers do not match",
  () => {
    expect(() =>
      reconstructPdfV4PageFromOcr(
        {
          pageNumber: 2,
          text: "OCR",
          confidence: 95,
          renderedWidth: 1200,
          renderedHeight: 1600,
          words: [],
          language: "eng",
          source: "ocr-tesseract",
        },
        {
          pageNumber: 1,
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
      ),
    ).toThrow(
      "OCR page 2 does not match PDF page 1.",
    );
  },
);
  },
);