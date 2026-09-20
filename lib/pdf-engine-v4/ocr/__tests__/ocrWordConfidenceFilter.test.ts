import {
  describe,
  expect,
  it,
} from "vitest";

import {
  filterPdfV4LowConfidenceOcrWords,
} from "../ocrWordConfidenceFilter";

describe(
  "filterPdfV4LowConfidenceOcrWords",
  () => {
    it(
      "removes very low-confidence OCR noise",
      () => {
        const words = [
          {
            text: "Khahamthai",
            confidence: 92,
          },
          {
            text: "RT",
            confidence: 21,
          },
          {
            text: "vr",
            confidence: 0,
          },
          {
            text: "Functional",
            confidence: 96,
          },
        ];

        const result =
          filterPdfV4LowConfidenceOcrWords(
            words,
          );

        expect(
          result.map(
            (word) =>
              word.text,
          ),
        ).toEqual([
          "Khahamthai",
          "Functional",
        ]);
      },
    );

    it(
      "keeps words exactly at the threshold",
      () => {
        const result =
          filterPdfV4LowConfidenceOcrWords([
            {
              text: "Boundary",
              confidence: 25,
            },
          ]);

        expect(
          result,
        ).toHaveLength(1);
      },
    );

    it(
      "supports a custom confidence threshold",
      () => {
        const result =
          filterPdfV4LowConfidenceOcrWords(
            [
              {
                text: "A",
                confidence: 45,
              },
              {
                text: "B",
                confidence: 70,
              },
            ],
            60,
          );

        expect(
          result.map(
            (word) =>
              word.text,
          ),
        ).toEqual([
          "B",
        ]);
      },
    );

    it(
      "does not mutate the original array",
      () => {
        const words = [
          {
            text: "RT",
            confidence: 21,
          },
          {
            text: "Normal",
            confidence: 95,
          },
        ];

        filterPdfV4LowConfidenceOcrWords(
          words,
        );

        expect(
          words,
        ).toHaveLength(2);
      },
    );
  },
);