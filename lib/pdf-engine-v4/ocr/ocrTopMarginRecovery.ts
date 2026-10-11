import type {
  PdfV4OcrWord,
  PdfV4OcrRectangle,
} from "./ocrRecognizer";

// Some large display headings are excluded by full-page layout analysis
// even when the body is recognized. Only probe an unrecognized top margin.
export function planTopMarginRecovery(
  words: PdfV4OcrWord[],
  bodyText: string,
  width: number,
  height: number,
): PdfV4OcrRectangle | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 400 ||
    height < 500 ||
    bodyText.trim().length < 65 ||
    words.length < 12
  ) {
    return null;
  }

  const firstTop = Math.min(
    ...words
      .filter((word) =>
        word.text.trim() &&
        word.confidence >= 50 &&
        Number.isFinite(word.bounds.y0) &&
        word.bounds.y0 >= 0,
      )
      .map((word) => word.bounds.y0),
  );

  // Existing OCR content must start below a genuine header-height gap.
  // Do not probe a fully used margin or an anomalously blank half-page.
  if (
    !Number.isFinite(firstTop) ||
    firstTop < height * 0.115 ||
    firstTop > height * 0.38
  ) {
    return null;
  }

  const regionHeight = Math.floor(
    Math.min(
      firstTop - Math.max(14, height * 0.012),
      height * 0.28,
    ),
  );

  if (regionHeight < height * 0.07) {
    return null;
  }

  return {
    left: 0,
    top: 0,
    width: Math.floor(width),
    height: regionHeight,
  };
}

// Only accept a distinct, high-confidence short heading read directly
// from the scanned image. Do not infer the heading from body text.
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
    confidence < 78 ||
    lines.length !== 1
  ) {
    return null;
  }

  const heading = lines[0];
  const tokens = heading.split(" ");

  if (
    heading.length < 8 ||
    heading.length > 85 ||
    tokens.length < 2 ||
    tokens.length > 9 ||
    !/^[A-Za-z][A-Za-z0-9 ,.:/&()\-]*$/.test(heading)
  ) {
    return null;
  }

  const letters = heading.match(/[A-Za-z]/g) ?? [];
  const uppercase = heading.match(/[A-Z]/g) ?? [];
  if (
    letters.length < 7 ||
    uppercase.length / letters.length < 0.8
  ) {
    return null;
  }

  const normalized = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

  if (normalized(bodyText).includes(normalized(heading))) {
    return null;
  }

  return heading;
}
