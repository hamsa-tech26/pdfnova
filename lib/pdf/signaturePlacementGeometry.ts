export type SignaturePlacementInput = {
  cropBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotationAngle: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  signatureAspect: number;
};

export type SignaturePdfPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
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

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

export function getVisibleSignatureBoxSize(
  cropBox: SignaturePlacementInput["cropBox"],
  rotationAngle: number,
) {
  const rotation =
    normalizeRotation(rotationAngle);

  if (
    rotation === 90 ||
    rotation === 270
  ) {
    return {
      width: cropBox.height,
      height: cropBox.width,
    };
  }

  return {
    width: cropBox.width,
    height: cropBox.height,
  };
}

export function calculateSignaturePdfPlacement(
  input: SignaturePlacementInput,
): SignaturePdfPlacement {
  const {
    cropBox,
    rotationAngle,
    signatureAspect,
  } = input;

  if (
    cropBox.width <= 0 ||
    cropBox.height <= 0
  ) {
    throw new Error(
      "The selected PDF page has invalid dimensions.",
    );
  }

  if (
    !Number.isFinite(
      signatureAspect,
    ) ||
    signatureAspect <= 0
  ) {
    throw new Error(
      "The signature has invalid dimensions.",
    );
  }

  const rotation =
    normalizeRotation(rotationAngle);

  const visible =
    getVisibleSignatureBoxSize(
      cropBox,
      rotation,
    );

  const widthRatio =
    clamp(
      input.widthRatio,
      0.08,
      0.8,
    );

  const visibleWidth =
    visible.width *
    widthRatio;

  const visibleHeight =
    visibleWidth /
    signatureAspect;

  const heightRatio =
    visibleHeight /
    visible.height;

  if (heightRatio >= 0.95) {
    throw new Error(
      "The signature is too tall for this page. Reduce the signature size.",
    );
  }

  const xRatio =
    clamp(
      input.xRatio,
      0,
      Math.max(
        0,
        1 - widthRatio,
      ),
    );

  const yRatio =
    clamp(
      input.yRatio,
      0,
      Math.max(
        0,
        1 - heightRatio,
      ),
    );

  const visibleX =
    visible.width * xRatio;

  const visibleY =
    visible.height -
    visible.height *
      yRatio -
    visibleHeight;

  let x = 0;
  let y = 0;

  switch (rotation) {
    case 90:
      x =
        cropBox.x +
        cropBox.width -
        visibleY;

      y =
        cropBox.y +
        visibleX;
      break;

    case 180:
      x =
        cropBox.x +
        cropBox.width -
        visibleX;

      y =
        cropBox.y +
        cropBox.height -
        visibleY;
      break;

    case 270:
      x =
        cropBox.x +
        visibleY;

      y =
        cropBox.y +
        cropBox.height -
        visibleX;
      break;

    default:
      x =
        cropBox.x +
        visibleX;

      y =
        cropBox.y +
        visibleY;
      break;
  }

  return {
    x,
    y,
    width: visibleWidth,
    height: visibleHeight,
    rotation,
    xRatio,
    yRatio,
    widthRatio,
    heightRatio,
  };
}
