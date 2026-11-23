import { dataUrlToBytes } from "@/lib/pdf/dataUrlBytes";

export type NormalizableImageMimeType = "image/png" | "image/jpeg";

export type NormalizedImageDataUrl = {
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
};

/**
 * Decode an uploaded image with its EXIF orientation applied, then re-encode
 * the displayed pixels without the orientation metadata. This keeps the
 * preview geometry and the PDF image XObject in the same orientation.
 *
 * All work is performed with browser-local Blob, ImageBitmap, and Canvas APIs.
 */
export async function normalizeImageOrientationDataUrl(
  dataUrl: string,
  mimeType: NormalizableImageMimeType,
): Promise<NormalizedImageDataUrl> {
  const bytes = dataUrlToBytes(dataUrl);
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: mimeType,
  });

  let bitmap: ImageBitmap | null = null;
  let source: CanvasImageSource | null = null;
  let width = 0;
  let height = 0;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      bitmap?.close();
      bitmap = null;
    }
  }

  if (!source) {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to decode the uploaded image."));
        image.src = objectUrl;
      });
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error("The uploaded image has invalid dimensions.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not supported in this browser.");
    }

    context.drawImage(source, 0, 0, width, height);
    const normalizedDataUrl = canvas.toDataURL(
      mimeType,
      mimeType === "image/jpeg" ? 0.94 : undefined,
    );

    if (!normalizedDataUrl.startsWith(`data:${mimeType};`)) {
      throw new Error("Unable to normalize the uploaded image.");
    }

    return {
      dataUrl: normalizedDataUrl,
      width,
      height,
      aspectRatio: width / height,
    };
  } finally {
    bitmap?.close();
  }
}
