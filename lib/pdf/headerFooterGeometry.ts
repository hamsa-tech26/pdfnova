export type PdfHeaderFooterAlignment =
  | "left"
  | "center"
  | "right";

export type PdfHeaderFooterSlot =
  | "header"
  | "footer";

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
  pageWidth: number,
  pageHeight: number,
  rotationAngle: number,
) {
  const rotation =
    normalizeRotation(rotationAngle);

  if (
    rotation === 90 ||
    rotation === 270
  ) {
    return {
      width: pageHeight,
      height: pageWidth,
    };
  }

  return {
    width: pageWidth,
    height: pageHeight,
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
  pageWidth: number,
  pageHeight: number,
  rotation: 0 | 90 | 180 | 270,
) {
  switch (rotation) {
    case 90:
      return {
        x: pageWidth - visibleY,
        y: visibleX,
      };

    case 180:
      return {
        x: pageWidth - visibleX,
        y: pageHeight - visibleY,
      };

    case 270:
      return {
        x: visibleY,
        y: pageHeight - visibleX,
      };

    default:
      return {
        x: visibleX,
        y: visibleY,
      };
  }
}

export function calculateHeaderFooterPlacement({
  pageWidth,
  pageHeight,
  rotationAngle,
  textWidth,
  fontSize,
  margin,
  alignment,
  slot,
}: {
  pageWidth: number;
  pageHeight: number;
  rotationAngle: number;
  textWidth: number;
  fontSize: number;
  margin: number;
  alignment: PdfHeaderFooterAlignment;
  slot: PdfHeaderFooterSlot;
}): PdfHeaderFooterPlacement {
  const rotation =
    normalizeRotation(rotationAngle);

  const visible =
    getVisibleHeaderFooterPageSize(
      pageWidth,
      pageHeight,
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
    pageWidth,
    pageHeight,
    rotation,
  );

  return {
    ...point,
    rotation,
    visibleWidth: visible.width,
    visibleHeight: visible.height,
  };
}
