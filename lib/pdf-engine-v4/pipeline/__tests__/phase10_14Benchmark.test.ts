import { describe, expect, it } from "vitest";
import { benchmark, scoreFixture } from "../../../../scripts/scorePhase10_14.mjs";
describe("Phase 10.14 scoring",()=>{
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
