import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculatePageTextExtractionQualityScore,
  classifyPageTextExtractionStatus,
} from "../pageReader";

describe(
  "classifyPageTextExtractionStatus",
  () => {
    it(
      "classifies an empty page as none",
      () => {
        expect(
          classifyPageTextExtractionStatus(
            0,
            0,
            0,
          ),
        ).toBe("none");
      },
    );

    it(
      "classifies a very small amount of text as low",
      () => {
        expect(
          classifyPageTextExtractionStatus(
            8,
            2,
            45,
          ),
        ).toBe("low");
      },
    );

    it(
      "classifies substantial text as sufficient",
      () => {
        expect(
          classifyPageTextExtractionStatus(
            40,
            8,
            240,
          ),
        ).toBe("sufficient");
      },
    );

    it(
      "requires at least two low-text signals",
      () => {
        expect(
          classifyPageTextExtractionStatus(
            15,
            6,
            140,
          ),
        ).toBe("sufficient");
      },
    );
        it(
      "returns zero quality for a page with no extractable text",
      () => {
        expect(
          calculatePageTextExtractionQualityScore(
            0,
            0,
            0,
          ),
        ).toBe(0);
      },
    );
        it(
      "returns full quality when all healthy-text thresholds are met",
      () => {
        expect(
          calculatePageTextExtractionQualityScore(
            20,
            3,
            80,
          ),
        ).toBe(1);
      },
    );
        it(
      "returns a partial quality score for limited native text",
      () => {
        expect(
          calculatePageTextExtractionQualityScore(
            10,
            2,
            40,
          ),
        ).toBeCloseTo(
          0.56,
          2,
        );
      },
    );
  },
);
