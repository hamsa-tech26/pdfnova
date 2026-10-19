import {describe,expect,it} from "vitest";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
import {findNativeDenseGridSubregions} from "../nativeDenseGridSubregion";
import {detectTableRegionsForPage} from "../tableRegionDetector";

function line(number:number,y:number,parts:Array<[string,number]>):PdfLine{
  const words:PdfWord[]=parts.map(([text,x],i)=>({
    id:"w-"+number+"-"+i,text,pageNumber:1,
    bounds:{x,y,width:Math.max(8,text.length*4),height:9},
    font:{size:9},rotation:0,extractionProvenance:{source:"native-pdf"}
  }));
  return {id:"line-"+number,pageNumber:1,words,
    bounds:{x:Math.min(...words.map(w=>w.bounds.x)),y,
      width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-
        Math.min(...words.map(w=>w.bounds.x)),height:9},
    text:words.map(w=>w.text).join(" ")};
}
function block(rows:PdfLine[]):PdfParagraphBlock{
  return {type:"paragraph",id:"source-large",pageNumber:1,lines:rows,
    bounds:{x:30,y:35,width:550,height:760},text:rows.map(r=>r.text).join(" "),
    confidence:0.8};
}
describe("R112 conservative native scientific grid segmentation",()=>{
  it("extracts numeric rows and nearby headers without swallowing surrounding prose",()=>{
    const pre=Array.from({length:9},(_,i)=>line(i,740-i*12,[["Ordinary laboratory article sentence describing conditions",55]]));
    const headers=[line(9,631,[["Subject",61],["Treatment",179],["Response",347]]),
      line(10,617,[["Group",61],["Value",179],["Rate",347]])];
    const data=Array.from({length:8},(_,i)=>line(i+11,601-i*14.5,[
      ["Specimen-"+(i+10),61],["19"+i,120],["2."+i,179],["5."+i,347]
    ]));
    const after=Array.from({length:10},(_,i)=>line(i+19,475-i*15,[
      ["Narrative description of results and observations",55]
    ]));
    const original=block([...pre,...headers,...data,...after]);
    const allBefore=original.lines.flatMap(l=>l.words).map(w=>w.id);
    const segments=findNativeDenseGridSubregions([original]);
    expect(segments).toHaveLength(1);
    expect(segments[0].block.id).toMatch(/^native-dense-grid/);
    expect(segments[0].block.lines.some(l=>l.id==="line-10")).toBe(true);
    expect(segments[0].block.lines.some(l=>l.id==="line-0")).toBe(false);
    expect(segments[0].block.lines.some(l=>l.id==="line-24")).toBe(false);
    expect(original.lines.flatMap(l=>l.words).map(w=>w.id)).toEqual(allBefore);
    expect(detectTableRegionsForPage([original]).regions.some(x=>
      x.block.id.startsWith("native-dense-grid-"))).toBe(true);
  });
  it("rejects parallel prose lines despite perfectly aligned left/right x positions",()=>{
    const prose=Array.from({length:30},(_,i)=>line(i,740-i*12,[
      ["The clinical study describes findings and measurements",57],
      ["and the comparative cohort is considered separately",315],
    ]));
    expect(findNativeDenseGridSubregions([block(prose)])).toEqual([]);
  });
  it("rejects OCR-sourced, sparse and drifting data anchors",()=>{
    const bad=Array.from({length:26},(_,i)=>line(i,740-i*13,[
      ["Sample"+i,50+i*3],["2."+i,150+i*4],["11"+i,270+i*3],["6."+i,360+i*4]
    ]));
    expect(findNativeDenseGridSubregions([block(bad)])).toEqual([]);
    const ocr=bad.map(l=>({...l,words:l.words.map(w=>({
      ...w,extractionProvenance:{source:"ocr-tesseract" as const}
    }))}));
    expect(findNativeDenseGridSubregions([block(ocr)])).toEqual([]);
  });
});
