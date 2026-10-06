export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type WatermarkPageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WatermarkPlacement = {
  x: number;
  y: number;
  drawRotation: number;
  visibleWidth: number;
  visibleHeight: number;
  boundingWidth: number;
  boundingHeight: number;
};

function normalizeQuarterTurn(
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

export function getVisibleWatermarkPageSize(
  box: WatermarkPageBox,
  pageRotation: number,
) {
  const rotation =
    normalizeQuarterTurn(
      pageRotation,
    );

  if (
    rotation === 90 ||
    rotation === 270
  ) {
    return {
      width: box.height,
      height: box.width,
    };
  }

  return {
    width: box.width,
    height: box.height,
  };
}

function rotatedBounds(
  width: number,
  height: number,
  degreesAngle: number,
) {
  const radians =
    (degreesAngle * Math.PI) /
    180;

  const cos =
    Math.cos(radians);

  const sin =
    Math.sin(radians);

  const points = [
    { x: 0, y: 0 },
    {
      x: width * cos,
      y: width * sin,
    },
    {
      x:
        -height * sin,
      y:
        height * cos,
    },
    {
      x:
        width * cos -
        height * sin,
      y:
        width * sin +
        height * cos,
    },
  ];

  const xs =
    points.map(
      (point) => point.x,
    );

  const ys =
    points.map(
      (point) => point.y,
    );

  const minX =
    Math.min(...xs);

  const maxX =
    Math.max(...xs);

  const minY =
    Math.min(...ys);

  const maxY =
    Math.max(...ys);

  return {
    minX,
    minY,
    width:
      maxX - minX,
    height:
      maxY - minY,
  };
}

function chooseBoundingOrigin(
  position: WatermarkPosition,
  visibleWidth: number,
  visibleHeight: number,
  boundingWidth: number,
  boundingHeight: number,
  margin: number,
) {
  switch (position) {
    case "top-left":
      return {
        x: margin,
        y:
          visibleHeight -
          margin -
          boundingHeight,
      };

    case "top-right":
      return {
        x:
          visibleWidth -
          margin -
          boundingWidth,
        y:
          visibleHeight -
          margin -
          boundingHeight,
      };

    case "bottom-left":
      return {
        x: margin,
        y: margin,
      };

    case "bottom-right":
      return {
        x:
          visibleWidth -
          margin -
          boundingWidth,
        y: margin,
      };

    default:
      return {
        x:
          (visibleWidth -
            boundingWidth) /
          2,
        y:
          (visibleHeight -
            boundingHeight) /
          2,
      };
  }
}

function visibleToPagePoint(
  visibleX: number,
  visibleY: number,
  box: WatermarkPageBox,
  pageRotation: 0 | 90 | 180 | 270,
) {
  switch (pageRotation) {
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

export function calculateWatermarkPlacement({
  box,
  pageRotation,
  watermarkRotation,
  elementWidth,
  elementHeight,
  position,
  margin = 32,
}: {
  box: WatermarkPageBox;
  pageRotation: number;
  watermarkRotation: number;
  elementWidth: number;
  elementHeight: number;
  position: WatermarkPosition;
  margin?: number;
}): WatermarkPlacement {
  if (
    box.width <= 0 ||
    box.height <= 0 ||
    elementWidth <= 0 ||
    elementHeight <= 0
  ) {
    throw new Error(
      "Watermark dimensions must be greater than zero.",
    );
  }

  const normalizedPageRotation =
    normalizeQuarterTurn(
      pageRotation,
    );

  const visible =
    getVisibleWatermarkPageSize(
      box,
      normalizedPageRotation,
    );

  const bounds =
    rotatedBounds(
      elementWidth,
      elementHeight,
      watermarkRotation,
    );

  if (
    bounds.width >
      visible.width -
        margin * 2 ||
    bounds.height >
      visible.height -
        margin * 2
  ) {
    throw new Error(
      "The watermark is too large for one or more pages. Reduce its size or rotation.",
    );
  }

  const boundingOrigin =
    chooseBoundingOrigin(
      position,
      visible.width,
      visible.height,
      bounds.width,
      bounds.height,
      margin,
    );

  const visibleOrigin = {
    x:
      boundingOrigin.x -
      bounds.minX,
    y:
      boundingOrigin.y -
      bounds.minY,
  };

  const point =
    visibleToPagePoint(
      visibleOrigin.x,
      visibleOrigin.y,
      box,
      normalizedPageRotation,
    );

  return {
    ...point,
    drawRotation:
      normalizedPageRotation +
      watermarkRotation,
    visibleWidth:
      visible.width,
    visibleHeight:
      visible.height,
    boundingWidth:
      bounds.width,
    boundingHeight:
      bounds.height,
  };
}
