import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const norm = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\\s+/g, " ").toLowerCase();
export function scoreFixture(expected, actual) {
  if (!Array.isArray(expected) || !Array.isArray(actual) || !expected.every(Array.isArray) || !actual.every(Array.isArray)) throw new Error("Expected two row matrices");
  const totalCells = expected.reduce((n, row) => n + row.length, 0);
  const matchedRows = expected.filter((row, i) => Array.isArray(actual[i]) && row.length === actual[i].length && row.every((cell, j) => norm(cell) === norm(actual[i][j]))).length;
  const matchedCells = expected.reduce((n, row, i) => n + row.filter((cell, j) => norm(cell) === norm(actual[i]?.[j]) && actual[i]?.[j] !== undefined).length, 0);
  return { expectedRows: expected.length, extractedRows: actual.length, matchedRows, rowAccuracyPct: expected.length ? 100 * matchedRows / expected.length : null, totalCells, matchedCells, cellAccuracyPct: totalCells ? 100 * matchedCells / totalCells : null, exactMatch: matchedRows === expected.length && actual.length === expected.length };
}
export async function benchmark(manifest, results) {
  const byId = new Map(results.map(x => [x.id, x]));
  return { generatedAt: new Date().toISOString(), metricDefinition: "Exact normalized cell text at the same row/column index. Missing or shifted cells fail. This is not semantic or character-error-rate scoring.", fixtures: manifest.fixtures.map(f => {
    const actual = byId.get(f.id);
    return !actual ? {id:f.id,file:f.file,status:"NOT_RUN"} : {id:f.id,file:f.file,status:"MEASURED",...scoreFixture(f.expectedRows,actual.rows)};
  })};
}
if (process.argv[1] && import.meta.url === new URL("file://" + path.resolve(process.argv[1])).href) {
  const manifest = JSON.parse(await fs.readFile("benchmarks/phase10_14/manifest.json","utf8"));
  const file = process.argv[2];
  const results = file ? JSON.parse(await fs.readFile(file,"utf8")) : [];
  if (!Array.isArray(results) || !results.every(v => v && typeof v.id === "string" && Array.isArray(v.rows))) throw new Error("Results must be [{id, rows: string[][]}]");
  const report = await benchmark(manifest,results);
  await fs.mkdir("benchmarks/phase10_14/reports",{recursive:true});
  await fs.writeFile("benchmarks/phase10_14/reports/latest.json",JSON.stringify(report,null,2)+"\\n");
  console.log(JSON.stringify(report,null,2));
  if (file && report.fixtures.some(x=>x.status==="NOT_RUN")) process.exitCode = 2;
}
