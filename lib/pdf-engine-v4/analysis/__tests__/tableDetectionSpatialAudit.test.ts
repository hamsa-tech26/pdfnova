import {describe,expect,it} from "vitest";
import {auditTableDetectionBoxes,tableBoxIou,topOriginToPdfBounds} from "../tableDetectionSpatialAudit";
const label=(pageNumber:number,left:number,top:number,right:number,bottom:number)=>({
  pageNumber,imageWidth:1000,imageHeight:1000,pdfWidth:500,pdfHeight:800,
  left,top,right,bottom,
});
describe("R133 independent scientific table localization scoring",()=>{
  it("converts top-origin publication labels into bottom-origin PDF coordinates",()=>{
    expect(topOriginToPdfBounds(label(1,100,200,500,400))).toEqual({
      x:50,y:480,width:200,height:160,
    });
  });
  it("scores disjoint real table boxes, not whole paragraph overlaps",()=>{
    const references=[label(1,100,200,500,400),label(2,100,300,500,600)];
    const correct={pageNumber:1,bounds:topOriginToPdfBounds(references[0])};
    const prose={pageNumber:2,bounds:{x:0,y:0,width:500,height:800}};
    const scored=auditTableDetectionBoxes(references,[correct,prose]);
    expect(scored.truePositive).toBe(1);
    expect(scored.falseNegative).toBe(1);
    expect(scored.falsePositive).toBe(1);
    expect(scored.details[1].bestIou).toBeLessThan(0.5);
    expect(scored.unmatchedCandidateIndices).toEqual([1]);
  });
  it("never counts the same broad detection twice for adjacent labels",()=>{
    const references=[label(1,100,100,300,300),label(1,300,100,500,300)];
    const broad={pageNumber:1,bounds:{x:50,y:560,width:200,height:160}};
    const scored=auditTableDetectionBoxes(references,[broad],0.45);
    expect(scored.truePositive).toBe(1);
    expect(scored.falseNegative).toBe(1);
    expect(scored.falsePositive).toBe(0);
  });
  it("rejects impossible coordinates, invalid geometry and unbounded batches",()=>{
    expect(()=>topOriginToPdfBounds(label(1,800,100,300,200))).toThrow();
    expect(()=>topOriginToPdfBounds(label(0,100,100,300,200))).toThrow();
    expect(()=>tableBoxIou({x:0,y:0,width:-1,height:4},{x:0,y:0,width:1,height:4})).toThrow();
    expect(()=>auditTableDetectionBoxes([],[],0)).toThrow();
    expect(()=>auditTableDetectionBoxes(Array(201).fill(label(1,1,1,2,2)),[])).toThrow();
  });
});
