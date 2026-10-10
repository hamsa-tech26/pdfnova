import type { PdfV4OcrPageResult, PdfV4OcrWord } from "./ocrRecognizer";

/**
 * OCR text is evidence, not a structured/form-verified transcript.
 * Keep the recognizer's output intact and add review cues where structure
 * or exact identifiers could be silently misinterpreted.
 */
export type PdfV4OcrExport = {
  text: string;
  warnings: string[];
  columnPreview: string | null;
};

type Line = { y: number; words: PdfV4OcrWord[] };

function wordHeight(word: PdfV4OcrWord): number {
  return Math.max(1, word.bounds.y1 - word.bounds.y0);
}

function makeLines(words: PdfV4OcrWord[]): Line[] {
  const sorted = words
    .filter((word) =>
      word.text.trim().length > 0 &&
      Number.isFinite(word.bounds.x0) &&
      Number.isFinite(word.bounds.x1) &&
      Number.isFinite(word.bounds.y0) &&
      Number.isFinite(word.bounds.y1) &&
      word.bounds.x1 > word.bounds.x0 &&
      word.bounds.y1 > word.bounds.y0,
    )
    .sort((a, b) =>
      (a.bounds.y0 + a.bounds.y1) / 2 - (b.bounds.y0 + b.bounds.y1) / 2 ||
      a.bounds.x0 - b.bounds.x0,
    );
  const lines: Line[] = [];
  for (const word of sorted) {
    const y = (word.bounds.y0 + word.bounds.y1) / 2;
    const tolerance = Math.max(3, wordHeight(word) * 0.55);
    const line = lines.find((item) => Math.abs(item.y - y) <= tolerance);
    if (line) {
      line.words.push(word);
    } else {
      lines.push({ y, words: [word] });
    }
  }
  return lines.sort((a, b) => a.y - b.y);
}

function linesToText(lines: Line[]): string {
  return lines
    .filter((line) => line.words.length > 0)
    .map((line) =>
      line.words
        .slice()
        .sort((a, b) => a.bounds.x0 - b.bounds.x0)
        .map((word) => word.text.trim())
        .join(" "),
    )
    .join("\n");
}

/**
 * Conservative alternate ordering; the raw OCR is always retained.
 * Column detection is skipped for checkbox grids, which need real
 * cell-level relationships rather than a misleading prose rearrangement.
 */
export function suggestPdfV4OcrColumnPreview(
  page: PdfV4OcrPageResult,
): string | null {
  const raw = page.text || "";
  if (/\bPass\s+Fail\s+N\s*\/?\s*A\b/i.test(raw)) return null;
  // Avoid expensive layout heuristics on exceptionally large OCR pages.
  if (page.renderedWidth <= 0 || page.words.length < 25 || page.words.length > 4000) return null;
  const words = page.words.filter((word) =>
    word.text.trim() &&
    Number.isFinite(word.bounds.x0) &&
    Number.isFinite(word.bounds.x1) &&
    word.bounds.x1 > word.bounds.x0 &&
    Number.isFinite(word.bounds.y0) &&
    Number.isFinite(word.bounds.y1),
  );
  if (words.length < 25) return null;

  let best: { split: number; crossing: number; balance: number } | null = null;
  for (let pct = 35; pct <= 80; pct += 1) {
    const split = (page.renderedWidth * pct) / 100;
    const left = words.filter((w) => w.bounds.x1 < split);
    const right = words.filter((w) => w.bounds.x0 > split);
    const crossing = words.length - left.length - right.length;
    if (left.length < 10 || right.length < 10 || crossing > words.length * 0.025) {
      continue;
    }
    const balance = Math.min(left.length, right.length) / words.length;
    if (!best || crossing < best.crossing ||
        (crossing === best.crossing && balance > best.balance)) {
      best = { split, crossing, balance };
    }
  }
  if (!best) return null;
  const left = makeLines(words.filter((w) => w.bounds.x1 < best!.split));
  const right = makeLines(words.filter((w) => w.bounds.x0 > best!.split));
  if (left.length < 4 || right.length < 4) return null;
  // This is a review aid rather than a replacement for source reading order.
  return "[LEFT COLUMN - CHECK AGAINST ORIGINAL]\n" +
    linesToText(left) + "\n\n[RIGHT COLUMN - CHECK AGAINST ORIGINAL]\n" +
    linesToText(right);
}

export function buildPdfV4OcrTextExport(
  page: PdfV4OcrPageResult,
): PdfV4OcrExport {
  const text = page.text.trim();
  const warnings: string[] = [];
  if (!Number.isFinite(page.confidence) || page.confidence < 75) {
    warnings.push("Low OCR confidence; verify text against the original PDF.");
  }
  if (/\b(?:record\s+id|invoice\s+id|application\s+id|serial\s+number|reference\s*(?:number|:)|facility\s+code|package\s+code)\b/i.test(text)) {
    warnings.push("Verify exact identifiers character by character (for example O/0, I/1 and 7/T).");
  }
  if (/\bPass\s+Fail\s+N\s*\/?\s*A\b/i.test(text) && /(?:^|\s)X(?:\s|$)/m.test(text)) {
    warnings.push("Checkbox status UNKNOWN from plain TXT: X marks may not retain Pass/Fail/N/A column associations. Verify against the original form.");
  }
  const columnPreview = suggestPdfV4OcrColumnPreview(page);
  if (columnPreview) {
    warnings.push("Possible multiple columns: raw OCR reading order may interleave main text and sidebar. The alternate view is unverified.");
  }
  return { text, warnings, columnPreview };
}

export function formatPdfV4OcrPageExport(
  page: PdfV4OcrPageResult,
): string {
  const output = buildPdfV4OcrTextExport(page);
  const sections = [`--- Page ${page.pageNumber} ---\n${output.text}`];
  if (output.warnings.length) {
    sections.push("[OCR REVIEW NOTES - NOT VERIFIED]\n" +
      output.warnings.map((warning) => "- " + warning).join("\n"));
  }
  if (output.columnPreview) {
    sections.push("[OPTIONAL COLUMN-AWARE PREVIEW - NOT VERIFIED]\n" +
      output.columnPreview);
  }
  return sections.join("\n\n");
}
