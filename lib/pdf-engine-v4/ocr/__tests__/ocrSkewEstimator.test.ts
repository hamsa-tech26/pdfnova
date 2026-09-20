import {
  describe,
  expect,
  it,
} from "vitest";

import {
  estimatePdfV4DeskewRadiansFromBlocks,
} from "../ocrSkewEstimator";

function degreesToRadians(
  degrees: number,
) {
  return (
    degrees *
    (Math.PI / 180)
  );
}

function createBaseline(
  angleDegrees: number,
  length = 200,
) {
  const angle =
    degreesToRadians(
      angleDegrees,
    );

  return {
    x0: 0,
    y0: 0,
    x1:
      Math.cos(angle) *
      length,
    y1:
      Math.sin(angle) *
      length,
  };
}

function createBlocks(
  angles: number[],
) {
  return [
    {
      paragraphs: [
        {
          lines:
            angles.map(
              (angle) => ({
                baseline:
                  createBaseline(
                    angle,
                  ),
              }),
            ),
        },
      ],
    },
  ];
}

describe(
  "estimatePdfV4DeskewRadiansFromBlocks",
  () => {
    it(
      "detects the controlled -4 degree skew and returns the opposite deskew rotation",
      () => {
        const result =
          estimatePdfV4DeskewRadiansFromBlocks(
            createBlocks([
              -3.99,
              -4,
              -4.03,
              -4.02,
              -3.98,
            ]),
          );

        expect(
          result,
        ).not.toBeNull();

        expect(
          result,
        ).toBeCloseTo(
          degreesToRadians(4),
          3,
        );
      },
    );

    it(
      "ignores an effectively straight page",
      () => {
        const result =
          estimatePdfV4DeskewRadiansFromBlocks(
            createBlocks([
              0,
              0.03,
              0.05,
              0.03,
              0,
            ]),
          );

        expect(
          result,
        ).toBeNull();
      },
    );

    it(
      "rejects inconsistent baseline angles",
      () => {
        const result =
          estimatePdfV4DeskewRadiansFromBlocks(
            createBlocks([
              -4,
              3,
              -8,
              7,
              -2,
            ]),
          );

        expect(
          result,
        ).toBeNull();
      },
    );

    it(
      "requires at least three usable baselines",
      () => {
        const result =
          estimatePdfV4DeskewRadiansFromBlocks(
            createBlocks([
              -4,
              -4,
            ]),
          );

        expect(
          result,
        ).toBeNull();
      },
    );
  },
);