/**
 * Optional review evidence for born-digital PDFs. Do not replace OCR: a PDF
 * text layer can be missing, stale, hidden, or in an unexpected order.
 * The caller labels this separately and only when substantial text exists.
 */
export type EmbeddedPdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
};

type TextLine = { y: number; items: EmbeddedPdfTextItem[] };

function readableItems(items: EmbeddedPdfTextItem[], pageWidth: number) {
  return items.filter((item) =>
    item.text.trim().length > 0 &&
    Number.isFinite(item.x) && Number.isFinite(item.y) &&
    Number.isFinite(item.width) && item.width >= 0 &&
    item.x >= 0 && item.x <= pageWidth &&
    item.x + item.width <= pageWidth + 2,
  );
}

function groupTextLines(items: EmbeddedPdfTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  for (const item of items.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
    // PDF text items can use slightly different baselines within one row.
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.sort((a, b) => a.y - b.y);
}

function linesAsText(items: EmbeddedPdfTextItem[]): string {
  return groupTextLines(items).map((line) =>
    line.items
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text.trim())
      .join(" ")
      .replace(/\s+([,.;:!?])/g, "$1"),
  ).filter(Boolean).join("\n");
}

/**
 * A cautious, geometric preview that reads a left content column to the end
 * before a right sidebar. It never invents words or changes the OCR transcript.
 * If column evidence is not strong, the digital text is still presented in
 * visual row order and explicitly marked as a preview.
 */
export function reconstructEmbeddedPdfTextPreview(
  items: EmbeddedPdfTextItem[],
  pageWidth: number,
): string | null {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return null;
  const valid = readableItems(items, pageWidth);
  const characters = valid.reduce((sum, item) => sum + item.text.trim().length, 0);
  if (valid.length < 12 || characters < 100) return null;

  let best: { left: EmbeddedPdfTextItem[]; right: EmbeddedPdfTextItem[]; score: number } | null = null;
  for (let ratio = 0.54; ratio <= 0.72; ratio += 0.02) {
    const x = pageWidth * ratio;
    const left = valid.filter((item) => item.x + item.width <= x);
    const right = valid.filter((item) => item.x >= x);
    const crossing = valid.length - left.length - right.length;
    if (left.length < 10 || right.length < 8 || crossing > 1) continue;
    if (groupTextLines(left).length < 5 || groupTextLines(right).length < 5) continue;
    const leftTop = Math.min(...left.map((item) => item.y));
    const rightTop = Math.min(...right.map((item) => item.y));
    if (Math.abs(leftTop - rightTop) > 60) continue;
    const score = Math.min(left.length, right.length) - crossing * 10;
    if (!best || score > best.score) best = { left, right, score };
  }
  if (!best) {
    return "[EMBEDDED TEXT - VISUAL ROW ORDER, REVIEW LAYOUT]\n" +
      linesAsText(valid);
  }
  return "[EMBEDDED TEXT - LEFT CONTENT COLUMN]\n" +
    linesAsText(best.left) +
    "\n\n[EMBEDDED TEXT - RIGHT SIDEBAR]\n" +
    linesAsText(best.right);
}

/** Browser-only; source text is read from the PDF locally using PDF.js. */
export async function extractEmbeddedPdfTextPreviews(
  file: File,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  if (typeof window === "undefined") return new Map();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const previews = new Map<number, string>();
  try {
    const doc = await task.promise;
    for (const pageNumber of pageNumbers) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) continue;
      const page = await doc.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const height = page.getViewport({ scale: 1 }).height;
        const width = page.getViewport({ scale: 1 }).width;
        const items: EmbeddedPdfTextItem[] = content.items.flatMap((item) => {
          if (!("str" in item) || typeof item.str !== "string") return [];
          const [a, b, c, d, tx, ty] = item.transform;
          if (![a, b, c, d, tx, ty].every(Number.isFinite)) return [];
          return [{
            text: item.str,
            x: tx,
            y: height - ty,
            width: Math.max(0, item.width),
          }];
        });
        const preview = reconstructEmbeddedPdfTextPreview(items, width);
        if (preview) previews.set(pageNumber, preview);
      } finally {
        page.cleanup();
      }
    }
    return previews;
  } finally {
    await task.destroy();
  }
}
