/** Fail closed before a browser-local ZIP grows unbounded in memory. */
export const MAX_JPG_ZIP_BYTES = 64 * 1024 * 1024;

export function nextJpgZipByteCount(currentBytes: number, pageBytes: number): number {
  if (!Number.isSafeInteger(currentBytes) || currentBytes < 0 ||
      !Number.isSafeInteger(pageBytes) || pageBytes < 0) {
    throw new Error("Invalid JPG archive byte count.");
  }
  const total = currentBytes + pageBytes;
  if (!Number.isSafeInteger(total) || total > MAX_JPG_ZIP_BYTES) {
    throw new Error(
      "The selected JPG images exceed the 64 MB browser ZIP safety limit. Choose fewer pages and export in smaller batches.",
    );
  }
  return total;
}
