import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizePdfV4OcrWord,
  normalizePdfV4OcrWords,
} from "../ocrWordNormalizer";

describe(
  "OCR word normalizer",
  () => {
    it(
      "removes a suspicious leading apostrophe from a low-confidence word",
      () => {
        const result =
          normalizePdfV4OcrWord({
            text: "'Damcherra",
            confidence: 40,
          });

        expect(
          result.text,
        ).toBe(
          "Damcherra",
        );
      },
    );

    it(
      "removes a suspicious leading apostrophe from a low-confidence serial number",
      () => {
        const result =
          normalizePdfV4OcrWord({
            text: "'8",
            confidence: 57,
          });

        expect(
          result.text,
        ).toBe("8");
      },
    );

    it(
      "keeps a high-confidence leading apostrophe unchanged",
      () => {
        const result =
          normalizePdfV4OcrWord({
            text: "'Example",
            confidence: 90,
          });

        expect(
          result.text,
        ).toBe(
          "'Example",
        );
      },
    );

    it(
      "does not remove an internal apostrophe",
      () => {
        const result =
          normalizePdfV4OcrWord({
            text: "O'Brien",
            confidence: 40,
          });

        expect(
          result.text,
        ).toBe(
          "O'Brien",
        );
      },
    );

    it(
      "normalizes an array without mutating the original words",
      () => {
        const words = [
          {
            text: "'8",
            confidence: 57,
          },
          {
            text: "Normal",
            confidence: 96,
          },
        ];

        const result =
          normalizePdfV4OcrWords(
            words,
          );

        expect(
          result.map(
            (word) =>
              word.text,
          ),
        ).toEqual([
          "8",
          "Normal",
        ]);

        expect(
          words[0].text,
        ).toBe("'8");
      },
    );
  },
);