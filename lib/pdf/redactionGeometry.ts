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
