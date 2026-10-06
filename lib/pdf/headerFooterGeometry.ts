export type PdfHeaderFooterAlignment =
  | "left"
  | "center"
  | "right";

export type PdfHeaderFooterSlot =
  | "header"
  | "footer";

export type PdfHeaderFooterBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfHeaderFooterPlacement = {
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  visibleWidth: number;
  visibleHeight: number;
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

export function getVisibleHeaderFooterPageSize(
  width: number,
  height: number,
  rotationAngle: number,
) {
  const rotation =
    normalizeRotation(rotationAngle);

  if (
    rotation === 90 ||
    rotation === 270
  ) {
    return {
      width: height,
      height: width,
    };
  }

  return {
    width,
    height,
  };
}

export function renderHeaderFooterTemplate(
  template: string,
  pageNumber: number,
  totalPages: number,
) {
  return template
    .replaceAll(
      "{page}",
      String(pageNumber),
    )
    .replaceAll(
      "{total}",
      String(totalPages),
    );
}

function getVisibleX(
  alignment: PdfHeaderFooterAlignment,
  visibleWidth: number,
  textWidth: number,
  margin: number,
) {
  if (alignment === "left") {
    return margin;
  }

  if (alignment === "right") {
    return Math.max(
      margin,
      visibleWidth -
        margin -
        textWidth,
    );
  }

  return Math.max(
    margin,
    (visibleWidth - textWidth) / 2,
  );
}

function visibleToPagePoint(
  visibleX: number,
  visibleY: number,
  box: PdfHeaderFooterBox,
  rotation: 0 | 90 | 180 | 270,
) {
  switch (rotation) {
    case 90:
      return {
        x:
          box.x +
          box.width -
          visibleY,
        y:
          box.y +
          visibleX,
      };

    case 180:
      return {
        x:
          box.x +
          box.width -
          visibleX,
        y:
          box.y +
          box.height -
          visibleY,
      };

    case 270:
      return {
        x:
          box.x +
          visibleY,
        y:
          box.y +
          box.height -
          visibleX,
      };

    default:
      return {
        x:
          box.x +
          visibleX,
        y:
          box.y +
          visibleY,
      };
  }
}

export function calculateHeaderFooterPlacement({
  box,
  rotationAngle,
  textWidth,
  fontSize,
  margin,
  alignment,
  slot,
}: {
  box: PdfHeaderFooterBox;
  rotationAngle: number;
  textWidth: number;
  fontSize: number;
  margin: number;
  alignment: PdfHeaderFooterAlignment;
  slot: PdfHeaderFooterSlot;
}): PdfHeaderFooterPlacement {
  if (
    box.width <= 0 ||
    box.height <= 0
  ) {
    throw new Error(
      "The PDF page has invalid visible dimensions.",
    );
  }

  const rotation =
    normalizeRotation(rotationAngle);

  const visible =
    getVisibleHeaderFooterPageSize(
      box.width,
      box.height,
      rotation,
    );

  const visibleX = getVisibleX(
    alignment,
    visible.width,
    textWidth,
    margin,
  );

  const visibleY =
    slot === "header"
      ? Math.max(
          margin,
          visible.height -
            margin -
            fontSize,
        )
      : margin;

  const point = visibleToPagePoint(
    visibleX,
    visibleY,
    box,
    rotation,
  );

  return {
    ...point,
    rotation,
    visibleWidth:
      visible.width,
    visibleHeight:
      visible.height,
  };
}
