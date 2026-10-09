import {describe,expect,it} from "vitest";
import {checkRelease37Gate,REQUIRED_CATEGORIES,REQUIRED_PHASES} from "../../../../scripts/checkRelease37Gate.mjs";

function mockReport() {
  return {
    corpus:{documents:Array.from({length:20},(_,i)=>({
      id:"test-"+i,origin:"real-world",usageRights:"de-identified",sha256:(i+1).toString(16).padStart(64,"0"),
      rightsUrl:"https://example.org/rights",independentReferenceReview:true,
      categories:REQUIRED_CATEGORIES.filter((_,j)=>i===j || i===j+8),
    }))},
    metrics:Object.fromEntries(REQUIRED_CATEGORIES.map(c=>[c,{
      status:"MEASURED",source:"real-world",documentCount:2,cellPct:98,rowPct:90,structurePct:94,actualOcrAttempted:true,
      scoredFromFiles:true,groundTruthVerified:true,evidenceDigest:"b".repeat(64),
    }])),
    phases:Object.fromEntries(REQUIRED_PHASES.map(p=>[p,{status:"PASS",evidenceUrl:"https://example.org/review"}])),
    regressions:{critical:0},syntheticPhase10_14:{status:"PASS"},
    performance:{status:"MEASURED",stressFileBytes:21*1024*1024,peakHeapBytes:120*1024*1024,
      mainThreadBlockMs:80,pageBatchingVerified:true,cancellationVerified:true},
  };
}
describe("Release 37 formal V4 Stable gate is fail-closed",()=>{
  it("blocks missing evidence",()=>{
    expect(checkRelease37Gate({}).status).toBe("BLOCKED");
    expect(checkRelease37Gate({}).failures.length).toBeGreaterThan(10);
  });
  it("blocks synthetic or unauthorized real corpus",()=>{
    const r=mockReport();r.corpus.documents[0].origin="synthetic";
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("rejects 20 distinct names pointing to the same source PDF bytes",()=>{
    const r=mockReport();
    r.corpus.documents[1].sha256=r.corpus.documents[0].sha256;
    const result=checkRelease37Gate(r);
    expect(result.status).toBe("BLOCKED");
    expect(result.failures.some((message:string)=>message.includes("duplicate PDF content hash"))).toBe(true);
  });
  it("rejects a claimed per-category measurement count that differs from actual source evidence",()=>{
    const r=mockReport();
    r.metrics.native.documentCount=20;
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks unreviewed references even with good claimed accuracy",()=>{
    const r=mockReport();r.corpus.documents[0].independentReferenceReview=false;
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks unmeasured category evidence",()=>{
    const r=mockReport();r.metrics.complex.scoredFromFiles=false;
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks structure problems even when OCR exact text passes",()=>{
    const r=mockReport();r.metrics.complex.structurePct=40;
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks a Bengali score without actual recognition evidence",()=>{
    const r=mockReport();r.metrics.bengali.actualOcrAttempted=false;
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks unsupported Bengali OCR measurements",()=>{
    const r=mockReport();r.metrics.bengali.status="NOT_VERIFIED";
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("blocks incomplete batching, cancellation, and synthetic OCR",()=>{
    const r=mockReport();r.performance.cancellationVerified=false;r.syntheticPhase10_14.status="BLOCKED";
    expect(checkRelease37Gate(r).status).toBe("BLOCKED");
  });
  it("passes only a fully populated MOCK of the gate for unit testing, not release evidence",()=>{
    expect(checkRelease37Gate(mockReport()).status).toBe("PASS");
  });
});
