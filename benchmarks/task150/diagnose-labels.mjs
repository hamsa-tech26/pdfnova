import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { createJiti } from "jiti";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

const base = process.argv[2];
if (!base) throw new Error("Usage: node benchmarks/task150/diagnose-labels.mjs /path/to/public-sources");

const jiti = createJiti(import.meta.url);
const { analyzePdfV4 } = jiti("../../lib/pdf-engine-v4/pipeline/analyzePdfV4.ts");
const { isScientificReviewOnlyTable } = jiti("../../lib/converters/pdfToXlsxStructuralEvidence.ts");

const editions = [
  ["Sep 2026", "kukureku-task149-cpi-sep-2026.pdf", "kukureku-task149-bls-table1-202609.xlsx"],
  ["Aug 2026", "kukureku-task149-cpi-aug-2026.pdf", "kukureku-task149-bls-table1-202608.xlsx"],
];

function decodeXml(s) {
  return s.replaceAll("&amp;", "&").replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

async function publisherLabels(bytes) {
  const workbook = await JSZip.loadAsync(bytes);
  const sheet = await workbook.file("xl/worksheets/sheet1.xml").async("string");
  const stringsXml = await workbook.file("xl/sharedStrings.xml").async("string");
  const strings = [...stringsXml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map(match =>
    decodeXml([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)].map(t => t[1]).join("")));
  const labels = [];
  for (const row of sheet.matchAll(/<row\s+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gu)) {
    const index = Number(row[1]);
    if (index < 7 || index > 45) continue;
    const id = row[2].match(/<c\s+r="B\d+"[^>]*>([\s\S]*?)<\/c>/u)?.[1]?.match(/<v>(\d+)<\/v>/u)?.[1];
    const numericColumns = [...row[2].matchAll(/<c\s+r="([C-K])\d+"[^>]*><v>([^<]+)<\/v><\/c>/gu)].length;
    if (id !== undefined && numericColumns === 9) labels.push(strings[Number(id)]);
  }
  return labels;
}

for (const [edition, pdfName, workbookName] of editions) {
  const original = await PDFDocument.load(await readFile(join(base, pdfName)));
  const pageDocument = await PDFDocument.create();
  const [page] = await pageDocument.copyPages(original, [8]);
  pageDocument.addPage(page);
  globalThis.window = {};
  const pdfBytes = await pageDocument.save();
  const copy = new Uint8Array(pdfBytes.length);
  copy.set(pdfBytes);
  const extraction = await analyzePdfV4(new File([copy], pdfName, { type: "application/pdf" }));
  const table = extraction.tables.find(t => t.rows.length === 38 &&
    t.columnCount === 10 && isScientificReviewOnlyTable(t));
  if (!table) throw new Error(`No review-only source table for ${edition}`);
  const fromPdf = table.rows.slice(1).map(row => row.cells[0].text.trim());
  const fromWorkbook = await publisherLabels(await readFile(join(base, workbookName)));
  if (fromPdf.length !== 37 || fromWorkbook.length !== 37) throw new Error(
    `${edition}: expected 37 source rows; got pdf=${fromPdf.length}, workbook=${fromWorkbook.length}`);
  const mismatches = fromPdf.map((actual, index) => ({
    index: index + 1,
    actual,
    expected: fromWorkbook[index],
  })).filter(item => item.actual !== item.expected);
  const withoutDotLeaders = value => value.replace(/(?:\s*\.\s*){3,}$/gu, "").trim();
  const afterLeaderCleanup = fromPdf.map(withoutDotLeaders);
  const leaderOnlyMatch = afterLeaderCleanup.filter((value, i) => value === fromWorkbook[i]).length;
  // This source-pinned count verifies that presentation-only leader cleanup
  // is bounded. Footnote rearrangement is deliberately not performed.
  assert.equal(leaderOnlyMatch, 28, `${edition}: publisher label agreement changed`);
  const remaining = afterLeaderCleanup.map((actual, index) => ({
    index: index + 1,
    actual,
    expected: fromWorkbook[index],
  })).filter(item => item.actual !== item.expected);
  console.log(JSON.stringify({ edition, exactLabels: 37 - mismatches.length,
    publisherLabels: 37, leaderOnlyMatch, remainingAfterLeaderCleanup: remaining }, null, 2));
}
