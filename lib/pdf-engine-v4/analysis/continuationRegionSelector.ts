import type {
  AnalyzedTableRegion,
} from "./tableRegionDetector";

const CONTINUATION_MINIMUM_SCORE = 40;
const POSSIBLE_TABLE_THRESHOLD = 42;

export type ContinuationRegionSelectionResult = {
  regionsToAnalyze: AnalyzedTableRegion[];
  continuationRegionIds: Set<string>;
};

export function selectRegionsForAnalysis(
  regions: AnalyzedTableRegion[],
  tableRegions: AnalyzedTableRegion[],
  hasPreviousPageTableAnalysis: boolean,
): ContinuationRegionSelectionResult {
  const normalCandidateIds =
    new Set(
      tableRegions.map(
        (region) => region.block.id,
      ),
    );

  const continuationRegionIds =
    new Set(
      hasPreviousPageTableAnalysis
        ? regions
            .filter(
              (region) =>
                !normalCandidateIds.has(
                  region.block.id,
                ) &&
                region.analysis.totalScore >=
                  CONTINUATION_MINIMUM_SCORE &&
                region.analysis.totalScore <
                  POSSIBLE_TABLE_THRESHOLD,
            )
            .map(
              (region) =>
                region.block.id,
            )
        : [],
    );

  const regionsToAnalyze =
    regions.filter(
      (region) =>
        normalCandidateIds.has(
          region.block.id,
        ) ||
        continuationRegionIds.has(
          region.block.id,
        ),
    );

  return {
    regionsToAnalyze,
    continuationRegionIds,
  };
}