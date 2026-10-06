export type PdfCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisibleCropMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function normalizeRotation(
  angle: number,
): 0 | 90 | 180 | 270 {
  const normalized =
    ((angle % 360) + 360) % 360;

  if (
    normalized === 90 ||
    normalized === 180 ||
    normalized === 270
  ) {
    return normalized;
  }

  return 0;
}

function toPageMargins(
  visible: VisibleCropMargins,
  rotationAngle: number,
) {
  const rotation =
    normalizeRotation(rotationAngle);

  switch (rotation) {
    case 90:
      return {
        left: visible.top,
        right: visible.bottom,
        bottom: visible.left,
        top: visible.right,
      };

    case 180:
      return {
        left: visible.right,
        right: visible.left,
        bottom: visible.top,
        top: visible.bottom,
      };

    case 270:
      return {
        left: visible.bottom,
        right: visible.top,
        bottom: visible.right,
        top: visible.left,
      };

    default:
      return visible;
  }
}

export function calculateVisibleCropBox(
  cropBox: PdfCropBox,
  rotationAngle: number,
  visibleMargins: VisibleCropMargins,
  minVisiblePoints = 36,
): PdfCropBox {
  const values = [
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    visibleMargins.top,
    visibleMargins.right,
    visibleMargins.bottom,
    visibleMargins.left,
    minVisiblePoints,
  ];

  if (
    values.some(
      (value) =>
        !Number.isFinite(value),
    )
  ) {
    throw new Error(
      "Crop dimensions must be finite numbers.",
    );
  }

  if (
    cropBox.width <= 0 ||
    cropBox.height <= 0
  ) {
    throw new Error(
      "The PDF page has invalid crop dimensions.",
    );
  }

  if (
    visibleMargins.top < 0 ||
    visibleMargins.right < 0 ||
    visibleMargins.bottom < 0 ||
    visibleMargins.left < 0
  ) {
    throw new Error(
      "Crop margins cannot be negative.",
    );
  }

  const pageMargins =
    toPageMargins(
      visibleMargins,
      rotationAngle,
    );

  const width =
    cropBox.width -
    pageMargins.left -
    pageMargins.right;

  const height =
    cropBox.height -
    pageMargins.bottom -
    pageMargins.top;

  if (
    width < minVisiblePoints ||
    height < minVisiblePoints
  ) {
    throw new Error(
      "The crop margins leave too little visible page area.",
    );
  }

  return {
    x:
      cropBox.x +
      pageMargins.left,
    y:
      cropBox.y +
      pageMargins.bottom,
    width,
    height,
  };
}
