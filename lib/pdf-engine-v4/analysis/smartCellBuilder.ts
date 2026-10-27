import {inferNativeScientificSymbols} from "./nativeScientificSymbolRecovery";
import type {
  PdfBoundingBox,
  PdfWord,
} from "../model/types";
import type {
  LogicalCell,
  LogicalRow,
  LogicalTable,
} from "../model/logicalTable";
import type { LogicalRowCandidate } from "./adaptiveRowDetector";
import type { ColumnCandidate } from "./stableColumnDetector";
import {
  createAnalysisWordsV4,
} from "./analysisTextFragments";

export type SmartCellBuilderResult = {
  table: LogicalTable | null;
  confidence: number;
};

type SmartCellBuilderOptions = {
  minimumCellConfidence?: number;
  sourceBlockId?: string;
};

const DEFAULT_MINIMUM_CELL_CONFIDENCE = 0.35;

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

function createCellId(
  rowIndex: number,
  columnIndex: number,
) {
  return `logical-cell-${rowIndex}-${columnIndex}`;
}

function createRowId(rowIndex: number) {
  return `logical-row-${rowIndex}`;
}

function createTableId(pageNumber: number, sourceBlockId?: string) {
  return sourceBlockId
    ? `logical-table-${pageNumber}-${sourceBlockId}`
    : `logical-table-${pageNumber}`;
}

function findNearestColumn(
  word: PdfWord,
  columns: ColumnCandidate[],
) {
  if (columns.length === 0) {
    return null;
  }

  for (const column of columns) {
    if (
      word.bounds.x >= column.leftBoundary &&
      word.bounds.x < column.rightBoundary
    ) {
      return column;
    }
  }

  let nearestColumn = columns[0];

  let nearestDistance = Math.abs(
    word.bounds.x - nearestColumn.x,
  );

  for (
    let index = 1;
    index < columns.length;
    index += 1
  ) {
    const column = columns[index];

    const distance = Math.abs(
      word.bounds.x - column.x,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestColumn = column;
    }
  }

  return nearestColumn;
}

function findCellAssignmentColumn(
  word: PdfWord,
  columns: ColumnCandidate[],
) {
  if (
    word.extractionProvenance
      ?.source !==
      "ocr-tesseract" ||
    columns.length <= 1
  ) {
    return findNearestColumn(
      word,
      columns,
    );
  }

  const sortedColumns =
    [...columns].sort(
      (first, second) =>
        first.x - second.x,
    );

  const tolerance =
    Math.max(
      word.bounds.height * 0.6,
      4,
    );

  for (
    let index =
      sortedColumns.length - 1;
    index >= 0;
    index -= 1
  ) {
    const column =
      sortedColumns[index];

    if (
      word.bounds.x +
        word.bounds.width / 2 >=
      column.x - tolerance
    ) {
      return column;
    }
  }

  return sortedColumns[0];
}

function getMappedColumnIndexes(
  lines: LogicalRowCandidate["lines"],
  columns: ColumnCandidate[],
) {
  const indexes =
    new Set<number>();

  for (const line of lines) {
    for (const word of line.words) {
      const nearestColumn =
        findNearestColumn(
          word,
          columns,
        );

      if (!nearestColumn) {
        continue;
      }

      const columnIndex =
        columns.findIndex(
          (column) =>
            column.id ===
            nearestColumn.id,
        );

      if (columnIndex >= 0) {
        indexes.add(
          columnIndex,
        );
      }
    }
  }

  return indexes;
}

function getLinesForCellAssignment(
  row: LogicalRowCandidate,
  columns: ColumnCandidate[],
  isFirstLogicalRow: boolean,
) {
  // A scoped caption-grid header was already separated from article prose.
  // Its compact first line may identify grouped column names, not a title.
  if (row.reason === "caption-native-numeric-grid") return row.lines;
  if (
    !isFirstLogicalRow ||
    row.lines.length < 2 ||
    columns.length < 3
  ) {
    return row.lines;
  }

  const [
    firstLine,
    ...remainingLines
  ] = row.lines;

  const firstLineColumns =
    getMappedColumnIndexes(
      [firstLine],
      columns,
    );

  const remainingColumns =
    getMappedColumnIndexes(
      remainingLines,
      columns,
    );

  const lastColumnIndex =
    columns.length - 1;

  const firstLineAvoidsEdges =
    !firstLineColumns.has(0) &&
    !firstLineColumns.has(
      lastColumnIndex,
    );

  const firstLineIsCompact =
    firstLineColumns.size > 0 &&
    firstLineColumns.size <=
      Math.max(
        2,
        Math.floor(
          columns.length / 2,
        ),
      );

  const tableLeft =
    columns[0].leftBoundary;

  const tableRight =
    columns[
      lastColumnIndex
    ].rightBoundary;

  const tableWidth =
    Math.max(
      tableRight - tableLeft,
      1,
    );

  const tableCenterX =
    tableLeft +
    tableWidth / 2;

  const firstLineCenterX =
    firstLine.bounds.x +
    firstLine.bounds.width / 2;

  const firstLineIsCentered =
    Math.abs(
      firstLineCenterX -
        tableCenterX,
    ) <=
    tableWidth * 0.15;

  const firstLineIsNarrow =
    firstLine.bounds.width <=
    tableWidth * 0.6;

  const remainingSpansTable =
    remainingColumns.has(0) &&
    remainingColumns.has(
      lastColumnIndex,
    );

  const remainingIsBroader =
    remainingColumns.size >=
      Math.max(
        3,
        firstLineColumns.size + 1,
      );

  const hasLeadingTableTitle =
    firstLineAvoidsEdges &&
    firstLineIsCompact &&
    firstLineIsCentered &&
    firstLineIsNarrow &&
    remainingSpansTable &&
    remainingIsBroader;

  return hasLeadingTableTitle
    ? remainingLines
    : row.lines;
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
      const sameVisualLine =
        Math.abs(
          previousWord.bounds.y -
            word.bounds.y,
        ) <= 3;

      if (!sameVisualLine) {
        text += " ";
      } else {
        const previousEndX =
          previousWord.bounds.x +
          previousWord.bounds.width;

        const gap =
          word.bounds.x -
          previousEndX;

        const estimatedCharacterWidth =
          previousWord.text.length > 0
            ? previousWord.bounds.width /
              previousWord.text.length
            : 4;

        if (
          gap >
          estimatedCharacterWidth * 0.35
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

function buildEmptyCell(
  rowIndex: number,
  columnIndex: number,
): LogicalCell {
  return {
    id: createCellId(
      rowIndex,
      columnIndex,
    ),
    rowIndex,
    columnIndex,
    text: "",
    words: [],
    bounds: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
    confidence: 0,
  };
}

function createEmptyCells(
  rowIndex: number,
  columns: ColumnCandidate[],
) {
  return columns.map(
    (_, columnIndex) =>
      buildEmptyCell(
        rowIndex,
        columnIndex,
      ),
  );
}

function assignWordsToCells(
  row: LogicalRowCandidate,
  columns: ColumnCandidate[],
  isFirstLogicalRow: boolean,
) {
  const cells =
    createEmptyCells(
      row.index,
      columns,
    );

  const linesForAssignment =
    getLinesForCellAssignment(
      row,
      columns,
      isFirstLogicalRow,
    );

  const analysisWords =
    linesForAssignment.flatMap(
      (line) =>
        createAnalysisWordsV4(line),
    );

  const denseTenColumns = row.reason === "native-dense-caption-ten-body-review" &&
    columns.length === 10
    ? [...columns].sort((a, b) => a.x - b.x)
    : null;

  for (const word of analysisWords) {
    const denseTenLabelWord =
      denseTenColumns !== null &&
      word.bounds.x + word.bounds.width <
        denseTenColumns[1].x - 8;
    const nearestColumn =
      denseTenLabelWord
        ? denseTenColumns![0]
        : (row.reason==="parallel-native-scientific-physical-row"||
        row.reason==="captioned-native-text-physical-line")&&columns.length===2
        ? (word.bounds.x>=columns[1].x-10?columns[1]:columns[0])
        : findCellAssignmentColumn(word,columns);

    if (!nearestColumn) {
      continue;
    }

    const columnIndex =
      columns.findIndex(
        (column) =>
          column.id ===
          nearestColumn.id,
      );

    if (columnIndex < 0) {
      continue;
    }

    cells[columnIndex].words.push(
      word,
    );
  }

  return cells;
}

function normalizeFinalSerialCellText(
  cell: LogicalCell,
  text: string,
) {
  if (cell.columnIndex !== 0) {
    return text;
  }

  const isOcrCell =
    cell.words.length > 0 &&
    cell.words.every(
      (word) =>
        word.extractionProvenance
          ?.source ===
        "ocr-tesseract",
    );

  if (!isOcrCell) {
    return text;
  }

  const match =
    text
      .trim()
      .match(
        /^['\u2019]?(\d+)[.)]?$/,
      );

  return match?.[1] ?? text;
}

function finalizeCell(
  cell: LogicalCell,
  column: ColumnCandidate,
  minimumCellConfidence: number,
  rowReason: string,
): LogicalCell {
  const rawText =
    joinWords(cell.words);

  // Dense caption tables often render long dot-leader decorations after the
  // label. Remove only 8+ trailing dots in this strictly review-only mode;
  // retain native words and exact originalNativeText for source inspection.
  // A short ellipsis, internal punctuation and every numeric cell are intact.
  const isDenseCaptionNativeLabel =
    rowReason === "native-dense-caption-ten-body-review" &&
    cell.columnIndex === 0 &&
    cell.words.length > 0 &&
    cell.words.every(word => word.extractionProvenance?.source === "native-pdf");
  const decorativeLeader = isDenseCaptionNativeLabel &&
    /(?:\s*\.\s*){8,}$/u.test(rawText);
  const cleanLabelText = decorativeLeader
    ? rawText.replace(/(?:\s*\.\s*){8,}$/u, "").trimEnd()
    : rawText;

  const nativeLabel =
    rowReason === "parallel-native-scientific-physical-row" &&
    cell.columnIndex === 0 &&
    cell.words.length > 0 &&
    cell.words.every(word =>
      !word.extractionProvenance ||
      word.extractionProvenance.source === "native-pdf",
    )
      ? inferNativeScientificSymbols(rawText)
      : {
          text: cleanLabelText,
          reasons: decorativeLeader
            ? ["Decorative trailing PDF dot leaders omitted from review-only native caption label."]
            : [] as string[],
        };

  const text =
    normalizeFinalSerialCellText(
      cell,
      nativeLabel.text,
    );

  const bounds =
    getBounds(cell.words);

  const contentConfidence =
    cell.words.length > 0
      ? 1
      : 0;

  const confidence =
    clamp(
      column.confidence * 0.65 +
        contentConfidence * 0.35,
      0,
      1,
    );

  return {
    ...cell,
    text,
    ...(nativeLabel.reasons.length > 0
      ? {
          originalNativeText: rawText,
          nativeTextAdjustmentReasons: nativeLabel.reasons,
        }
      : {}),
    bounds,
    confidence:
      confidence >=
      minimumCellConfidence
        ? confidence
        : 0,
  };
}

function buildLogicalRow(
  row: LogicalRowCandidate,
  columns: ColumnCandidate[],
  minimumCellConfidence: number,
  isFirstLogicalRow: boolean,
): LogicalRow {

  const emptyCells =
    assignWordsToCells(
      row,
      columns,
      isFirstLogicalRow,
    );

  const cells =
    emptyCells.map(
      (cell, index) =>
        finalizeCell(
          cell,
          columns[index],
          minimumCellConfidence,
          row.reason,
        ),
    );

  const populatedCells =
    cells.filter(
      (cell) => cell.text,
    );

  const confidence =
    populatedCells.length === 0
      ? 0
      : average(
          populatedCells.map(
            (cell) =>
              cell.confidence,
          ),
        );

  return {
    id: createRowId(row.index),
    rowIndex: row.index,
    cells,
    confidence,
  };
}

function getTableBounds(
  rows: LogicalRow[],
): PdfBoundingBox {
  const words =
    rows.flatMap((row) =>
      row.cells.flatMap(
        (cell) => cell.words,
      ),
    );

  return getBounds(words);
}

export function buildSmartTableV4(
  pageNumber: number,
  rows: LogicalRowCandidate[],
  columns: ColumnCandidate[],
  options?: SmartCellBuilderOptions,
): SmartCellBuilderResult {
  const minimumCellConfidence =
    options?.minimumCellConfidence ??
    DEFAULT_MINIMUM_CELL_CONFIDENCE;

  if (
    rows.length === 0 ||
    columns.length === 0
  ) {
    return {
      table: null,
      confidence: 0,
    };
  }

  const logicalRows =
    rows.map(
      (
        row,
        rowPosition,
      ) =>
        buildLogicalRow(
          row,
          columns,
          minimumCellConfidence,
          rowPosition === 0,
        ),
    );

  const populatedRows =
    logicalRows.filter((row) =>
      row.cells.some(
        (cell) => cell.text,
      ),
    );

  if (populatedRows.length === 0) {
    return {
      table: null,
      confidence: 0,
    };
  }

  const confidence =
    average(
      populatedRows.map(
        (row) => row.confidence,
      ),
    );

  const table: LogicalTable = {
    id: createTableId(pageNumber, options?.sourceBlockId),
    pageNumber,
    rows: populatedRows,
    columnCount: columns.length,
    bounds:
      getTableBounds(
        populatedRows,
      ),
    confidence,
  };

  return {
    table,
    confidence,
  };
}
