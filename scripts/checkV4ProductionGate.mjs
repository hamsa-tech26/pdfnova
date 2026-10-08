import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_THRESHOLDS = Object.freeze({
  minimumCellAccuracyPct: 95,
  minimumRowAccuracyPct: 75,
  requireActualOcr: true,
  requireAllFixtures: true,
});

/** Production gate is deliberately separate from successfully running a benchmark. */
export function checkV4ProductionGate(report, thresholds = DEFAULT_THRESHOLDS) {
  const failures = [];
  const fixtures = Array.isArray(report?.fixtures) ? report.fixtures : [];
  if (!fixtures.length) failures.push("No benchmark fixtures found.");
  for (const fixture of fixtures) {
    const id = String(fixture.id ?? "unknown");
    if (fixture.status !== "MEASURED") {
      failures.push(id + ": measurement missing or not completed.");
      continue;
    }
    if (thresholds.requireActualOcr && fixture.ocrAttempted !== true) {
      failures.push(id + ": no confirmed OCR attempt.");
    }
    if (fixture.cellAccuracyPct === null || !Number.isFinite(fixture.cellAccuracyPct) ||
        fixture.cellAccuracyPct < thresholds.minimumCellAccuracyPct) {
      failures.push(id + ": cell accuracy " + fixture.cellAccuracyPct + "% below " + thresholds.minimumCellAccuracyPct + "%.");
    }
    if (fixture.rowAccuracyPct === null || !Number.isFinite(fixture.rowAccuracyPct) ||
        fixture.rowAccuracyPct < thresholds.minimumRowAccuracyPct) {
      failures.push(id + ": row accuracy " + fixture.rowAccuracyPct + "% below " + thresholds.minimumRowAccuracyPct + "%.");
    }
    if (fixture.expectedRows !== fixture.extractedRows) {
      failures.push(id + ": data row count mismatch (" + fixture.extractedRows + " vs " + fixture.expectedRows + ").");
    }
  }
  if (thresholds.requireAllFixtures && fixtures.length !== 4) {
    failures.push("Expected all four Phase 10.14 fixtures; got " + fixtures.length + ".");
  }
  return {status:failures.length === 0 ? "PASS" : "BLOCKED", failures, thresholds, fixtureCount:fixtures.length,
    scope:"Synthetic English OCR/table qualification ONLY; does not certify Phases 10.15–10.20."};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const reportPath = process.argv[2] ?? "benchmarks/phase10_14/reports/latest.json";
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const result = checkV4ProductionGate(report);
  console.log(JSON.stringify(result,null,2));
  if (result.status !== "PASS") process.exitCode = 1;
}
