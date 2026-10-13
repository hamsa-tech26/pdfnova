import type { PdfV4OcrPageResult } from "./ocrRecognizer";

export type LowResolutionRetryRegion = {
  left: number; top: number; width: number; height: number;
};

/**
 * Extra OCR is expensive: require tangible evidence of damaged text or low
 * page confidence plus an exact-identifier label. No fixture-specific IDs,
 * names, or corrections belong in this decision.
 */
export function shouldReviewLowResolutionOcr(
  text: string, confidence: number,
): boolean {
  if (text.trim().length < 70) return false;
  const truncatedCommonLabel = /(?:^|\n)\s*tems\s+(?:expected|received)\s*:/im.test(text);
  const unreliableIdentifier =
    Number.isFinite(confidence) && confidence < 80 &&
    /\b(?:record|invoice|application)\s+(?:id|number)\s*:/i.test(text);
  return truncatedCommonLabel || unreliableIdentifier;
}

/**
 * Bound retry work to a text-dense region instead of re-reading blank page
 * margins. Rectangles refer to already-rendered page image coordinates.
 */
export function planLowResolutionRetryRegion(
  page: Pick<PdfV4OcrPageResult, "words" | "renderedWidth" | "renderedHeight">,
): LowResolutionRetryRegion | null {
  const { renderedWidth: width, renderedHeight: height } = page;
  if (!(width >= 200 && height >= 300 && width * height <= 11_000_000)) return null;
  const words = page.words.filter((w) =>
    w.text.trim() && [w.bounds.x0, w.bounds.x1, w.bounds.y0, w.bounds.y1].every(Number.isFinite) &&
    w.bounds.x0 >= 0 && w.bounds.y0 >= 0 &&
    w.bounds.x1 > w.bounds.x0 && w.bounds.y1 > w.bounds.y0 &&
    w.bounds.x1 <= width + 2 && w.bounds.y1 <= height + 2,
  );
  if (words.length < 14 || words.length > 1500) return null;
  const minX = Math.min(...words.map((w) => w.bounds.x0));
  const maxX = Math.max(...words.map((w) => w.bounds.x1));
  const minY = Math.min(...words.map((w) => w.bounds.y0));
  const maxY = Math.max(...words.map((w) => w.bounds.y1));
  const padX = width * 0.06;
  const padY = height * 0.035;
  const left = Math.max(0, Math.floor(minX - padX));
  const top = Math.max(0, Math.floor(minY - padY));
  const right = Math.min(width, Math.ceil(maxX + padX));
  const bottom = Math.min(height, Math.ceil(maxY + padY));
  if (right - left < 170 || bottom - top < 140) return null;
  // A retry only makes sense when we can remove meaningful blank margins.
  if ((bottom - top) / height > 0.82) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function percentile(hist: Uint32Array, total: number, fraction: number): number {
  let cumulative = 0;
  const threshold = Math.max(1, Math.floor(total * fraction));
  for (let value = 0; value < hist.length; value++) {
    cumulative += hist[value];
    if (cumulative >= threshold) return value;
  }
  return 255;
}

/**
 * Browser-local; never uploads pixels. Crop to the recognized content, expand
 * with high-quality canvas interpolation and apply grayscale percentile
 * contrast + mild unsharp masking. This only creates a review candidate and
 * never changes the original OCR transcript or declares an ID correct.
 */
export async function prepareLowResolutionReviewImage(
  imageDataUrl: string,
  region: LowResolutionRetryRegion,
): Promise<string> {
  if (typeof Image === "undefined" || typeof document === "undefined") {
    throw new Error("OCR image enhancement requires a browser.");
  }
  if (![region.left, region.top, region.width, region.height].every(Number.isFinite) ||
      region.width <= 0 || region.height <= 0) {
    throw new Error("Invalid OCR enhancement region.");
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Cannot load rendered OCR image."));
    image.src = imageDataUrl;
  });
  const scale = Math.min(1.45, 2400 / Math.max(region.width, region.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(region.width * scale);
  canvas.height = Math.round(region.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR enhancement canvas unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image,
    region.left, region.top, region.width, region.height,
    0, 0, canvas.width, canvas.height,
  );

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const bytes = pixels.data;
  const count = canvas.width * canvas.height;
  const gray = new Uint8Array(count);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    const value = Math.round(bytes[offset] * 0.299 + bytes[offset + 1] * 0.587 + bytes[offset + 2] * 0.114);
    gray[i] = value;
    histogram[value]++;
  }
  const lower = percentile(histogram, count, 0.008);
  const upper = percentile(histogram, count, 0.992);
  const contrast = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    contrast[i] = upper > lower + 12
      ? Math.max(0, Math.min(255, Math.round((gray[i] - lower) * 255 / (upper - lower))))
      : gray[i];
  }
  const { width, height } = canvas;
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - 1);
    const bottom = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - 1);
      const right = Math.min(width - 1, x + 1);
      const at = y * width + x;
      const mid = contrast[at];
      const blur = (
        contrast[top * width + left] + 2 * contrast[top * width + x] + contrast[top * width + right] +
        2 * contrast[y * width + left] + 4 * mid + 2 * contrast[y * width + right] +
        contrast[bottom * width + left] + 2 * contrast[bottom * width + x] + contrast[bottom * width + right]
      ) / 16;
      const sharpened = Math.abs(mid - blur) > 3 ? mid + 1.3 * (mid - blur) : mid;
      const value = Math.max(0, Math.min(255, Math.round(sharpened)));
      const offset = at * 4;
      bytes[offset] = value;
      bytes[offset + 1] = value;
      bytes[offset + 2] = value;
      bytes[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const result = canvas.toDataURL("image/png");
  canvas.width = 0;
  canvas.height = 0;
  return result;
}

export function acceptLowResolutionReviewCandidate(
  original: string, candidate: string, confidence: number,
): string | null {
  const normalized = candidate.trim();
  if (!Number.isFinite(confidence) || confidence < 55 ||
      normalized.length < 50 || normalized === original.trim()) return null;
  return normalized;
}
