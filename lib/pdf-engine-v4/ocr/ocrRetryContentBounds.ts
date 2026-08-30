export type PdfV4OcrRetryPixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type PdfV4OcrRetryVerticalContentBounds = {
  top: number;
  bottom: number;
  height: number;
};

export function detectPdfV4OcrRetryVerticalContentBounds(
  imageData: PdfV4OcrRetryPixelBuffer,
  darknessThreshold = 235,
  minimumInkRatio = 0.005,
  padding = 12,
): PdfV4OcrRetryVerticalContentBounds {
  const {
    data,
    width,
    height,
  } = imageData;

  if (
    width <= 0 ||
    height <= 0 ||
    data.length <
      width * height * 4
  ) {
    return {
      top: 0,
      bottom: height,
      height,
    };
  }

  const minimumInkPixels =
    Math.max(
      2,
      Math.ceil(
        width *
          minimumInkRatio,
      ),
    );

  let firstContentRow = -1;
  let lastContentRow = -1;

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    let darkPixelCount = 0;

    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      const pixelIndex =
        (y * width + x) * 4;

      const red =
        data[pixelIndex];

      const green =
        data[pixelIndex + 1];

      const blue =
        data[pixelIndex + 2];

      const alpha =
        data[pixelIndex + 3];

      if (alpha === 0) {
        continue;
      }

      const luminance =
        red * 0.299 +
        green * 0.587 +
        blue * 0.114;

      if (
        luminance <=
        darknessThreshold
      ) {
        darkPixelCount += 1;
      }
    }

    if (
      darkPixelCount >=
      minimumInkPixels
    ) {
      if (
        firstContentRow === -1
      ) {
        firstContentRow = y;
      }

      lastContentRow = y;
    }
  }

  if (
    firstContentRow === -1 ||
    lastContentRow === -1
  ) {
    return {
      top: 0,
      bottom: height,
      height,
    };
  }

  const top =
    Math.max(
      0,
      firstContentRow -
        padding,
    );

  const bottom =
    Math.min(
      height,
      lastContentRow +
        1 +
        padding,
    );

  return {
    top,
    bottom,
    height:
      bottom - top,
  };
}