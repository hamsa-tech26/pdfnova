import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const reportDir = path.join(root, "benchmarks/phase10_14/reports");
const manifest = JSON.parse(await readFile(path.join(root, "benchmarks/phase10_14/manifest.json"), "utf8"));
const actual = [];
for (const fixture of manifest.fixtures) {
  try {
    const data = JSON.parse(await readFile(path.join(reportDir, "raw", fixture.id + ".json"), "utf8"));
    if (data.id !== fixture.id || !Array.isArray(data.rows)) throw new Error("Bad fixture record: " + fixture.id);
    actual.push(data);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    console.warn("NOT_RUN:", fixture.id);
  }
}
await mkdir(reportDir, {recursive:true});
await writeFile(path.join(reportDir, "actual-results.json"), JSON.stringify(actual, null, 2) + "\n");
console.log("Collected", actual.length, "of", manifest.fixtures.length, "actual V4 runs.");
