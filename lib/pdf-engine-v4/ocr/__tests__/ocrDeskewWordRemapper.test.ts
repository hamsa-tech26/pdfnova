import {
  describe,
  expect,
  it,
} from "vitest";

import {
  remapPdfV4DeskewedOcrWords,
} from "../ocrDeskewWordRemapper";

import type {
  PdfV4OcrWord,
} from "../ocrRecognizer";

function createWord(): PdfV4OcrWord {
  return {
    text: "Test",
    confidence: 95,
    bounds: {
      x0: 60,
      y0: 50,
      x1: 70,
      y1: 60,
    },
    coordinateSpace:
      "rendered-image-pixels",
    source: "ocr-tesseract",
  };
}

describe(
  "remapPdfV4DeskewedOcrWords",
  () => {
    it(
      "keeps word bounds unchanged when there is no skew",
      () => {
        const word =
          createWord();

        const result =
          remapPdfV4DeskewedOcrWords(
            [word],
            100,
            100,
            0,
          );

        expect(
          result[0].bounds,
        ).toEqual(
          word.bounds,
        );
      },
    );

    it(
      "rotates deskewed word bounds back around the page center",
      () => {
        const result =
          remapPdfV4DeskewedOcrWords(
            [createWord()],
            100,
            100,
            Math.PI / 2,
          );

        expect(
          result[0].bounds,
        ).toEqual({
          x0: 40,
          y0: 60,
          x1: 50,
          y1: 70,
        });
      },
    );
  },
);