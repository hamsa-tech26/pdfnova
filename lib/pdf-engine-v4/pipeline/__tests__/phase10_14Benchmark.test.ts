import { describe, expect, it } from "vitest";
import { benchmark, scoreFixture } from "../../../../scripts/scorePhase10_14.mjs";
import { excludePhase10_14ColumnHeader } from "../../../../scripts/phase10_14Rows.mjs";
describe("Phase 10.14 scoring",()=>{
 it("removes only an identifiable heading row without hiding OCR-missing serials",()=>{
   const raw=[["Sl No","Name of Scheme","GP/VC","Status","Remarks"],["","Damaged row","","",""],["1","Rani Para","Damcherra","Functional","Normal"]];
   expect(excludePhase10_14ColumnHeader(raw)).toEqual({rows:raw.slice(1),removed:1});
   expect(excludePhase10_14ColumnHeader(raw.slice(1))).toEqual({rows:raw.slice(1),removed:0});
 });
 it("calculates honest header-aware metrics alongside unadjusted positional accuracy",async()=>{
   const fixture={fixtures:[{id:"a",file:"x.pdf",expectedRows:[["1","Name","GP","Status","Notes"]]}]};
   const actual=[{id:"a",rows:[["Sl No","Name of Scheme","GP/VC","Status","Remarks"],["1","Name","GP","Status","Notes"]],ocrAttempted:true}];
   const scored=(await benchmark(fixture,actual)).fixtures[0];
   expect(scored).toMatchObject({headerRowsExcluded:1,matchedRows:1,matchedCells:5,unadjustedPositional:{matchedRows:0}});
 });

 it("reports perfect exact reference row match",()=>{
  expect(scoreFixture([["1","A"],["2","B"]],[["1","A"],["2","B"]])).toMatchObject({matchedRows:2,matchedCells:4,exactMatch:true});
 });
 it("counts missing and shifted data as errors",()=>{
  expect(scoreFixture([["1","A"],["2","B"]],[["2","B"]])).toMatchObject({matchedRows:0,matchedCells:0,exactMatch:false});
 });
 it("does not pretend missing OCR runs passed",async()=>{
  const result=await benchmark({fixtures:[{id:"a",file:"x.pdf",expectedRows:[["1"]]}]},[]);
  expect(result.fixtures[0].status).toBe("NOT_RUN");
 });
});
