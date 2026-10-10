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
    it("replaces an overlapping low-confidence primary token with an independently stronger retry", () => {
      const weak={...createWord("Nilbusan",10,10,85,34),confidence:46};
      const strong={...createWord("Nilbhusan",11,11,84,33),confidence:92};
      const result=mergePdfV4OcrRetryWords([weak],[strong]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(strong);
      expect(result[0].text).toBe("Nilbhusan");
    });
    it("does not overwrite a reliable primary with a conflicting retry", () => {
      const strong={...createWord("Confirmed",10,10,90,34),confidence:93};
      const retry={...createWord("Incorrect",12,11,88,33),confidence:99};
      expect(mergePdfV4OcrRetryWords([strong],[retry])).toEqual([strong]);
    });
    it("rejects low-quality, empty and nonfinite replacement suggestions", () => {
      const original={...createWord("Original",10,10,90,34),confidence:50};
      for(const retry of [
        {...createWord("Uncertain",12,11,88,33),confidence:70},
        {...createWord(" ",12,11,88,33),confidence:95},
        {...createWord("NaN",12,11,88,33),confidence:Number.NaN},
      ]){
        expect(mergePdfV4OcrRetryWords([original],[retry])).toEqual([original]);
      }
    });
    it("does not remove disjoint retry words even when primary confidence is high", () => {
      const original={...createWord("Column 1",10,10,80,34),confidence:98};
      const retry={...createWord("Column 2",110,10,180,34),confidence:91};
      expect(mergePdfV4OcrRetryWords([original],[retry])).toEqual([original,retry]);
    });

  },
);