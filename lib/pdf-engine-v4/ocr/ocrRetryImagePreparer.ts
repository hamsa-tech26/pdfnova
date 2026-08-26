export type PdfV4PreparedOcrRetryImage = {
  pageNumber: number;

  imageDataUrl: string;

  width: number;
  height: number;

  originalPageWidth: number;
  originalPageHeight: number;

  sourceRectangle: {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  retryScale: number;

  source:
    "ocr-retry-crop";
};

function loadPdfV4OcrRetryImage(
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
            "OCR retry image could not be loaded.",
          ),
        );

      image.src =
        imageDataUrl;
    },
  );
}

export async function preparePdfV4OcrRetryImage(
  pageNumber: number,
  imageDataUrl: string,
  sourceRectangle: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
  retryScale = 2,
): Promise<PdfV4PreparedOcrRetryImage> {
  if (typeof window === "undefined") {
    throw new Error(
      "OCR retry image preparation must run inside the browser.",
    );
  }

  if (
    sourceRectangle.width <= 0 ||
    sourceRectangle.height <= 0 ||
    retryScale <= 0
  ) {
    throw new Error(
      "OCR retry image dimensions and scale must be positive.",
    );
  }

  const image =
  await loadPdfV4OcrRetryImage(
    imageDataUrl,
  );

const cropLeft =
  Math.max(
    0,
    Math.floor(
      sourceRectangle.left,
    ),
  );

const cropTop =
  Math.max(
    0,
    Math.floor(
      sourceRectangle.top,
    ),
  );

const cropWidth =
  Math.min(
    Math.floor(
      sourceRectangle.width,
    ),
    image.width - cropLeft,
  );

const cropHeight =
  Math.min(
    Math.floor(
      sourceRectangle.height,
    ),
    image.height - cropTop,
  );

if (
  cropWidth <= 0 ||
  cropHeight <= 0
) {
  throw new Error(
    "OCR retry crop falls outside the rendered page.",
  );
}

const canvas =
  document.createElement(
    "canvas",
  );

canvas.width =
  Math.ceil(
    cropWidth * retryScale,
  );

canvas.height =
  Math.ceil(
    cropHeight * retryScale,
  );

const context =
  canvas.getContext("2d");

if (!context) {
  throw new Error(
    "Canvas is not supported in this browser.",
  );
}

context.drawImage(
  image,
  cropLeft,
  cropTop,
  cropWidth,
  cropHeight,
  0,
  0,
  canvas.width,
  canvas.height,
);

const retryImageDataUrl =
  canvas.toDataURL(
    "image/png",
  );

return {
  pageNumber,
  imageDataUrl:
    retryImageDataUrl,
  width: canvas.width,
  height: canvas.height,
  originalPageWidth:
    image.width,
  originalPageHeight:
    image.height,
  sourceRectangle: {
    left: cropLeft,
    top: cropTop,
    width: cropWidth,
    height: cropHeight,
  },
  retryScale,
  source:
    "ocr-retry-crop",
};
}