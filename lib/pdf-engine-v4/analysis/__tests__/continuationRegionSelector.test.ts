import {
  describe,
  expect,
  it,
} from "vitest";

import {
  selectRegionsForAnalysis,
} from "../continuationRegionSelector";

import type {
  AnalyzedTableRegion,
} from "../tableRegionDetector";

function createRegion(
  id: string,
  totalScore: number,
): AnalyzedTableRegion {
  return {
    block: {
      id,
      type: "paragraph",
      pageNumber: 2,
      bounds: {
        x: 0,
        y: 0,
        width: 500,
        height: 100,
      },
      lines: [],
      text: id,
      confidence: 1,
    },
    analysis: {
      isTable:
        totalScore >= 60,
      totalScore,
      confidence: 1,
      breakdown: {
        alignment: {
          score: 0,
          confidence: 0,
        },
        spacing: {
          score: 0,
          confidence: 0,
        },
        density: {
          score: 0,
          confidence: 0,
        },
        header: {
          score: 0,
          confidence: 0,
        },
        numericColumn: {
          score: 0,
          confidence: 0,
        },
      },
    },
  };
}

describe(
  "Continuation Region Selector",
  () => {
    it(
      "admits a near-threshold region when the previous page has a table",
      () => {
        const continuation =
          createRegion(
            "page-5-continuation",
            41.6,
          );

        const result =
          selectRegionsForAnalysis(
            [continuation],
            [],
            true,
          );

        expect(
          result.regionsToAnalyze,
        ).toHaveLength(1);

        expect(
          result.continuationRegionIds.has(
            "page-5-continuation",
          ),
        ).toBe(true);
      },
    );

    it(
      "does not admit the same near-threshold region without a previous-page table",
      () => {
        const continuation =
          createRegion(
            "page-5-continuation",
            41.6,
          );

        const result =
          selectRegionsForAnalysis(
            [continuation],
            [],
            false,
          );

        expect(
          result.regionsToAnalyze,
        ).toHaveLength(0);

        expect(
          result.continuationRegionIds.size,
        ).toBe(0);
      },
    );

    it(
      "does not admit a region below the continuation minimum score",
      () => {
        const weakRegion =
          createRegion(
            "weak-region",
            39.9,
          );

        const result =
          selectRegionsForAnalysis(
            [weakRegion],
            [],
            true,
          );

        expect(
          result.regionsToAnalyze,
        ).toHaveLength(0);
      },
    );

    it(
      "keeps a normal table candidate regardless of continuation recovery",
      () => {
        const normalCandidate =
          createRegion(
            "normal-candidate",
            45,
          );

        const result =
          selectRegionsForAnalysis(
            [normalCandidate],
            [normalCandidate],
            false,
          );

        expect(
          result.regionsToAnalyze,
        ).toHaveLength(1);

        expect(
          result.continuationRegionIds.size,
        ).toBe(0);
      },
    );
  },
);