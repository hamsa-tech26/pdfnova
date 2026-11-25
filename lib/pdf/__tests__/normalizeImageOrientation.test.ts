import { describe, expect, it } from "vitest";
import {
  MAX_NORMALIZED_IMAGE_DIMENSION,
  MAX_NORMALIZED_IMAGE_PIXELS,
  readImageDimensionsFromBytes,
} from "../normalizeImageOrientation";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x04, 0x45, 0x78,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

describe("readImageDimensionsFromBytes", () => {
  it("reads PNG IHDR dimensions without decoding image pixels", () => {
    expect(readImageDimensionsFromBytes(pngHeader(4032, 3024), "image/png")).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it("walks JPEG metadata segments to find the start-of-frame dimensions", () => {
    expect(readImageDimensionsFromBytes(jpegHeader(6000, 2000), "image/jpeg")).toEqual({
      width: 6000,
      height: 2000,
    });
  });

  it("accepts the exact 16-megapixel and per-side limits", () => {
    expect(MAX_NORMALIZED_IMAGE_PIXELS).toBe(16_000_000);
    expect(MAX_NORMALIZED_IMAGE_DIMENSION).toBe(8_192);
    expect(readImageDimensionsFromBytes(pngHeader(4000, 4000), "image/png")).toEqual({
      width: 4000,
      height: 4000,
    });
  });

  it("rejects PNG dimensions above the decoded-pixel ceiling", () => {
    expect(() => readImageDimensionsFromBytes(pngHeader(4001, 4000), "image/png"))
      .toThrow("too large to process safely");
  });

  it("rejects JPEG dimensions above the decoded-pixel ceiling", () => {
    expect(() => readImageDimensionsFromBytes(jpegHeader(5000, 4000), "image/jpeg"))
      .toThrow("too large to process safely");
  });

  it("rejects a single dimension above the browser canvas safety limit", () => {
    expect(() => readImageDimensionsFromBytes(pngHeader(8193, 1), "image/png"))
      .toThrow("too large to process safely");
  });

  it("rejects malformed PNG signatures and incomplete IHDR headers", () => {
    const invalidSignature = pngHeader(100, 100);
    invalidSignature[0] = 0;
    expect(() => readImageDimensionsFromBytes(invalidSignature, "image/png"))
      .toThrow("invalid or uses an unsupported encoding");

    expect(() => readImageDimensionsFromBytes(new Uint8Array([0x89, 0x50]), "image/png"))
      .toThrow("invalid or uses an unsupported encoding");
  });

  it("rejects malformed JPEG segment lengths and missing SOF dimensions", () => {
    expect(() => readImageDimensionsFromBytes(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x01]),
      "image/jpeg",
    )).toThrow("invalid or uses an unsupported encoding");

    expect(() => readImageDimensionsFromBytes(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      "image/jpeg",
    )).toThrow("invalid or uses an unsupported encoding");
  });

  it("rejects zero image dimensions", () => {
    expect(() => readImageDimensionsFromBytes(pngHeader(0, 100), "image/png"))
      .toThrow("invalid or uses an unsupported encoding");
  });
});
