export type PdfV4OcrRetryPreprocessPixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export function preprocessPdfV4OcrRetryPixels(
  imageData: PdfV4OcrRetryPreprocessPixelBuffer,
  threshold = 210,
): Uint8ClampedArray {
  const output =
    new Uint8ClampedArray(
      imageData.data,
    );

  for (
    let index = 0;
    index < output.length;
    index += 4
  ) {
    const red =
      output[index];

    const green =
      output[index + 1];

    const blue =
      output[index + 2];

    const alpha =
      output[index + 3];

    if (alpha === 0) {
      continue;
    }

    const luminance =
      red * 0.299 +
      green * 0.587 +
      blue * 0.114;

    const value =
      luminance <= threshold
        ? 0
        : 255;

    output[index] = value;
    output[index + 1] = value;
    output[index + 2] = value;
    output[index + 3] = 255;
  }

  return output;
}