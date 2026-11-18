import type { PdfLine, PdfParagraphBlock, PdfVisualBlock, PdfWord } from "../model/types";

/**
 * Source-first short numeric tables: a real caption, a small multi-line
 * header, and at least five distinct physical rows sharing seven native-PDF
 * column positions. This is deliberately narrower than the general table
 * scorer: prose, missing source provenance, OCR, and weak columns must not
 * gain an automatic workbook export merely by lowering a score threshold.
 */
export type CaptionedShortNumericGrid = {
  sourceBlock: PdfParagraphBlock;
  firstLineIndex: number;
  lastLineIndex: number;
  block: PdfParagraphBlock;
};

const TABLE_CAPTION = /^\s*table\s+\d{1,3}(?:[-.]\d{1,3})?\s*[.:\s]/iu;
const NUMERIC_CELL = /^[+\-−]?\d[\d,.]*(?:%)?$/u;
const MIN_BODY_ROWS = 5;
const MAX_BODY_ROWS = 12;
const BODY_COLUMNS = 7;
const COLUMN_TOLERANCE = 8;

function wordsByX(line: PdfLine): PdfWord[] | null {
  if (line.words.length !== BODY_COLUMNS) return null;
  if (line.words.some(word =>
    word.extractionProvenance?.source !== "native-pdf" ||
    !word.text.trim() ||
    ![word.bounds.x, word.bounds.y, word.bounds.width, word.bounds.height].every(Number.isFinite) ||
    word.bounds.width <= 0 || word.bounds.height <= 0
  )) return null;
  const sorted = [...line.words].sort((a, b) => a.bounds.x - b.bounds.x);
  if (sorted[0].text.trim().length > 25 ||
    sorted.slice(1).filter(word => NUMERIC_CELL.test(word.text.trim())).length < 6 ||
    sorted[BODY_COLUMNS - 1].bounds.x - sorted[0].bounds.x < 250) return null;
  if (sorted.slice(1).some((word, index) =>
    word.bounds.x - sorted[index].bounds.x < 22)) return null;
  return sorted;
}

function centerY(line: PdfLine): number {
  return line.bounds.y + line.bounds.height / 2;
}

function samePhysicalColumns(base: PdfWord[], next: PdfWord[]): boolean {
  return base.every((word, i) =>
    Math.abs(word.bounds.x - next[i].bounds.x) <= COLUMN_TOLERANCE);
}

function nativeHeader(line: PdfLine): boolean {
  return line.words.length > 0 &&
    line.words.length <= 5 &&
    line.words.every(word =>
      word.extractionProvenance?.source === "native-pdf" &&
      word.text.trim().length > 0 &&
      word.text.length <= 45);
}

function boundedBlock(
  source: PdfParagraphBlock,
  lines: PdfLine[],
  index: number,
): PdfParagraphBlock {
  const words = lines.flatMap(line => line.words);
  const x = Math.min(...words.map(word => word.bounds.x));
  const y = Math.min(...words.map(word => word.bounds.y));
  const right = Math.max(...words.map(word => word.bounds.x + word.bounds.width));
  const top = Math.max(...words.map(word => word.bounds.y + word.bounds.height));
  return {
    ...source,
    id: "native-captioned-short-numeric-" + source.pageNumber + "-" + source.id + "-" + index,
    lines,
    text: lines.map(line => line.text).join(" "),
    bounds: { x, y, width: right - x, height: top - y },
  };
}

export function findNativeCaptionedShortNumericGrids(
  blocks: readonly PdfVisualBlock[],
): CaptionedShortNumericGrid[] {
  const found: CaptionedShortNumericGrid[] = [];
  for (const source of blocks) {
    if (source.type !== "paragraph" ||
      source.lines.length < 11 || source.lines.length > 160) continue;
    const lines = source.lines;
    const candidates = lines.map(wordsByX);
    for (let start = 0; start <= lines.length - MIN_BODY_ROWS; start++) {
      if (!candidates[start]) continue;
      const first = candidates[start]!;
      let end = start;
      while (end + 1 < lines.length && end - start + 1 < MAX_BODY_ROWS) {
        const next = candidates[end + 1];
        const dy = centerY(lines[end]) - centerY(lines[end + 1]);
        if (!next || dy < 9 || dy > 29 || !samePhysicalColumns(first, next)) break;
        end++;
      }
      if (end - start + 1 < MIN_BODY_ROWS) continue;

      // The caption must be an actual preceding source line, not table-looking
      // prose on the same physical row. Limit the header to six short lines.
      const captionIndex = lines.findIndex((line, index) =>
        index < start && index >= start - 7 &&
        TABLE_CAPTION.test(line.text) &&
        line.words.every(word => word.extractionProvenance?.source === "native-pdf") &&
        centerY(line) - centerY(lines[start]) >= 30 &&
        centerY(line) - centerY(lines[start]) <= 110);
      if (captionIndex < 0) continue;
      const header = lines.slice(captionIndex + 1, start);
      if (header.length < 1 || header.length > 6 || !header.every(nativeHeader)) continue;
      const selected = lines.slice(captionIndex + 1, end + 1);
      found.push({
        sourceBlock: source,
        firstLineIndex: captionIndex + 1,
        lastLineIndex: end,
        block: boundedBlock(source, selected, captionIndex + 1),
      });
      start = end;
      if (found.length >= 3) return found;
    }
  }
  return found;
}
