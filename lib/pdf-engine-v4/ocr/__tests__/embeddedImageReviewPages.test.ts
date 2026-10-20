import {describe,expect,it} from "vitest";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {listEmbeddedImageReviewPages} from "../embeddedImageReviewPages";
import {planEmbeddedImageOcrRegions} from "../embeddedImageRegionPlanner";

function fixture(pageNumber:number,overlay=false):PdfPageModel{
  const bounds={x:60,y:450,width:350,height:170};
  const w:PdfWord={id:"native",text:"visible",pageNumber,
    bounds:{x:70,y:475,width:50,height:11},font:{size:10},rotation:0};
  return {pageNumber,width:610,height:792,words:overlay?[w,w,w,w]:[],
    lines:[],blocks:[],imagePaintCount:1,
    imagePaintRegions:[{bounds,areaFraction:350*170/(610*792)}],
    textExtraction:{status:"sufficient",wordCount:100,
      lineCount:15,characterCount:800,qualityScore:1}};
}
describe("R142 complete optional embedded-image review page navigation",()=>{
  it("keeps an overlay page available for manual selection without auto-selecting OCR",()=>{
    const hidden=fixture(6,true);
    expect(planEmbeddedImageOcrRegions([hidden])).toEqual([]);
    expect(listEmbeddedImageReviewPages([hidden],[])).toEqual([{
      pageNumber:6,manualCandidateCount:1,automaticRecommended:false,
    }]);
  });
  it("lists recommended and manually reviewable pages exactly once in page order",()=>{
    const pages=[fixture(7,true),fixture(6),fixture(8,true)];
    const selected=listEmbeddedImageReviewPages(pages,[
      {pageNumber:6,imageReviewRecommended:true},
      {pageNumber:8,imageReviewRecommended:false},
    ]);
    expect(selected.map(x=>x.pageNumber)).toEqual([6,7,8]);
    expect(selected.map(x=>x.automaticRecommended)).toEqual([true,false,false]);
    expect(listEmbeddedImageReviewPages([pages[0],pages[0]],[])).toHaveLength(1);
  });
  it("does not offer logo-only, invalid or low-native-text candidate pages",()=>{
    const tiny=fixture(1);tiny.imagePaintRegions=[
      {bounds:{x:30,y:30,width:20,height:20},areaFraction:.001}];
    const weak=fixture(2);weak.textExtraction={...weak.textExtraction,status:"low"};
    expect(listEmbeddedImageReviewPages([tiny,weak],[])).toEqual([]);
    expect(listEmbeddedImageReviewPages([],[])).toEqual([]);
  });
});
