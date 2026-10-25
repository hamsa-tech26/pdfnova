import {PDFDocument, PDFName, PDFNumber, PDFRawStream} from "pdf-lib";

/** Admission/work budgets, not a hard bound on a browser's PDF image decoder. */
export const REDACTION_LIMITS = Object.freeze({
  inputBytes: 25 * 1024 * 1024,
  pages: 100,
  dimension: 3200,
  pagePixels: 3200 * 3200,
  totalPixels: 120_000_000,
  encodedBytes: 64 * 1024 * 1024,
  outputBytes: 128 * 1024 * 1024,
  sourceImagePixels: 16_000_000,
  totalSourceImagePixels: 64_000_000,
  milliseconds: 120_000,
});

/** Inspect declared image dimensions before PDF.js can decode them, including soft masks. */
export function validateRedactionSourceImages(source: PDFDocument) {
  let total = 0;
  for (const [, object] of source.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    const width = object.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber();
    const height = object.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber();
    const pixels = width * height;
    if (![width, height, pixels].every(n => Number.isSafeInteger(n) && n > 0) ||
        pixels > REDACTION_LIMITS.sourceImagePixels || total + pixels > REDACTION_LIMITS.totalSourceImagePixels) {
      throw new Error("This PDF exceeds the source-image memory budget. Export was withheld before image decoding.");
    }
    total += pixels;
  }
}

export function validateRedactionInput(bytes: number, pages: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > REDACTION_LIMITS.inputBytes ||
      !Number.isSafeInteger(pages) || pages < 1 || pages > REDACTION_LIMITS.pages) {
    throw new Error("Redaction is limited to 25 MB and 100 pages. Export was withheld.");
  }
}

export function createRedactionBudget(now = () => performance.now()) {
  const started = now();
  let pixels = 0;
  let encoded = 0;
  function checkTime() {
    if (now() - started >= REDACTION_LIMITS.milliseconds) {
      throw new Error("Redaction exceeded the two-minute processing limit. Export was withheld.");
    }
  }
  return {
    checkTime,
    admitPage(width: number, height: number) {
      checkTime();
      if (![width, height].every(n => Number.isSafeInteger(n) && n > 0 && n <= REDACTION_LIMITS.dimension) ||
          width * height > REDACTION_LIMITS.pagePixels || pixels + width * height > REDACTION_LIMITS.totalPixels) {
        throw new Error("Redaction exceeded the raster processing budget. Export was withheld.");
      }
      pixels += width * height;
    },
    admitEncoded(bytes: number) {
      encoded += bytes;
      if (!Number.isSafeInteger(bytes) || bytes < 0 || encoded > REDACTION_LIMITS.encodedBytes) {
        throw new Error("Redaction exceeded the encoded image memory budget. Export was withheld.");
      }
    },
  };
}
