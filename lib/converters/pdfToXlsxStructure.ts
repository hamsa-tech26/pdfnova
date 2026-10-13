import type { LogicalRow, LogicalTable } from "../pdf-engine-v4/model/logicalTable";
import type { PdfXlsxInput } from "./pdfToXlsx";

/**
 * Native-text-only correction for a narrowly evidenced failure mode:
 * page-separated tables with stable, repeatable native word positions,
 * consecutive printed record numbers and an adjacent ID column.
 *
 * No OCR, textual splitting on spaces, guessed column boundaries or
 * PDF Engine V4 modifications are permitted. Ambiguous layouts fail closed.
 */
type Fragment = { x: number; text: string };
type RecordRow = { page: number; serial: number; fragments: Fragment[] };
type PageTable = { page: number; records: RecordRow[] };
type Cluster = { x: number; rowIds: Set<number> };

function fragmentsOf(row: LogicalRow): Fragment[] | null {
  const all = row.cells.flatMap(cell => cell.words);
  if (!all.length) return null;
  const seen = new Set<string>();
  const words = all.filter(word => {
    if (seen.has(word.id)) return false;
    seen.add(word.id);
    return word.extractionProvenance?.source === "native-pdf" &&
      Number.isFinite(word.bounds.x) && Number.isFinite(word.bounds.y) &&
      Number.isFinite(word.bounds.width) && word.bounds.width > 0 &&
      !!word.text.trim();
  }).sort((a, b) => a.bounds.x - b.bounds.x);
  if (words.length < 5 || words.length !== seen.size) return null;
  // Multi-line physical rows are outside this conservative recovery path.
  if (Math.max(...words.map(w => w.bounds.y)) -
      Math.min(...words.map(w => w.bounds.y)) > 3.5) return null;

  const fragments: Fragment[] = [];
  let current: Fragment | null = null;
  let prior = words[0];
  for (const word of words) {
    const text = word.text.trim();
    if (current === null) {
      current = { x: word.bounds.x, text };
    } else {
      const gap = word.bounds.x - (prior.bounds.x + prior.bounds.width);
      const charWidth = prior.bounds.width / Math.max(prior.text.length, 1);
      const threshold = Math.max(5, Math.min(9, charWidth * 1.5));
      if (gap > threshold) {
        fragments.push(current);
        current = { x: word.bounds.x, text };
      } else {
        current.text += (gap > charWidth * 0.25 ? " " : "") + text;
      }
    }
    prior = word;
  }
  if (current !== null) fragments.push(current);
  return fragments;
}

function nativeRecords(table: LogicalTable): PageTable | null {
  const records: RecordRow[] = [];
  for (const row of table.rows) {
    const fragments = fragmentsOf(row);
    if (!fragments || fragments.length < 7 || fragments.length > 12) continue;
    // The printed serial plus an independent numeric ID are source signals,
    // not assumptions that every PDF uses this layout.
    if (!/^[0-9]{1,4}$/.test(fragments[0].text) ||
        !/^[0-9]{3,8}$/.test(fragments[1].text)) continue;
    const page = row.provenance?.pageNumber ?? table.pageNumber;
    if (page !== table.pageNumber) return null;
    records.push({ page, serial: Number(fragments[0].text), fragments });
  }
  if (records.length < 5) return null;
  for (let i = 1; i < records.length; i++) {
    if (records[i].serial !== records[i - 1].serial + 1) return null;
  }
  return { page: table.pageNumber, records };
}

function alignedColumns(rows: readonly RecordRow[]): number[] | null {
  const clusters: Cluster[] = [];
  rows.forEach((row, rowId) => {
    for (const fragment of row.fragments) {
      const matches = clusters.filter(c => Math.abs(c.x - fragment.x) <= 6);
      if (matches.length > 1) return;
      if (matches.length === 1) {
        const chosen = matches[0];
        chosen.x = (chosen.x * chosen.rowIds.size + fragment.x) /
          (chosen.rowIds.size + 1);
        chosen.rowIds.add(rowId);
      } else {
        clusters.push({ x: fragment.x, rowIds: new Set([rowId]) });
      }
    }
  });
  const strong = clusters.filter(c => c.rowIds.size >= Math.ceil(rows.length * 0.8))
    .sort((a, b) => a.x - b.x);
  if (strong.length < 8 || strong.length > 9) return null;
  const anchors = strong.map(c => c.x);
  if (anchors.some((x, i) => i > 0 && x - anchors[i - 1] < 10)) return null;
  return anchors;
}

function alignRecord(row: RecordRow, anchors: number[]): string[] | null {
  const result = anchors.map(() => "");
  for (const item of row.fragments) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const distance = Math.abs(item.x - anchors[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    // Never invent a cell placement if the original native word's start
    // doesn't agree with a well-supported column anchor.
    if (bestIndex < 0 || bestDistance > 8 || result[bestIndex]) return null;
    result[bestIndex] = item.text;
  }
  if (result.filter(Boolean).length < anchors.length - 1) return null;
  return result;
}

export function hasCollapsedSerialAndIdColumns(table: LogicalTable): boolean {
  if (table.columnCount > 7) return false;
  const suspicious = table.rows.filter(row => {
    const first = row.cells.find(c => c.columnIndex === 0)?.text ?? "";
    return /^[0-9]{1,4}\s+[0-9]{3,8}\s+\S/.test(first.trim());
  });
  return suspicious.length >= 3;
}

/**
 * Recover a continuous set of *data records* from consecutively paginated
 * native-text tables. When printed spreadsheet row numbers are present
 * outside the eight data fields, omit only that verified auxiliary counter.
 * Original multi-line source headers are NOT claimed to be reconstructed:
 * field labels are explicit placeholders requiring review.
 */
export function reconstructConsecutiveNativeTable(
  tables: readonly LogicalTable[],
): PdfXlsxInput | null {
  if (tables.length < 2 || tables.length > 12) return null;
  const pages = tables.map(nativeRecords);
  if (pages.some(p => p === null)) return null;
  const safePages = pages as PageTable[];
  for (let i = 1; i < safePages.length; i++) {
    if (safePages[i].page !== safePages[i - 1].page + 1 ||
        safePages[i].records[0].serial !==
        safePages[i - 1].records[safePages[i - 1].records.length - 1].serial + 1) {
      return null;
    }
  }
  const rows = safePages.flatMap(p => p.records);
  if (rows.length > 2000) return null;
  const anchors = alignedColumns(rows);
  if (!anchors) return null;
  const placed = rows.map(row => alignRecord(row, anchors));
  if (placed.some(row => row === null)) return null;
  const safe = placed as string[][];
  // For 9 stable starts, the first is a serial printed OUTSIDE the eight
  // field headings. The adjacent ID starts at the second aligned position.
  const isMarginCounter = anchors.length === 9 &&
    safe.every((row, i) => Number(row[0]) === rows[i].serial &&
      /^[0-9]{3,8}$/.test(row[1]));
  if (anchors.length === 9 && !isMarginCounter) return null;
  const offset = isMarginCounter ? 1 : 0;
  const width = anchors.length - offset;
  const body = safe.map(row => row.slice(offset));
  if (body.some(row => row.length !== width ||
      row.filter(Boolean).length < width - 1)) return null;
  return {
    tables: [{
      name: "Table 1",
      rows: [Array.from({ length: width }, (_, i) => "Column " + (i + 1)), ...body],
    }],
    reviewNotes: [
      "EXTRACTION NOT VERIFIED: columns recovered from strongly aligned native PDF text positions; verify each field against the original PDF.",
      "Original multi-line headers were not reliably reconstructed; Column 1, Column 2 etc. are placeholders, NOT original PDF headings.",
      "Consecutive data records from PDF pages " + safePages.map(p => p.page).join(", ") +
        " were joined using stable column anchors and checked serial continuity.",
      ...(offset ? ["A printed worksheet row counter outside the eight data fields was omitted from the exported data columns."] : []),
      "Page-by-page visual layout, colors, merged cells and formatting are not preserved. Values are literal strings.",
    ],
  };
}
