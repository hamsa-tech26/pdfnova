/** Deterministic, spreadsheet-safe CSV export for OCR and PDF table matrices.
 * A CSV file carries text and column structure, not geometry or verified provenance.
 */
export function serializeTableCsv(rows: readonly (readonly unknown[])[]): string {
  if (!Array.isArray(rows) || !rows.every(Array.isArray)) {
    throw new Error("CSV export requires a two-dimensional row array");
  }
  return rows.map(row => row.map(cell => {
    let value = String(cell ?? "").replace(/\u0000/g, "");
    // Leading control/space characters must not bypass formula protection.
    if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(value)) value = "'" + value;
    return '"' + value.replace(/"/g, '""') + '"';
  }).join(",")).join("\r\n") + (rows.length ? "\r\n" : "");
}
export function csvDownloadBlob(rows: readonly (readonly unknown[])[]): Blob {
  return new Blob(["\uFEFF", serializeTableCsv(rows)], {type:"text/csv;charset=utf-8"});
}
