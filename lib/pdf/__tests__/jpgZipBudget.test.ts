import { describe, expect, it } from "vitest";
import { MAX_JPG_ZIP_BYTES, nextJpgZipByteCount } from "../jpgZipBudget";

describe("browser JPG archive memory budget", () => {
  it("accepts an exact budget boundary and returns updated count", () => {
    expect(nextJpgZipByteCount(0, 1024)).toBe(1024);
    expect(nextJpgZipByteCount(MAX_JPG_ZIP_BYTES - 1, 1)).toBe(MAX_JPG_ZIP_BYTES);
  });
  it("rejects oversized batches without wrapping or partial success", () => {
    expect(() => nextJpgZipByteCount(MAX_JPG_ZIP_BYTES, 1)).toThrow(/64 MB/);
    expect(() => nextJpgZipByteCount(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
  it("rejects malformed or negative lengths", () => {
    for (const pair of [[-1, 2], [2, -1], [NaN, 1], [1.5, 2], [0, Infinity]]) {
      expect(() => nextJpgZipByteCount(pair[0], pair[1])).toThrow(/Invalid JPG/);
    }
  });
});
