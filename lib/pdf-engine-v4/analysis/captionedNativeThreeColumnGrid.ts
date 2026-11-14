import type { PdfLine, PdfParagraphBlock, PdfVisualBlock, PdfWord } from "../model/types";
import type { LogicalTable } from "../model/logicalTable";

/**
 * Narrowly recover separately captioned native 3-column service grids whose
 * five physical rows are separate visual blocks. No OCR, invented cells, or
 * global detector-threshold changes. Requires a repeated numeric centre
 * column, a stable right edge in the final column and a printed TOTAL row.
 */
const CAPTION = /^table\s+(?:[a-z]|\d{1,3})\s*[-–—:.]\s*\S/i;
const NUMBER = /^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/u;
const TOLERANCE = 10;
const MAX_ROWS = 24;
export type CaptionedThreeColumnGrid = {
  block: PdfParagraphBlock;
  sourceRows: PdfVisualBlock[];
};

function onlyLine(block: PdfVisualBlock): PdfLine | null {
  if ((block.type !== "paragraph" && block.type !== "heading") ||
      block.lines.length !== 1) return null;
  return block.lines[0] ?? null;
}

function nativeCells(line: PdfLine): PdfWord[] | null {
  if (line.words.length !== 3 ||
      line.words.some(word =>
        word.extractionProvenance?.source !== "native-pdf" ||
        !Number.isFinite(word.bounds.x) ||
        !Number.isFinite(word.bounds.y) ||
        !Number.isFinite(word.bounds.width) ||
        word.bounds.width <= 0 ||
        !word.text.trim() || word.text.length > 64)) return null;
  const cells = [...line.words].sort((a, b) => a.bounds.x - b.bounds.x);
  if (cells.slice(1).some((cell, index) =>
      cell.bounds.x - cells[index].bounds.x < 25 ||
      cells[index].bounds.x + cells[index].bounds.width > cell.bounds.x + 2))
    return null;
  return cells;
}

const right = (word: PdfWord) => word.bounds.x + word.bounds.width;
const isHeader = (cells: PdfWord[]) =>
  cells.every(cell => /[A-Za-z]/.test(cell.text) &&
    cell.text.trim().length <= 32) &&
  !NUMBER.test(cells[1].text.trim());

export function findCaptionedNativeThreeColumnGrids(
  blocks: readonly PdfVisualBlock[],
): CaptionedThreeColumnGrid[] {
  const found: CaptionedThreeColumnGrid[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const caption = blocks[index];
    const captionLine = onlyLine(caption);
    if (!captionLine || !CAPTION.test(captionLine.text.trim()) ||
        captionLine.words.some(word => word.extractionProvenance?.source !== "native-pdf"))
      continue;
    const headerBlock = blocks[index + 1];
    const headerLine = headerBlock && onlyLine(headerBlock);
    const header = headerLine && nativeCells(headerLine);
    if (!headerLine || !header || !isHeader(header) ||
        caption.pageNumber !== headerBlock.pageNumber) continue;
    const captionGap = captionLine.bounds.y -
      (headerLine.bounds.y + headerLine.bounds.height);
    if (captionGap < 0 || captionGap > 60) continue;
    const rows: { line: PdfLine; cells: PdfWord[]; block: PdfVisualBlock }[] = [];
    let previousLine = headerLine;
    let firstStep: number | null = null;
    for (let cursor = index + 2;
         cursor < blocks.length && rows.length < MAX_ROWS - 1;
         cursor++) {
      const block = blocks[cursor];
      const line = onlyLine(block);
      const cells = line && nativeCells(line);
      if (!line || !cells || block.pageNumber !== caption.pageNumber) break;
      if (!NUMBER.test(cells[1].text.trim()) ||
          !/[A-Za-z]/.test(cells[0].text) ||
          !(/^[A-Za-z][A-Za-z ]*$/.test(cells[2].text.trim()) ||
            (cells[0].text.trim().toUpperCase() === "TOTAL" &&
             cells[2].text.trim() === "-"))) break;
      const step = previousLine.bounds.y - line.bounds.y;
      if (step < 20 || step > 56 ||
          (firstStep !== null && Math.abs(step - firstStep) > 3)) break;
      if (Math.abs(cells[0].bounds.x - header[0].bounds.x) > TOLERANCE ||
          Math.abs(right(cells[1]) - right(header[1])) > TOLERANCE ||
          Math.abs(right(cells[2]) - right(header[2])) > TOLERANCE)
        break;
      if (firstStep === null) firstStep = step;
      rows.push({ line, cells, block });
      previousLine = line;
      if (cells[0].text.trim().toUpperCase() === "TOTAL") break;
    }
    if (rows.length < 4 ||
        rows[rows.length - 1].cells[0].text.trim().toUpperCase() !== "TOTAL" ||
        rows.slice(0, -1).some(row =>
          row.cells[0].text.trim().toUpperCase() === "TOTAL"))
      continue;
    const sourceRows = [headerBlock, ...rows.map(row => row.block)];
    const lines = [headerLine, ...rows.map(row => row.line)];
    const words = lines.flatMap(line => line.words);
    const minX = Math.min(...words.map(word => word.bounds.x));
    const minY = Math.min(...words.map(word => word.bounds.y));
    const maxX = Math.max(...words.map(word => right(word)));
    const maxY = Math.max(...words.map(word => word.bounds.y + word.bounds.height));
    found.push({
      sourceRows,
      block: {
        id: "captioned-native-three-grid-" + caption.pageNumber + "-" + caption.id,
        type: "paragraph",
        pageNumber: caption.pageNumber,
        bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        lines,
        text: lines.map(line => line.text).join(" "),
        confidence: Math.min(...sourceRows.map(block => block.confidence)),
      },
    });
    index += sourceRows.length;
  }
  return found;
}

/** Preserve the three exact native headings only when all source words survived. */
export function restoreCaptionedThreeColumnHeader(
  table: LogicalTable, region: PdfVisualBlock,
): LogicalTable {
  if (!region.id.startsWith("captioned-native-three-grid-") ||
      region.type !== "paragraph" || table.columnCount !== 3 ||
      !table.rows[0] || table.rows[0].cells.length !== 3) return table;
  const source = region.lines[0] && nativeCells(region.lines[0]);
  const header = table.rows[0];
  if (!source || !header) return table;
  const assigned = header.cells.flatMap(cell => cell.words);
  if (assigned.length !== source.length ||
      new Set(assigned.map(word => word.id)).size !== source.length ||
      source.some(word => !assigned.some(actual => actual.id === word.id)))
    return table;
  const cells = header.cells.map((cell, index) => {
    const word = source[index];
    return {
      ...cell,
      text: word.text,
      words: [word],
      bounds: word.bounds,
      originalNativeText: word.text,
      extractionProvenance: {
        source: "native-pdf" as const, wordCount: 1, nativeWordCount: 1,
        ocrWordCount: 0, unknownWordCount: 0,
        pageNumbers: [word.pageNumber],
      },
    };
  });
  return { ...table, rows: [{ ...header, cells }, ...table.rows.slice(1)] };
}
