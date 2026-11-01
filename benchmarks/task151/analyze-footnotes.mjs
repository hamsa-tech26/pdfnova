import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createJiti } from "jiti";
import { PDFDocument } from "pdf-lib";

const dir = process.argv[2];
if (!dir) throw new Error("Pass directory containing the original public BLS PDFs");
const jiti = createJiti(import.meta.url);
const { analyzePdfV4 } = jiti("../../lib/pdf-engine-v4/pipeline/analyzePdfV4.ts");
const { isScientificReviewOnlyTable } = jiti("../../lib/converters/pdfToXlsxStructuralEvidence.ts");

const sources = [
  ["September 2026", "kukureku-task149-cpi-sep-2026.pdf", "d2fe7deb0ae83a869a37553c9d3934d3d5be4969cd3ca9763a4881df878bf66a"],
  ["August 2026", "kukureku-task149-cpi-aug-2026.pdf", "658d7de6366114cb1638af490e14fe03cd1fab8faa8c9ce9aeba95c5b9a65e52"],
];
const raisedLabels = [6, 10, 24, 25, 26, 30, 32, 33, 35];
const round = x => Number(x.toFixed(2));

for (const [name, pdfName, expectedHash] of sources) {
  const pdfBytes = await readFile(join(dir, pdfName));
  const hash = createHash("sha256").update(pdfBytes).digest("hex");
  if (hash !== expectedHash) throw new Error(`Publisher source hash mismatch: ${pdfName}`);
  const original = await PDFDocument.load(pdfBytes);
  const sliced = await PDFDocument.create();
  const [page] = await sliced.copyPages(original, [8]);
  sliced.addPage(page);
  const sourceBytes = await sliced.save();
  const copy = new Uint8Array(sourceBytes.length);
  copy.set(sourceBytes);
  globalThis.window = {};
  const result = await analyzePdfV4(new File([copy], pdfName, { type: "application/pdf" }));
  const table = result.tables.find(t => t.rows.length === 38 &&
    t.columnCount === 10 && isScientificReviewOnlyTable(t));
  if (!table) throw new Error(`Missing source-bound caption table: ${name}`);
  console.log(`\n=== ${name} ===`);
  for (const sourceIndex of raisedLabels) {
    const cell = table.rows[sourceIndex].cells[0];
    const words = cell.words.filter(word => !/^(?:\s*\.\s*)+$/u.test(word.text));
    console.log(JSON.stringify({ row: sourceIndex, extractedLabel: cell.text,
      words: words.map(word => ({ t: word.text.slice(0, 55), x: round(word.bounds.x),
        xEnd: round(word.bounds.x + word.bounds.width),
        y: round(word.bounds.y), h: round(word.bounds.height),
        size: word.font?.size ?? null, id: word.id })),
    }));
  }
}
