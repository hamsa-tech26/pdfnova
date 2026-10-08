import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Phase 10.20: independently measured real-world evidence, never green-CI-by-assumption. */
export const REQUIRED_CATEGORIES = Object.freeze([
  "native", "scanned", "hybrid", "complex", "multipage", "rotated", "hindi", "bengali",
]);
export const REQUIRED_PHASES = Object.freeze(["10.15","10.16","10.17","10.18","10.19"]);
export const THRESHOLDS = Object.freeze({
  distinctRealDocuments:20,perCategory:2,cellPct:95,rowPct:75,structurePct:90,
  stressBytes:20*1024*1024,peakHeapBytes:512*1024*1024,mainThreadBlockMs:200,
});
export function checkRelease37Gate(report, limits=THRESHOLDS) {
  const failures = [];
  const documents = Array.isArray(report?.corpus?.documents) ? report.corpus.documents : [];
  const ids = new Set();
  for (const item of documents) {
    if (typeof item?.id !== "string" || !item.id || ids.has(item.id)) {
      failures.push("Missing/duplicate real-world document ID.");
      continue;
    }
    ids.add(item.id);
    if (item.origin !== "real-world" ||
        !["consented","de-identified","public-domain","licensed"].includes(item.usageRights) ||
        !/^[a-f0-9]{64}$/i.test(String(item.sha256 ?? "")) ||
        !/^https:\/\/[^ ]+/i.test(String(item.rightsUrl ?? "")) ||
        item.independentReferenceReview !== true) {
      failures.push(item.id + ": missing real-world source rights, independent annotation review or hash evidence.");
    }
  }
  if (ids.size < limits.distinctRealDocuments) failures.push("Real corpus has " + ids.size + " of " + limits.distinctRealDocuments + " required documents.");
  for (const category of REQUIRED_CATEGORIES) {
    const coverage = new Set(documents.filter(d=>Array.isArray(d?.categories) && d.categories.includes(category) && ids.has(d.id)).map(d=>d.id)).size;
    if (coverage < limits.perCategory) failures.push(category + ": insufficient real-world document coverage.");
    const metric = report?.metrics?.[category];
    if (metric?.status !== "MEASURED" || metric.source !== "real-world" ||
        !Number.isFinite(metric.cellPct) || metric.cellPct < limits.cellPct ||
        !Number.isFinite(metric.rowPct) || metric.rowPct < limits.rowPct ||
        !Number.isFinite(metric.structurePct) || metric.structurePct < limits.structurePct ||
        !Number.isInteger(metric.documentCount) || metric.documentCount < limits.perCategory ||
        metric.cellPct > 100 || metric.rowPct > 100 || metric.structurePct > 100 ||
        (["scanned","hindi","bengali"].includes(category) && metric.actualOcrAttempted !== true) ||
        metric.scoredFromFiles !== true || metric.groundTruthVerified !== true ||
        !/^[a-f0-9]{64}$/i.test(String(metric.evidenceDigest ?? ""))) {
      failures.push(category + ": separately measured cell, row and structure accuracy missing or insufficient.");
    }
  }
  for (const phase of REQUIRED_PHASES) {
    if (report?.phases?.[phase]?.status !== "PASS" ||
        !/^https:\/\/\S+/u.test(String(report?.phases?.[phase]?.evidenceUrl ?? ""))) {
      failures.push("Phase " + phase + " independent evidence missing.");
    }
  }
  if (!Number.isInteger(report?.regressions?.critical) || report.regressions.critical !== 0) {
    failures.push("Zero-critical-regression clearance not recorded.");
  }
  const p=report?.performance;
  if (p?.status !== "MEASURED" ||
      !Number.isFinite(p.stressFileBytes) || p.stressFileBytes < limits.stressBytes ||
      !Number.isFinite(p.peakHeapBytes) || p.peakHeapBytes > limits.peakHeapBytes ||
      !Number.isFinite(p.mainThreadBlockMs) || p.mainThreadBlockMs > limits.mainThreadBlockMs ||
      p.pageBatchingVerified !== true || p.cancellationVerified !== true) {
    failures.push("20–25 MB stress, heap, main-thread, batching or cancellation evidence absent/failed.");
  }
  if (report?.syntheticPhase10_14?.status !== "PASS") failures.push("Actual Phase 10.14 OCR gate must also PASS.");
  return {status:failures.length?"BLOCKED":"PASS",failures,documentCount:ids.size,
    scope:"Formal Phase 10.20 V4 Stable acceptance — independent real-world evidence required"};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const filename=process.argv[2] ?? "benchmarks/release37/report.json";
  const report=JSON.parse(await readFile(filename,"utf8"));
  const result=checkRelease37Gate(report);
  console.log(JSON.stringify(result,null,2));
  if (result.status !== "PASS") process.exitCode=1;
}
