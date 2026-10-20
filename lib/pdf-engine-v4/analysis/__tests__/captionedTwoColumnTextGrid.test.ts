import {describe,expect,it} from "vitest";
import {findCaptionedTwoColumnTextGrids} from "../captionedTwoColumnTextGrid";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";
import type {PdfLine,PdfParagraphBlock,PdfWord} from "../../model/types";

function line(i:number,parts:readonly [number,string][]):PdfLine{
  const y=740-i*12;
  const words:PdfWord[]=parts.map(([x,text],j)=>({
    id:"text-"+i+"-"+j,text,pageNumber:1,
    bounds:{x,y,width:Math.min(239,Math.max(12,text.length*3)),height:9},
    font:{size:9},rotation:0,extractionProvenance:{source:"native-pdf"},
  }));
  return {id:"line-"+i,pageNumber:1,words,
    bounds:{x:Math.min(...words.map(w=>w.bounds.x)),y,
      width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-
        Math.min(...words.map(w=>w.bounds.x)),height:9},
    text:words.map(w=>w.text).join(" ")};
}
function build(withCaption=true):PdfParagraphBlock{
  const lines=[line(0,[[57,"A preceding narrative paragraph in this scientific article"]]),
    line(1,[[57,"The detailed background remains outside the published table"]]),
    line(2,[[57,withCaption?"Table 2. Comparison of two documented conditions":
      "Discussion of two documented conditions"]])];
  for(let i=0;i<15;i++){
    const row=i+3;
    // Two wrapped source rows deliberately lack a left-column fragment.
    if(i===4||i===5)lines.push(line(row,[[315,"Wrapped note belonging to the right source column"]]));
    else if(i===7)lines.push(line(row,[
      [57,"Source record "+i+": long reported description"],
      [315,"Counterpart "+i+": another long reported description"],
      [350,"Additional fragment for the right side"]]));
    else lines.push(line(row,[
      [57,"Source record "+i+": long reported description"],
      [315,"Counterpart "+i+": another long reported description"]]));
  }
  lines.push(line(18,[[57,"Narrative resumes below the table"]]));
  lines.push(line(19,[[57,"Methodology and discussion of unrelated source findings"]]));
  lines.push(line(20,[[57,"Publication bibliography starts afterward"]]));
  const all=lines.flatMap(l=>l.words);
  return {id:"source",type:"paragraph",pageNumber:1,confidence:0.86,
    bounds:{x:57,y:500,width:510,height:250},
    lines,text:lines.map(l=>l.text).join(" ")};
}
describe("caption-restricted two-column native text regions",()=>{
  it("isolates source-backed two-column rows from caption and prose",()=>{
    const src=build();
    const a=findCaptionedTwoColumnTextGrids([src]);
    expect(a).toHaveLength(1);
    expect(a[0].firstLineIndex).toBe(3);
    expect(a[0].lastLineIndex).toBe(17);
    expect(a[0].block.lines).toHaveLength(15);
    expect(a[0].block.bounds.width).toBeLessThan(src.bounds.width);
    const regions=detectTableRegionsForPage([src]);
    expect(regions.tableRegions.some(x=>x.block.id.startsWith("native-captioned-text-grid-")))
      .toBe(true);
    const region=regions.tableRegions.find(x=>
      x.block.id.startsWith("native-captioned-text-grid-"))!;
    const columns=detectStableColumnsV4(region.block);
    expect(columns.columns).toHaveLength(2);
    const rows=detectAdaptiveRowsV4(region.block,columns.columns);
    expect(rows.rows).toHaveLength(15);
    expect(rows.rows.every(row=>row.reason==="captioned-native-text-physical-line"))
      .toBe(true);
    const logical=buildSmartTableV4(1,rows.rows,columns.columns).table;
    expect(logical?.rows).toHaveLength(15);
    // The exact input tokens remain in source order, not guessed cells.
    const sourceIds=region.block.type==="paragraph"?
      region.block.lines.flatMap(line=>line.words.map(word=>word.id)):[];
    const emitted=logical?.rows.flatMap(row=>row.cells.flatMap(cell=>cell.words.map(word=>word.id)))??[];
    expect(emitted).toHaveLength(sourceIds.length);
    expect(new Set(emitted)).toEqual(new Set(sourceIds));
    const fragments=regions.regions.filter(x=>x.block.type==="paragraph");
    const emitted=fragments.flatMap(x=>x.block.type==="paragraph"?x.block.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
    expect(emitted).toHaveLength(src.lines.flatMap(l=>l.words).length);
    expect(new Set(emitted).size).toBe(emitted.length);
  });
  it("does not mistake uncaptained narrative columns for an exportable table",()=>{
    expect(findCaptionedTwoColumnTextGrids([build(false)])).toHaveLength(0);
  });
  it("refuses OCR mixed into an otherwise captioned native region",()=>{
    const src=build(); const row=src.lines[10];
    row.words[0].extractionProvenance={source:"ocr-tesseract"};
    expect(findCaptionedTwoColumnTextGrids([src])).toHaveLength(0);
  });
  it("rejects drifting column anchors and unsupported small runs",()=>{
    const unstable=build();
    for(let i=9;i<=17;i++){
      unstable.lines[i].words[1].bounds.x+=45;
    }
    expect(findCaptionedTwoColumnTextGrids([unstable])).toHaveLength(0);
    const small=build();
    small.lines=small.lines.filter((_,i)=>i<8||i>17);
    expect(findCaptionedTwoColumnTextGrids([small])).toHaveLength(0);
  });
});
