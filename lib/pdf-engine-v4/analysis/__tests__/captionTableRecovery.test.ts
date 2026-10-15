import {describe,it,expect} from "vitest";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import type {PdfParagraphBlock,PdfLine,PdfWord} from "../../model/types";

const xs=[40,160,270,380,480,565];
function makeLine(index:number,cells:string[],compact=false):PdfLine{
  const y=760-index*16;
  const words:PdfWord[]=cells.map((text,j)=>({
    id:"g-"+index+"-"+j,text,pageNumber:1,rotation:0,
    font:{size:10},
    bounds:{x:compact?40+j*20:xs[j],y,width:Math.max(10,Math.min(55,text.length*5)),height:11},
  }));
  return {id:"line-"+index,pageNumber:1,
    bounds:{x:words[0].bounds.x,y,width:words[words.length-1].bounds.x+55-words[0].bounds.x,height:11},
    text:cells.join(" "),words};
}
function makeBlock(lines:PdfLine[]):PdfParagraphBlock{
  return {id:"mixed-native-report",type:"paragraph",pageNumber:1,
    bounds:{x:40,y:Math.min(...lines.map(l=>l.bounds.y)),width:560,
      height:Math.max(...lines.map(l=>l.bounds.y+l.bounds.height))-Math.min(...lines.map(l=>l.bounds.y))},
    confidence:1,lines,text:lines.map(l=>l.text).join(" ")};
}
function mixedPage(){
  const prose=Array.from({length:12},(_,i)=>makeLine(i,["This section provides regional biological field observations, without tabular layout."]));
  const caption=makeLine(12,["Table 4. Number of tagged fish detected at sites"]);
  const header=makeLine(13,["Direction","Year","Weir","Trawl","Freeport","Rio"]);
  const rows=[
    makeLine(14,["Downstream","2021","19","19","0","15"]),
    makeLine(15,["Downstream","2022","16","16","0","16"]),
    makeLine(16,["Downstream","2023","20","19","16","20"]),
    makeLine(17,["Total","2023","55","54","16","51"]),
  ];
  const tail=Array.from({length:7},(_,i)=>makeLine(18+i,["Individual fish movements are described by water year and season."]));
  return makeBlock([...prose,caption,header,...rows,...tail]);
}
describe("Issue 70: caption-anchored real table region recovery",()=>{
  it("recovers a numeric grid concealed in a much larger article paragraph",()=>{
    const result=detectTableRegionsForPage([mixedPage()]);
    expect(result.tableRegions.some(r=>r.block.id.startsWith("caption-table-"))).toBe(true);
    expect(result.tableRegions.some(r=>r.block.id.startsWith("caption-table-")&&r.analysis.isTable)).toBe(true);
  });
  it("excludes the oversized prose parent to prevent duplicate cross-page continuation",()=>{
    const result=detectTableRegionsForPage([mixedPage()]);
    expect(result.regions.some(r=>r.block.id==="mixed-native-report")).toBe(false);
    expect(result.tableRegions.filter(r=>r.block.id.startsWith("caption-table-"))).toHaveLength(1);
  });
  it("rejects ordinary paragraphs that merely mention Table 4 in their text",()=>{
    const lines=Array.from({length:16},(_,i)=>makeLine(i,[
      i===8?"We compare results from Table 4 and the previous field study.":"Migration observations varied between field sampling sites."
    ]));
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    expect(result.regions.some(r=>r.block.id.startsWith("caption-table-"))).toBe(false);
  });
  it("rejects captioned prose with dates but no true numeric multi-column rows",()=>{
    const lines=[makeLine(0,["Table 7. Summary of dated field observations"]),
      ...Array.from({length:10},(_,i)=>makeLine(i+1,["2021","was recorded in field observations of migration direction."]))];
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    expect(result.regions.some(r=>r.block.id.startsWith("caption-table-"))).toBe(false);
  });
  it("does not turn a figure caption with numerical callouts into table rows",()=>{
    const lines=[makeLine(0,["Figure 4. Site locations"]),
      ...Array.from({length:6},(_,i)=>makeLine(i+1,["Station",String(i+1),"2023","37"]))];
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    expect(result.regions.some(r=>r.block.id.startsWith("caption-table-"))).toBe(false);
  });
  it("requires meaningful column spread, not a compact numeric bullet list",()=>{
    const lines=[
      makeLine(0,["Table 3. Summary"]),
      ...Array.from({length:7},(_,i)=>makeLine(i+1,[String(i+1),String(2020+i),"1"],true))
    ];
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    expect(result.regions.some(r=>r.block.id.startsWith("caption-table-"))).toBe(false);
  });
});
