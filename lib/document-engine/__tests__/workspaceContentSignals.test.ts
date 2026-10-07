import {
  comparePdfContentSignals,
  normalizeComparableText,
  textSimilarity,
  type PdfContentSignal,
} from "../workspace-intelligence/contentSignals";
import {
  describe,
  expect,
  it,
} from "vitest";

function signal(
  overrides: Partial<PdfContentSignal> = {},
): PdfContentSignal {
  return {
    fileName:
      "document.pdf",
    fileSize: 100,
    sha256:
      "a".repeat(64),
    pageCount: 2,
    selectableTextChars: 20,
    normalizedText:
      "alpha beta gamma delta epsilon",
    normalizedLines: [
      "alpha beta gamma",
      "delta epsilon",
    ],
    ...overrides,
  };
}

describe(
  "workspace content signals",
  () => {
    it("normalizes comparable text deterministically", () => {
      expect(
        normalizeComparableText(
          "  Hello,   WORLD! 42 ",
        ),
      ).toBe(
        "hello world 42",
      );
    });

    it("confirms exact duplicates only from matching SHA-256 values", () => {
      const result =
        comparePdfContentSignals(
          signal(),
          signal({
            fileName:
              "copy.pdf",
          }),
        );

      expect(
        result.exactDuplicate,
      ).toBe(true);
      expect(
        result.relationship,
      ).toBe(
        "exact-duplicate",
      );
    });

    it("recognizes a probable revision from strong selectable-text overlap", () => {
      const result =
        comparePdfContentSignals(
          signal({
            sha256:
              "a".repeat(64),
            normalizedText:
              "alpha beta gamma delta epsilon zeta eta theta",
          }),
          signal({
            sha256:
              "b".repeat(64),
            normalizedText:
              "alpha beta gamma delta epsilon zeta eta theta iota",
            pageCount: 3,
          }),
        );

      expect(
        result.exactDuplicate,
      ).toBe(false);
      expect(
        result.relationship,
      ).toBe(
        "probable-revision",
      );
      expect(
        result.pageCountDelta,
      ).toBe(1);
    });

    it("reports unverified text similarity when selectable text is absent", () => {
      const result =
        comparePdfContentSignals(
          signal({
            sha256:
              "a".repeat(64),
            normalizedText: "",
            normalizedLines: [],
            selectableTextChars: 0,
          }),
          signal({
            sha256:
              "b".repeat(64),
            normalizedText: "",
            normalizedLines: [],
            selectableTextChars: 0,
          }),
        );

      expect(
        result.relationship,
      ).toBe(
        "unverified",
      );
      expect(
        result.textSimilarity,
      ).toBeNull();
    });

    it("keeps unrelated text below the related threshold", () => {
      expect(
        textSimilarity(
          "alpha beta gamma delta",
          "red blue green yellow",
        ),
      ).toBe(0);
    });
  },
);
