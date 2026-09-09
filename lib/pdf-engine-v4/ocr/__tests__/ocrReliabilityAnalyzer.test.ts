import {
  describe,
  expect,
  it,
} from "vitest";

import {
  analyzePdfV4OcrReliability,
} from "../ocrReliabilityAnalyzer";

describe(
  "analyzePdfV4OcrReliability",
  () => {
    it(
      "classifies a strong OCR page as high reliability",
      () => {
        const result =
          analyzePdfV4OcrReliability({
            pageNumber: 1,

            primaryConfidence: 95,
            primaryWordCount: 25,

            retryAttempted: false,
            retryApproved: false,

            coverageRatio: 0.9,
          });

        expect(
          result.level,
        ).toBe("high");

        expect(
          result.score,
        ).toBeGreaterThanOrEqual(85);
      },
    );

    it(
      "classifies a weak OCR page as low reliability",
      () => {
        const result =
          analyzePdfV4OcrReliability({
            pageNumber: 2,

            primaryConfidence: 35,
            primaryWordCount: 2,

            retryAttempted: true,
            retryApproved: false,
            retryConfidence: 20,
            retryWordCount: 1,

            coverageRatio: 0.15,
          });

        expect(
          result.level,
        ).toBe("low");

        expect(
          result.score,
        ).toBeLessThan(60);
      },
    );

    it(
      "classifies a moderate OCR page as review",
      () => {
        const result =
          analyzePdfV4OcrReliability({
            pageNumber: 3,

            primaryConfidence: 70,
            primaryWordCount: 10,

            retryAttempted: false,
            retryApproved: false,

            coverageRatio: 0.6,
          });

        expect(
          result.level,
        ).toBe("review");

        expect(
          result.score,
        ).toBeGreaterThanOrEqual(60);

        expect(
          result.score,
        ).toBeLessThan(85);
      },
    );
  },
);

it(
  "keeps a strong OCR page high when an approved retry recovers content",
  () => {
    const result =
      analyzePdfV4OcrReliability({
        pageNumber: 4,

        primaryConfidence: 95,
        primaryWordCount: 34,

        retryAttempted: true,
        retryApproved: true,
        retryConfidence: 92,
        retryWordCount: 19,
        retryAddedWordCount: 19,

        coverageRatio: 0.75,
      });

    expect(
      result.level,
    ).toBe("high");

    expect(
      result.score,
    ).toBeGreaterThanOrEqual(85);
  },
);