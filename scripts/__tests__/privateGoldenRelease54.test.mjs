import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {CATEGORIES,validatePrivateManifest} from "../privateGoldenScorer.mjs";
import {makePrivateGoldenDraft,scaffoldChecklist} from "../privateGoldenScaffold.mjs";
import {buildGoldenFailurePlan} from "../privateGoldenTriage.mjs";
const hashFor=x=>createHash("sha256").update("test "+x).digest("hex");
function caseOf(category,id){
  const expected=category==="ocr-text"?{text:"REFERENCE PRIVATE ANSWER"}:
    category==="table"?{tableIndex:0,rows:[["COL1","COL2"],["A","B"]]}:
    category==="form"?{visiblePhrases:["ANNOTATED VALUE"]}:
    {pageCount:1,pages:[{width:612,height:792,rotation:0,requiredText:["PAGE ONE"]}]};
  return {id,category,file:"case-"+id+".pdf",sha256:hashFor(id),
    rights:"licensed-test",
    annotation:{annotatorId:"reviewer-01",reviewerId:"reviewer-02",
      reviewerApproved:true,reviewDate:"2026-10-10"},expected};
}
const manifest=(cases)=>({schema:"kukureku-private-golden-v1",
  provenance:"REAL_WORLD_HUMAN_REVIEWED",cases});
const fixtures=()=>CATEGORIES.flatMap(c=>[caseOf(c,c+"-one"),caseOf(c,c+"-two")]);
describe("Release 54 private real-document readiness and remediation",()=>{
  it("makes eight distinct unapproved slots without forging a real reviewed corpus",()=>{
    const draft=makePrivateGoldenDraft();
    expect(draft.provenance).toBe("DRAFT_NOT_REVIEWED");
    expect(draft.cases).toHaveLength(8);
    expect(new Set(draft.cases.map(c=>c.file)).size).toBe(8);
    expect(draft.cases.every(c=>c.annotation.reviewerApproved===false&&c.sha256==="")).toBe(true);
    expect(()=>validatePrivateManifest(draft)).toThrow();
  });
  it("defaults to NOT_RUN in the checklist and does not count synthetic documents",()=>{
    const plan=scaffoldChecklist();
    expect(plan.qualification).toBe("NOT_RUN");
    expect(plan.realWorldDocumentsMeasured).toBe(0);
    expect(Object.values(plan.slots).reduce((a,x)=>a+x.requested,0)).toBe(8);
  });
  it("blocks scoring with eight real annotated cases but no measured browser outputs",()=>{
    const report=buildGoldenFailurePlan(manifest(fixtures()),[]);
    expect(report.status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");
    expect(report.notRun).toBe(8);
    expect(report.prioritizedWork).toHaveLength(4);
  });
  it("generates category-specific useful failure triage and preserves exact counts",()=>{
    const cases=fixtures();
    const evidence=cases.map((c,i)=>({id:c.id,status:i===0||i===2?"FAIL":"PASS",
      reasonCode:i===0?"TEXT_ACCURACY":"TABLE_ACCURACY",
      metrics:{characterErrorPct:42,exactCellPct:73}}));
    const report=buildGoldenFailurePlan(manifest(cases),evidence);
    expect(report.failed).toBe(2);
    expect(report.status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");
    expect(report.prioritizedWork[0].category).toBe("ocr-text");
    expect(report.byCategory.table.remainingPassingCases).toBe(1);
    expect(report.byCategory["ocr-text"].observations[0].metrics.characterErrorPct).toBe(42);
  });
  it("refuses to leak raw private OCR text or arbitrary metrics into generated reports",()=>{
    const cases=fixtures();
    const evidence=[{id:cases[0].id,status:"FAIL",reasonCode:"TEXT_ACCURACY",
      metrics:{characterErrorPct:10,expectedText:cases[0].expected.text,
        rawPdfBytes:"PRIVATE_PDF_CONTENT",notNumber:"private secret"}}];
    const report=JSON.stringify(buildGoldenFailurePlan(manifest(cases),evidence));
    expect(report).not.toContain("REFERENCE PRIVATE ANSWER");
    expect(report).not.toContain("PRIVATE_PDF_CONTENT");
    expect(report).not.toContain("private secret");
    expect(report).toContain("characterErrorPct");
  });
  it("produces a scoped pass only when every distinct case is actually measured and passes",()=>{
    const cases=fixtures();
    const evidence=cases.map(c=>({id:c.id,status:"PASS",reasonCode:"THRESHOLD_MET",metrics:{}}));
    const report=buildGoldenFailurePlan(manifest(cases),evidence);
    expect(report.status).toBe("PASS_SCOPED_REAL_WORLD");
    expect(report.prioritizedWork).toHaveLength(0);
    expect(report.passed).toBe(8);
  });
});
