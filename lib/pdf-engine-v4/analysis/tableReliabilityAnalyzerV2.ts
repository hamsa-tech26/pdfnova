import type {
  LogicalRow,
  LogicalTable,
} from "../model/logicalTable";

import {
  buildColumnReliabilityProfiles,
  type RowReliabilityResult,
} from "./rowReliabilityAnalyzer";

export type TableReliabilityV2Level =
  | "high"
  | "review"
  | "low";

export type TableReliabilityV2ReasonCode =
  | "row-review-required"
  | "low-row-reliability"
  | "inconsistent-column-population"
  | "low-table-construction-confidence"
  | "inconsistent-row-shape"
  | "serial-sequence-instability";

export type TableReliabilityV2Reason = {
  code: TableReliabilityV2ReasonCode;
  message: string;
  severity:
    | "low"
    | "medium"
    | "high";
};

export type TableReliabilityV2Result = {
  score: number;
  level: TableReliabilityV2Level;

  rowReliabilityScore: number;
  columnConsistencyScore: number;
  constructionScore: number;
  rowShapeConsistencyScore: number;
  structuralConsistencyScore: number;

  reasons: TableReliabilityV2Reason[];
};

function clamp(
  value: number,
  minimum = 0,
  maximum = 1,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function average(
  values: number[],
) {
  if (values.length === 0) {
    return 1;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function median(
  values: number[],
) {
  if (values.length === 0) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (first, second) =>
        first - second,
    );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function getAssessedRows(
  table: LogicalTable,
  rowReliability:
    RowReliabilityResult,
): LogicalRow[] {
  return rowReliability.rows
    .map(
      (assessment) =>
        table.rows.find(
          (row) =>
            row.rowIndex ===
            assessment.rowIndex,
        ),
    )
    .filter(
      (
        row,
      ): row is LogicalRow =>
        Boolean(row),
    );
}

function getCoreColumnProfiles(
  table: LogicalTable,
  rowReliability:
    RowReliabilityResult,
) {
  const serialColumnIndex =
    rowReliability
      .serialColumnDiagnostics
      .detectedColumnIndex ??
    -1;

  const profiles =
    buildColumnReliabilityProfiles(
      table,
      serialColumnIndex,
    );

  return profiles.filter(
    (profile) =>
      profile.populationRatio >=
      0.6,
  );
}

function getColumnConsistencyScore(
  table: LogicalTable,
  rowReliability:
    RowReliabilityResult,
) {
  const coreColumns =
    getCoreColumnProfiles(
      table,
      rowReliability,
    );

  if (
    coreColumns.length === 0
  ) {
    return 1;
  }

  return clamp(
    average(
      coreColumns.map(
        (profile) =>
          profile.populationRatio,
      ),
    ),
  );
}

function getPopulatedCellCount(
  row: LogicalRow,
  columnIndexes?: number[],
) {
  if (
    columnIndexes &&
    columnIndexes.length > 0
  ) {
    return columnIndexes.filter(
      (columnIndex) =>
        Boolean(
          row.cells[
            columnIndex
          ]?.text.trim(),
        ),
    ).length;
  }

  return row.cells.filter(
    (cell) =>
      Boolean(
        cell.text.trim(),
      ),
  ).length;
}

function getRowShapeConsistencyScore(
  table: LogicalTable,
  rowReliability:
    RowReliabilityResult,
) {
  const rows =
    getAssessedRows(
      table,
      rowReliability,
    );

  if (rows.length === 0) {
    return 0;
  }

  const coreColumnIndexes =
    getCoreColumnProfiles(
      table,
      rowReliability,
    ).map(
      (profile) =>
        profile.columnIndex,
    );

  const populatedCellCounts =
    rows.map(
      (row) =>
        getPopulatedCellCount(
          row,
          coreColumnIndexes.length >
            0
            ? coreColumnIndexes
            : undefined,
        ),
    );

  const medianCellCount =
    median(
      populatedCellCounts,
    );

  if (
    medianCellCount <= 0
  ) {
    return 0;
  }

  return clamp(
    average(
      populatedCellCounts.map(
        (count) => {
          if (count <= 0) {
            return 0;
          }

          return (
            Math.min(
              count,
              medianCellCount,
            ) /
            Math.max(
              count,
              medianCellCount,
            )
          );
        },
      ),
    ),
  );
}

function getStructuralConsistencyScore(
  rowReliability:
    RowReliabilityResult,
) {
  if (
    rowReliability.analysisMode ===
    "structural"
  ) {
    return 1;
  }

  return clamp(
    rowReliability
      .serialColumnDiagnostics
      .sequenceConfidence,
  );
}

function buildTableReliabilityV2Reasons(
  reviewRowCount: number,
  rowReliabilityScore: number,
  columnConsistencyScore: number,
  constructionScore: number,
  rowShapeConsistencyScore: number,
  structuralConsistencyScore: number,
  analysisMode:
    RowReliabilityResult["analysisMode"],
): TableReliabilityV2Reason[] {
  const reasons:
    TableReliabilityV2Reason[] = [];

  if (reviewRowCount > 0) {
    reasons.push({
      code:
        "row-review-required",
message:
  reviewRowCount === 1
    ? "1 row requires manual review."
    : `${reviewRowCount} rows require manual review.`,
      severity: "high",
    });
  }

  if (
    rowReliabilityScore < 0.75
  ) {
    reasons.push({
      code:
        "low-row-reliability",
      message:
        "The table contains rows with lower overall reliability than expected.",
      severity: "high",
    });
  }

  if (
    columnConsistencyScore <
    0.75
  ) {
    reasons.push({
      code:
        "inconsistent-column-population",
      message:
        "Core columns are not populated consistently across the table.",
      severity: "medium",
    });
  }

  if (
    constructionScore < 0.75
  ) {
    reasons.push({
      code:
        "low-table-construction-confidence",
      message:
        "The reconstructed table has lower construction confidence.",
      severity: "medium",
    });
  }

  if (
    rowShapeConsistencyScore <
    0.75
  ) {
    reasons.push({
      code:
        "inconsistent-row-shape",
      message:
        "Rows do not follow a consistent populated-cell structure.",
      severity: "medium",
    });
  }

  if (
    analysisMode === "serial" &&
    structuralConsistencyScore <
      0.8
  ) {
    reasons.push({
      code:
        "serial-sequence-instability",
      message:
        "The detected serial-number sequence is not fully consistent.",
      severity: "high",
    });
  }

  return reasons;
}

export function classifyTableReliabilityV2Level(
  score: number,
): TableReliabilityV2Level {
  if (score >= 0.85) {
    return "high";
  }

  if (score >= 0.6) {
    return "review";
  }

  return "low";
}

export function analyzeTableReliabilityV2(
  table: LogicalTable,
  rowReliability:
    RowReliabilityResult,
): TableReliabilityV2Result {
  const rowReliabilityScore =
    clamp(
      rowReliability.confidence,
    );

  const columnConsistencyScore =
    getColumnConsistencyScore(
      table,
      rowReliability,
    );

  const constructionScore =
    clamp(
      table.confidence,
    );

  const rowShapeConsistencyScore =
    getRowShapeConsistencyScore(
      table,
      rowReliability,
    );

  const structuralConsistencyScore =
    getStructuralConsistencyScore(
      rowReliability,
    );

  const score =
    clamp(
      rowReliabilityScore *
        0.35 +
      columnConsistencyScore *
        0.25 +
      constructionScore *
        0.2 +
      rowShapeConsistencyScore *
        0.1 +
      structuralConsistencyScore *
        0.1,
    );

  const reasons =
    buildTableReliabilityV2Reasons(
      rowReliability.reviewRowCount,
      rowReliabilityScore,
      columnConsistencyScore,
      constructionScore,
      rowShapeConsistencyScore,
      structuralConsistencyScore,
      rowReliability.analysisMode,
    );

  let level =
    classifyTableReliabilityV2Level(
      score,
    );

  const hasHighSeverityReason =
    reasons.some(
      (reason) =>
        reason.severity ===
        "high",
    );

  if (
    level === "high" &&
    hasHighSeverityReason
  ) {
    level = "review";
  }

  return {
    score,
    level,

    rowReliabilityScore,
    columnConsistencyScore,
    constructionScore,
    rowShapeConsistencyScore,
    structuralConsistencyScore,

    reasons,
  };
}