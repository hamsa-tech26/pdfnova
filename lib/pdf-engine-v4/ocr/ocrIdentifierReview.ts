import type { PdfV4OcrRectangle, PdfV4OcrWord } from "./ocrRecognizer";

/**
 * Find a few visually localized reference/ID lines worth a second OCR pass.
 * This does not assert which spelling is correct and is never used to mutate
 * the original OCR transcript. The page-confidence threshold bounds work.
 */
export type PdfV4OcrIdentifierCandidate = {
  primaryText: string;
  rectangle: PdfV4OcrRectangle;
  lowestWordConfidence: number;
};

export type PdfV4OcrIdentifierReview = {
  primaryText: string;
  alternateText: string;
  alternateConfidence: number;
  rectangle: PdfV4OcrRectangle;
  status: "DIFFERENT_UNVERIFIED";
};

const IDENTIFIER_LABEL =
  /\b(?:record\s+id|invoice\s+id|application\s+id|reference(?:\s+(?:number|no))?|facility\s+code|package\s+code|serial\s+(?:number|no))\b\s*:?/i;

function usable(word: PdfV4OcrWord, width: number, height: number) {
  const b = word.bounds;
  return Boolean(word.text.trim()) &&
    Number.isFinite(word.confidence) &&
    [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) &&
    b.x0 >= 0 && b.y0 >= 0 && b.x1 <= width && b.y1 <= height &&
    b.x1 > b.x0 && b.y1 > b.y0;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function findPdfV4OcrIdentifierCandidates(
  words: readonly PdfV4OcrWord[],
  renderedWidth: number,
  renderedHeight: number,
  pageConfidence: number,
  maxCandidates = 3,
): PdfV4OcrIdentifierCandidate[] {
  if (words.length < 2 || words.length > 3000 ||
    renderedWidth <= 0 || renderedHeight <= 0 || maxCandidates < 1) return [];

  const lines: { y: number; words: PdfV4OcrWord[] }[] = [];
  const sorted = words.filter(w => usable(w, renderedWidth, renderedHeight))
    .sort((a, b) => (a.bounds.y0 + a.bounds.y1 - b.bounds.y0 - b.bounds.y1) ||
      a.bounds.x0 - b.bounds.x0);

  for (const word of sorted) {
    const y = (word.bounds.y0 + word.bounds.y1) / 2;
    const height = word.bounds.y1 - word.bounds.y0;
    const line = lines.find(l => Math.abs(l.y - y) <= Math.max(4, height * 0.45));
    if (line) line.words.push(word);
    else lines.push({ y, words: [word] });
  }

  const candidates: PdfV4OcrIdentifierCandidate[] = [];
  for (const line of lines) {
    const items = line.words.sort((a, b) => a.bounds.x0 - b.bounds.x0);
    const primaryText = normalize(items.map(w => w.text).join(" "));
    const label = IDENTIFIER_LABEL.exec(primaryText);
    if (!label) continue;
    const afterLabel = primaryText.slice(label.index + label[0].length).trim();
    // Do not rescan a bare label without a detected value to compare.
    if (!/[A-Z0-9]{2,}/i.test(afterLabel) || primaryText.length > 160) continue;
    const lowestWordConfidence = Math.min(...items.map(w => w.confidence));
    if (pageConfidence >= 90 && lowestWordConfidence >= 85) continue;

    const left = Math.max(0, Math.floor(Math.min(...items.map(w => w.bounds.x0)) - 12));
    const top = Math.max(0, Math.floor(Math.min(...items.map(w => w.bounds.y0)) - 7));
    const right = Math.min(renderedWidth, Math.ceil(Math.max(...items.map(w => w.bounds.x1)) + 12));
    const bottom = Math.min(renderedHeight, Math.ceil(Math.max(...items.map(w => w.bounds.y1)) + 7));
    if (right - left < 20 || bottom - top < 8) continue;
    candidates.push({
      primaryText,
      rectangle: { left, top, width: right - left, height: bottom - top },
      lowestWordConfidence,
    });
    if (candidates.length >= Math.min(3, Math.floor(maxCandidates))) break;
  }
  return candidates;
}

export function comparePdfV4OcrIdentifierReadings(
  candidate: PdfV4OcrIdentifierCandidate,
  alternateText: string,
  alternateConfidence: number,
): PdfV4OcrIdentifierReview | null {
  const primary = normalize(candidate.primaryText);
  const alternative = normalize(alternateText);
  if (!Number.isFinite(alternateConfidence) || alternateConfidence < 50 ||
    alternative.length < Math.max(4, primary.length * 0.4) ||
    alternative.length > Math.min(200, primary.length * 2) ||
    !/[A-Z0-9]/i.test(alternative)) return null;

  const primaryField = IDENTIFIER_LABEL.exec(primary);
  const alternateField = IDENTIFIER_LABEL.exec(alternative);
  // Reject different fields and missing labels rather than comparing two
  // unrelated strings. Compare only actual ID values, not label punctuation.
  if (!primaryField || !alternateField ||
      normalize(primaryField[0]).replace(/[:.]/g, "").toLowerCase() !==
      normalize(alternateField[0]).replace(/[:.]/g, "").toLowerCase()) return null;
  const primaryValue = normalize(primary.slice(primaryField.index + primaryField[0].length));
  const alternativeValue = normalize(alternative.slice(alternateField.index + alternateField[0].length));
  if (!primaryValue || !alternativeValue ||
      primaryValue.toUpperCase() === alternativeValue.toUpperCase()) return null;
  return {
    primaryText: primary,
    alternateText: alternative,
    alternateConfidence,
    rectangle: candidate.rectangle,
    status: "DIFFERENT_UNVERIFIED",
  };
}
