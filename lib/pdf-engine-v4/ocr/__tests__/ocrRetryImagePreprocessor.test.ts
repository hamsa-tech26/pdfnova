import {
  describe,
  expect,
  it,
} from "vitest";

import {
  preprocessPdfV4OcrRetryPixels,
} from "../ocrRetryImagePreprocessor";

describe(
  "preprocessPdfV4OcrRetryPixels",
  () => {
    it(
      "converts dark pixels to black and light pixels to white",
      () => {
        const data =
          new Uint8ClampedArray([
            50, 50, 50, 255,
            240, 240, 240, 255,
          ]);

        const result =
          preprocessPdfV4OcrRetryPixels(
            {
              data,
              width: 2,
              height: 1,
            },
            210,
          );

        expect(
          Array.from(result),
        ).toEqual([
          0, 0, 0, 255,
          255, 255, 255, 255,
        ]);
      },
    );

    it(
      "does not modify the original pixel buffer",
      () => {
        const data =
          new Uint8ClampedArray([
            100, 100, 100, 255,
          ]);

        preprocessPdfV4OcrRetryPixels(
          {
            data,
            width: 1,
            height: 1,
          },
        );

        expect(
          Array.from(data),
        ).toEqual([
          100, 100, 100, 255,
        ]);
      },
    );
  },
);