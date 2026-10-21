import {describe,it,expect} from "vitest";
import type {PdfPageModel} from "../../pdf-engine-v4/model/types";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {auditPdfPageCoverage} from "../pdfPageCoverageAudit";
import {listManuallyReviewableImageRegions,
  planEmbeddedImageOcrRegions} from "../../pdf-engine-v4/ocr/embeddedImageRegionPlanner";
function page(pageNumber:number,status:"sufficient"|"low"|"none",
  imageBoxes:Array<{x:number;y:number;width:number;height:number}>=[],
  wordCount=0):PdfPageModel{
  const width=612,height=792;
  return {pageNumber,width,height,words:Array.from({length:wordCount},(_,i)=>({
    id:"w"+i,text:"Source",pageNumber,
    bounds:{x:20,y:120+i*12,width:40,height:9},
    font:{size:10},rotation:0,
    extractionProvenance:{source:"native-pdf" as const},
  })),lines:[],blocks:[],imagePaintCount:imageBoxes.length,
  imagePaintRegions:imageBoxes.map(bounds=>({bounds,
    areaFraction:bounds.width*bounds.height/(width*height)})),
  textExtraction:{status,wordCount,lineCount:wordCount,characterCount:wordCount*6,
    qualityScore:status==="sufficient"?.95:0}};
}
function table(pageNumber:number):LogicalTable{
  return {id:"candidate",pageNumber,confidence:.9,columnCount:3,
    bounds:{x:55,y:120,width:400,height:90},rows:[]};
}
describe("R156/R157 user review of source page gaps, without false table promotion",()=>{
  it("flags native prose as uncovered but supplies no fabricated OCR or table actions",()=>{
    const src=page(1,"sufficient",[],5);
    expect(auditPdfPageCoverage([src],[])).toEqual([{
      pageNumber:1,nativeTextStatus:"sufficient",tableCandidateCount:0,
      paintedImageCount:0,manualImages:[],reason:"native-text-no-table",
    }]);
  });
  it("shows actual painted image paints on hybrid page, even when tables exist",()=>{
    const first={x:57,y:490,width:240,height:185},second={x:314,y:245,width:241,height:189};
    const src=page(4,"sufficient",[first,second],4);
    const audit=auditPdfPageCoverage([src],[table(4)])[0];
    expect(audit.reason).toBe("painted-content-needs-review");
    expect(audit.tableCandidateCount).toBe(1);
    expect(audit.manualImages.map(x=>x.imagePaintIndex)).toEqual([1,0]);
    expect(planEmbeddedImageOcrRegions([src])).toHaveLength(2);
  });
  it("offers only explicit single-page review on a scanned full-page image",()=>{
    const src=page(6,"none",[{x:0,y:0,width:612,height:792}]);
    expect(planEmbeddedImageOcrRegions([src])).toEqual([]);
    const audit=auditPdfPageCoverage([src],[])[0];
    expect(audit.manualImages).toEqual([{imagePaintIndex:0,nativeWordOverlap:0}]);
    expect(audit.nativeTextStatus).toBe("none");
    expect(listManuallyReviewableImageRegions(src)).toHaveLength(1);
  });
  it("refuses unbounded invalid image paints and does not invent missing cells",()=>{
    const src=page(2,"low",[{x:-5,y:5,width:350,height:100},
      {x:10,y:100,width:30,height:20}]);
    expect(auditPdfPageCoverage([src],[])[0]).toMatchObject({
      manualImages:[],reason:"painted-content-needs-review",
    });
    expect(()=>auditPdfPageCoverage([src,src],[])).toThrow(/Invalid source/);
    expect(()=>auditPdfPageCoverage(Array.from({length:26},(_,i)=>
      page(i+1,"sufficient",[],2)),[])).toThrow(/bounded/);
  });
});
