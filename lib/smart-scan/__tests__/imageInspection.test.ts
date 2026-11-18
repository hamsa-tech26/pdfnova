import { describe, expect, it } from "vitest";
import {
  inspectScannerImage,
  MAX_SCANNER_IMAGE_PIXELS,
  validateScannerDimensions,
} from "../imageInspection";

const pngHeader = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
  73, 72, 68, 82, 0, 0, 0, 10, 0, 0, 0, 10,
]);
const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

function imageFile(name: string, type: string, bytes: Uint8Array) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("Smart Scanner V0.1 local image inspection", () => {
  it("recognizes a PNG from the extension, MIME type, and bytes", async () => {
    await expect(inspectScannerImage(imageFile("scan.png", "image/png", pngHeader))).resolves.toEqual({
      kind: "png",
      label: "PNG image",
    });
  });

  it("recognizes JPEG even when the browser omits its MIME type", async () => {
    await expect(inspectScannerImage(imageFile("camera.JPG", "", jpegHeader))).resolves.toEqual({
      kind: "jpeg",
      label: "JPG image",
    });
  });

  it("rejects unsupported extension and mismatched bytes", async () => {
    await expect(inspectScannerImage(imageFile("scan.svg", "image/svg+xml", pngHeader))).rejects.toThrow("JPG or PNG");
    await expect(inspectScannerImage(imageFile("scan.png", "image/png", jpegHeader))).rejects.toThrow("valid JPG or PNG header");
    await expect(inspectScannerImage(imageFile("scan.jpg", "image/png", jpegHeader))).rejects.toThrow("does not match");
  });

  it("rejects empty and oversized images", async () => {
    await expect(inspectScannerImage(imageFile("empty.jpg", "image/jpeg", new Uint8Array()))).rejects.toThrow("empty");
    const hugeFile = {
      name: "huge.jpg",
      type: "image/jpeg",
      size: 25 * 1024 * 1024 + 1,
      slice: () => new Blob([jpegHeader]),
    };
    await expect(inspectScannerImage(hugeFile)).rejects.toThrow("25 MB");
  });

  it("limits decoded pixels and rejects impossible dimensions", () => {
    expect(validateScannerDimensions(2000, 3000)).toBeNull();
    expect(validateScannerDimensions(0, 3000)).toMatch(/could not be decoded/);
    expect(validateScannerDimensions(MAX_SCANNER_IMAGE_PIXELS, 2)).toMatch(/40 megapixel/);
  });
});
