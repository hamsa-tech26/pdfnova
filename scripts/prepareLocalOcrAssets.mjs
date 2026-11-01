import {copyFile,mkdir,stat} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

/**
 * Browser OCR must not depend on a third-party CDN at runtime. Copy exactly
 * the LSTM-only English worker, device-appropriate cores, and language data
 * from lockfile-installed packages into Next.js's public directory.
 *
 * These generated assets are deliberately not checked into Git. Run before
 * dev/build so a missing or incomplete dependency fails the build explicitly.
 */
const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const packages=join(projectRoot,"node_modules");
const destination=join(projectRoot,"public","ocr-runtime");
const coreVariants=["lstm","simd-lstm","relaxedsimd-lstm"];
const copies=[
  [join(packages,"tesseract.js","dist","worker.min.js"),"worker.min.js"],
  [join(packages,"tesseract.js","LICENSE.md"),"LICENSE-tesseract-js.txt"],
  [join(packages,"tesseract.js-core","LICENSE"),"LICENSE-tesseract-core.txt"],
  [join(packages,"@tesseract.js-data","eng","4.0.0_best_int","eng.traineddata.gz"),
    "eng.traineddata.gz"],
  ...coreVariants.flatMap(variant=>[
    [join(packages,"tesseract.js-core",`tesseract-core-${variant}.wasm.js`),
      `tesseract-core-${variant}.wasm.js`],
    [join(packages,"tesseract.js-core",`tesseract-core-${variant}.wasm`),
      `tesseract-core-${variant}.wasm`],
  ]),
];

// Check all sources before writing so partial npm installs cannot silently
// leave a half-functional browser OCR runtime.
await Promise.all(copies.map(async([from])=>{
  if((await stat(from)).size===0)throw Error(`Empty OCR runtime asset: ${from}`);
}));
await mkdir(destination,{recursive:true});
for(const [from,file] of copies)await copyFile(from,join(destination,file));
console.log(`Prepared ${copies.length} same-origin English OCR runtime assets.`);
