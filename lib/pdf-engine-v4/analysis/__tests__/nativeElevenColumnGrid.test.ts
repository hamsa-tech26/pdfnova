import {describe,it,expect} from "vitest";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
import {findNativeElevenColumnGrids,detectNativeElevenColumns} from "../nativeElevenColumnGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";

function line(n:number,y:number,starts:number[],prefix="V"):PdfLine{
  const words:PdfWord[]=starts.map((x,i)=>({
    id:"r87-word-"+n+"-"+i,pageNumber:5,
    text:prefix+n+"-"+i,rotation:0,font:{size:9},
    bounds:{x,y,width:Math.min(i===0?24:20,20),height:8},
    extractionProvenance:{source:"native-pdf"},
  }));
  const x=Math.min(...starts);
  return {id:"r87-line-"+n,pageNumber:5,words,
    bounds:{x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,height:8},
    text:words.map(w=>w.text).join(" ")};
}
const xs=[67,104,161,220,282,320,355,391,425,461,511];
function source(){
  const a:PdfLine[]=[
    line(0,698,[57],"Table 3"), // caption text patched below
    line(1,684,[57,88,143,201,263,319,345,378,421,444,492],"Header"),
    line(2,675,[87,143,197,271,346,377,417,492],"Header"),
    line(3,666,[149,212,264,377,508],"Header"),
    line(4,657,[148,202,264,495],"Header"),
    line(5,648,[206,276,505],"Header"),
  ];
  a[0]={...a[0],text:"Table 3. Native source header"};
  for(let i=0;i<12;i++){
    const starts= i<2?xs.slice(0,10): i%4===0?xs.slice(0,10):xs;
    a.push(line(6+i,i<=5?635-i*12:555-(i-6)*12,starts,"row"));
    if(i===5)a.push(line(38,566,[326],"continuation"));
  }
  a.push(line(39,430,[57,305],"prose"));
  const all=a.flatMap(l=>l.words);
  const block:PdfParagraphBlock={
    id:"complex-source",type:"paragraph",pageNumber:5,
    text:a.map(l=>l.text).join(" "),confidence:0.95,lines:a,
    bounds:{x:57,y:400,width:481,height:310},
  };
  return {block,sourceWordIds:all.map(w=>w.id)};
}
describe("R87 strict native 11-column grid with multiple header tiers",()=>{
  it("isolates captioned 13x11 grid, groups header, preserves every original source word",()=>{
    const {block,sourceWordIds}=source();
    const found=findNativeElevenColumnGrids([block]);
    expect(found).toHaveLength(1);
    const grid=found[0].block;
    expect(grid.type).toBe("paragraph");
    if(grid.type!=="paragraph")return;
    expect(grid.lines).toHaveLength(13);
    const before=new Set(sourceWordIds);
    const actual=new Set([
      ...grid.lines.flatMap(l=>l.words.map(w=>w.id)),
      ...block.lines.slice(0,found[0].firstLineIndex).flatMap(l=>l.words.map(w=>w.id)),
      ...block.lines.slice(found[0].lastLineIndex+1).flatMap(l=>l.words.map(w=>w.id)),
    ]);
    expect(actual).toEqual(before);
    const detected=detectTableRegionsForPage([block]);
    expect(detected.tableRegions.some(r=>r.block.id===grid.id)).toBe(true);
    const columns=detectNativeElevenColumns(grid,detectStableColumnsV4(grid));
    expect(columns?.columns).toHaveLength(11);
    expect(columns?.columns.map(c=>Math.round(c.x))).toEqual(xs);
    if(!columns)return;
    const rows=detectAdaptiveRowsV4(grid,columns.columns);
    expect(rows.rows).toHaveLength(13);
    expect(rows.rows.every(r=>r.reason==="native-eleven-caption-physical-row")).toBe(true);
    const table=buildSmartTableV4(5,rows.rows,columns.columns).table;
    expect(table?.columnCount).toBe(11);
    expect(table?.rows).toHaveLength(13);
  });
  it("refuses absent caption, OCR, too few rows, drifting columns and narrative text",()=>{
    const {block}=source();
    const notCaption={...block,lines:block.lines.map((l,i)=>i===0?
      {...l,text:"Appendix narrative"}:l)};
    expect(findNativeElevenColumnGrids([notCaption])).toHaveLength(0);
    const ocr={...block,lines:block.lines.map(l=>({...l,words:l.words.map(w=>({
      ...w,extractionProvenance:{source:"ocr-tesseract" as const},
    }))}))};
    expect(findNativeElevenColumnGrids([ocr])).toHaveLength(0);
    const shortened={...block,lines:block.lines.slice(0,14)};
    expect(findNativeElevenColumnGrids([shortened])).toHaveLength(0);
    const drifting={...block,lines:block.lines.map((l,i)=>i>=6?
      {...l,words:l.words.map(w=>({...w,bounds:{...w.bounds,x:w.bounds.x+i*2}}))}:l)};
    expect(findNativeElevenColumnGrids([drifting])).toHaveLength(0);
    const narrative={...block,lines:block.lines.map((l,i)=>i>=6?
      {...l,words:[l.words[0]]}:l)};
    expect(findNativeElevenColumnGrids([narrative])).toHaveLength(0);
  });
});
