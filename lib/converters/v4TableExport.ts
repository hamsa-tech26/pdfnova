import type { LogicalTable } from "../pdf-engine-v4/model/logicalTable";

/** Keep the V4 column indices, including empty cells. No source text is edited. */
export function tableToCsvRows(table: LogicalTable): string[][] {
  const width = Math.max(
    table.columnCount,
    ...table.rows.flatMap(row => row.cells.map(cell => cell.columnIndex + 1)),
    0,
  );
  if (!Number.isSafeInteger(width) || width > 512 || width < 0) {
    throw new Error("This table exceeds the 512-column CSV export safety limit.");
  }
  return table.rows.map(row => {
    const values = Array.from({length:width},()=> "");
    for(const cell of row.cells) {
      if (!Number.isInteger(cell.columnIndex) || cell.columnIndex < 0 || cell.columnIndex >= width) {
        throw new Error("Invalid V4 cell column index.");
      }
      if (values[cell.columnIndex]) {
        values[cell.columnIndex] += " " + cell.text;
      } else {
        values[cell.columnIndex] = cell.text ?? "";
      }
    }
    return values;
  });
}
