import {describe,expect,it} from "vitest";
import {findNativeCompactScientificGrids} from "../nativeCompactScientificGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";

function line(index:number,content:string[],xs:number[],ocr=false):PdfLine{
  const y=740-index*18;
  const words:PdfWord[]=content.map((text,i)=>({
    id:"word-"+index+"-"+i,pageNumber:1,text,
    bounds:{x:xs[i],y,width:Math.max(7,text.length*5),height:10},
    font:{size:9},rotation:0,
    extractionProvenance:{source:ocr?"ocr-tesseract":"native-pdf",confidence:90},
  }));
  const x=Math.min(...words.map(w=>w.bounds.x));
  const right=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  return {id:"line-"+index,pageNumber:1,text:content.join(" "),
    words,bounds:{x,y,width:right-x,height:10}};
}
function block(lines:PdfLine[]):PdfParagraphBlock{
  return {id:"source-p",pageNumber:1,type:"paragraph",confidence:0.85,
    bounds:{x:50,y:180,width:500,height:575},
    lines,text:lines.map(l=>l.text).join(" ")};
}
function source(columns:3|4=3,ocr=false):PdfParagraphBlock{
  const before=[
    line(0,["This published report describes the methodology and sampling."],[50]),
    line(1,["The values that follow were obtained from observations."],[50]),
  ];
  const table=Array.from({length:8},(_,i)=>line(i+2,
    columns===3?["Site"+(i+1),String(100+i),String(200+i)]:
      ["Site"+(i+1),String(100+i),String(200+i),String(300+i)],
    columns===3?[55,190,330]:[55,175,295,415],ocr));
  return block([...before,...table,
    line(10,["The summary below is discussed in the article text."],[50]),
    line(11,["Future research may improve these measurements."],[50])]);
}
describe("R130–132 native compact scientific grids",()=>{
  it("segments an evidence-backed 3-column region while preserving prose",()=>{
    const input=source(3);
    const segments=findNativeCompactScientificGrids([input]);
    expect(segments).toHaveLength(1);
    expect([segments[0].firstLineIndex,segments[0].lastLineIndex]).toEqual([2,9]);
    expect(segments[0].block.lines).toHaveLength(8);
    expect(segments[0].block.bounds.width).toBeLessThan(input.bounds.width);
    const result=detectTableRegionsForPage([input]);
    const recovered=result.tableRegions.filter(x=>x.block.id.startsWith("native-compact-grid-"));
    expect(recovered).toHaveLength(1);
    expect(recovered[0].block.type).toBe("paragraph");
    const fragments=result.regions.filter(x=>x.block.id.startsWith("caption-prose-"));
    expect(fragments).toHaveLength(2);
    expect(fragments.map(x=>x.block.type==="paragraph"?x.block.lines.length:0))
      .toEqual([2,2]);
    const ids=result.regions.flatMap(x=>x.block.type==="paragraph"?x.block.lines.map(l=>l.id):[]);
    expect(new Set(ids).size).toBe(input.lines.length);
    expect(ids).toHaveLength(input.lines.length);
  });
  it("handles a fully source-positioned 4-column numeric table",()=>{
    const segments=findNativeCompactScientificGrids([source(4)]);
    expect(segments).toHaveLength(1);
    expect(segments[0].block.lines[0].words).toHaveLength(4);
  });
  it("does not auto-accept OCR, noisy geometry or weak numeric paragraphs",()=>{
    expect(findNativeCompactScientificGrids([source(3,true)])).toHaveLength(0);
    const jitter=source(3);
    jitter.lines[5].words[1].bounds.x+=34;
    expect(findNativeCompactScientificGrids([jitter])).toHaveLength(0);
    const prose=source(3);
    for(let i=2;i<10;i++)prose.lines[i].words[1].text="overview";
    expect(findNativeCompactScientificGrids([prose])).toHaveLength(0);
    const tooShort=source(3);
    tooShort.lines.splice(5,3);
    expect(findNativeCompactScientificGrids([tooShort])).toHaveLength(0);
  });
  it("refuses a loose long-row layout and does not lower the global threshold",()=>{
    const irregular=source(3);
    irregular.lines[6].bounds.y-=45;
    irregular.lines[6].words.forEach(w=>w.bounds.y-=45);
    expect(findNativeCompactScientificGrids([irregular])).toHaveLength(0);
    const result=detectTableRegionsForPage([block([
      line(0,["A discussion of regional water supply patterns"],[50]),
      line(1,["The most common description is narrative rather than tabular"],[50]),
      line(2,["Observational uncertainty must be carefully considered"],[50]),
      line(3,["This discussion continues into the next paragraph"],[50]),
      line(4,["No independent numeric column anchors are provided"],[50]),
      line(5,["A second section explains the methodology"],[50]),
      line(6,["The conclusion summarizes the main observations"],[50]),
      line(7,["Additional references are available in the bibliography"],[50]),
      line(8,["The final paragraph contains prose only"],[50]),
    ])]);
    expect(result.tableRegions.some(r=>r.block.id.startsWith("native-compact-grid-")))
      .toBe(false);
  });
});
