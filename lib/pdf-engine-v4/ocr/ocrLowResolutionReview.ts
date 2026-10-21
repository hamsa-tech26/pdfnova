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
    /\b(?:(?:record|invoice|application|serial|facility|package)\s+(?:id|number|code)|reference(?:\s+(?:id|number|code))?)\s*:/i.test(text);
  return truncatedCommonLabel || unreliableIdentifier;
}

function centeredY(word: { bounds: { y0: number; y1: number } }): number {
  return (word.bounds.y0 + word.bounds.y1) / 2;
}

/**
 * Target a *single source-image line* containing an identifier label.
 * Do not make corrections from the document's meaning or from patterns
 * such as a guessed digit where raw OCR read a letter.
 */
export function planLowResolutionIdentifierLine(
  page: Pick<PdfV4OcrPageResult, "words" | "renderedWidth" | "renderedHeight">,
): LowResolutionRetryRegion | null {
  const { renderedWidth: width, renderedHeight: height } = page;
  if (!(width >= 200 && height >= 300)) return null;
  const words = page.words
    .filter((w) =>
      w.text.trim() &&
      [w.bounds.x0, w.bounds.x1, w.bounds.y0, w.bounds.y1].every(Number.isFinite) &&
      w.bounds.x1 > w.bounds.x0 && w.bounds.y1 > w.bounds.y0 &&
      w.bounds.x0 >= 0 && w.bounds.y0 >= 0 &&
      w.bounds.x1 <= width + 2 && w.bounds.y1 <= height + 2,
    )
    .sort((a, b) => centeredY(a) - centeredY(b) || a.bounds.x0 - b.bounds.x0);
  if (words.length < 8 || words.length > 1500) return null;
  for (const word of words) {
    const base = word.text.replace(/[^A-Za-z]/g, "").toLowerCase();
    if (!/^(record|invoice|application|serial|facility|package|reference)$/.test(base)) continue;
    const heightPx = Math.max(8, word.bounds.y1 - word.bounds.y0);
    const line = words.filter((candidate) =>
      Math.abs(centeredY(candidate) - centeredY(word)) <= heightPx * 0.65 &&
      candidate.bounds.x0 >= word.bounds.x0 - heightPx,
    ).sort((a, b) => a.bounds.x0 - b.bounds.x0);
    const index = line.indexOf(word);
    if(index<0)continue;
    const standaloneReference=base==="reference"&&
      /:\\s*$/.test(word.text);
    const key=standaloneReference?"reference":
      line[index+1]?.text.replace(/[^A-Za-z]/g,"").toLowerCase();
    if(!standaloneReference&&!/^(id|number|code)$/.test(key??""))continue;
    const offset=standaloneReference?1:2;
    const rest=line.slice(index+offset).filter(w=>w.text.trim().length);
    if(!rest.length||rest.length>6||line.length-index>9)continue;
    if(!rest.some(w=>/[A-Za-z0-9]{3}/.test(w.text)))continue;
    // A candidate field must be compact enough to isolate a single source
    // identifier, not capture an unrelated article paragraph or second column.
    const range=line.slice(index);
    if(range[range.length-1].bounds.x1-word.bounds.x0>width*.46)
      continue;
    const minX = Math.min(...range.map((w) => w.bounds.x0));
    const maxX = Math.max(...range.map((w) => w.bounds.x1));
    const minY = Math.min(...range.map((w) => w.bounds.y0));
    const maxY = Math.max(...range.map((w) => w.bounds.y1));
    const padX = Math.max(14, 1.1 * heightPx);
    const padY = Math.max(7, 0.35 * heightPx);
    const left = Math.max(0, Math.floor(minX - padX));
    const top = Math.max(0, Math.floor(minY - padY));
    const right = Math.min(width, Math.ceil(maxX + padX));
    const bottom = Math.min(height, Math.ceil(maxY + padY));
    if (right - left < 90 || bottom - top < 12 ||
        bottom - top > height * 0.075) continue;
    return { left, top, width: right - left, height: bottom - top };
  }
  return null;
}

export function acceptIdentifierLineReview(
  rawOcrText: string,
  candidateLine: string,
  confidence: number,
): string | null {
  if (!Number.isFinite(confidence) || confidence < 55) return null;
  const candidate = candidateLine.trim().replace(/\s+/g, " ");
  if (candidate.length > 150) return null;
  // A targeted reread must identify exactly one labelled value; otherwise
  // even a plausible disagreement could be about a different source field.
  const pattern = /\b((?:(?:record|invoice|application|serial|facility|package)\s+(?:id|number|code)|reference(?:\s+(?:id|number|code))?))\s*:\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})\b/gi;
  const reads = [...candidate.matchAll(pattern)];
  if (reads.length !== 1) return null;
  const sourceMatches = [...rawOcrText.matchAll(pattern)]
    .filter((match) => match[1].toLowerCase() === reads[0][1].toLowerCase());
  if (sourceMatches.length !== 1 ||
      sourceMatches[0][2].toLowerCase() === reads[0][2].toLowerCase()) return null;
  // This is an UNVERIFIED alternative; never overwrite the original OCR.
  return reads[0][0];
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
 * Browser-local enhancement for a bounded ID line only. Never uploads pixels,
 * rewrites identifiers or changes the original OCR transcript. The result is
 * separately marked UNVERIFIED even if it disagrees with the original read.
 */
export async function prepareLowResolutionReviewImage(
  imageDataUrl: string,
  region: LowResolutionRetryRegion,
  scaleLimit = 1.45,
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
  const safeScale = Number.isFinite(scaleLimit) && scaleLimit >= 1 && scaleLimit <= 3 ? scaleLimit : 1.45;
  const scale = Math.min(safeScale, 2400 / Math.max(region.width, region.height));
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
