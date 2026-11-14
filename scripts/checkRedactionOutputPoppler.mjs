/**
 * Inspect a downloaded, raster-redacted PDF with Poppler, independently of
 * pdf-lib, PDF.js, and the PyMuPDF pixel-fidelity check.
 *
 * This is a test-only second-reader check. It establishes neither a forensic
 * security certification nor the correctness of a user's chosen masks.
 */
import {spawnSync} from "node:child_process";

function readWithPoppler(binary, args) {
  const result = spawnSync(binary, args, {
    encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Do not copy document contents or command stderr into CI logs.
    throw new Error(`POPLER_READER_FAILED:${binary}:${result.error?.code ?? result.status}`);
  }
  return result.stdout;
}

export function verifyRedactionWithPoppler(outputPath, expectedPages) {
  if (!Number.isSafeInteger(expectedPages) || expectedPages < 1) {
    throw new Error("INVALID_EXPECTED_PAGE_COUNT");
  }
  const info = readWithPoppler("pdfinfo", [outputPath]);
  const pages = Number(/^Pages:\s*(\d+)\s*$/im.exec(info)?.[1]);
  if (pages !== expectedPages) throw new Error("POPLER_PAGE_COUNT_CHANGED");
  if (!/^Encrypted:\s*no\s*$/im.test(info)) throw new Error("POPLER_UNEXPECTED_ENCRYPTION");

  // A raster-only export must have no extractable text at all, including text
  // on unselected pages. Whitespace is ignored because Poppler emits page feeds.
  const extractedText = readWithPoppler("pdftotext", ["-enc", "UTF-8", outputPath, "-"]);
  if (extractedText.trim()) throw new Error("POPLER_RETAINED_TEXT");

  const attachments = readWithPoppler("pdfdetach", ["-list", outputPath]).trim();
  if (!/^0 embedded files?$/i.test(attachments)) throw new Error("POPLER_RETAINED_ATTACHMENT");

  const imageRows = readWithPoppler("pdfimages", ["-list", outputPath])
    .split(/\r?\n/)
    .slice(2)
    .map(row => row.trim())
    .filter(Boolean);
  // The export embeds exactly one masked, opaque PNG raster per page. Additional
  // image objects could retain unmasked image data even if visually concealed.
  if (imageRows.length !== expectedPages) throw new Error("POPLER_UNEXPECTED_IMAGE_COUNT");
  for (const [index, row] of imageRows.entries()) {
    if (Number(row.split(/\s+/)[0]) !== index + 1) {
      throw new Error("POPLER_UNEXPECTED_IMAGE_PAGE");
    }
  }
  return {status: "PASS", pages, images: imageRows.length, retainedText: 0, attachments: 0};
}
