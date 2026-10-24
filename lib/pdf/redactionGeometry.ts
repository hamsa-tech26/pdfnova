export type RedactionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRedactionRect(rect: RedactionRect): RedactionRect {
  const x1 = clamp(Math.min(rect.x, rect.x + rect.width), 0, 1);
  const y1 = clamp(Math.min(rect.y, rect.y + rect.height), 0, 1);
  const x2 = clamp(Math.max(rect.x, rect.x + rect.width), 0, 1);
  const y2 = clamp(Math.max(rect.y, rect.y + rect.height), 0, 1);
  return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
}

export function isUsefulRedactionRect(rect: RedactionRect) {
  const normalized = normalizeRedactionRect(rect);
  return normalized.width >= 0.005 && normalized.height >= 0.005;
}

/** Cover every pixel touched by the selected area, including fractional edges. */
export function redactionPixelBounds(rect: RedactionRect, width: number, height: number) {
  const normalized = normalizeRedactionRect(rect);
  const x = Math.floor(normalized.x * width);
  const y = Math.floor(normalized.y * height);
  const right = Math.min(width, Math.ceil((normalized.x + normalized.width) * width));
  const bottom = Math.min(height, Math.ceil((normalized.y + normalized.height) * height));
  return {x, y, width: right - x, height: bottom - y};
}

/**
 * Fail closed before raster export when a saved mask is malformed, out of
 * source-page range, or too small to be applied. Otherwise a caller with a
 * stale page map could download an apparently redacted but unmasked page.
 *
 * UI drags may use negative widths/heights; those are still normalized.
 */
export function validateRedactionPlan(
  redactionsByPage: Record<number, RedactionRect[]>,
  pageCount: number,
): void {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 ||
      !redactionsByPage || typeof redactionsByPage !== "object" ||
      Array.isArray(redactionsByPage)) {
    throw new Error("Invalid redaction source or page selections.");
  }

  let selectedCount = 0;
  for (const [pageKey, rects] of Object.entries(redactionsByPage)) {
    const pageNumber = Number(pageKey);
    if (!/^[1-9][0-9]*$/.test(pageKey) ||
        !Number.isSafeInteger(pageNumber) || pageNumber > pageCount) {
      throw new Error("A redaction area refers to a page outside this PDF; export was withheld.");
    }
    if (!Array.isArray(rects)) {
      throw new Error("A redaction page contains invalid selection data; export was withheld.");
    }
    for (const rect of rects) {
      if (!rect || typeof rect !== "object" ||
          ![rect.x, rect.y, rect.width, rect.height].every(
            value => typeof value === "number" && Number.isFinite(value),
          ) || !Number.isFinite(rect.x + rect.width) ||
          !Number.isFinite(rect.y + rect.height) ||
          !isUsefulRedactionRect(rect)) {
        throw new Error("A redaction area could not be safely applied; export was withheld.");
      }
      selectedCount += 1;
    }
  }

  if (selectedCount === 0) {
    throw new Error("Add at least one redaction area before creating the PDF.");
  }
}
