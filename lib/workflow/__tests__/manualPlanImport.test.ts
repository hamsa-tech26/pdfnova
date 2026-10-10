import {describe,expect,it} from "vitest";
import {importManualIntentPlan} from "../intentPlanner";

const schema = "kukureku-manual-workflow-v1";
function manifest(operations: unknown[]) { return JSON.stringify({schema,operations}); }
describe("saved manual workflow import safety",()=>{
  it("restores only internally defined operation order and trusted labels",()=>{
    const p=importManualIntentPlan(manifest([
      {id:"compress",href:"/compress-pdf",title:"Untrusted",note:"Secret"},
      {id:"merge",href:"/merge-pdf",requiresReview:false},
    ]));
    expect(p.steps.map(s=>s.href)).toEqual(["/compress-pdf","/merge-pdf"]);
    expect(p.steps[0].title).toBe("Compress PDF");
    expect(p.steps[1].requiresReview).toBe(true);
    expect(JSON.stringify(p)).not.toContain("Secret");
    expect(p.warnings.join(" ")).toMatch(/nothing runs automatically/i);
  });
  it("blocks forged and external routes",()=>{
    expect(()=>importManualIntentPlan(manifest([{id:"merge",href:"https://evil.invalid"}]))).toThrow(/unsafe tool route/);
    expect(()=>importManualIntentPlan(manifest([{id:"__proto__"}]))).toThrow(/unsafe tool route/);
    expect(()=>importManualIntentPlan(manifest([{id:"merge"},{id:"merge"}]))).toThrow(/duplicate/);
  });
  it("rejects invalid schema, empty inputs, oversized and malformed JSON",()=>{
    expect(()=>importManualIntentPlan("{}")).toThrow(/unsupported schema/);
    expect(()=>importManualIntentPlan(manifest([]))).toThrow(/unsupported schema/);
    expect(()=>importManualIntentPlan("{bad")).toThrow(/valid JSON/);
    expect(()=>importManualIntentPlan(" ".repeat(64*1024+1))).toThrow(/too large/);
  });
  it("warns when password protection and unlocking are combined",()=>{
    const p=importManualIntentPlan(manifest([{id:"protect"},{id:"unlock"}]));
    expect(p.warnings.join(" ")).toMatch(/Confirm the intended order/);
  });
});
