import {describe,it,expect} from "vitest";
import {diagnoseOcrTable,buildPhase10_14Diagnostics} from "../diagnosePhase10_14.mjs";
describe("Release 55 verified OCR error attribution",()=>{
 it("identifies exact positional column mistakes without leaking text",()=>{
   const gold=[["1","Alpha","Ready"],["2","Beta","Done"]];
   const actual=[["1","Alpho","Ready"],["2","Beta","Done"]];
   const diag=diagnoseOcrTable(gold,actual);
   expect(diag.positionalErrorCount).toBe(1);
   expect(diag.matchedRows).toBe(1);
   expect(diag.byColumn[1].mismatchedCells).toBe(1);
   expect(JSON.stringify(diag)).not.toContain("Alpha");
   expect(JSON.stringify(diag)).not.toContain("Alpho");
 });
 it("detects missing rows and missing cells without rewarding short output",()=>{
   const diag=diagnoseOcrTable([["A","B"],["C","D"]],[["A"]]);
   expect(diag.missingRows).toBe(1);
   expect(diag.positionalErrorCount).toBe(3);
   expect(diag.rowProblems).toHaveLength(2);
 });
 it("notes adjacent row shifts without silently realigning benchmark answers",()=>{
   const diag=diagnoseOcrTable([["A","B"],["C","D"]],[["C","D"],["A","B"]]);
   expect(diag.matchedRows).toBe(0);
   expect(diag.positionalErrorCount).toBe(4);
   expect(diag.adjacentShiftCandidates).toBe(2);
 });
 it("keeps unknown OCR executions incomplete rather than measured",()=>{
   const manifest={fixtures:[{id:"fixture-01",expectedRows:[["A","B"]]}]};
   const result=buildPhase10_14Diagnostics(manifest,[{id:"fixture-01",rows:[["A","B"]]}]);
   expect(result.status).toBe("INCOMPLETE");
   expect(result.fixtures[0].status).toBe("OCR_NOT_CONFIRMED");
 });
 it("rejects malformed or unbounded OCR matrices",()=>{
   expect(()=>diagnoseOcrTable([["A"]],[["B",42]])).toThrow();
   expect(()=>diagnoseOcrTable([Array(101).fill("x")],[])).toThrow();
 });
});
