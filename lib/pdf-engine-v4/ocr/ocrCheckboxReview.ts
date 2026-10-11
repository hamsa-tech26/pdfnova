import type { PdfV4OcrPageResult, PdfV4OcrWord } from "./ocrRecognizer";

/**
 * Non-authoritative visual-position clues for OCR checklists.
 * Never turn an OCR X into a definitive Pass/Fail/N/A answer:
 * OCR may omit or displace marks, and underlying printed forms vary.
 */
export type PdfV4OcrCheckboxCandidate = {
  rowLabel: string;
  alignedWith: "Pass" | "Fail" | "N/A";
  markerText: "X";
};

type Header = {
  label: PdfV4OcrCheckboxCandidate["alignedWith"];
  word: PdfV4OcrWord;
};
const labels: ReadonlyArray<Header["label"]> = ["Pass", "Fail", "N/A"];

function centerX(word: PdfV4OcrWord) {
  return (word.bounds.x0 + word.bounds.x1) / 2;
}
function centerY(word: PdfV4OcrWord) {
  return (word.bounds.y0 + word.bounds.y1) / 2;
}
function height(word: PdfV4OcrWord) {
  return word.bounds.y1 - word.bounds.y0;
}
function valid(word: PdfV4OcrWord, width: number, pageHeight: number) {
  return word.text.trim() !== "" &&
    Number.isFinite(word.confidence) &&
    Number.isFinite(word.bounds.x0) &&
    Number.isFinite(word.bounds.x1) &&
    Number.isFinite(word.bounds.y0) &&
    Number.isFinite(word.bounds.y1) &&
    word.bounds.x1 > word.bounds.x0 &&
    word.bounds.y1 > word.bounds.y0 &&
    word.bounds.x0 >= 0 &&
    word.bounds.x1 <= width &&
    word.bounds.y0 >= 0 &&
    word.bounds.y1 <= pageHeight;
}

function headerLabel(text: string): Header["label"] | null {
  const token = text.trim().replace(/[./\\]/g, "").toUpperCase();
  if (token === "PASS") return "Pass";
  if (token === "FAIL") return "Fail";
  if (token === "NA") return "N/A";
  return null;
}

function findHeader(words: PdfV4OcrWord[]): Header[] | null {
  const headerWords = words
    .map((word) => ({ word, label: headerLabel(word.text) }))
    .filter((candidate): candidate is { word: PdfV4OcrWord; label: Header["label"] } =>
      candidate.label !== null,
    );

  const combinations: Header[][] = [];
  for (const start of headerWords.filter((candidate) => candidate.label === "Pass")) {
    const next = headerWords.find((candidate) =>
      candidate.label === "Fail" &&
      centerX(candidate.word) > centerX(start.word) + 12 &&
      Math.abs(centerY(candidate.word) - centerY(start.word)) <=
        Math.max(height(start.word), height(candidate.word)) * 0.6,
    );
    if (!next) continue;
    const last = headerWords.find((candidate) =>
      candidate.label === "N/A" &&
      centerX(candidate.word) > centerX(next.word) + 12 &&
      Math.abs(centerY(candidate.word) - centerY(start.word)) <=
        Math.max(height(start.word), height(candidate.word)) * 0.6,
    );
    if (last) combinations.push([
      {label: "Pass", word: start.word},
      {label: "Fail", word: next.word},
      {label: "N/A", word: last.word},
    ]);
  }
  // Multiple candidate checklist headers cannot be safely disambiguated.
  return combinations.length === 1 ? combinations[0] : null;
}

export function inspectPdfV4OcrCheckboxCandidates(
  page: PdfV4OcrPageResult,
): PdfV4OcrCheckboxCandidate[] {
  if (page.words.length > 4000 || page.words.length < 7 ||
      page.renderedWidth <= 0 || page.renderedHeight <= 0) return [];

  const words = page.words.filter((w) =>
    valid(w, page.renderedWidth, page.renderedHeight),
  );
  const header = findHeader(words);
  if (!header) return [];
  const headerY = Math.max(...header.map((h) => h.word.bounds.y1));
  const firstColumnStart = header[0].word.bounds.x0;
  const gap = Math.min(
    centerX(header[1].word) - centerX(header[0].word),
    centerX(header[2].word) - centerX(header[1].word),
  );
  if (gap < 24) return [];
  const maxHorizontalOffset = gap * 0.38;
  const marks = words.filter((w) =>
    /^[Xx]$/.test(w.text.trim()) &&
    w.confidence >= 65 &&
    w.bounds.y0 > headerY + 2,
  );
  const observations: PdfV4OcrCheckboxCandidate[] = [];
  for (const mark of marks) {
    const y = centerY(mark);
    const lineTolerance = Math.max(7, height(mark) * 0.65);
    // More than one X on one OCR line is ambiguous, not a status assertion.
    if (marks.some((other) =>
      other !== mark && Math.abs(centerY(other) - y) < lineTolerance,
    )) continue;

    const column = header.reduce<Header | null>((best, candidate) =>
      Math.abs(centerX(candidate.word) - centerX(mark)) <
      (best ? Math.abs(centerX(best.word) - centerX(mark)) : Infinity)
        ? candidate : best,
    null);
    if (!column || Math.abs(centerX(column.word) - centerX(mark)) > maxHorizontalOffset) {
      continue;
    }
    const rowLabel = words
      .filter((w) =>
        w !== mark &&
        centerX(w) < firstColumnStart - 8 &&
        Math.abs(centerY(w) - y) <= lineTolerance &&
        !/^[|_\\-]+$/.test(w.text.trim()),
      )
      .sort((a, b) => a.bounds.x0 - b.bounds.x0)
      .map((w) => w.text.trim())
      .join(" ")
      .slice(0, 100);
    if (!rowLabel) continue;

    observations.push({
      rowLabel,
      alignedWith: column.label,
      markerText: "X",
    });
    if (observations.length >= 12) break;
  }
  return observations;
}

/** The heading explicitly prevents treating visual proximity as a verified checkbox state. */
export function formatPdfV4OcrCheckboxCandidates(
  observations: PdfV4OcrCheckboxCandidate[],
): string | null {
  if (!observations.length) return null;
  return observations.map((candidate) =>
    candidate.rowLabel + " — OCR X appears near " + candidate.alignedWith +
    " (UNVERIFIED; verify original image)",
  ).join("\n");
}
