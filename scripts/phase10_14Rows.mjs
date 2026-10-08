/**
 * Diagnostic-only removal of a recognized column-heading row from the
 * Phase 10.14 synthetic five-column fixtures. Does not modify the V4 output.
 * Do NOT drop rows just because their serial is damaged or missing.
 */
export function excludePhase10_14ColumnHeader(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return {rows:[], removed:0};
  const first = rows[0] ?? [];
  const headerName = String(first[1] ?? "").toLowerCase().includes("name of scheme");
  const headerStatus = String(first[3] ?? "").toLowerCase().includes("status");
  const headerRemarks = String(first[4] ?? "").toLowerCase().includes("remarks");
  if (headerName && (headerStatus || headerRemarks)) {
    return {rows:rows.slice(1), removed:1};
  }
  return {rows, removed:0};
}
