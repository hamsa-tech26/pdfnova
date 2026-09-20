type PdfV4Baseline = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type PdfV4LineLike = {
  baseline: PdfV4Baseline;
};

type PdfV4BlockLike = {
  paragraphs: readonly {
    lines: readonly PdfV4LineLike[];
  }[];
};

const PDF_V4_MIN_BASELINES = 3;

const PDF_V4_MIN_BASELINE_LENGTH = 40;

const PDF_V4_MIN_SKEW_RADIANS =
  0.3 * (Math.PI / 180);

const PDF_V4_MAX_SKEW_RADIANS =
  15 * (Math.PI / 180);

const PDF_V4_MAX_MEDIAN_DEVIATION =
  1 * (Math.PI / 180);

const PDF_V4_INLIER_TOLERANCE =
  2 * (Math.PI / 180);

function median(
  values: number[],
): number {
  const sorted = [
    ...values,
  ].sort(
    (a, b) => a - b,
  );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2
    );
  }

  return sorted[middle];
}

function normalizeBaselineAngle(
  angle: number,
): number {
  if (
    angle > Math.PI / 2
  ) {
    return angle - Math.PI;
  }

  if (
    angle < -Math.PI / 2
  ) {
    return angle + Math.PI;
  }

  return angle;
}

export function estimatePdfV4DeskewRadiansFromBlocks(
  blocks:
    | readonly PdfV4BlockLike[]
    | null
    | undefined,
): number | null {
  if (
    !blocks ||
    blocks.length === 0
  ) {
    return null;
  }

  const angles: number[] = [];

  for (
    const block of blocks
  ) {
    for (
      const paragraph of
        block.paragraphs
    ) {
      for (
        const line of
          paragraph.lines
      ) {
        const {
          x0,
          y0,
          x1,
          y1,
        } = line.baseline;

        const dx = x1 - x0;
        const dy = y1 - y0;

        const lineLength =
          Math.hypot(
            dx,
            dy,
          );

        if (
          lineLength <
          PDF_V4_MIN_BASELINE_LENGTH
        ) {
          continue;
        }

        const angle =
          normalizeBaselineAngle(
            Math.atan2(
              dy,
              dx,
            ),
          );

        if (
          Math.abs(angle) >
          PDF_V4_MAX_SKEW_RADIANS
        ) {
          continue;
        }

        angles.push(angle);
      }
    }
  }

  if (
    angles.length <
    PDF_V4_MIN_BASELINES
  ) {
    return null;
  }

  const medianAngle =
    median(angles);

  if (
    Math.abs(
      medianAngle,
    ) <
    PDF_V4_MIN_SKEW_RADIANS
  ) {
    return null;
  }

  const deviations =
    angles.map(
      (angle) =>
        Math.abs(
          angle -
            medianAngle,
        ),
    );

  const medianDeviation =
    median(deviations);

  if (
    medianDeviation >
    PDF_V4_MAX_MEDIAN_DEVIATION
  ) {
    return null;
  }

  const inliers =
    angles.filter(
      (angle) =>
        Math.abs(
          angle -
            medianAngle,
        ) <=
        PDF_V4_INLIER_TOLERANCE,
    );

  const minimumInliers =
    Math.max(
      PDF_V4_MIN_BASELINES,
      Math.ceil(
        angles.length *
          0.6,
      ),
    );

  if (
    inliers.length <
    minimumInliers
  ) {
    return null;
  }

  const refinedMedian =
    median(inliers);

  // Baselines describe the current
  // text slope. Deskew requires the
  // opposite rotation.
  return -refinedMedian;
}