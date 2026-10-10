import {describe,it,expect} from "vitest";
import {CATEGORIES,validatePrivateManifest} from "../privateGoldenScorer.mjs";
import {buildGoldenFailurePlan} from "../privateGoldenTriage.mjs";
import {makePrivateGoldenDraft} from "../privateGoldenScaffold.mjs";
import {createHash} from "node:crypto";
const hash=s=>createHash("sha256").update(s).digest("hex");
const make=(category,id)=>({id,category,file:"case-"+id+".pdf",sha256:hash(id),
 rights:"licensed-test",annotation:{annotatorId:"reviewer-a",reviewerId:"reviewer-b",
 reviewerApproved:true,reviewDate:"2026-10-10"},
 expected:category==="ocr-text"?{text:"Known text"}:category==="table"?{tableIndex:0,rows:[["A","B"],["C","D"]]}:
 category==="form"?{visiblePhrases:["Known phrase"]}:{pageCount:1,pages:[{width:612,height:792,rotation:0,requiredText:["Page"]}]}}); 
const corpus=()=>({schema:"kukureku-private-golden-v1",provenance:"REAL_WORLD_HUMAN_REVIEWED",cases:CATEGORIES.flatMap(c=>[make(c,c+"-one"),make(c,c+"-two")])});
describe("Release 55 real-world quality triage",()=>{
 it("never promotes missing corpus or draft placeholders",()=>{
  expect(makePrivateGoldenDraft().provenance).toBe("DRAFT_NOT_REVIEWED");
  expect(()=>validatePrivateManifest(makePrivateGoldenDraft())).toThrow();
 });
 it("prioritizes failing categories and keeps exact aggregate outcomes",()=>{
  const m=corpus(),ev=m.cases.map((c,i)=>({id:c.id,status:i===0||i===2?"FAIL":"PASS",reasonCode:"TEXT_ACCURACY",metrics:{characterErrorPct:8,rawText:"secret"}}));
  const r=buildGoldenFailurePlan(m,ev);
  expect(r.failed).toBe(2);expect(r.passed).toBe(6);
  expect(r.prioritizedWork[0].category).toBe("ocr-text");
  expect(JSON.stringify(r)).not.toContain("secret");
  expect(r.byCategory.table.observations[0].metrics.characterErrorPct).toBeUndefined();
 });
 it("does not allow metrics or status for an unrecognized case to inflate qualification",()=>{
  const m=corpus(),ev=m.cases.map(c=>({id:c.id,status:"PASS"}));
  ev[0]={id:"unknown-case",status:"PASS"};
  expect(()=>buildGoldenFailurePlan(m,ev)).toThrow();
 });
 it("retains per-category counts and only reports PASS when every required case passes",()=>{
  const m=corpus(),ev=m.cases.map(c=>({id:c.id,status:"PASS"}));
  expect(buildGoldenFailurePlan(m,ev).status).toBe("PASS_SCOPED_REAL_WORLD");
  ev[0].status="NOT_RUN";
  const r=buildGoldenFailurePlan(m,ev);
  expect(r.status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");expect(r.notRun).toBe(1);
 });
});
