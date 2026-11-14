import {copyFile, mkdir, readFile, stat} from "node:fs/promises";
import {createHash} from "node:crypto";
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
const modelSource = join(packages, "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz");
// The packaged model was independently matched by Git blob SHA to
// naptha/tessdata gh-pages:4.0.0_best_int/eng.traineddata.gz (730a6a59...).
// Its upstream repository licenses the trained data under Apache-2.0, although
// the npm package metadata says MIT. Distribute the exact upstream license and
// keep the contradictory metadata flagged for separate release/legal review.
const expectedModelSha256 = "45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91";
// Keep the runtime package within a reviewed CDN-transfer budget. A dependency
// update that increases this footprint must receive a fresh size/cost review.
const maxRuntimeBytes = 25 * 1024 * 1024;
const variants = ["lstm", "simd-lstm", "relaxedsimd-lstm"];
const copies = [
  [join(packages, "tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [join(packages, "tesseract.js", "LICENSE.md"), "LICENSE-tesseract-js.txt"],
  [join(packages, "tesseract.js-core", "LICENSE"), "LICENSE-tesseract-core.txt"],
  [join(projectRoot, "vendor", "naptha-tessdata", "LICENSE"), "LICENSE-eng-traineddata-Apache-2.0.txt"],
  [modelSource, "eng.traineddata.gz"],
  ...variants.flatMap(variant => [
    [join(packages, "tesseract.js-core", `tesseract-core-${variant}.wasm.js`), `tesseract-core-${variant}.wasm.js`],
    [join(packages, "tesseract.js-core", `tesseract-core-${variant}.wasm`), `tesseract-core-${variant}.wasm`],
  ]),
];

const actualModelSha256 = createHash("sha256").update(await readFile(modelSource)).digest("hex");
if (actualModelSha256 !== expectedModelSha256) {
  throw Error("English OCR trained-data bytes differ from the independently traced upstream model; build withheld.");
}

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
