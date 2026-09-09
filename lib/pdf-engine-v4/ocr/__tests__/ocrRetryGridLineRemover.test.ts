import {
  describe,
  expect,
  it,
} from "vitest";

import {
  removePdfV4OcrRetryGridLines,
} from "../ocrRetryGridLineRemover";

function createWhiteImage(
  width: number,
  height: number,
): Uint8ClampedArray {
  const data =
    new Uint8ClampedArray(
      width * height * 4,
    );

  for (
    let index = 0;
    index < data.length;
    index += 4
  ) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }

  return data;
}

function makeBlack(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
) {
  const index =
    (y * width + x) * 4;

  data[index] = 0;
  data[index + 1] = 0;
  data[index + 2] = 0;
  data[index + 3] = 255;
}

describe(
  "removePdfV4OcrRetryGridLines",
  () => {
    it(
      "removes long horizontal and vertical black lines",
      () => {
        const width = 20;
        const height = 20;

        const data =
          createWhiteImage(
            width,
            height,
          );

        for (
          let x = 2;
          x < 18;
          x += 1
        ) {
          makeBlack(
            data,
            width,
            x,
            5,
          );
        }

        for (
          let y = 2;
          y < 18;
          y += 1
        ) {
          makeBlack(
            data,
            width,
            10,
            y,
          );
        }

        const result =
          removePdfV4OcrRetryGridLines(
            {
              data,
              width,
              height,
            },
            0.5,
            0.5,
          );

        const horizontalIndex =
          (5 * width + 3) * 4;

        const verticalIndex =
          (12 * width + 10) * 4;

        expect(
          result[horizontalIndex],
        ).toBe(255);

        expect(
          result[verticalIndex],
        ).toBe(255);
      },
    );

    it(
      "keeps short black runs that may belong to text",
      () => {
        const width = 20;
        const height = 20;

        const data =
          createWhiteImage(
            width,
            height,
          );

        makeBlack(
          data,
          width,
          3,
          8,
        );

        makeBlack(
          data,
          width,
          4,
          8,
        );

        makeBlack(
          data,
          width,
          5,
          8,
        );

        const result =
          removePdfV4OcrRetryGridLines(
            {
              data,
              width,
              height,
            },
            0.5,
            0.5,
          );

        const index =
          (8 * width + 4) * 4;

        expect(
          result[index],
        ).toBe(0);
      },
    );
  },
);