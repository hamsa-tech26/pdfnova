import type { DetectedColumn } from "./columnDetector";
import type { DetectedRow } from "./rowDetector";
import type {
  PdfCell,
  PdfWord,
} from "./types";

export type BuiltCell = PdfCell & {
  words: PdfWord[];
  rowIndex: number;
  columnIndex: number;
  x: number;
  y: number;
};

export type BuiltRow = {
  index: number;
  y: number;
  cells: BuiltCell[];
};

export type CellBuildResult = {
  rows: BuiltRow[];
  confidence: number;
};

function distance(
  first: number,
  second: number,
) {
  return Math.abs(first - second);
}

function findNearestColumn(
  word: PdfWord,
  columns: DetectedColumn[],
) {
  let nearestColumn: DetectedColumn | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const column of columns) {
    const currentDistance = distance(
      word.x,
      column.x,
    );

    if (currentDistance < nearestDistance) {
      nearestDistance = currentDistance;
      nearestColumn = column;
    }
  }

  return nearestColumn;
}

function joinWords(
  words: PdfWord[],
) {
  const sortedWords = [...words].sort(
    (first, second) =>
      first.x - second.x,
  );

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
      const previousEndX =
        previousWord.x +
        previousWord.width;

      const gap =
        word.x - previousEndX;

      const estimatedCharacterWidth =
        previousWord.text.length > 0
          ? previousWord.width /
            previousWord.text.length
          : 4;

      if (
        gap >
        estimatedCharacterWidth * 0.35
      ) {
        text += " ";
      }
    }

    text += word.text;
  }

  return text
    .replace(/\s+/g, " ")
    .trim();
}

function buildEmptyCells(
  row: DetectedRow,
  columns: DetectedColumn[],
): BuiltCell[] {
  return columns.map((column) => ({
    text: "",
    words: [],
    rowIndex: row.index,
    columnIndex: column.index,
    x: column.x,
    y: row.y,
  }));
}

function assignWordsToCells(
  row: DetectedRow,
  columns: DetectedColumn[],
) {
  const cells =
    buildEmptyCells(row, columns);

  for (const word of row.words) {
    const nearestColumn =
      findNearestColumn(
        word,
        columns,
      );

    if (!nearestColumn) {
      continue;
    }

    const targetCell =
      cells[nearestColumn.index];

    targetCell.words.push(word);
  }

  return cells.map((cell) => ({
    ...cell,
    text: joinWords(cell.words),
  }));
}

function calculateConfidence(
  rows: BuiltRow[],
  columns: DetectedColumn[],
) {
  if (
    rows.length === 0 ||
    columns.length === 0
  ) {
    return 0;
  }

  const totalCells =
    rows.length * columns.length;

  const populatedCells =
    rows.reduce((count, row) => {
      return (
        count +
        row.cells.filter(
          (cell) => cell.text,
        ).length
      );
    }, 0);

  return Math.min(
    1,
    populatedCells / totalCells,
  );
}

export function buildTableCells(
  rows: DetectedRow[],
  columns: DetectedColumn[],
): CellBuildResult {
  if (
    rows.length === 0 ||
    columns.length === 0
  ) {
    return {
      rows: [],
      confidence: 0,
    };
  }

  const builtRows: BuiltRow[] =
    rows.map((row) => {
      const cells =
        assignWordsToCells(
          row,
          columns,
        );

      return {
        index: row.index,
        y: row.y,
        cells,
      };
    });

  const confidence =
    calculateConfidence(
      builtRows,
      columns,
    );

  return {
    rows: builtRows,
    confidence,
  };
}