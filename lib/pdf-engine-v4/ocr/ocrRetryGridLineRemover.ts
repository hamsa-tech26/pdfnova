export type PdfV4OcrRetryBinaryPixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

function isBlackPixel(
  data: Uint8ClampedArray,
  pixelIndex: number,
): boolean {
  const index =
    pixelIndex * 4;

  return (
    data[index] === 0 &&
    data[index + 1] === 0 &&
    data[index + 2] === 0 &&
    data[index + 3] !== 0
  );
}

export function removePdfV4OcrRetryGridLines(
  imageData: PdfV4OcrRetryBinaryPixelBuffer,
  minimumHorizontalRunRatio = 0.35,
  minimumVerticalRunRatio = 0.45,
): Uint8ClampedArray {
  const {
    data,
    width,
    height,
  } = imageData;

  const output =
    new Uint8ClampedArray(
      data,
    );

  if (
    width <= 0 ||
    height <= 0 ||
    data.length <
      width * height * 4
  ) {
    return output;
  }

  const pixelsToRemove =
    new Uint8Array(
      width * height,
    );

  const minimumHorizontalRun =
    Math.max(
      2,
      Math.ceil(
        width *
          minimumHorizontalRunRatio,
      ),
    );

  const minimumVerticalRun =
    Math.max(
      2,
      Math.ceil(
        height *
          minimumVerticalRunRatio,
      ),
    );

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    let runStart = -1;

    for (
      let x = 0;
      x <= width;
      x += 1
    ) {
      const isBlack =
        x < width &&
        isBlackPixel(
          data,
          y * width + x,
        );

      if (
        isBlack &&
        runStart === -1
      ) {
        runStart = x;
      }

      if (
        !isBlack &&
        runStart !== -1
      ) {
        const runLength =
          x - runStart;

        if (
          runLength >=
          minimumHorizontalRun
        ) {
          for (
            let removeX =
              runStart;
            removeX < x;
            removeX += 1
          ) {
            pixelsToRemove[
              y * width +
                removeX
            ] = 1;
          }
        }

        runStart = -1;
      }
    }
  }

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    let runStart = -1;

    for (
      let y = 0;
      y <= height;
      y += 1
    ) {
      const isBlack =
        y < height &&
        isBlackPixel(
          data,
          y * width + x,
        );

      if (
        isBlack &&
        runStart === -1
      ) {
        runStart = y;
      }

      if (
        !isBlack &&
        runStart !== -1
      ) {
        const runLength =
          y - runStart;

        if (
          runLength >=
          minimumVerticalRun
        ) {
          for (
            let removeY =
              runStart;
            removeY < y;
            removeY += 1
          ) {
            pixelsToRemove[
              removeY * width +
                x
            ] = 1;
          }
        }

        runStart = -1;
      }
    }
  }

  for (
    let pixelIndex = 0;
    pixelIndex <
    pixelsToRemove.length;
    pixelIndex += 1
  ) {
    if (
      pixelsToRemove[
        pixelIndex
      ] !== 1
    ) {
      continue;
    }

    const index =
      pixelIndex * 4;

    output[index] = 255;
    output[index + 1] = 255;
    output[index + 2] = 255;
    output[index + 3] = 255;
  }

  return output;
}