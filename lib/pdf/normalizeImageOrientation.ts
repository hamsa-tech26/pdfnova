import { dataUrlToBytes } from "@/lib/pdf/dataUrlBytes";

export type NormalizableImageMimeType = "image/png" | "image/jpeg";

export type NormalizedImageDataUrl = {
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
};

export type ImageDimensions = {
  width: number;
  height: number;
};

export const MAX_NORMALIZED_IMAGE_PIXELS = 16_000_000;
export const MAX_NORMALIZED_IMAGE_DIMENSION = 8_192;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function invalidImage(): Error {
  return new Error("The uploaded image is invalid or uses an unsupported encoding.");
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw invalidImage();
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkLength = view.getUint32(8, false);
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunkLength !== 13 || chunkType !== "IHDR") {
    throw invalidImage();
  }

  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw invalidImage();
  }

  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw invalidImage();
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      throw invalidImage();
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0x00) {
      throw invalidImage();
    }

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > bytes.length) {
      throw invalidImage();
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw invalidImage();
    }

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) {
        throw invalidImage();
      }

      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }

    offset += segmentLength;
  }

  throw invalidImage();
}

function assertSafeImageDimensions({ width, height }: ImageDimensions): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw invalidImage();
  }

  if (
    width > MAX_NORMALIZED_IMAGE_DIMENSION ||
    height > MAX_NORMALIZED_IMAGE_DIMENSION ||
    width > Math.floor(MAX_NORMALIZED_IMAGE_PIXELS / height)
  ) {
    throw new Error(
      "This image is too large to process safely. Please use an image up to 16 megapixels and 8,192 pixels per side.",
    );
  }
}

/**
 * Read PNG IHDR or JPEG SOF dimensions before asking the browser to decode
 * the image. This prevents a small compressed upload from triggering an
 * unexpectedly large ImageBitmap or canvas allocation.
 */
export function readImageDimensionsFromBytes(
  bytes: Uint8Array,
  mimeType: NormalizableImageMimeType,
): ImageDimensions {
  const dimensions = mimeType === "image/png"
    ? readPngDimensions(bytes)
    : readJpegDimensions(bytes);

  assertSafeImageDimensions(dimensions);
  return dimensions;
}

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
  readImageDimensionsFromBytes(bytes, mimeType);

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
    assertSafeImageDimensions({ width, height });

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

    if (!normalizedDataUrl.startsWith("data:" + mimeType + ";")) {
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
