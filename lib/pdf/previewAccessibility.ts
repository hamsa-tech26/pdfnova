export type NormalizedPosition = {
  x: number;
  y: number;
};

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

export function nudgeNormalizedPosition({
  position,
  deltaX,
  deltaY,
  maxX,
  maxY,
}: {
  position: NormalizedPosition;
  deltaX: number;
  deltaY: number;
  maxX: number;
  maxY: number;
}): NormalizedPosition {
  return {
    x: clamp(
      position.x + deltaX,
      0,
      Math.max(0, maxX),
    ),
    y: clamp(
      position.y + deltaY,
      0,
      Math.max(0, maxY),
    ),
  };
}

export function normalizedRectFromPercent({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}): NormalizedRect {
  const normalizedX =
    clamp(x / 100, 0, 1);
  const normalizedY =
    clamp(y / 100, 0, 1);

  const normalizedWidth =
    clamp(
      width / 100,
      0.5 / 100,
      1 - normalizedX,
    );

  const normalizedHeight =
    clamp(
      height / 100,
      0.5 / 100,
      1 - normalizedY,
    );

  return {
    x: normalizedX,
    y: normalizedY,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

export function normalizedRectToPercent(
  rect: NormalizedRect,
) {
  return {
    x: Math.round(rect.x * 1000) / 10,
    y: Math.round(rect.y * 1000) / 10,
    width:
      Math.round(
        rect.width * 1000,
      ) / 10,
    height:
      Math.round(
        rect.height * 1000,
      ) / 10,
  };
}
