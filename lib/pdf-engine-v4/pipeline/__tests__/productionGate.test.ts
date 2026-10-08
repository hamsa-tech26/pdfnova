import {describe,expect,it} from "vitest";
import {checkV4ProductionGate} from "../../../../scripts/checkV4ProductionGate.mjs";

const fixture=(id:string,cells=100,rows=100)=>({id,status:"MEASURED",ocrAttempted:true,cellAccuracyPct:cells,rowAccuracyPct:rows,extractedRows:9,expectedRows:9});
describe("Production-quality OCR gate is separate from successful benchmark execution",()=>{
  it("rejects the measured perspective-distorted baseline rather than treating CI success as accuracy",()=>{
    const report={fixtures:[fixture("10.14a",95.56,77.78),fixture("10.14b"),fixture("10.14c"),fixture("10.14d",42.22,11.11)]};
    const result=checkV4ProductionGate(report);
    expect(result.status).toBe("BLOCKED");
    expect(result.failures.some((reason:string)=>reason.includes("10.14d") && reason.includes("cell accuracy"))).toBe(true);
  });
  it("rejects missing OCR, missing fixtures and incomplete row counts",()=>{
    const result=checkV4ProductionGate({fixtures:[{...fixture("10.14a"),ocrAttempted:false,extractedRows:8}]});
    expect(result.status).toBe("BLOCKED");
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });
  it("passes only when all four measured fixtures exceed defined thresholds",()=>{
    expect(checkV4ProductionGate({fixtures:["a","b","c","d"].map(id=>fixture(id))}).status).toBe("PASS");
  });
});
