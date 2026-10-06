export const PDF_PAGE_SIZE_PRESETS = {
  a4: {
    label: "A4",
    width: 595.28,
    height: 841.89,
  },
  letter: {
    label: "Letter",
    width: 612,
    height: 792,
  },
  legal: {
    label: "Legal",
    width: 612,
    height: 1008,
  },
  a5: {
    label: "A5",
    width: 419.53,
    height: 595.28,
  },
} as const;

export type PdfPageSizePreset =
  keyof typeof PDF_PAGE_SIZE_PRESETS;

export type PdfResizeOrientation =
  | "auto"
  | "portrait"
  | "landscape";

export type PdfResizeTarget = {
  width: number;
  height: number;
  visibleWidth: number;
  visibleHeight: number;
  visibleOrientation: "portrait" | "landscape";
};

function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export function isQuarterTurnRotation(angle: number) {
  const normalized = normalizeRotation(angle);
  return normalized === 90 || normalized === 270;
}

export function getVisiblePageSize(
  width: number,
  height: number,
  rotationAngle: number,
) {
  if (isQuarterTurnRotation(rotationAngle)) {
    return {
      width: height,
      height: width,
    };
  }

  return { width, height };
}

export function resolveResizeTarget(
  preset: PdfPageSizePreset,
  orientation: PdfResizeOrientation,
  sourceWidth: number,
  sourceHeight: number,
  rotationAngle: number,
): PdfResizeTarget {
  const selected = PDF_PAGE_SIZE_PRESETS[preset];
  const portraitWidth = Math.min(
    selected.width,
    selected.height,
  );
  const portraitHeight = Math.max(
    selected.width,
    selected.height,
  );

  const visibleSource = getVisiblePageSize(
    sourceWidth,
    sourceHeight,
    rotationAngle,
  );

  const visibleOrientation =
    orientation === "auto"
      ? visibleSource.width > visibleSource.height
        ? "landscape"
        : "portrait"
      : orientation;

  const visibleWidth =
    visibleOrientation === "portrait"
      ? portraitWidth
      : portraitHeight;

  const visibleHeight =
    visibleOrientation === "portrait"
      ? portraitHeight
      : portraitWidth;

  if (isQuarterTurnRotation(rotationAngle)) {
    return {
      width: visibleHeight,
      height: visibleWidth,
      visibleWidth,
      visibleHeight,
      visibleOrientation,
    };
  }

  return {
    width: visibleWidth,
    height: visibleHeight,
    visibleWidth,
    visibleHeight,
    visibleOrientation,
  };
}

export function calculateProportionalFitScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new Error("Page dimensions must be greater than zero.");
  }

  return Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
}
