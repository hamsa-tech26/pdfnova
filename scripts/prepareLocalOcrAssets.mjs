import {copyFile, mkdir, stat} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

/**
 * Stage the exact installed Tesseract English assets as same-origin files.
 * A missing worker, WASM binary, or language archive fails the build.
 * Generated binaries and third-party notices are not committed to Git.
 */
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = join(projectRoot, "node_modules");
const destination = join(projectRoot, "public", "ocr-runtime");
// Keep the runtime package within a reviewed CDN-transfer budget. A dependency
// update that increases this footprint must receive a fresh size/cost review.
const maxRuntimeBytes = 25 * 1024 * 1024;
const variants = ["lstm", "simd-lstm", "relaxedsimd-lstm"];
const copies = [
  [join(packages, "tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [join(packages, "tesseract.js", "LICENSE.md"), "LICENSE-tesseract-js.txt"],
  [join(packages, "tesseract.js-core", "LICENSE"), "LICENSE-tesseract-core.txt"],
  [join(packages, "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
  ...variants.flatMap(variant => [
    [join(packages, "tesseract.js-core", `tesseract-core-${variant}.wasm.js`), `tesseract-core-${variant}.wasm.js`],
    [join(packages, "tesseract.js-core", `tesseract-core-${variant}.wasm`), `tesseract-core-${variant}.wasm`],
  ]),
];

// Validate the complete set and aggregate byte budget before copying any file.
const sizes = await Promise.all(copies.map(async ([from]) => {
  const size = (await stat(from)).size;
  if (size === 0) throw Error(`Empty OCR runtime asset: ${from}`);
  return size;
}));
const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
if (totalBytes > maxRuntimeBytes) {
  throw Error(`OCR runtime assets exceed the reviewed 25 MiB CDN budget: ${totalBytes} bytes`);
}
await mkdir(destination, {recursive: true});
for (const [from, filename] of copies) await copyFile(from, join(destination, filename));
console.log(`Prepared ${copies.length} same-origin English OCR runtime assets (${(totalBytes / (1024 * 1024)).toFixed(2)} MiB).`);
