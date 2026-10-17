import {describe,it,expect} from "vitest";
import {applyTableRegionDetection,detectTableRegionsForPage} from "../tableRegionDetector";
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

  it("preserves every source line exactly once in source order, including the caption and trailing prose",()=>{
    const original=mixedPage();
    const result=detectTableRegionsForPage([original]);
    const lineIds=result.regions.flatMap(region=>
      region.block.type==="paragraph"?region.block.lines.map(line=>line.id):[]
    );
    expect(lineIds).toEqual(original.lines.map(line=>line.id));
    expect(new Set(lineIds).size).toBe(original.lines.length);
    expect(result.regions.filter(region=>region.block.id.startsWith("caption-prose-"))).toHaveLength(2);
    const output=applyTableRegionDetection({pages:[{blocks:[original]}]});
    const prose=output.pages[0].blocks.filter(block=>block.type==="paragraph")
      .map(block=>block.type==="paragraph"?block.text:"").join(" ");
    expect(prose).toContain("This section provides regional biological field observations");
    expect(prose).toContain("Table 4. Number of tagged fish detected at sites");
    expect(prose).toContain("Individual fish movements are described");
    expect(prose).not.toContain("Downstream 2021");
    expect(output.pages[0].blocks.filter(block=>block.type==="table")).toHaveLength(1);
  });
  it("preserves and isolates two separate tables in one mixed paragraph without overlapping lines",()=>{
    const lines=[
      makeLine(0,["Introduction to the report"]),
      makeLine(1,["Table 4. First observed counts"]),
      makeLine(2,["Direction","Year","Weir","Trawl","Freeport","Rio"]),
      makeLine(3,["Downstream","2021","19","19","0","15"]),
      makeLine(4,["Downstream","2022","16","16","0","16"]),
      makeLine(5,["Downstream","2023","20","19","16","20"]),
      makeLine(6,["Total","2023","55","54","16","51"]),
      makeLine(7,["Intervening prose and explanations"]),
      makeLine(8,["Table 5. Second observed counts"]),
      makeLine(9,["Direction","Year","Weir","Trawl","Freeport","Rio"]),
      makeLine(10,["Downstream","2021","9","8","0","5"]),
      makeLine(11,["Downstream","2022","10","12","2","7"]),
      makeLine(12,["Downstream","2023","11","14","3","8"]),
      makeLine(13,["Total","2023","30","34","5","20"]),
      makeLine(14,["Closing remarks for the paper"]),
    ];
    const source=makeBlock(lines);
    const result=detectTableRegionsForPage([source]);
    const emitted=result.regions.flatMap(region=>region.block.type==="paragraph"
      ?region.block.lines.map(line=>line.id):[]);
    expect(emitted).toEqual(lines.map(line=>line.id));
    expect(new Set(emitted).size).toBe(lines.length);
    expect(result.tableRegions.filter(region=>region.block.id.startsWith("caption-table-"))).toHaveLength(2);
  });
  it("keeps its original paragraph when a caption's numeric rows are insufficient",()=>{
    const source=makeBlock([
      makeLine(0,["Context for this article"]),
      makeLine(1,["Table 9. Incomplete observations"]),
      makeLine(2,["Direction","Year","Weir","Trawl","Freeport","Rio"]),
      makeLine(3,["Downstream","2021","19","19","0","15"]),
      makeLine(4,["No additional values were recorded"]),
      makeLine(5,["This should stay a paragraph"]),
    ]);
    const result=detectTableRegionsForPage([source]);
    expect(result.regions.some(region=>region.block===source)).toBe(true);
    expect(result.regions.some(region=>region.block.id.startsWith("caption-table-"))).toBe(false);
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
  it("recovers all 34 numeric data rows under a standalone scientific caption, without losing prose",()=>{
    const lines=[
      makeLine(0,["Narrative introduction before the table."]),
      makeLine(1,["Table 1"]),
      makeLine(2,["Species","Year","North","South","East","West"]),
      ...Array.from({length:34},(_,i)=>makeLine(i+3,[
        "Salmon",String(1990+i),String(i+1),String(i+2),String(i+3),String(i+4),
      ])),
      ...Array.from({length:5},(_,i)=>makeLine(i+37,[
        "Discussion of population characteristics after the recorded observations.",
      ])),
    ];
    const original=makeBlock(lines);
    const result=detectTableRegionsForPage([original]);
    const grid=result.tableRegions.find(region=>region.block.id.startsWith("caption-table-"));
    expect(grid).toBeDefined();
    expect(grid?.block.type).toBe("paragraph");
    if(!grid||grid.block.type!=="paragraph") return;
    expect(grid.block.lines).toHaveLength(35); // header + 34 data rows
    expect(grid.block.lines[34]?.id).toBe("line-36");
    expect(result.regions.flatMap(region=>
      region.block.type==="paragraph"?region.block.lines.map(line=>line.id):[]
    )).toEqual(lines.map(line=>line.id));
    expect(result.regions.filter(region=>region.block.id.startsWith("caption-prose-")))
      .toHaveLength(2);
  });

  it("stops at prose and does not absorb a later unrelated numeric passage",()=>{
    const lines=[
      makeLine(0,["Table S2: Experimental cell counts"]),
      makeLine(1,["Species","Year","North","South","East","West"]),
      makeLine(2,["Salmon","2024","10","11","12","13"]),
      makeLine(3,["Salmon","2025","14","15","16","17"]),
      makeLine(4,["Discussion begins here without a tabular format."]),
      makeLine(5,["The observations should remain in the document narrative."]),
      makeLine(6,["This explanation separates the following numeric passage."]),
      makeLine(7,["The following examples are not part of the first table."]),
      makeLine(8,["Other","2026","90","91","92","93"]),
      makeLine(9,["Other","2027","94","95","96","97"]),
    ];
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    const grid=result.tableRegions.find(region=>region.block.id.startsWith("caption-table-"));
    expect(grid).toBeDefined();
    if(!grid||grid.block.type!=="paragraph") return;
    expect(grid.block.lines.map(line=>line.id)).toEqual(["line-1","line-2","line-3"]);
    const prose=result.regions.filter(region=>region.block.id.startsWith("caption-prose-"))
      .flatMap(region=>region.block.type==="paragraph"?region.block.lines.map(line=>line.id):[]);
    expect(prose).toContain("line-8");
    expect(prose).toContain("line-9");
  });

  it("does not interpret a prose sentence starting with a table reference as a caption",()=>{
    const source=makeBlock([
      makeLine(0,["Table 1 describes results from the previous season."]),
      ...Array.from({length:6},(_,i)=>makeLine(i+1,["Narrative evidence only."])),
    ]);
    expect(detectTableRegionsForPage([source]).regions.some(region=>
      region.block.id.startsWith("caption-table-")
    )).toBe(false);
  });

});
