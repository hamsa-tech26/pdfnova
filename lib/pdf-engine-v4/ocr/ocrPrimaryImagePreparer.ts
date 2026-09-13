import type {
  PdfV4PreparedOcrPage,
} from "./ocrPageRenderer";

import {
  preprocessPdfV4OcrRetryPixels,
} from "./ocrRetryImagePreprocessor";

import {
  removePdfV4OcrRetryGridLines,
} from "./ocrRetryGridLineRemover";

function loadPdfV4PrimaryOcrImage(
  imageDataUrl: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        reject(
          new Error(
            "Primary OCR image could not be loaded.",
          ),
        );

      image.src =
        imageDataUrl;
    },
  );
}

export async function preparePdfV4PrimaryOcrPages(
  pages: PdfV4PreparedOcrPage[],
): Promise<PdfV4PreparedOcrPage[]> {
  if (typeof window === "undefined") {
    throw new Error(
      "Primary OCR image preparation must run inside the browser.",
    );
  }

  const preparedPages:
    PdfV4PreparedOcrPage[] = [];

  for (const page of pages) {
    const image =
      await loadPdfV4PrimaryOcrImage(
        page.imageDataUrl,
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      image.width;

    canvas.height =
      image.height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Canvas is not supported in this browser.",
      );
    }

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );

    const originalPixels =
      new Uint8ClampedArray(
        imageData.data,
      );

    const detectionPixels =
      preprocessPdfV4OcrRetryPixels(
        {
          data:
            imageData.data,
          width:
            imageData.width,
          height:
            imageData.height,
        },
        210,
      );

    const gridDetectionPixels =
      removePdfV4OcrRetryGridLines(
        {
          data:
            detectionPixels,
          width:
            imageData.width,
          height:
            imageData.height,
        },
        0.35,
        0.3,
      );

    const cleanedPixels =
      new Uint8ClampedArray(
        originalPixels,
      );

    for (
      let pixelIndex = 0;
      pixelIndex <
        imageData.width *
          imageData.height;
      pixelIndex += 1
    ) {
      const index =
        pixelIndex * 4;

      const wasBlack =
        detectionPixels[index] === 0;

      const wasRemoved =
        gridDetectionPixels[index] ===
        255;

      if (
        !wasBlack ||
        !wasRemoved
      ) {
        continue;
      }

      cleanedPixels[index] = 255;
      cleanedPixels[index + 1] = 255;
      cleanedPixels[index + 2] = 255;
      cleanedPixels[index + 3] = 255;
    }

    imageData.data.set(
      cleanedPixels,
    );
    context.putImageData(
      imageData,
      0,
      0,
    );

    preparedPages.push({
      ...page,
      imageDataUrl:
        canvas.toDataURL(
          "image/png",
        ),
    });
  }

  return preparedPages;
}
