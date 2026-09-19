import type {
  PdfV4PreparedOcrPage,
} from "./ocrPageRenderer";

function loadPdfV4DeskewImage(
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
            "OCR deskew image could not be loaded.",
          ),
        );

      image.src =
        imageDataUrl;
    },
  );
}

export async function preparePdfV4DeskewedOcrPage(
  page: PdfV4PreparedOcrPage,
  detectedSkewRadians: number,
): Promise<PdfV4PreparedOcrPage> {
  if (typeof window === "undefined") {
    throw new Error(
      "OCR deskew image preparation must run inside the browser.",
    );
  }

  const image =
    await loadPdfV4DeskewImage(
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

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  context.save();

  context.translate(
    canvas.width / 2,
    canvas.height / 2,
  );

  context.rotate(
  detectedSkewRadians,
);

  context.drawImage(
    image,
    -image.width / 2,
    -image.height / 2,
  );

  context.restore();

  return {
    ...page,
    imageDataUrl:
      canvas.toDataURL(
        "image/png",
      ),
  };
}