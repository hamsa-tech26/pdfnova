import type {
  PdfLine,
  PdfVisualBlock,
  PdfWord,
} from "../model/types";
import type { ColumnCandidate } from "./stableColumnDetector";

export type RowDecisionBreakdown = {
  serialNumber: number;
  verticalGap: number;
  leftAlignment: number;
  emptyLeadingColumns: number;
  wrappedText: number;
};

export type LogicalRowCandidate = {
  id: string;
  index: number;
  lines: PdfLine[];
  words: PdfWord[];
  startY: number;
  endY: number;
  isNewRecord: boolean;
  score: number;
  confidence: number;
  breakdown: RowDecisionBreakdown;
  reason: string;
};

export type AdaptiveRowDetectionResult = {
  rows: LogicalRowCandidate[];
  confidence: number;
};

type AdaptiveRowDetectorOptions = {
  newRecordThreshold?: number;
  continuationThreshold?: number;
  serialNumberWeight?: number;
  largeGapWeight?: number;
  leftAlignmentWeight?: number;
  emptyLeadingColumnsPenalty?: number;
  wrappedTextPenalty?: number;
};

const DEFAULT_NEW_RECORD_THRESHOLD = 24;
const DEFAULT_CONTINUATION_THRESHOLD = 8;

const DEFAULT_SERIAL_NUMBER_WEIGHT = 40;
const DEFAULT_LARGE_GAP_WEIGHT = 20;
const DEFAULT_LEFT_ALIGNMENT_WEIGHT = 15;
const DEFAULT_EMPTY_LEADING_COLUMNS_PENALTY = 20;
const DEFAULT_WRAPPED_TEXT_PENALTY = 20;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function createId(index: number) {
  return `logical-row-${index}`;
}

function getBlockLines(
  block: PdfVisualBlock,
): PdfLine[] {
  if (
    block.type === "paragraph" ||
    block.type === "heading"
  ) {
    return [...block.lines].sort(
      (first, second) =>
        second.bounds.y -
        first.bounds.y,
    );
  }

  return [];
}

function getSortedWords(line: PdfLine) {
  return [...line.words].sort(
    (first, second) =>
      first.bounds.x -
      second.bounds.x,
  );
}

function getFirstText(line: PdfLine) {
  return (
    getSortedWords(line)[0]?.text.trim() ?? ""
  );
}

function startsWithSerialNumber(
  line: PdfLine,
) {
  return /^\d+[.)]?$/.test(
    getFirstText(line),
  );
}

function getLineCenterY(line: PdfLine) {
  return (
    line.bounds.y +
    line.bounds.height / 2
  );
}

function getVerticalGap(
  previousLine: PdfLine,
  currentLine: PdfLine,
) {
  const previousBottom =
    previousLine.bounds.y;

  const currentTop =
    currentLine.bounds.y +
    currentLine.bounds.height;

  return previousBottom - currentTop;
}

function getAverageLineHeight(
  lines: PdfLine[],
) {
  if (lines.length === 0) {
    return 1;
  }

  return Math.max(
    1,
    average(
      lines.map((line) =>
        Math.max(
          line.bounds.height,
          1,
        ),
      ),
    ),
  );
}

function findNearestColumnIndex(
  word: PdfWord,
  columns: ColumnCandidate[],
) {
  if (columns.length === 0) {
    return -1;
  }

  let nearestIndex = 0;
  let nearestDistance =
    Number.POSITIVE_INFINITY;

  columns.forEach((column, index) => {
    const distance = Math.abs(
      word.bounds.x - column.x,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getPopulatedColumnIndexes(
  line: PdfLine,
  columns: ColumnCandidate[],
) {
  const indexes = new Set<number>();

  for (const word of line.words) {
    const index =
      findNearestColumnIndex(
        word,
        columns,
      );

    if (index >= 0) {
      indexes.add(index);
    }
  }

  return Array.from(indexes).sort(
    (first, second) =>
      first - second,
  );
}

function hasEmptyLeadingColumns(
  line: PdfLine,
  columns: ColumnCandidate[],
) {
  const populatedIndexes =
    getPopulatedColumnIndexes(
      line,
      columns,
    );

  if (populatedIndexes.length === 0) {
    return true;
  }

  const firstPopulated =
    populatedIndexes[0];

  return firstPopulated > 0;
}

function alignsWithPreviousRow(
  previousLines: PdfLine[],
  currentLine: PdfLine,
  columns: ColumnCandidate[],
) {
  if (
    previousLines.length === 0 ||
    columns.length === 0
  ) {
    return false;
  }

  const previousIndexes =
    new Set(
      previousLines.flatMap((line) =>
        getPopulatedColumnIndexes(
          line,
          columns,
        ),
      ),
    );

  const currentIndexes =
    getPopulatedColumnIndexes(
      currentLine,
      columns,
    );

  if (currentIndexes.length === 0) {
    return false;
  }

  const overlapCount =
    currentIndexes.filter((index) =>
      previousIndexes.has(index),
    ).length;

  return (
    overlapCount /
      currentIndexes.length >=
    0.5
  );
}

function isLikelyWrappedText(
  previousLine: PdfLine,
  currentLine: PdfLine,
  columns: ColumnCandidate[],
) {
  const gap =
    getVerticalGap(
      previousLine,
      currentLine,
    );

  const averageHeight =
    getAverageLineHeight([
      previousLine,
      currentLine,
    ]);

  const closeVertically =
    gap <= averageHeight * 0.8;

  const sameAlignment =
    alignsWithPreviousRow(
      [previousLine],
      currentLine,
      columns,
    );

  const noSerial =
    !startsWithSerialNumber(
      currentLine,
    );

  return (
    closeVertically &&
    sameAlignment &&
    noSerial
  );
}

function calculateDecision(
  previousLogicalLines: PdfLine[],
  currentLine: PdfLine,
  columns: ColumnCandidate[],
  options: Required<AdaptiveRowDetectorOptions>,
) {
  const breakdown: RowDecisionBreakdown = {
    serialNumber: 0,
    verticalGap: 0,
    leftAlignment: 0,
    emptyLeadingColumns: 0,
    wrappedText: 0,
  };

  if (
    startsWithSerialNumber(
      currentLine,
    )
  ) {
    breakdown.serialNumber =
      options.serialNumberWeight;
  }

  const previousLine =
    previousLogicalLines[
      previousLogicalLines.length - 1
    ];

  if (previousLine) {
    const gap =
      getVerticalGap(
        previousLine,
        currentLine,
      );

    const averageHeight =
      getAverageLineHeight([
        previousLine,
        currentLine,
      ]);

    if (
      gap >
      averageHeight * 1.4
    ) {
      breakdown.verticalGap =
        options.largeGapWeight;
    }

    const currentFirstX =
      getSortedWords(
        currentLine,
      )[0]?.bounds.x ?? 0;

    const previousFirstX =
      getSortedWords(
        previousLine,
      )[0]?.bounds.x ?? 0;

    const tolerance =
      Math.max(
        averageHeight * 0.8,
        8,
      );

    if (
      Math.abs(
        currentFirstX -
          previousFirstX,
      ) <= tolerance
    ) {
      breakdown.leftAlignment =
        options.leftAlignmentWeight;
    }

    if (
      isLikelyWrappedText(
        previousLine,
        currentLine,
        columns,
      )
    ) {
      breakdown.wrappedText =
        -options.wrappedTextPenalty;
    }
  }

  if (
    hasEmptyLeadingColumns(
      currentLine,
      columns,
    )
  ) {
    breakdown.emptyLeadingColumns =
      -options.emptyLeadingColumnsPenalty;
  }

  const score =
    breakdown.serialNumber +
    breakdown.verticalGap +
    breakdown.leftAlignment +
    breakdown.emptyLeadingColumns +
    breakdown.wrappedText;

  const isNewRecord =
    score >=
    options.newRecordThreshold;

  const confidence =
    clamp(
      Math.abs(score) /
        Math.max(
          options.serialNumberWeight +
            options.largeGapWeight +
            options.leftAlignmentWeight,
          1,
        ),
      0,
      1,
    );

  let reason =
    "Continuation line.";

  if (isNewRecord) {
    reason =
      "Started a new logical row.";
  } else if (
    score <=
    options.continuationThreshold
  ) {
    reason =
      "Merged as wrapped or continuation content.";
  }

  return {
    score,
    confidence,
    isNewRecord,
    breakdown,
    reason,
  };
}

function createLogicalRow(
  line: PdfLine,
  index: number,
  decision: ReturnType<
    typeof calculateDecision
  >,
): LogicalRowCandidate {
  return {
    id: createId(index),
    index,
    lines: [line],
    words: [...line.words],
    startY: getLineCenterY(line),
    endY: getLineCenterY(line),
    isNewRecord:
      decision.isNewRecord,
    score: decision.score,
    confidence:
      decision.confidence,
    breakdown:
      decision.breakdown,
    reason: decision.reason,
  };
}

function appendLineToRow(
  row: LogicalRowCandidate,
  line: PdfLine,
) {
  return {
    ...row,
    lines: [...row.lines, line],
    words: [
      ...row.words,
      ...line.words,
    ],
    endY: getLineCenterY(line),
  };
}

export function detectAdaptiveRowsV4(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
  options?: AdaptiveRowDetectorOptions,
): AdaptiveRowDetectionResult {
  const resolvedOptions: Required<AdaptiveRowDetectorOptions> = {
    newRecordThreshold:
      options?.newRecordThreshold ??
      DEFAULT_NEW_RECORD_THRESHOLD,
    continuationThreshold:
      options?.continuationThreshold ??
      DEFAULT_CONTINUATION_THRESHOLD,
    serialNumberWeight:
      options?.serialNumberWeight ??
      DEFAULT_SERIAL_NUMBER_WEIGHT,
    largeGapWeight:
      options?.largeGapWeight ??
      DEFAULT_LARGE_GAP_WEIGHT,
    leftAlignmentWeight:
      options?.leftAlignmentWeight ??
      DEFAULT_LEFT_ALIGNMENT_WEIGHT,
    emptyLeadingColumnsPenalty:
      options?.emptyLeadingColumnsPenalty ??
      DEFAULT_EMPTY_LEADING_COLUMNS_PENALTY,
    wrappedTextPenalty:
      options?.wrappedTextPenalty ??
      DEFAULT_WRAPPED_TEXT_PENALTY,
  };

  const lines =
    getBlockLines(block);

  if (lines.length === 0) {
    return {
      rows: [],
      confidence: 0,
    };
  }

  const logicalRows:
    LogicalRowCandidate[] = [];

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line = lines[index];

    const previousRow =
      logicalRows[
        logicalRows.length - 1
      ];

    const previousLines =
      previousRow?.lines ?? [];

    const decision =
      calculateDecision(
        previousLines,
        line,
        columns,
        resolvedOptions,
      );

    if (
      !previousRow ||
      decision.isNewRecord
    ) {
      logicalRows.push(
        createLogicalRow(
          line,
          logicalRows.length,
          decision,
        ),
      );

      continue;
    }

    logicalRows[
      logicalRows.length - 1
    ] = appendLineToRow(
      previousRow,
      line,
    );
  }

  const confidence =
    logicalRows.length === 0
      ? 0
      : average(
          logicalRows.map(
            (row) =>
              row.confidence,
          ),
        );

  return {
    rows: logicalRows,
    confidence,
  };
}
