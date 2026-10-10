import {createHash} from "node:crypto";
import {describe,it,expect} from "vitest";
import {
 validatePrivateManifest,scorePrivateCase,assessRealWorldCoverage,
 characterErrorPct,REALWORLD_POLICY,normalizeText
} from "../privateGoldenScorer.mjs";

const hashFor=id=>createHash("sha256").update("public-example-"+id).digest("hex");
function entry(category,id){
 const expected={
  "ocr-text":{text:"EXAMPLE APPROVED TEXT"},
  table:{tableIndex:0,rows:[["Serial","Name"],["1","Sample A"],["2","Sample B"]]},
  form:{visiblePhrases:["EXAMPLE APPROVED"]},
  layout:{pageCount:2,pages:[
   {width:612,height:792,rotation:0,requiredText:["PAGE ONE"]},
   {width:480,height:720,rotation:90,requiredText:["PAGE TWO"]}
  ]}
 };
 return {id,category,file:"case-"+id+".pdf",sha256:hashFor(id),rights:"owner-consent",
   annotation:{annotatorId:"annotator-one",reviewerId:"reviewer-two",
     reviewerApproved:true,reviewDate:"2026-10-10"},expected:expected[category]};
}
const manifest=cases=>({schema:"kukureku-private-golden-v1",provenance:"REAL_WORLD_HUMAN_REVIEWED",cases});

describe("Release 52 private Golden Document score engine",()=>{
 it("normalizes NFKC and case, and calculates actual character edit distance",()=>{
  expect(normalizeText(" ＡＢＣ \t D ")).toBe("abc d");
  expect(characterErrorPct("ABCDE","ABXDE")).toBe(20);
  expect(characterErrorPct("same text","SAME   TEXT")).toBe(0);
 });
 it("blocks traversal, duplicated cases, insufficient consent and unreviewed annotations",()=>{
  const s=entry("ocr-text","case-one");
  expect(validatePrivateManifest(manifest([s]))).toHaveLength(1);
  expect(()=>validatePrivateManifest(manifest([s,s]))).toThrow();
  expect(()=>validatePrivateManifest(manifest([{...s,file:"../leak.pdf"}]))).toThrow();
  expect(()=>validatePrivateManifest(manifest([{...s,rights:"unknown"}]))).toThrow();
  expect(()=>validatePrivateManifest(manifest([{...s,annotation:{...s.annotation,reviewerId:"annotator-one"}}]))).toThrow();
  expect(()=>validatePrivateManifest(manifest([{...s,annotation:{...s.annotation,reviewerApproved:false}}]))).toThrow();
  expect(()=>validatePrivateManifest(manifest([{...s,sha256:"bad"}]))).toThrow();
 });
 it("forbids counting a single source PDF twice under different categories",()=>{
  const first=entry("ocr-text","source-one");
  const second={...entry("table","source-two"),sha256:first.sha256};
  expect(()=>validatePrivateManifest(manifest([first,second]))).toThrow();
 });
 it("rejects nonexistent calendar dates and accepts a legitimate leap day",()=>{
  const first=entry("ocr-text","calendar-01");
  expect(()=>validatePrivateManifest(manifest([{...first,
    annotation:{...first.annotation,reviewDate:"2026-02-30"}}]))).toThrow();
  expect(validatePrivateManifest(manifest([{...first,
    annotation:{...first.annotation,reviewDate:"2024-02-29"}}]))).toHaveLength(1);
 });
 it("requires exact independently chosen table index and penalizes shifted rows",()=>{
  const s=entry("table","table-one");
  const matched=scorePrivateCase(s,{measured:true,rows:s.expected.rows});
  expect(matched.status).toBe("PASS");
  const shifted=scorePrivateCase(s,{measured:true,rows:[s.expected.rows[1],s.expected.rows[2]]});
  expect(shifted.status).toBe("FAIL");
  expect(shifted.metrics.rowCountMatch).toBe(false);
  const swap=scorePrivateCase(s,{measured:true,rows:[["Name","Serial"],["Sample A","1"],["Sample B","2"]]});
  expect(swap.status).toBe("FAIL");
 });
 it("scores OCR only from actual measured text with fixed 5% CER policy",()=>{
  const s=entry("ocr-text","text-one");
  expect(scorePrivateCase(s,{measured:true,text:"EXAMPLE APPROVED TEXT"}).status).toBe("PASS");
  expect(scorePrivateCase(s,{measured:true,text:"COMPLETE FAILURE"}).status).toBe("FAIL");
  expect(scorePrivateCase(s,{measured:false,text:s.expected.text}).status).toBe("FAIL");
  expect(REALWORLD_POLICY.maxCharacterErrorPct).toBe(5);
 });
 it("enforces visible form answer and removal of editable fields",()=>{
  const s=entry("form","form-one");
  expect(scorePrivateCase(s,{measured:true,flattenedText:"Visible EXAMPLE APPROVED",remainingFieldCount:0}).status).toBe("PASS");
  expect(scorePrivateCase(s,{measured:true,flattenedText:"EXAMPLE APPROVED",remainingFieldCount:1}).status).toBe("FAIL");
  expect(scorePrivateCase(s,{measured:true,flattenedText:"missing",remainingFieldCount:0}).status).toBe("FAIL");
 });
 it("rejects layout text loss, rotation errors and missing pages",()=>{
  const s=entry("layout","layout-one");
  const pages=s.expected.pages.map(p=>({...p,text:p.requiredText.join(" ")}));
  expect(scorePrivateCase(s,{measured:true,pages}).status).toBe("PASS");
  expect(scorePrivateCase(s,{measured:true,pages:[{...pages[0],rotation:270},pages[1]]}).status).toBe("FAIL");
  expect(scorePrivateCase(s,{measured:true,pages:[pages[0]]}).status).toBe("FAIL");
 });
 it("requires eight reviewed independent cases over four categories; missing and failures block",()=>{
  const categories=["ocr-text","table","form","layout"];
  const samples=categories.flatMap(cat=>[entry(cat,cat+"-one"),entry(cat,cat+"-two")]);
  const results=samples.map(c=>({id:c.id,status:"PASS"}));
  expect(assessRealWorldCoverage(manifest(samples),[]).status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");
  expect(assessRealWorldCoverage(manifest(samples),results).status).toBe("PASS_SCOPED_REAL_WORLD");
  expect(assessRealWorldCoverage(manifest(samples),results.slice(0,-1)).status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");
  expect(assessRealWorldCoverage(manifest(samples),results.map((x,i)=>i===0?{...x,status:"FAIL"}:x)).status).toBe("BLOCKED_INCOMPLETE_OR_FAILED");
 });
 it("does not emit raw document text, tables or annotations in case results",()=>{
  const s=entry("ocr-text","text-three");
  const result=scorePrivateCase(s,{measured:true,text:"EXAMPLE APPROVED TEXT"});
  const json=JSON.stringify(result);
  expect(json).not.toContain(s.expected.text);
  expect(json).not.toContain("annotator-one");
  expect(json).not.toContain("EXAMPLE");
 });
});
