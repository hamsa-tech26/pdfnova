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


/** Conservatively flags suspicious structural output. Does not certify text fidelity. */
export function inspectV4TableExport(table: LogicalTable): {needsReview:boolean; warnings:string[]} {
  const warnings: string[] = [];
  if (table.rows.length === 0) warnings.push("No rows were extracted.");
  const emptyRowCount = table.rows.filter(row => row.cells.every(cell => !String(cell.text ?? "").trim())).length;
  if (emptyRowCount) warnings.push(emptyRowCount + " entirely blank extracted row(s).");

  const serialPattern = /^[\s"'‘’“”]*\(?(\d+)\)?[.)]?\s*$/u;
  const leading = table.rows.map(row => String(row.cells.find(cell => cell.columnIndex === 0)?.text ?? "").trim());
  const values = leading.map(value => serialPattern.exec(value));
  const serialRowCount = values.filter(Boolean).length;
  // Only make a serial-sequence claim when the first column clearly resembles one.
  if (serialRowCount >= 3 && serialRowCount >= Math.ceil(table.rows.length / 2)) {
    const anomalies = leading.filter((value,i) => i > 0 && !values[i] && value.toLowerCase() !== "sl no").length;
    if (anomalies) warnings.push(anomalies + " row(s) with missing or unrecognized serial numbers.");
    const numbers = values.filter((x): x is RegExpExecArray => x !== null).map(x => Number(x[1]));
    if (numbers.some((n,i) => i > 0 && n !== numbers[i-1]+1)) {
      warnings.push("Serial numbers contain gaps or repeats.");
    }
    if (leading.some((value,i) => values[i] && /^[\s"'‘’“”]/u.test(value))) {
      warnings.push("Leading quotation artifacts appear in serial cells.");
    }
  }
  return {needsReview:warnings.length > 0,warnings};
}
