import {describe,it,expect} from "vitest";
import {findNativeScientificRasterReviewTargets} from "../nativeScientificRasterReview";
import type {PdfPageModel} from "../../model/types";
import type {LogicalTable} from "../../model/logicalTable";

function page(imageRects:Array<{x:number;y:number;width:number;height:number}>,
  status:"sufficient"|"low"="sufficient"):PdfPageModel{
  return {pageNumber:2,width:612,height:792,words:[],lines:[],blocks:[],
    textExtraction:{status,wordCount:200,lineCount:30,characterCount:800,
      qualityScore:0.9},
    imagePaintCount:imageRects.length,
    imagePaintRegions:imageRects.map(bounds=>({bounds,
      areaFraction:bounds.width*bounds.height/(612*792)}))};
}
function table(id="native-caption-header-grid-2-source-3"):LogicalTable{
  return {id:"logical-1",pageNumber:2,columnCount:4,confidence:0.85,
    bounds:{x:61,y:522,width:489,height:140},
    extractionProvenance:{source:"native-pdf",wordCount:25,
      nativeWordCount:25,ocrWordCount:0,unknownWordCount:0,pageNumbers:[2]},
    rows:[{id:"row-1",rowIndex:0,cells:[],confidence:0.9,
      provenance:{pageNumber:2,blockId:id,originalRowIndex:0}}]};
}
describe("R150 source-backed manual scientific raster review targets",()=>{
  it("identifies only original painted images directly below a captioned native source",()=>{
    const p=page([
      {x:57,y:330,width:241,height:149},
      {x:315,y:359,width:241,height:121},
      {x:5,y:20,width:110,height:90},
    ]);
    const found=findNativeScientificRasterReviewTargets([p],[table()]);
    expect(found).toEqual([
      {tableIndex:0,pageNumber:2,imagePaintIndex:0,relationship:"below-native-region"},
      {tableIndex:0,pageNumber:2,imagePaintIndex:1,relationship:"below-native-region"},
    ]);
    expect(table().bounds.y).toBe(522); // never synthesize logical rows or bounds
  });
  it("flags a legitimate overlapping image but not a distant/decorative/sidebar image",()=>{
    const p=page([
      {x:72,y:550,width:230,height:100},
      {x:61,y:100,width:240,height:100},
      {x:575,y:490,width:38,height:100},
      {x:61,y:450,width:3,height:3},
    ]);
    expect(findNativeScientificRasterReviewTargets([p],[table()])).toEqual([
      {tableIndex:0,pageNumber:2,imagePaintIndex:0,relationship:"overlaps-native-region"},
    ]);
  });
  it("cannot classify article prose or low-text pages as source-backed tables",()=>{
    const p=page([{x:57,y:330,width:241,height:149}]);
    expect(findNativeScientificRasterReviewTargets([p],
      [table("paragraph-2-1")])).toEqual([]);
    expect(findNativeScientificRasterReviewTargets(
      [page([{x:57,y:330,width:241,height:149}],"low")],[table()])).toEqual([]);
  });
  it("rejects malformed painted bounds and non-native unknown table locations",()=>{
    const p=page([{x:Number.NaN,y:330,width:241,height:149},
      {x:57,y:330,width:-1,height:149}]);
    expect(findNativeScientificRasterReviewTargets([p],[table()])).toEqual([]);
    const unknown=table();
    unknown.bounds={x:NaN,y:522,width:489,height:140};
    expect(findNativeScientificRasterReviewTargets([page([
      {x:57,y:330,width:241,height:149}])],[unknown])).toEqual([]);
  });
});
