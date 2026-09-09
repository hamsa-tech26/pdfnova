import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mergePdfV4OcrRetryWords,
} from "../ocrRetryWordMerge";

import type {
  PdfV4OcrWord,
} from "../ocrRecognizer";

function createWord(
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): PdfV4OcrWord {
  return {
    text,
    confidence: 90,
    bounds: {
      x0,
      y0,
      x1,
      y1,
    },
    coordinateSpace:
      "rendered-image-pixels",
    source:
      "ocr-tesseract",
  };
}

describe(
  "mergePdfV4OcrRetryWords",
  () => {
    it(
      "keeps new retry words and removes overlapping duplicates",
      () => {
        const primaryWords = [
          createWord(
            "Existing",
            10,
            10,
            60,
            30,
          ),
        ];

        const retryWords = [
          createWord(
            "Duplicate",
            12,
            11,
            58,
            29,
          ),
          createWord(
            "New",
            100,
            100,
            130,
            120,
          ),
        ];

        const result =
          mergePdfV4OcrRetryWords(
            primaryWords,
            retryWords,
          );

        expect(
          result.map(
            (word) => word.text,
          ),
        ).toEqual([
          "Existing",
          "New",
        ]);
      },
    );
  },
);