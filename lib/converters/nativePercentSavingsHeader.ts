import type { LogicalTable } from "../pdf-engine-v4/model/logicalTable";
import type { PdfWord } from "../pdf-engine-v4/model/types";

/**
 * Narrow, source-native projection of the NREL-style "Percent Fuel Savings"
 * super-header onto four aligned, two-line column labels. This makes a flat
 * seven-column workbook unambiguous without inventing source words, assuming
 * table border merges, or modifying the engine's physical-word evidence.
 *
 * Reject anything without the exact source heading, full native provenance,
 * repeated physical header baselines, stable geometry and five percentage
 * data rows. Other science tables retain their existing review-only labels.
 */
export function projectNativePercentSavingsHeader(
  table: LogicalTable,
  rows: string[][],
): { rows: string[][]; note: string | null } {
  const unchanged = { rows, note: null };
  if (table.columnCount !== 7 || table.rows.length !== 6 ||
      rows.length !== 6 || rows.some(row => row.length !== 7) ||
      !table.rows[0].provenance?.blockId?.startsWith("native-captioned-short-numeric-") ||
      table.rows.some(row => row.provenance?.pageNumber !== table.pageNumber) ||
      !rows.slice(1).every(row => row.slice(3).every(value =>
        /^\d{1,3}(?:\.\d+)?%$/u.test(value.trim())))) return unchanged;

  const cells = [...table.rows[0].cells].sort((a, b) =>
    a.columnIndex - b.columnIndex);
  if (cells.length !== 7 || cells.some((cell, index) =>
    cell.columnIndex !== index || cell.words.length < 2 ||
    cell.words.some(word => word.extractionProvenance?.source !== "native-pdf" ||
      !word.text.trim() || ![word.bounds.x, word.bounds.y,
        word.bounds.width, word.bounds.height].every(Number.isFinite) ||
      word.bounds.width <= 0 || word.bounds.height <= 0))) return unchanged;

  const words = cells.flatMap(cell => cell.words);
  const parents = words.filter(word => word.text.trim() === "Percent Fuel Savings");
  if (parents.length !== 1 || new Set(words.map(word => word.id)).size !== words.length)
    return unchanged;
  const parent = parents[0];
  if (cells.slice(0, 3).some(cell =>
    cell.words.includes(parent)) || cells[4].words.filter(word =>
      word.id === parent.id).length !== 1) return unchanged;

  const childCells = cells.slice(3);
  const leaves = childCells.map(cell => cell.words.filter(word =>
    word.id !== parent.id));
  if (leaves.some(words => words.length !== 2)) return unchanged;
  const canonical = (text: string) => text.replace(/\s+/gu, " ").trim();
  if (cells.some((cell, index) =>
    canonical(rows[0][index]) !== canonical(cell.words.map(word =>
      word.text).join(" ")))) return unchanged;

  // The four child column names must occupy two common physical source lines,
  // and the source super-header must be directly above their top line.
  const top = leaves.map(words => words[0].bounds);
  const bottom = leaves.map(words => words[1].bounds);
  if (top.some(bounds => Math.abs(bounds.y - top[0].y) > 2) ||
      bottom.some(bounds => Math.abs(bounds.y - bottom[0].y) > 2) ||
      leaves.some((words, i) =>
        top[i].y - bottom[i].y < 8 || top[i].y - bottom[i].y > 17) ||
      parent.bounds.y - top[0].y < 7 ||
      parent.bounds.y - top[0].y > 23) return unchanged;

  const center = (word: PdfWord) => word.bounds.x + word.bounds.width / 2;
  const centers = leaves.map(words => center(words[0]));
  if (centers.some((value, index) =>
    index > 0 && value - centers[index - 1] < 35) ||
    Math.abs(center(parent) - (centers[0] + centers[3]) / 2) > 12)
    return unchanged;

  const header = [...rows[0]];
  for (let index = 3; index < 7; index++) {
    header[index] = parent.text.trim() + " / " +
      leaves[index - 3].map(word => word.text.trim()).join(" ");
  }
  return {
    rows: [header, ...rows.slice(1)],
    note: "The original native 'Percent Fuel Savings' heading was assigned " +
      "to its four geometrically aligned child labels. The workbook uses " +
      "flat, explicit headings; it does not reproduce PDF merged cells.",
  };
}
