import type { PdfV4OcrRectangle } from "./ocrRecognizer";

// Run a conservative read of the first page's *actual pixels*, even when
// Tesseract returns no blocks or returns words that it omits from data.text.
// Never infer the title from document semantics or an expected fixture.
export function planTopMarginRecovery(
  bodyText: string,
  width: number,
  height: number,
): PdfV4OcrRectangle | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 400 ||
    height < 500 ||
    bodyText.trim().length < 65
  ) {
    return null;
  }

  const regionHeight = Math.floor(height * 0.22);
  if (regionHeight < 200) {
    return null;
  }

  return {
    left: 0,
    top: 0,
    width: Math.floor(width),
    height: regionHeight,
  };
}

// Use a true cropped image rather than a Tesseract "rectangle" on the
// full-resolution page. The latter may preserve full-page segmentation,
// which omitted this heading in two actual browser exports.
export async function cropTopMarginOcrImage(
  imageDataUrl: string,
  region: PdfV4OcrRectangle,
): Promise<string> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    throw new Error("OCR top-margin crop requires a browser.");
  }

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("OCR image could not be loaded."));
    image.src = imageDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = region.width;
  canvas.height = region.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable for OCR recovery.");
  }

  context.drawImage(
    image,
    region.left,
    region.top,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );
  return canvas.toDataURL("image/png");
}

// Only recover text actually recognized in the top strip. Some source titles
// span multiple lines, and a high-contrast header may include a subtitle.
// Validate every line to avoid promoting body prose or OCR noise to a title.
function normalizeTopHeadingLine(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// Crop recognition may include document metadata beneath the banner.
// Extract only the leading contiguous uppercase heading lines and never
// infer text from a document's meaning or from a known fixture.
function recognizedTopHeadingLines(raw: string): string[] | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (!lines.length) return null;
  const headings: string[] = [];
  for (const line of lines) {
    const letters = line.match(/[A-Za-z]/g) ?? [];
    const capitals = line.match(/[A-Z]/g) ?? [];
    const valid =
      line.length >= 6 &&
      line.length <= 85 &&
      /^[A-Za-z][A-Za-z0-9 ,.:/&()\-]*$/.test(line) &&
      letters.length >= 6 &&
      capitals.length / letters.length >= 0.8;
    if (!valid) {
      if (!headings.length) return null;
      break;
    }
    headings.push(line);
    if (headings.length > 4) return null;
  }
  const joined = headings.join(" ");
  const words = joined.split(/\s+/);
  if (
    joined.length < 8 ||
    joined.length > 255 ||
    words.length < 2 ||
    words.length > 28
  ) return null;
  return headings;
}

export function acceptRecoveredTopHeading(
  rawHeading: string,
  confidence: number,
  bodyText: string,
): string | null {
  if (!Number.isFinite(confidence) || confidence < 78) return null;
  const headings = recognizedTopHeadingLines(rawHeading);
  if (!headings) return null;
  const normalizedBody = normalizeTopHeadingLine(bodyText);
  const missing = headings.filter(
    (heading) => !normalizedBody.includes(normalizeTopHeadingLine(heading)),
  );
  return missing.length ? missing.join("\n") : null;
}

// Reconstruct the banner in source order, retaining the full-page OCR body.
// A second cropped OCR pass sometimes finds lines already in raw OCR and
// sometimes finds only the missing ones. De-duplicate exact heading lines
// near the top of the raw transcript before inserting the complete banner.
// Never discard distant matching body text or modify the original PDF.
export function mergeRecoveredTopHeading(
  rawHeading: string,
  confidence: number,
  bodyText: string,
): string {
  if (!acceptRecoveredTopHeading(rawHeading, confidence, bodyText)) return bodyText;
  const headings = recognizedTopHeadingLines(rawHeading);
  if (!headings) return bodyText;
  const headingKeys = new Set(headings.map(normalizeTopHeadingLine));
  const kept = bodyText.split(/\r?\n/).filter((line, index) => {
    if (index >= 12) return true;
    const key = normalizeTopHeadingLine(line);
    return !key || !headingKeys.has(key);
  });
  return headings.join("\n") + "\n\n" + kept.join("\n").replace(/^\s*\n/, "");
}
