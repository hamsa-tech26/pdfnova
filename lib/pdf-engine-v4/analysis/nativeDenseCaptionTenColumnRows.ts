import type { PdfLine, PdfVisualBlock, PdfWord } from "../model/types";
import type { ColumnCandidate } from "./stableColumnDetector";
import type { AdaptiveRowDetectionResult, LogicalRowCandidate } from "./adaptiveRowDetector";

/**
 * A conservative, source-physical recovery for dense, ten-column, captioned
 * native grids. It is not semantic/independent cell certification.
 *
 * The generic row heuristic can mistake tiny raised footnote numerals for
 * serial numbers and join dozens of adjacent source records into one cell.
 * Only nine strictly positioned native numeric cells repeated over at least
 * twenty separate source lines can enable this recovery. All original words
 * are preserved, including wrapped first-column text and raised footnotes.
 */
const DECIMAL = /^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/u;

function createRow(lines: PdfLine[], index: number, reason: string): LogicalRowCandidate {
  const words = lines.flatMap(line => line.words);
  const first = lines[0];
  const last = lines[lines.length - 1];
  return {
    id: `logical-row-${index}`,
    index,
    lines,
    words,
    startY: first.bounds.y + first.bounds.height / 2,
    endY: last.bounds.y + last.bounds.height / 2,
    isNewRecord: true,
    score: 82,
    confidence: 0.82,
    breakdown: {
      serialNumber: 0,
      verticalGap: 0,
      leftAlignment: 0,
      emptyLeadingColumns: 0,
      wrappedText: 0,
    },
    reason,
  };
}

function inColumn(word: PdfWord, column: ColumnCandidate): boolean {
  return word.bounds.x >= column.leftBoundary &&
    word.bounds.x < column.rightBoundary;
}

export function recoverDenseNativeCaptionTenColumnRows(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
): AdaptiveRowDetectionResult | null {
  if (block.type !== "paragraph" ||
    !block.id.startsWith("caption-table-") ||
    columns.length !== 10 ||
    block.lines.length < 35 || block.lines.length > 110
  ) return null;

  const lines = [...block.lines].sort((a, b) => b.bounds.y - a.bounds.y);
  if (lines.some(line => !line.words.length || line.words.some(word =>
    word.extractionProvenance?.source !== "native-pdf"
  ))) return null;

  const ordered = [...columns].sort((a, b) => a.x - b.x);
  const dataIndexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const numbers = line.words.filter(word => DECIMAL.test(word.text.trim()) &&
      ordered.slice(1).some(col => inColumn(word, col)));
    // A genuine row has all NINE, separately positioned numeric values and
    // at least one native label word to the left of the numeric columns.
    if (numbers.length !== 9 || !ordered.slice(1).every(column =>
      numbers.filter(word => inColumn(word, column)).length === 1
    ) || !line.words.some(word => inColumn(word, ordered[0]) &&
      !DECIMAL.test(word.text.trim()))) continue;
    dataIndexes.push(i);
  }

  if (dataIndexes.length < 20 ||
    dataIndexes.length < Math.ceil(lines.length * 0.58) ||
    dataIndexes[0] < 4 || dataIndexes[0] > 15 ||
    lines.length - 1 - dataIndexes[dataIndexes.length - 1] > 2
  ) return null;

  const rowGroups: PdfLine[][] = [lines.slice(0, dataIndexes[0])];
  for (let i = 0; i < dataIndexes.length; i++) {
    const current = dataIndexes[i];
    const previous = i === 0 ? current - 1 : dataIndexes[i - 1];
    const intervening = i === 0 ? [] : lines.slice(previous + 1, current);
    // Wrapped text or source superscript may precede the numeric record.
    // Never absorb intervening numeric columns or a separate possible table.
    if (intervening.length > 2 || intervening.some(line => line.words.some(word =>
      // A raised source footnote may sit just right of the first-column
      // alignment band, but remains well left of the first numeric anchor.
      word.bounds.x + word.bounds.width >= ordered[1].x - 8
    ))) return null;
    if (i > 0) {
      const gap = lines[previous].bounds.y - lines[current].bounds.y;
      if (gap < 7 || gap > 36) return null;
    }
    rowGroups.push([...intervening, lines[current]]);
  }

  const rows = rowGroups.map((group, index) => createRow(
    group,
    index,
    index === 0
      ? "native-dense-caption-ten-header-review"
      : "native-dense-caption-ten-body-review",
  ));
  return { rows, confidence: 0.82 };
}

