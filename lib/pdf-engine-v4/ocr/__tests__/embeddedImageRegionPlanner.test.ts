import {describe,it,expect} from "vitest";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {inspectPdfImagePaints,type ImageOperatorCodes} from "../../reader/imagePaintGeometry";
import {imageRegionToOcrRectangle,planEmbeddedImageOcrRegions} from "../embeddedImageRegionPlanner";

const ops:ImageOperatorCodes={
 save:1,restore:2,transform:3,paintImageXObject:4,
 paintInlineImageXObject:5,paintImageMaskXObject:6,paintSolidColorImageMask:7,
};
const sample={x:60,y:500,width:300,height:130};
function page(regions:Array<{bounds:typeof sample;areaFraction:number}>,words:PdfWord[]=[]):PdfPageModel{
 return {pageNumber:6,width:610,height:792,words,lines:[],blocks:[],
  imagePaintCount:regions.length,imagePaintRegions:regions,textExtraction:{
    status:"sufficient",wordCount:100,lineCount:15,characterCount:800,qualityScore:1}};
}
describe("R118-122 actual image-operator geometry and explicit review bounds",()=>{
 it("tracks save, transform and restore, counting paints without persisting image data",()=>{
  const list={fnArray:[1,3,4,2,5],argsArray:[
    [],[300,0,0,130,60,500],["image-blob"],[],["inline-image"]]};
  const found=inspectPdfImagePaints(list,ops,610,792);
  expect(found.imagePaintCount).toBe(2);
  expect(found.imagePaintRegions[0].bounds).toEqual(sample);
  expect(found.imagePaintRegions[1].bounds).toEqual({x:0,y:0,width:1,height:1});
  expect(JSON.stringify(found)).not.toContain("image-blob");
 });
 it("tracks rotated/sheer image footprint as a bounding rectangle",()=>{
  const found=inspectPdfImagePaints({
   fnArray:[3,4],argsArray:[[0,100,-40,0,150,250],["image"]]
  },ops,610,792);
  expect(found.imagePaintRegions[0].bounds).toEqual({x:110,y:250,width:40,height:100});
 });
 it("discards logos, duplicate overlap, fully native paragraphs, and nonfinite geometry",()=>{
  const regions=[
   {bounds:sample,areaFraction:300*130/(610*792)},
   {bounds:{x:65,y:500,width:295,height:130},areaFraction:295*130/(610*792)},
   {bounds:{x:20,y:20,width:30,height:30},areaFraction:.002},
  ];
  expect(planEmbeddedImageOcrRegions([page(regions)])).toHaveLength(1);
  const word:PdfWord={id:"native",text:"visible",pageNumber:6,
    bounds:{x:70,y:510,width:20,height:15},font:{size:10},rotation:0};
  expect(planEmbeddedImageOcrRegions([page(regions,[word,word,word])])).toHaveLength(0);
  expect(imageRegionToOcrRectangle({...sample,width:Number.NaN},610,792,1220,1584)).toBeNull();
 });
 it("maps bottom-origin PDF coordinates to top-origin OCR crop pixels",()=>{
  const rect=imageRegionToOcrRectangle(sample,610,792,1220,1584);
  expect(rect).not.toBeNull();
  expect(rect!.left).toBeLessThan(120);
  expect(rect!.top).toBeLessThan(324);
  expect(rect!.top).toBeGreaterThan(290);
  expect(rect!.width).toBeGreaterThan(600);
  expect(rect!.height).toBeGreaterThan(260);
  expect(rect!.top+rect!.height).toBeLessThanOrEqual(1584);
 });
 it("never schedules image OCR merely from low-text or uninspected pages",()=>{
  const original=page([{bounds:sample,areaFraction:.1}]);
  expect(planEmbeddedImageOcrRegions([{...original,textExtraction:{...original.textExtraction,status:"none"}}])).toEqual([]);
  expect(planEmbeddedImageOcrRegions([{...original,imagePaintRegions:undefined}])).toEqual([]);
 });
});
