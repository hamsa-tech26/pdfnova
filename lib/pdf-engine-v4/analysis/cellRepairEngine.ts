import type {
  PdfBoundingBox,
  PdfWord,
} from "../model/types";
import type {
  LogicalCell,
  LogicalRow,
  LogicalRowProvenance,
  LogicalTable,
} from "../model/logicalTable";

export type CellRepairAction = {
  id: string;
  type:
    | "move-to-previous-row"
    | "move-to-next-row"
    | "merge-with-neighbour-cell";
  fromRowIndex: number;
  fromColumnIndex: number;
  toRowIndex: number;
  toColumnIndex: number;
  fromProvenance?: LogicalRowProvenance;
  toProvenance?: LogicalRowProvenance;
  text: string;
  confidence: number;
  reason: string;
};

export type CellRepairDebugOutcome =
  | "accepted"
  | "rejected-threshold"
  | "rejected-safety";

export type CellRepairDebugCandidate = {
  rowIndex: number;
  columnIndex: number;
  text: string;
  physicalLineCount: number;
  previousScore: number;
  nextScore: number;
  bestScore: number;
  threshold: number;
  thresholdPassed: boolean;
  accepted: boolean;
  outcome: CellRepairDebugOutcome;
  decisionReason?: string;
};

export type CellRepairResult = {
  table: LogicalTable;
  actions: CellRepairAction[];
  debugCandidates: CellRepairDebugCandidate[];
  confidence: number;
};

type CellRepairOptions = {
  minimumMoveConfidence?: number;
  maximumContinuationGap?: number;
};

const DEFAULT_MINIMUM_MOVE_CONFIDENCE = 0.62;
const DEFAULT_MINIMUM_FRAGMENT_MOVE_CONFIDENCE =
  0.35;
const DEFAULT_MAXIMUM_CONTINUATION_GAP = 20;

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

function createActionId(index: number) {
  return `cell-repair-action-${index}`;
}

function cloneCell(
  cell: LogicalCell,
): LogicalCell {
  return {
    ...cell,
    words: [...cell.words],
    bounds: {
      ...cell.bounds,
    },
  };
}

function cloneRow(
  row: LogicalRow,
): LogicalRow {
  return {
    ...row,
    cells: row.cells.map(cloneCell),
  };
}

function cloneTable(
  table: LogicalTable,
): LogicalTable {
  return {
    ...table,
    rows: table.rows.map(cloneRow),
    bounds: {
      ...table.bounds,
    },
  };
}

function isSerialCell(cell: LogicalCell) {
  return /^\d+[.)]?$/.test(
    cell.text.trim(),
  );
}

function hasSerialNumber(row: LogicalRow) {
  return row.cells.some(isSerialCell);
}

function getCellCenterY(
  cell: LogicalCell,
) {
  return (
    cell.bounds.y +
    cell.bounds.height / 2
  );
}

function getWordCenterY(word: PdfWord) {
  return (
    word.bounds.y +
    word.bounds.height / 2
  );
}
function getWordsAverageY(
  words: PdfWord[],
) {
  if (words.length === 0) {
    return 0;
  }

  return average(
    words.map(getWordCenterY),
  );
}

function getCellAverageY(
  cell: LogicalCell,
) {
  if (cell.words.length === 0) {
    return getCellCenterY(cell);
  }

  return average(
    cell.words.map(getWordCenterY),
  );
}

function getRowAverageY(
  row: LogicalRow,
) {
  const words =
    row.cells.flatMap(
      (cell) => cell.words,
    );

  if (words.length === 0) {
    return 0;
  }

  return getWordsAverageY(words);
}

function getVerticalDistance(
  source: LogicalCell,
  target: LogicalCell,
) {
  return Math.abs(
    getCellAverageY(source) -
      getCellAverageY(target),
  );
}

function getBounds(
  words: PdfWord[],
): PdfBoundingBox {
  if (words.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  const minX = Math.min(
    ...words.map(
      (word) => word.bounds.x,
    ),
  );

  const minY = Math.min(
    ...words.map(
      (word) => word.bounds.y,
    ),
  );

  const maxX = Math.max(
    ...words.map(
      (word) =>
        word.bounds.x +
        word.bounds.width,
    ),
  );

  const maxY = Math.max(
    ...words.map(
      (word) =>
        word.bounds.y +
        word.bounds.height,
    ),
  );

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function sortWordsForReading(
  words: PdfWord[],
) {
  return [...words].sort(
    (first, second) => {
      const yDifference =
        second.bounds.y -
        first.bounds.y;

      if (Math.abs(yDifference) > 3) {
        return yDifference;
      }

      return (
        first.bounds.x -
        second.bounds.x
      );
    },
  );
}
function groupWordsByPhysicalLine(
  words: PdfWord[],
) {
  if (words.length === 0) {
    return [];
  }

  const sortedWords =
    sortWordsForReading(words);

  const lines: PdfWord[][] = [];
  const yTolerance = 3;

  for (const word of sortedWords) {
    const matchingLine =
      lines.find((line) => {
        const referenceWord =
          line[0];

        return (
          referenceWord &&
          Math.abs(
            referenceWord.bounds.y -
              word.bounds.y,
          ) <= yTolerance
        );
      });

    if (matchingLine) {
      matchingLine.push(word);
      continue;
    }

    lines.push([word]);
  }

  return lines.map((line) =>
    [...line].sort(
      (first, second) =>
        first.bounds.x -
        second.bounds.x,
    ),
  );
}

function joinWords(
  words: PdfWord[],
) {
  const sortedWords =
    sortWordsForReading(words);

  let text = "";

  for (
    let index = 0;
    index < sortedWords.length;
    index += 1
  ) {
    const word = sortedWords[index];
    const previousWord =
      sortedWords[index - 1];

    if (previousWord) {
      const sameLine =
        Math.abs(
          previousWord.bounds.y -
            word.bounds.y,
        ) <= 3;

      if (!sameLine) {
        text += " ";
      } else {
        const previousEndX =
          previousWord.bounds.x +
          previousWord.bounds.width;

        const gap =
          word.bounds.x -
          previousEndX;

        const characterWidth =
          previousWord.text.length > 0
            ? previousWord.bounds.width /
              previousWord.text.length
            : 4;

        if (
          gap >
          characterWidth * 0.35
        ) {
          text += " ";
        }
      }
    }

    text += word.text;
  }

  return text
    .replace(/\s+/g, " ")
    .trim();
}
function getPhysicalLineTexts(
  cell: LogicalCell,
) {
  return groupWordsByPhysicalLine(
    cell.words,
  )
    .map((lineWords) => ({
      words: lineWords,
      text: joinWords(lineWords),
    }))
    .filter(
      (line) =>
        line.text.trim().length > 0,
    );
}

function finalizeCell(
  cell: LogicalCell,
) {
  return {
    ...cell,
    text: joinWords(cell.words),
    bounds: getBounds(cell.words),
    confidence:
      cell.words.length > 0
        ? Math.max(
            cell.confidence,
            0.75,
          )
        : 0,
  };
}
function replaceCellWords(
  cell: LogicalCell,
  words: PdfWord[],
) {
  return finalizeCell({
    ...cell,
    words: [...words],
  });
}

function hasMultiplePhysicalLines(
  cell: LogicalCell,
) {
  return (
    getPhysicalLineTexts(cell).length >= 2
  );
}

function isSuspiciousCell(
  row: LogicalRow,
  cell: LogicalCell,
) {
  if (!cell.text.trim()) {
    return false;
  }

  if (cell.columnIndex === 0) {
    return false;
  }

  const wordCount =
    cell.text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
      const hasMultipleLines =
  hasMultiplePhysicalLines(cell);

  const previousCell =
    row.cells[
      cell.columnIndex - 1
    ];

  const nextCell =
    row.cells[
      cell.columnIndex + 1
    ];

  const neighbourIsEmpty =
    !previousCell?.text.trim() ||
    !nextCell?.text.trim();

  return (
  (wordCount <= 4 &&
    neighbourIsEmpty) ||
  hasMultipleLines
);
}

function scoreMove(
  sourceCell: LogicalCell,
  targetCell: LogicalCell,
  sourceRow: LogicalRow,
  targetRow: LogicalRow,
  maximumContinuationGap: number,
) {
  const verticalDistance =
    getVerticalDistance(
      sourceCell,
      targetCell,
    );

  const distanceScore =
    clamp(
      1 -
        verticalDistance /
          Math.max(
            maximumContinuationGap,
            1,
          ),
      0,
      1,
    );

  const sameColumnScore =
    sourceCell.columnIndex ===
    targetCell.columnIndex
      ? 1
      : 0;

  const targetIsEmptyScore =
    targetCell.text.trim()
      ? 0
      : 1;

  const serialContinuityScore =
    hasSerialNumber(targetRow)
      ? 1
      : hasSerialNumber(sourceRow)
        ? 0.4
        : 0.2;

  return clamp(
    distanceScore * 0.35 +
      sameColumnScore * 0.25 +
      targetIsEmptyScore * 0.25 +
      serialContinuityScore * 0.15,
    0,
    1,
  );
}
function scorePhysicalLineMove(
  lineWords: PdfWord[],
  targetCell: LogicalCell,
  targetRow: LogicalRow,
  maximumContinuationGap: number,
) {
  if (lineWords.length === 0) {
    return 0;
  }

  const lineY =
    getWordsAverageY(lineWords);

  const targetY =
    targetCell.words.length > 0
      ? getCellAverageY(targetCell)
      : getRowAverageY(targetRow);

  const verticalDistance =
    Math.abs(
      lineY - targetY,
    );

  const distanceScore =
    clamp(
      1 -
        verticalDistance /
          Math.max(
            maximumContinuationGap,
            1,
          ),
      0,
      1,
    );

  const targetIsEmptyScore =
    targetCell.text.trim()
      ? 0
      : 1;

  const targetWordCount =
  targetCell.text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const targetIsWeakScore =
  targetWordCount === 0
    ? 1
    : targetWordCount <= 2
      ? 0.9
      : targetWordCount <= 4
        ? 0.45
        : 0;

  const serialScore =
    hasSerialNumber(targetRow)
      ? 1
      : 0.25;
      const continuationBonus =
  hasSerialNumber(targetRow) &&
  targetWordCount <= 2
    ? 0.05
    : 0;

  return clamp(
  distanceScore * 0.4 +
    targetIsEmptyScore * 0.15 +
    targetIsWeakScore * 0.25 +
    serialScore * 0.2 +
    continuationBonus,
  0,
  1,
);
}

function normalizeRepairText(
  text: string,
) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function wouldDuplicateTargetContent(
  movingText: string,
  targetCell: LogicalCell,
) {
  const normalizedMovingText =
    normalizeRepairText(
      movingText,
    );

  const normalizedTargetText =
    normalizeRepairText(
      targetCell.text,
    );

  if (
    !normalizedMovingText ||
    !normalizedTargetText
  ) {
    return false;
  }

  return normalizedTargetText.includes(
    normalizedMovingText,
  );
}

function movePhysicalLine(
  source: LogicalCell,
  target: LogicalCell,
  lineWords: PdfWord[],
) {
  const movingWordIds =
    new Set(
      lineWords.map(
        (word) => word.id,
      ),
    );

  const remainingWords =
    source.words.filter(
      (word) =>
        !movingWordIds.has(word.id),
    );

  const updatedSource =
    replaceCellWords(
      source,
      remainingWords,
    );

  const updatedTarget =
    replaceCellWords(
      target,
      [
        ...target.words,
        ...lineWords,
      ],
    );

  return {
    source: updatedSource,
    target: updatedTarget,
  };
}
function moveCellContent(
  source: LogicalCell,
  target: LogicalCell,
) {
  const movedWords = [
    ...source.words,
  ];

  const updatedSource =
    finalizeCell({
      ...source,
      words: [],
    });

  const updatedTarget =
    finalizeCell({
      ...target,
      words: [
        ...target.words,
        ...movedWords,
      ],
    });

  return {
    source: updatedSource,
    target: updatedTarget,
  };
}

function updateRowConfidence(
  row: LogicalRow,
) {
  const populatedCells =
    row.cells.filter(
      (cell) => cell.text.trim(),
    );

  return {
    ...row,
    confidence:
      populatedCells.length === 0
        ? 0
        : average(
            populatedCells.map(
              (cell) =>
                cell.confidence,
            ),
          ),
  };
}

function updateTableConfidence(
  table: LogicalTable,
) {
  return {
    ...table,
    confidence:
      table.rows.length === 0
        ? 0
        : average(
            table.rows.map(
              (row) =>
                row.confidence,
            ),
          ),
  };
}

export function repairLogicalTableV1(
  table: LogicalTable,
  options?: CellRepairOptions,
): CellRepairResult {
  const minimumMoveConfidence =
    options?.minimumMoveConfidence ??
    DEFAULT_MINIMUM_MOVE_CONFIDENCE;

  const maximumContinuationGap =
    options?.maximumContinuationGap ??
    DEFAULT_MAXIMUM_CONTINUATION_GAP;

  let repairedTable =
    cloneTable(table);

  const referenceTable =
  cloneTable(table);  

  const actions:
    CellRepairAction[] = [];

  const debugCandidates:
  CellRepairDebugCandidate[] = [];

  for (
  let rowIndex = 1;
  rowIndex < repairedTable.rows.length;
  rowIndex += 1
) {
  const row =
    repairedTable.rows[rowIndex];

const referenceRow =
  referenceTable.rows[rowIndex];

const previousRow =
  referenceTable.rows[
    rowIndex - 1
  ];

const nextRow =
  referenceTable.rows[
    rowIndex + 1
  ];

    for (
      let columnIndex = 1;
      columnIndex < row.cells.length;
      columnIndex += 1
    ) {
      const cell =
  referenceRow.cells[columnIndex];

      if (
        !isSuspiciousCell(
          row,
          cell,
        )
      ) {
        continue;
      }

      const previousTarget =
        previousRow?.cells[
          columnIndex
        ];

      const nextTarget =
        nextRow?.cells[
          columnIndex
        ];

        const physicalLines =
  getPhysicalLineTexts(cell);

const lineToMove =
  physicalLines.length >= 2
    ? physicalLines[
        physicalLines.length - 1
      ]
    : null;

const previousScore =
  previousRow &&
  previousTarget
    ? lineToMove
      ? scorePhysicalLineMove(
          lineToMove.words,
          previousTarget,
          previousRow,
          maximumContinuationGap,
        )
      : scoreMove(
          cell,
          previousTarget,
          row,
          previousRow,
          maximumContinuationGap,
        )
    : 0;

const nextScore =
  nextRow &&
  nextTarget
    ? lineToMove
      ? scorePhysicalLineMove(
          lineToMove.words,
          nextTarget,
          nextRow,
          maximumContinuationGap,
        )
      : scoreMove(
          cell,
          nextTarget,
          row,
          nextRow,
          maximumContinuationGap,
        )
    : 0;

      const isBorderlineNextTie =
  Boolean(lineToMove) &&
  physicalLines.length >= 2 &&
  Math.abs(
    nextScore - previousScore,
  ) <= 0.01 &&
  nextScore >= 0.3 &&
  Boolean(nextRow) &&
  Boolean(nextTarget);

const bestDirection =
  nextScore > previousScore ||
  isBorderlineNextTie
    ? "next"
    : "previous";

const bestScore =
  Math.max(
    previousScore,
    nextScore,
  );

const bestTarget =
  bestDirection === "next"
    ? nextTarget
    : previousTarget;

const bestTargetHasContent =
  Boolean(
    bestTarget?.text.trim(),
  );

const baseRequiredConfidence =
  isBorderlineNextTie
    ? 0.3
    : lineToMove &&
        nextScore > previousScore &&
        nextScore >= 0.33
      ? 0.33
      : lineToMove
        ? DEFAULT_MINIMUM_FRAGMENT_MOVE_CONFIDENCE
        : minimumMoveConfidence;

const requiredConfidence =
  lineToMove &&
  bestTargetHasContent
    ? Math.max(
        baseRequiredConfidence,
        0.55,
      )
    : baseRequiredConfidence;

        const thresholdPassed =
  bestScore >=
  requiredConfidence;

const debugCandidate:
  CellRepairDebugCandidate = {
    rowIndex,
    columnIndex,
    text: cell.text,
    physicalLineCount:
      physicalLines.length,
    previousScore,
    nextScore,
    bestScore,
    threshold:
      requiredConfidence,
    thresholdPassed,
    accepted:
      thresholdPassed,
    outcome:
      thresholdPassed
        ? "accepted"
        : "rejected-threshold",
    decisionReason:
      thresholdPassed
        ? "Repair score passed the required confidence threshold."
        : "Repair score did not meet the required confidence threshold.",
  };

debugCandidates.push(
  debugCandidate,
);


if (
  bestScore <
  requiredConfidence
) {
  continue;
}

      const targetRow =
        bestDirection === "next"
          ? nextRow
          : previousRow;

      const targetCell =
        bestDirection === "next"
          ? nextTarget
          : previousTarget;

      if (
        !targetRow ||
        !targetCell
      ) {
        continue;
      }

const targetRowIndex =
  bestDirection === "next"
    ? rowIndex + 1
    : rowIndex - 1;

const editableSourceRow =
  repairedTable.rows[rowIndex];

const editableTargetRow =
  repairedTable.rows[
    targetRowIndex
  ];

const editableSourceCell =
  editableSourceRow.cells[
    columnIndex
  ];

const editableTargetCell =
  editableTargetRow.cells[
    columnIndex
  ];

const movingText =
  lineToMove
    ? joinWords(
        lineToMove.words,
      )
    : cell.text;

const duplicateTargetContent =
  wouldDuplicateTargetContent(
    movingText,
    editableTargetCell,
  );

if (duplicateTargetContent) {
  debugCandidate.accepted =
    false;

  debugCandidate.outcome =
    "rejected-safety";

  debugCandidate.decisionReason =
    `Target already contains the moving fragment "${movingText}".`;

  continue;
}

const moved =
  lineToMove
    ? movePhysicalLine(
        editableSourceCell,
        editableTargetCell,
        lineToMove.words,
      )
    : moveCellContent(
        editableSourceCell,
        editableTargetCell,
      );

editableSourceRow.cells[
  columnIndex
] = moved.source;

editableTargetRow.cells[
  columnIndex
] = moved.target;

repairedTable.rows[rowIndex] =
  updateRowConfidence(
    editableSourceRow,
  );

repairedTable.rows[
  targetRowIndex
] = updateRowConfidence(
  editableTargetRow,
);

      actions.push({
        id: createActionId(
          actions.length,
        ),
        type:
          bestDirection === "next"
            ? "move-to-next-row"
            : "move-to-previous-row",
        fromRowIndex: rowIndex,
        fromColumnIndex:
          columnIndex,
        toRowIndex:
          targetRowIndex,
        toColumnIndex:
          columnIndex,
          fromProvenance:
  editableSourceRow.provenance,

toProvenance:
  editableTargetRow.provenance,
  
        text:
  lineToMove
    ? joinWords(
        lineToMove.words,
      )
    : cell.text,
        confidence:
          bestScore,
        reason:
          bestDirection === "next"
            ? "Moved to the next numbered row because its matching cell was a stronger continuation target."
            : "Moved to the previous numbered row because its matching cell was a stronger continuation target.",
      });
    }
  }

  repairedTable =
    updateTableConfidence(
      repairedTable,
    );

  const confidence =
    actions.length === 0
      ? repairedTable.confidence
      : average(
          actions.map(
            (action) =>
              action.confidence,
          ),
        );

return {
  table: repairedTable,
  actions,
  debugCandidates,
  confidence,
};
}
