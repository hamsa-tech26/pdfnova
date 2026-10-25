import { MAX_RASTER_IMAGE_BYTES } from "../pdf/imageBatchLimits";

export type ScannerImageKind = "jpeg" | "png";

export type ScannerImageFile = Pick<File, "name" | "size" | "type" | "slice">;

export type ScannerImageInspection = {
  kind: ScannerImageKind;
  label: string;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Inspect image bytes before offering a workspace handoff. The browser
 * separately decodes the image before the user can continue.
 */
export async function inspectScannerImage(
  file: ScannerImageFile,
): Promise<ScannerImageInspection> {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("This image is empty or has an invalid file size.");
  }

  if (file.size > MAX_RASTER_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 25 MB.");
  }

  const name = file.name.toLowerCase();
  const expectedKind: ScannerImageKind | null = name.endsWith(".png")
    ? "png"
    : name.endsWith(".jpg") || name.endsWith(".jpeg")
      ? "jpeg"
      : null;

  if (!expectedKind) {
    throw new Error("Choose a JPG or PNG image. Other file types are not supported yet.");
  }

  const mimeType = file.type.toLowerCase();
  if (
    mimeType &&
    mimeType !== (expectedKind === "png" ? "image/png" : "image/jpeg") &&
    !(expectedKind === "jpeg" && mimeType === "image/jpg")
  ) {
    throw new Error("This image's format does not match its file name.");
  }

  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const validPng =
    header.length >= 24 &&
    PNG_SIGNATURE.every((byte, index) => header[index] === byte) &&
    header[12] === 73 &&
    header[13] === 72 &&
    header[14] === 68 &&
    header[15] === 82;
  const validJpeg =
    header.length >= 4 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff;

  if (expectedKind === "png" ? !validPng : !validJpeg) {
    throw new Error("This file does not contain a valid JPG or PNG header.");
  }

  return {
    kind: expectedKind,
    label: expectedKind === "png" ? "PNG image" : "JPG image",
  };
}

export const MAX_SCANNER_IMAGE_PIXELS = 40_000_000;

export function validateScannerDimensions(width: number, height: number): string | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "This image could not be decoded. Try another JPG or PNG.";
  }

  if (width * height > MAX_SCANNER_IMAGE_PIXELS) {
    return "This image is too large to process safely in your browser (40 megapixel limit).";
  }

  return null;
}
