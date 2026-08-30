import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectPdfV4OcrRetryVerticalContentBounds,
} from "../ocrRetryContentBounds";

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

describe(
  "detectPdfV4OcrRetryVerticalContentBounds",
  () => {
    it(
      "trims blank space above and below visible content",
      () => {
        const width = 100;
        const height = 100;

        const data =
          createWhiteImage(
            width,
            height,
          );

        for (
          let y = 30;
          y < 60;
          y += 1
        ) {
          for (
            let x = 10;
            x < 90;
            x += 1
          ) {
            const index =
              (y * width + x) * 4;

            data[index] = 0;
            data[index + 1] = 0;
            data[index + 2] = 0;
          }
        }

        const bounds =
          detectPdfV4OcrRetryVerticalContentBounds(
            {
              data,
              width,
              height,
            },
            235,
            0.005,
            5,
          );

        expect(bounds).toEqual({
          top: 25,
          bottom: 65,
          height: 40,
        });
      },
    );

    it(
      "keeps the full image when no visible content is detected",
      () => {
        const width = 100;
        const height = 80;

        const data =
          createWhiteImage(
            width,
            height,
          );

        const bounds =
          detectPdfV4OcrRetryVerticalContentBounds(
            {
              data,
              width,
              height,
            },
          );

        expect(bounds).toEqual({
          top: 0,
          bottom: 80,
          height: 80,
        });
      },
    );
  },
);