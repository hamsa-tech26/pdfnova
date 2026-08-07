import type { BuiltRow } from "./cellBuilder";

export type NormalizedRow = BuiltRow;

export type RowNormalizationResult = {
  rows: NormalizedRow[];
  removedColumnIndexes: number[];
};

function getPopulatedCellCount(row: BuiltRow) {
  return row.cells.filter((cell) => cell.text.trim()).length;
}

function isNumericSerial(value: string) {
  return /^\d+$/.test(value.trim());
}

function isLikelyContinuationRow(
  previousRow: BuiltRow,
  currentRow: BuiltRow,
) {
  const currentSerial = currentRow.cells[0]?.text.trim() ?? "";
  const previousSerial = previousRow.cells[0]?.text.trim() ?? "";

  if (isNumericSerial(currentSerial)) {
    return false;
  }

  if (!isNumericSerial(previousSerial)) {
    return false;
  }

  const currentPopulatedCells = getPopulatedCellCount(currentRow);

  return currentPopulatedCells > 0 && currentPopulatedCells <= 3;
}

function mergeRows(
  previousRow: BuiltRow,
  continuationRow: BuiltRow,
): BuiltRow {
  return {
    ...previousRow,
    cells: previousRow.cells.map((cell, index) => {
      const continuationText =
        continuationRow.cells[index]?.text.trim() ?? "";

      if (!continuationText) {
        return cell;
      }

      const combinedText = [cell.text.trim(), continuationText]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        ...cell,
        text: combinedText,
        words: [
          ...cell.words,
          ...(continuationRow.cells[index]?.words ?? []),
        ],
      };
    }),
  };
}

function mergeContinuationRows(rows: BuiltRow[]) {
  const normalizedRows: BuiltRow[] = [];

  for (const row of rows) {
    const previousRow = normalizedRows[normalizedRows.length - 1];

    if (
      previousRow &&
      isLikelyContinuationRow(previousRow, row)
    ) {
      normalizedRows[normalizedRows.length - 1] = mergeRows(
        previousRow,
        row,
      );

      continue;
    }

    normalizedRows.push(row);
  }

  return normalizedRows;
}

function findWeakColumns(rows: BuiltRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const columnCount = Math.max(
    ...rows.map((row) => row.cells.length),
  );

  const weakColumnIndexes: number[] = [];

  for (
    let columnIndex = 0;
    columnIndex < columnCount;
    columnIndex += 1
  ) {
    const populatedCount = rows.reduce((count, row) => {
      const text =
        row.cells[columnIndex]?.text.trim() ?? "";

      return text ? count + 1 : count;
    }, 0);

    const supportRatio = populatedCount / rows.length;

    if (supportRatio < 0.18) {
      weakColumnIndexes.push(columnIndex);
    }
  }

  return weakColumnIndexes;
}

function removeWeakColumns(
  rows: BuiltRow[],
  weakColumnIndexes: number[],
) {
  if (weakColumnIndexes.length === 0) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    cells: row.cells
      .filter(
        (_, index) =>
          !weakColumnIndexes.includes(index),
      )
      .map((cell, index) => ({
        ...cell,
        columnIndex: index,
      })),
  }));
}

export function normalizeDetectedRows(
  rows: BuiltRow[],
): RowNormalizationResult {
  const mergedRows =
    mergeContinuationRows(rows);

  const removedColumnIndexes =
    findWeakColumns(mergedRows);

  const cleanedRows =
    removeWeakColumns(
      mergedRows,
      removedColumnIndexes,
    );

  return {
    rows: cleanedRows,
    removedColumnIndexes,
  };
}