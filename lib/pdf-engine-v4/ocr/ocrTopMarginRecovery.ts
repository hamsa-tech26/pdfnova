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
export function acceptRecoveredTopHeading(
  rawHeading: string,
  confidence: number,
  bodyText: string,
): string | null {
  const lines = rawHeading
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  if (
    !Number.isFinite(confidence) ||
    confidence < 78 ||
    lines.length === 0
  ) {
    return null;
  }

  // Read the contiguous heading at the TOP of the crop. The wider crop may
  // also include body lines such as "Notice ID", which are not part of the
  // title and must not cause a valid recovered heading to be discarded.
  // Do not skip a leading invalid line or guess missing characters.
  const headingLines: string[] = [];
  for (const line of lines) {
    const letters = line.match(/[A-Za-z]/g) ?? [];
    const uppercase = line.match(/[A-Z]/g) ?? [];
    const validLine =
      line.length >= 6 &&
      line.length <= 85 &&
      /^[A-Za-z][A-Za-z0-9 ,.:/&()\-]*$/.test(line) &&
      letters.length >= 6 &&
      uppercase.length / letters.length >= 0.8;

    if (!validLine) {
      if (headingLines.length === 0) return null;
      break;
    }

    headingLines.push(line);
    if (headingLines.length > 4) return null;
  }

  if (headingLines.length === 0) return null;
  const heading = headingLines.join(" ");
  const tokens = heading.split(/\s+/);
  if (
    heading.length < 8 ||
    heading.length > 255 ||
    tokens.length < 2 ||
    tokens.length > 28
  ) {
    return null;
  }

  const normalized = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const normalizedBody = normalized(bodyText);
  // Exclude already-recognized lines; never rewrite primary OCR text.
  const missingLines = headingLines.filter(
    (line) => !normalizedBody.includes(normalized(line)),
  );
  return missingLines.length ? missingLines.join("\n") : null;
}
