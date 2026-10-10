import { describe, expect, it } from "vitest";
import { buildIntentPlan } from "../intentPlanner";

describe("browser-local workflow intent planner", () => {
  it("creates an ordered manual plan using existing tool routes", () => {
    const result = buildIntentPlan("Merge these PDFs, compress them, add page numbers and protect the result.");
    expect(result.steps.map(x=>x.id)).toEqual(["merge", "compress", "number", "protect"]);
    expect(result.steps.every(x => x.href.startsWith("/"))).toBe(true);
    expect(result.steps.filter(x=>x.requiresReview).map(x=>x.id)).toEqual(["merge","protect"]);
    expect(result.warnings.join(" ")).toContain("not passed automatically");
  });
  it("does not repeat an action and respects explicit simple negations", () => {
    expect(buildIntentPlan("merge and combine 3 PDFs but do not protect").steps.map(x=>x.id)).toEqual(["merge"]);
    expect(buildIntentPlan("compress and compress again").steps.map(x=>x.id)).toEqual(["compress"]);
  });
  it("does not treat unsupported AI goals as automatically executable", () => {
    const r=buildIntentPlan("Summarize the PDF and email it to somebody");
    expect(r.steps).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/No supported operation|outside this local tool/);
  });
  it("flags sensitive and contradictory requested operations", () => {
    const plan = buildIntentPlan("redact and protect then unlock");
    expect(plan.steps.map(x=>x.id)).toEqual(["redact","protect","unlock"]);
    expect(plan.warnings.some(x=>x.includes("Confirm the intended order"))).toBe(true);
  });
});
