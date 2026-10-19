import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {checkRelease37Gate} from "../../../../scripts/checkRelease37Gate.mjs";

describe("Release 107 evidence claim boundary",()=>{
  it("never counts synthetic fixtures as independently reviewed real PDFs",()=>{
    const manifest=JSON.parse(readFileSync(resolve("benchmarks/golden/manifest.json"),"utf8"));
    if(manifest.classification==="SYNTHETIC_ONLY"){
      expect(manifest.realWorldEvaluated).toBe(0);
      expect(manifest.cases.length).toBeGreaterThan(0);
    }
    const syntheticOnly={
      corpus:{documents:manifest.cases.map((test:{id:string})=>({
        id:test.id,origin:"synthetic",independentReferenceReview:false,
      }))},
      syntheticPhase10_14:{status:"PASS"},
    };
    expect(checkRelease37Gate(syntheticOnly).status).toBe("BLOCKED");
  });
});
