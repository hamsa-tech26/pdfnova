import {describe,expect,it} from "vitest";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
import {findInterleavedNativeThreeColumnGrids,
  detectInterleavedNativeThreeColumns} from "../interleavedNativeThreeColumnGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";

function line(index:number,y:number,entries:[number,string][]):PdfLine{
  const words:PdfWord[]=entries.map(([x,text],i)=>({
    id:"r88-word-"+index+"-"+i,text,pageNumber:5,rotation:0,
    font:{size:9},bounds:{x,y,width:Math.max(10,Math.min(18,text.length*4)),height:9},
    extractionProvenance:{source:"native-pdf"},
  }));
  const x=Math.min(...words.map(w=>w.bounds.x));
  return {id:"r88-line-"+index,pageNumber:5,words,
    bounds:{x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,height:9},
    text:words.map(w=>w.text).join(" ")};
}
function original(){
  const lines:PdfLine[]=[
    line(0,697,[[57,"Table 3."],[305,"Discussion continues beside the table"]]),
  ];
  for(let i=0;i<28;i++){
    const y=684-i*13;
    const sparse=i%7===3;
    const left:[number,string][]=[[57,"Measure"+i]];
    if(!sparse)left.push([202,String(100+i)],[279,String(50+i)]);
    if(i%5===0)left.splice(1,0,[64,"group"],[68,"marker"]);
    // Real source puts two independent page-column text streams
    // on the same physical PDF line, not in two text blocks.
    lines.push(line(i*3+1,y,[
      ...left,[305,"Adjacent article paragraph"],[360,"reference"],[420,"prose"],
    ]));
    lines.push(line(i*3+2,y-6,[[305,"Right-column prose only"]]));
  }
  lines.push(line(100,271,[[57,"Following discussion"],[305,"Footnote paragraph"]]));
  const block:PdfParagraphBlock={
    id:"journal-page-five",type:"paragraph",pageNumber:5,
    lines,text:lines.map(l=>l.text).join(" "),confidence:0.95,
    bounds:{x:57,y:61,width:482,height:646},
  };
  return block;
}
describe("R88 native three-column grid interleaved with independent prose",()=>{
  it("reconstructs 28 source rows and three columns without duplicating or losing ANY words",()=>{
    const block=original();
    const found=findInterleavedNativeThreeColumnGrids([block]);
    expect(found).toHaveLength(1);
    expect(found[0].block.type).toBe("paragraph");
    if(found[0].block.type!=="paragraph")return;
    expect(found[0].block.lines).toHaveLength(28);
    const d=detectTableRegionsForPage([block]);
    const grid=d.tableRegions.find(r=>r.block.id===found[0].block.id);
    expect(grid).toBeDefined();
    const sourceIds=block.lines.flatMap(l=>l.words.map(w=>w.id));
    const actualIds=d.regions.flatMap(r=>r.block.type==="paragraph"?
      r.block.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
    expect(actualIds).toHaveLength(sourceIds.length);
    expect(new Set(actualIds).size).toBe(sourceIds.length);
    expect(new Set(actualIds)).toEqual(new Set(sourceIds));
    expect(d.regions.some(r=>r.block.id.startsWith("caption-prose-")&&
      r.block.type==="paragraph"&&
      r.block.lines.some(l=>l.words.some(w=>w.bounds.x===305)))).toBe(true);
    const columns=detectInterleavedNativeThreeColumns(
      grid!.block,detectStableColumnsV4(grid!.block));
    expect(columns?.columns.map(c=>Math.round(c.x))).toEqual([57,202,279]);
    const rows=detectAdaptiveRowsV4(grid!.block,columns!.columns);
    expect(rows.rows).toHaveLength(28);
    expect(rows.rows.every(r=>r.reason==="interleaved-native-three-physical-row")).toBe(true);
    const table=buildSmartTableV4(5,rows.rows,columns!.columns).table;
    expect(table?.columnCount).toBe(3);
    expect(table?.rows).toHaveLength(28);
  });
  it("rejects uncaptioned, short, OCR, wrong-side, sparse and unaligned pseudo-grids",()=>{
    const originalBlock=original();
    const plain={...originalBlock,
      lines:originalBlock.lines.map((l,i)=>i===0?{...l,words:l.words.map(
        (w,j)=>j===0?{...w,text:"Section details"}:w)}:l)};
    expect(findInterleavedNativeThreeColumnGrids([plain])).toHaveLength(0);
    const short={...originalBlock,lines:originalBlock.lines.slice(0,31)};
    expect(findInterleavedNativeThreeColumnGrids([short])).toHaveLength(0);
    const ocr={...originalBlock,
      lines:originalBlock.lines.map(l=>({...l,words:l.words.map(w=>({
        ...w,extractionProvenance:{source:"ocr-tesseract" as const},
      }))}))};
    expect(findInterleavedNativeThreeColumnGrids([ocr])).toHaveLength(0);
    const noRight={...originalBlock,
      lines:originalBlock.lines.map(l=>({...l,words:l.words.filter(w=>w.bounds.x<300)}))};
    expect(findInterleavedNativeThreeColumnGrids([noRight])).toHaveLength(0);
    const missingColumns={...originalBlock,
      lines:originalBlock.lines.map(l=>({...l,words:l.words.filter(w=>w.bounds.x!==202)}))};
    expect(findInterleavedNativeThreeColumnGrids([missingColumns])).toHaveLength(0);
    const drift={...originalBlock,
      lines:originalBlock.lines.map((l,i)=>({...l,words:l.words.map(w=>
        w.bounds.x===279?{...w,bounds:{...w.bounds,x:279+i*1.5}}:w)}))};
    expect(findInterleavedNativeThreeColumnGrids([drift])).toHaveLength(0);
  });
});
