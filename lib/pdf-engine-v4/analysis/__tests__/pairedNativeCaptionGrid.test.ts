import {describe,it,expect} from "vitest";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
import {findPairedNativeCaptionGrids} from "../pairedNativeCaptionGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";

function line(index:number,y:number,columns:[number,string][]):PdfLine{
 const words:PdfWord[]=columns.map(([x,text],k)=>({
   id:"word-"+index+"-"+k,text,pageNumber:5,rotation:0,
   font:{size:9},bounds:{x,y,width:Math.max(10,text.length*3),height:10},
   extractionProvenance:{source:"native-pdf" as const},
 }));
 const x=Math.min(...words.map(w=>w.bounds.x));
 return {id:"line-"+index,pageNumber:5,words,
   bounds:{x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,height:10},
   text:words.map(w=>w.text).join(" ")};
}
function build(){
 const rows=[
   ["Age group","Frequencies (%)"],
   ["0-9","4.0 (6.6)"],
   ["10-19","36.0 (59.0)"],
   ["20-29","9.0 (14.8)"],
   ["30-39","6.0 (9.8)"],
   ["40-49","5.0 (8.2)"],
   ["Total","60.0 (98.4)"],
   ["Missing","1.0 (1.6)"],
   ["Overall total","61(100.0)"],
 ] as [string,string][];
 const source=[
   line(0,680,[[45,"Background"],[120,"Clinical series"]]),
   line(1,662,[[45,"Several studies"],[190,"demonstrate variations"]]),
   line(2,640,[[45,"Table"],[74,"1."]]),
   ...rows.map(([a,b],i)=>line(i+3,625-i*15,[[45,a],[130,b]])),
   line(13,470,[[45,"The following paragraph"],[200,"resumes article prose"]]),
 ];
 const words=source.flatMap(l=>l.words);
 const x=Math.min(...words.map(w=>w.bounds.x));
 const b:PdfParagraphBlock={id:"article-mixed",type:"paragraph",pageNumber:5,
   text:source.map(l=>l.text).join(" "),lines:source,confidence:0.96,
   bounds:{x,y:470,width:420,height:220}};
 return {b,rows};
}
describe("R86 native paired table-caption recovery",()=>{
 it("splits exactly the source's 9x2 aligned rows, leaving prose and caption intact",()=>{
   const {b,rows}=build();
   const found=findPairedNativeCaptionGrids([b]);
   expect(found).toHaveLength(1);
   expect(found[0].firstLineIndex).toBe(3);
   expect(found[0].lastLineIndex).toBe(11);
   const table=found[0].block;
   expect(table.type).toBe("paragraph");
   if(table.type!=="paragraph")return;
   expect(table.lines).toHaveLength(9);
   expect(table.lines.map(l=>l.words.map(w=>w.text))).toEqual(rows);
   const d=detectTableRegionsForPage([b]);
   expect(d.tableRegions.some(r=>r.block.id===table.id)).toBe(true);
   const c=detectStableColumnsV4(table);
   expect(c.columns).toHaveLength(2);
   const r=detectAdaptiveRowsV4(table,c.columns);
   expect(r.rows).toHaveLength(9);
   const final=buildSmartTableV4(5,r.rows,c.columns).table;
   expect(final?.columnCount).toBe(2);
   expect(final?.rows).toHaveLength(9);
   expect(final?.rows[8].cells.map(c=>c.text)).toEqual(["Overall total","61(100.0)"]);
 });
 it("does not recover uncaptioned, short, OCR or unstable prose",()=>{
   const {b}=build();
   const plain={...b,lines:b.lines.filter(l=>l.id!=="line-2")};
   expect(findPairedNativeCaptionGrids([plain])).toHaveLength(0);
   const short={...b,lines:b.lines.slice(0,8)};
   expect(findPairedNativeCaptionGrids([short])).toHaveLength(0);
   const ocr={...b,lines:b.lines.map(l=>({...l,words:l.words.map(w=>({
     ...w,extractionProvenance:{source:"ocr-tesseract" as const},
   }))}))};
   expect(findPairedNativeCaptionGrids([ocr])).toHaveLength(0);
   const drift={...b,lines:b.lines.map((l,i)=>i===7?{
     ...l,words:l.words.map((w,j)=>j===1?
       {...w,bounds:{...w.bounds,x:185}}:w),
   }:l)};
   expect(findPairedNativeCaptionGrids([drift])).toHaveLength(0);
   const paragraph={...b,lines:b.lines.map((l,i)=>i>=3?{
     ...l,words:l.words.map((w,j)=>j===0?{...w,text:"Further evidence"}:
       {...w,text:"was found in clinical practice"}),
   }:l)};
   expect(findPairedNativeCaptionGrids([paragraph])).toHaveLength(0);
 });
});
