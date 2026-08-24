import type {
  PdfBoundingBox,
} from "../model/types";

import type {
  LogicalCell,
  LogicalRow,
  LogicalRowProvenance,
  LogicalTable,
} from "../model/logicalTable";

export type ColumnReliabilityProfile = {
  columnIndex: number;
  populatedRowCount: number;
  populationRatio: number;
  medianWordCount: number;
};

function parseSerialValue(
  text: string,
) {
  const match =
    text
      .trim()
      .match(/^(\d+)[.)]?(?:\s+|$)/);

  if (!match) {
    return null;
  }

  const value =
    Number.parseInt(
      match[1],
      10,
    );

  return Number.isFinite(value)
    ? value
    : null;
}

function getSerialNumberAtColumn(
  row: LogicalRow,
  columnIndex: number,
) {
  const cell =
    row.cells[columnIndex];

  if (!cell) {
    return null;
  }

  return parseSerialValue(
    cell.text,
  );
}

function detectSerialColumnIndex(
  table: LogicalTable,
) {
  let bestColumnIndex = -1;
  let bestScore = -1;

  for (
    let columnIndex = 0;
    columnIndex < table.columnCount;
    columnIndex += 1
  ) {
    const values =
      table.rows
        .map((row) =>
          getSerialNumberAtColumn(
            row,
            columnIndex,
          ),
        )
        .filter(
          (value): value is number =>
            value !== null,
        );

    if (values.length < 2) {
      continue;
    }

    let sequentialPairs = 0;

    for (
      let index = 1;
      index < values.length;
      index += 1
    ) {
      if (
        values[index] ===
        values[index - 1] + 1
      ) {
        sequentialPairs += 1;
      }
    }

    const score =
      sequentialPairs /
      (values.length - 1);

    if (score > bestScore) {
      bestScore = score;
      bestColumnIndex =
        columnIndex;
    }
  }

  return bestScore >= 0.5
    ? bestColumnIndex
    : -1;
}

function getSerialSequenceConfidence(
  table: LogicalTable,
  columnIndex: number,
) {
  if (columnIndex < 0) {
    return 0;
  }

  const values =
    table.rows
      .map((row) =>
        getSerialNumberAtColumn(
          row,
          columnIndex,
        ),
      )
      .filter(
        (value): value is number =>
          value !== null,
      );

  if (values.length < 2) {
    return 0;
  }

  let sequentialPairs = 0;

  for (
    let index = 1;
    index < values.length;
    index += 1
  ) {
    if (
      values[index] ===
      values[index - 1] + 1
    ) {
      sequentialPairs += 1;
    }
  }

  return (
    sequentialPairs /
    (values.length - 1)
  );
}

function getSerialColumnCandidates(
  table: LogicalTable,
): SerialColumnCandidateDiagnostic[] {
  const candidates:
    SerialColumnCandidateDiagnostic[] =
    [];

  for (
    let columnIndex = 0;
    columnIndex < table.columnCount;
    columnIndex += 1
  ) {
    const values =
      table.rows
        .map((row) =>
          getSerialNumberAtColumn(
            row,
            columnIndex,
          ),
        )
        .filter(
          (value): value is number =>
            value !== null,
        );

    if (values.length < 2) {
      continue;
    }

    let sequentialPairCount = 0;

    for (
      let index = 1;
      index < values.length;
      index += 1
    ) {
      if (
        values[index] ===
        values[index - 1] + 1
      ) {
        sequentialPairCount += 1;
      }
    }

    candidates.push({
      columnIndex,
      numericValueCount:
        values.length,
      sequentialPairCount,
      sequenceConfidence:
        sequentialPairCount /
        (values.length - 1),
    });
  }

  return candidates;
}

function getSerialCellAtColumn(
  row: LogicalRow,
  columnIndex: number,
) {
  return (
    row.cells[columnIndex] ??
    null
  );
}

function getWordCount(
  text: string,
) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
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

function getDataRowsAtSerialColumn(
  table: LogicalTable,
  serialColumnIndex: number,
) {
  if (serialColumnIndex < 0) {
    return [];
  }

  return table.rows.filter(
    (row) =>
      getSerialNumberAtColumn(
        row,
        serialColumnIndex,
      ) !== null,
  );
}

function getRowBoldRatio(
  row: LogicalRow,
) {
  const words =
    row.cells.flatMap(
      (cell) => cell.words,
    );

  if (words.length === 0) {
    return 0;
  }

  const boldWordCount =
    words.filter(
      (word) =>
        word.font.bold === true,
    ).length;

  return (
    boldWordCount /
    words.length
  );
}

function isLikelyHeaderLabel(
  text: string,
) {
  const normalized =
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  if (!normalized) {
    return false;
  }

  const headerTerms = [
    "parameter",
    "value",
    "status",
    "description",
    "quantity",
    "rate",
    "amount",
    "unit",
    "remark",
    "remarks",
    "item",
    "particular",
    "particulars",
    "category",
    "gender",
    "scheme id",
    "scheme name",
  ];

  return headerTerms.some(
    (term) =>
      normalized === term,
  );
}

function getHeaderLabelRatio(
  row: LogicalRow,
) {
  const populatedCells =
    row.cells.filter(
      (cell) =>
        Boolean(
          cell.text.trim(),
        ),
    );

  if (
    populatedCells.length < 2
  ) {
    return 0;
  }

  const headerLikeCells =
    populatedCells.filter(
      (cell) =>
        isLikelyHeaderLabel(
          cell.text,
        ),
    );

  return (
    headerLikeCells.length /
    populatedCells.length
  );
}

function isLikelyStructuralHeader(
  table: LogicalTable,
) {
  if (table.rows.length < 2) {
    return false;
  }

  const firstRow =
    table.rows[0];

  const followingRows =
    table.rows.slice(1);

  const firstRowBoldRatio =
    getRowBoldRatio(
      firstRow,
    );

  const followingBoldRatio =
    average(
      followingRows.map(
        (row) =>
          getRowBoldRatio(row),
      ),
    );

  const headerLabelRatio =
    getHeaderLabelRatio(
      firstRow,
    );

  const hasStrongTypography =
    firstRowBoldRatio >= 0.6 &&
    firstRowBoldRatio -
      followingBoldRatio >=
      0.4;

  const hasStrongHeaderLabels =
    headerLabelRatio >= 0.6;

  return (
    hasStrongTypography ||
    hasStrongHeaderLabels
  );
}

function getReliabilityRows(
  table: LogicalTable,
  serialColumnIndex: number,
) {
  if (serialColumnIndex >= 0) {
    return getDataRowsAtSerialColumn(
      table,
      serialColumnIndex,
    );
  }

  const hasStructuralHeader =
    isLikelyStructuralHeader(
      table,
    );

  return table.rows.filter(
    (row, rowIndex) => {
      if (
        hasStructuralHeader &&
        rowIndex === 0
      ) {
        return false;
      }

      const populatedCellCount =
        row.cells.filter(
          (cell) =>
            Boolean(
              cell?.text.trim(),
            ),
        ).length;

      return populatedCellCount >= 2;
    },
  );
}

export function buildColumnReliabilityProfiles(
  table: LogicalTable,
  serialColumnIndex: number,
): ColumnReliabilityProfile[] {

const dataRows =
  getReliabilityRows(
    table,
    serialColumnIndex,
  );

  if (dataRows.length === 0) {
    return [];
  }

  const profiles:
    ColumnReliabilityProfile[] = [];

  for (
    let columnIndex = 0;
    columnIndex <
    table.columnCount;
    columnIndex += 1
  ) {
    const populatedCells =
      dataRows
        .map(
          (row) =>
            row.cells[
              columnIndex
            ],
        )
        .filter(
          (cell) =>
            Boolean(
              cell?.text.trim(),
            ),
        );

    const wordCounts =
      populatedCells.map(
        (cell) =>
          getWordCount(
            cell.text,
          ),
      );

    profiles.push({
      columnIndex,
      populatedRowCount:
        populatedCells.length,
      populationRatio:
        populatedCells.length /
        dataRows.length,
      medianWordCount:
        median(
          wordCounts,
        ),
    });
  }

  return profiles;
}
export type RowReliabilityStatus =
  | "reliable"
  | "needs-review";

export type RowReliabilityReasonCode =
  | "low-construction-confidence"
  | "unusual-column-emptiness"
  | "unusually-short-content"
  | "serial-sequence-anomaly";

export type RowReliabilityReason = {
  code: RowReliabilityReasonCode;
  message: string;
  columnIndex?: number;
  cellId?: string;
  cellText?: string;
  cellBounds?: PdfBoundingBox;
  sourceFragmentCount?: number;
  severity:
    | "low"
    | "medium"
    | "high";
};

export type RowReliabilityAssessment = {
  rowIndex: number;
  serialNumber: number | null;
  provenance?: LogicalRowProvenance;
  score: number;
  status: RowReliabilityStatus;
  reasons: RowReliabilityReason[];
};

export type SerialColumnCandidateDiagnostic = {
  columnIndex: number;
  numericValueCount: number;
  sequentialPairCount: number;
  sequenceConfidence: number;
};

export type SerialColumnDiagnostics = {
  detectedColumnIndex: number | null;
  sequenceConfidence: number;
  candidates: SerialColumnCandidateDiagnostic[];
};

export type RowReliabilityResult = {
  rows: RowReliabilityAssessment[];
  reliableRowCount: number;
  reviewRowCount: number;
  confidence: number;
  analysisMode:
    | "serial"
    | "structural";
  serialColumnDiagnostics: SerialColumnDiagnostics;
};

const RELIABLE_SCORE_THRESHOLD =
  0.75;

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

function getColumnPresenceScore(
  row: LogicalRow,
  profiles:
    ColumnReliabilityProfile[],
) {
  const expectedColumns =
    profiles.filter(
      (profile) =>
        profile.populationRatio >=
        0.75,
    );

  if (
    expectedColumns.length === 0
  ) {
    return 1;
  }

  return average(
    expectedColumns.map(
      (profile) => {
        const cell =
          row.cells[
            profile.columnIndex
          ];

        return cell?.text.trim()
          ? 1
          : 0;
      },
    ),
  );
}

function getContentConsistencyScore(
  row: LogicalRow,
  profiles:
    ColumnReliabilityProfile[],
) {
  const comparableColumns =
    profiles.filter(
      (profile) =>
        profile.populationRatio >=
          0.6 &&
        profile.medianWordCount >=
          4,
    );

  if (
    comparableColumns.length ===
    0
  ) {
    return 1;
  }

  return average(
    comparableColumns.map(
      (profile) => {
        const cell =
          row.cells[
            profile.columnIndex
          ];

        const wordCount =
          getWordCount(
            cell?.text ?? "",
          );

        return clamp(
          wordCount /
            profile.medianWordCount,
        );
      },
    ),
  );
}

function getSerialContinuityScore(
  serialNumber: number | null,
  previousSerialNumber:
    number | null,
) {
  if (serialNumber === null) {
    return 0;
  }

  if (
    previousSerialNumber === null
  ) {
    return 1;
  }

  return serialNumber ===
    previousSerialNumber + 1
    ? 1
    : 0;
}

function buildReliabilityReasons(
  row: LogicalRow,
  profiles:
    ColumnReliabilityProfile[],
  serialNumber: number | null,
  previousSerialNumber:
    number | null,
  serialColumnIndex: number,
) {
  const reasons:
    RowReliabilityReason[] = [];

  if (row.confidence < 0.75) {
    reasons.push({
      code:
        "low-construction-confidence",
      message:
        "The row has lower construction confidence than expected.",
      severity: "medium",
    });
  }

  for (const profile of profiles) {
    const cell =
      row.cells[
        profile.columnIndex
      ];

    const text =
      cell?.text.trim() ?? "";

    if (
      profile.populationRatio >=
        0.75 &&
      !text
    ) {
      reasons.push({
        code:
          "unusual-column-emptiness",
        columnIndex:
          profile.columnIndex,
        cellId:
  cell?.id,
cellText:
  text,
cellBounds:
  cell?.bounds,  
        message:
          `Column ${
            profile.columnIndex + 1
          } is empty even though this column is normally populated.`,
        severity: "medium",
      });
    }

    if (
      profile.populationRatio >=
        0.6 &&
      profile.medianWordCount >=
        4 &&
      text
    ) {
      const wordCount =
        getWordCount(text);

      const ratio =
        wordCount /
        profile.medianWordCount;

      if (ratio < 0.45) {
        reasons.push({
          code:
            "unusually-short-content",
          columnIndex:
            profile.columnIndex,
            cellId:
  cell?.id,
cellText:
  text,
cellBounds:
  cell?.bounds,
  sourceFragmentCount:
  cell?.words.length ?? 0,
          message:
            `Column ${
              profile.columnIndex + 1
            } contains substantially less content than comparable rows.`,
          severity: "high",
        });
      } else if (
        ratio < 0.65
      ) {
        reasons.push({
          code:
            "unusually-short-content",
          columnIndex:
            profile.columnIndex,
            cellId:
  cell?.id,
cellText:
  text,
cellBounds:
  cell?.bounds,
          message:
            `Column ${
              profile.columnIndex + 1
            } contains less content than is typical for this table.`,
          severity: "medium",
        });
      }
    }
  }

  if (
  serialNumber !== null &&
  previousSerialNumber !== null &&
  serialNumber !==
    previousSerialNumber + 1
) {
  const serialCell =
  getSerialCellAtColumn(
    row,
    serialColumnIndex,
  );

  reasons.push({
    code:
      "serial-sequence-anomaly",
    columnIndex:
      serialColumnIndex >= 0
        ? serialColumnIndex
        : undefined,
    cellId:
      serialCell?.id,
    cellText:
      serialCell?.text.trim(),
    cellBounds:
      serialCell?.bounds,
    message:
      `Serial number ${serialNumber} does not follow ${previousSerialNumber}.`,
    severity: "high",
  });
}

  return reasons;
}

export function analyzeRowReliabilityV1(
  table: LogicalTable,
): RowReliabilityResult {

  const serialColumnIndex =
  detectSerialColumnIndex(table);

  const serialSequenceConfidence =
  getSerialSequenceConfidence(
    table,
    serialColumnIndex,
  );

  const serialColumnCandidates =
  getSerialColumnCandidates(
    table,
  );

const profiles =
  buildColumnReliabilityProfiles(
    table,
    serialColumnIndex,
  );

const dataRows =
  getReliabilityRows(
    table,
    serialColumnIndex,
  );

  const assessments:
    RowReliabilityAssessment[] =
    [];

  let previousSerialNumber:
    number | null = null;

  for (const row of dataRows) {
    const serialNumber =
  getSerialNumberAtColumn(
    row,
    serialColumnIndex,
  );

    const constructionScore =
      clamp(row.confidence);

    const columnScore =
      getColumnPresenceScore(
        row,
        profiles,
      );

    const contentScore =
      getContentConsistencyScore(
        row,
        profiles,
      );

    const serialScore =
      getSerialContinuityScore(
        serialNumber,
        previousSerialNumber,
      );

    const score =
  serialColumnIndex >= 0
    ? clamp(
        constructionScore *
          0.25 +
          columnScore *
            0.25 +
          contentScore *
            0.4 +
          serialScore *
            0.1,
      )
    : clamp(
        (
          constructionScore *
            0.25 +
          columnScore *
            0.25 +
          contentScore *
            0.4
        ) /
          0.9,
      );
    const reasons =
      buildReliabilityReasons(
        row,
        profiles,
        serialNumber,
        previousSerialNumber,
        serialColumnIndex,
      );

    const hasHighSeverityReason =
      reasons.some(
        (reason) =>
          reason.severity ===
          "high",
      );

    const status:
      RowReliabilityStatus =
      score >=
        RELIABLE_SCORE_THRESHOLD &&
      !hasHighSeverityReason
        ? "reliable"
        : "needs-review";

    assessments.push({
  rowIndex:
    row.rowIndex,
  serialNumber,
  provenance:
    row.provenance,
  score,
  status,
  reasons,
});

    if (
      serialNumber !== null
    ) {
      previousSerialNumber =
        serialNumber;
    }
  }

  const reliableRowCount =
    assessments.filter(
      (assessment) =>
        assessment.status ===
        "reliable",
    ).length;

  const reviewRowCount =
    assessments.length -
    reliableRowCount;

  return {
    rows: assessments,
    reliableRowCount,
    reviewRowCount,
    confidence:
      assessments.length === 0
        ? 0
        : average(
            assessments.map(
              (assessment) =>
                assessment.score,
            ),
          ),

            analysisMode:
    serialColumnIndex >= 0
      ? "serial"
      : "structural",

            serialColumnDiagnostics: {
    detectedColumnIndex:
      serialColumnIndex >= 0
        ? serialColumnIndex
        : null,
    sequenceConfidence:
      serialSequenceConfidence,
      candidates:
  serialColumnCandidates,
  },
  };
}