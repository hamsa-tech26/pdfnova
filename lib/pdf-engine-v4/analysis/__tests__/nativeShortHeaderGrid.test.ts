import {describe,it,expect} from "vitest";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";
import {findNativeShortHeaderGrids} from "../nativeShortHeaderGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {isScientificReviewOnlyTable} from "../../../converters/pdfToXlsxStructuralEvidence";
import type {LogicalTable} from "../../model/logicalTable";
function line(n:number,tokens:string[],xs:number[],ocr=false):PdfLine{
  const y=650-n*18;
  const words:PdfWord[]=tokens.map((text,i)=>({
    id:"w"+n+"-"+i,text,pageNumber:1,
    bounds:{x:xs[i],y,width:Math.max(9,text.length*5),height:10},
    font:{size:10},rotation:0,
    extractionProvenance:{source:ocr?"ocr-tesseract":"native-pdf"},
  }));
  const x=Math.min(...xs),right=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  return {id:"l"+n,pageNumber:1,words,text:tokens.join(" "),
    bounds:{x,y,width:right-x,height:10}};
}
function block(lines:PdfLine[]):PdfParagraphBlock{
  return {id:"native-source",type:"paragraph",pageNumber:1,confidence:.96,
    bounds:{x:20,y:260,width:560,height:420},lines,
    text:lines.map(x=>x.text).join(" ")};
}
const xs=[46,196,345];
function shortGrid():PdfParagraphBlock{
  return block([
    line(0,["Report overview paragraph"],[46]),
    line(1,["Site","Year","Amount"],xs),
    ...Array.from({length:4},(_,i)=>line(i+2,
      ["A"+i,String(2020+i),String(40+i*5)],xs)),
    line(6,["These observations are discussed below."],[46]),
  ]);
}
describe("R167 short native numeric table with independent header evidence",()=>{
  it("recognizes four anchored source rows under an explicit multi-column heading",()=>{
    const input=shortGrid();
    const fragments=findNativeShortHeaderGrids([input]);
    expect(fragments).toHaveLength(1);
    expect([fragments[0].firstLineIndex,fragments[0].lastLineIndex]).toEqual([1,5]);
    expect(fragments[0].block.lines).toHaveLength(5);
    const detected=detectTableRegionsForPage([input]);
    expect(detected.tableRegions.some(x=>
      x.block.id.startsWith("native-short-header-grid-"))).toBe(true);
    const provenance=fragments[0].block.id;
    const t={id:"review",pageNumber:1,columnCount:3,confidence:.91,
      rows:[{id:"row",rowIndex:0,cells:[],confidence:.9,
        provenance:{pageNumber:1,blockId:provenance,originalRowIndex:0}}],
      bounds:{x:46,y:545,width:330,height:90}} as LogicalTable;
    expect(isScientificReviewOnlyTable(t)).toBe(true);
  });
  it("never promotes two-column article prose or unlabeled rows",()=>{
    const prose=block(Array.from({length:7},(_,i)=>
      line(i,["Long column text containing article fragments",
        "Other narrative text"],[46,345])));
    expect(findNativeShortHeaderGrids([prose])).toEqual([]);
    const noHeader=shortGrid();
    noHeader.lines[1].words[2].text="2026";
    expect(findNativeShortHeaderGrids([noHeader])).toEqual([]);
  });
  it("declines OCR, weak numeric evidence, jitter and large vertical gaps",()=>{
    const ocr=shortGrid();
    ocr.lines[3].words[1].extractionProvenance={source:"ocr-tesseract"};
    expect(findNativeShortHeaderGrids([ocr])).toEqual([]);
    const weak=shortGrid();
    weak.lines[4].words[2].text="unknown";
    expect(findNativeShortHeaderGrids([weak])).toEqual([]);
    const jitter=shortGrid();
    jitter.lines[4].words[1].bounds.x+=18;
    expect(findNativeShortHeaderGrids([jitter])).toEqual([]);
    const jump=shortGrid();
    jump.lines[4].bounds.y-=50;
    jump.lines[4].words.forEach(w=>w.bounds.y-=50);
    expect(findNativeShortHeaderGrids([jump])).toEqual([]);
  });
});
