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

function createTableId(pageNumber: number) {
  return `logical-table-${pageNumber}`;
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
) {
  const cells =
    createEmptyCells(
      row.index,
      columns,
    );

  const analysisWords =
  row.lines.flatMap(
    (line) =>
      createAnalysisWordsV4(line),
  );

for (const word of analysisWords) {
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

    if (columnIndex < 0) {
      continue;
    }

    cells[columnIndex].words.push(
      word,
    );
  }

  return cells;
}

function finalizeCell(
  cell: LogicalCell,
  column: ColumnCandidate,
  minimumCellConfidence: number,
): LogicalCell {
  const text =
    joinWords(cell.words);

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
): LogicalRow {
  const emptyCells =
    assignWordsToCells(
      row,
      columns,
    );

  const cells =
    emptyCells.map(
      (cell, index) =>
        finalizeCell(
          cell,
          columns[index],
          minimumCellConfidence,
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
    rows.map((row) =>
      buildLogicalRow(
        row,
        columns,
        minimumCellConfidence,
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
    id: createTableId(pageNumber),
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
