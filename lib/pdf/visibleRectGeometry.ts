export type VisibleRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfRectPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
};

function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeVisibleRect(rect: VisibleRect): VisibleRect {
  const x1 = clamp(Math.min(rect.x, rect.x + rect.width), 0, 1);
  const y1 = clamp(Math.min(rect.y, rect.y + rect.height), 0, 1);
  const x2 = clamp(Math.max(rect.x, rect.x + rect.width), 0, 1);
  const y2 = clamp(Math.max(rect.y, rect.y + rect.height), 0, 1);
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}

export function visibleRectToPdfPlacement(
  cropBox: { x: number; y: number; width: number; height: number },
  rotationAngle: number,
  rawRect: VisibleRect,
): PdfRectPlacement {
  if (cropBox.width <= 0 || cropBox.height <= 0) {
    throw new Error("The selected PDF page has invalid dimensions.");
  }

  const rect = normalizeVisibleRect(rawRect);
  if (rect.width < 0.005 || rect.height < 0.005) {
    throw new Error("Draw a larger field area.");
  }

  const rotation = normalizeRotation(rotationAngle);
  const visibleWidth = rotation === 90 || rotation === 270 ? cropBox.height : cropBox.width;
  const visibleHeight = rotation === 90 || rotation === 270 ? cropBox.width : cropBox.height;

  const width = visibleWidth * rect.width;
  const height = visibleHeight * rect.height;
  const visibleX = visibleWidth * rect.x;
  const visibleY = visibleHeight - visibleHeight * rect.y - height;

  switch (rotation) {
    case 90:
      return {
        x: cropBox.x + cropBox.width - visibleY,
        y: cropBox.y + visibleX,
        width,
        height,
        rotation,
      };
    case 180:
      return {
        x: cropBox.x + cropBox.width - visibleX,
        y: cropBox.y + cropBox.height - visibleY,
        width,
        height,
        rotation,
      };
    case 270:
      return {
        x: cropBox.x + visibleY,
        y: cropBox.y + cropBox.height - visibleX,
        width,
        height,
        rotation,
      };
    default:
      return {
        x: cropBox.x + visibleX,
        y: cropBox.y + visibleY,
        width,
        height,
        rotation,
      };
  }
}
