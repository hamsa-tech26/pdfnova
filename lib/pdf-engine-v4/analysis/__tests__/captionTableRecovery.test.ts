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
      makeLine(4,["Salmon","2026","18","19","20","21"]),
      makeLine(5,["Discussion begins here without a tabular format."]),
      makeLine(6,["The observations should remain in the document narrative."]),
      makeLine(7,["This explanation separates the following numeric passage."]),
      makeLine(8,["The following examples are not part of the first table."]),
      makeLine(9,["Other","2027","90","91","92","93"]),
      makeLine(10,["Other","2028","94","95","96","97"]),
    ];
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    const grid=result.tableRegions.find(region=>region.block.id.startsWith("caption-table-"));
    expect(grid).toBeDefined();
    if(!grid||grid.block.type!=="paragraph") return;
    expect(grid.block.lines.map(line=>line.id)).toEqual(["line-1","line-2","line-3","line-4"]);
    const prose=result.regions.filter(region=>region.block.id.startsWith("caption-prose-"))
      .flatMap(region=>region.block.type==="paragraph"?region.block.lines.map(line=>line.id):[]);
    expect(prose).toContain("line-9");
    expect(prose).toContain("line-10");
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

  it("isolates long seven-column native scientific tables without treating prose as cells",()=>{
    const anchors=[60,100,175,249,324,399,474];
    const mk=(i:number,values:string[],xs=anchors):PdfLine=>{
      const y=760-i*13;
      const pieces=values.map((text,j):PdfWord=>({
        id:"science-word-"+i+"-"+j,text,pageNumber:1,rotation:0,
        font:{size:9},bounds:{x:xs[j],y,width:Math.max(8,Math.min(30,text.length*4)),height:10},
      }));
      return {id:"scientific-line-"+i,pageNumber:1,words:pieces,
        text:values.join(" "),
        bounds:{x:xs[0],y,width:xs[xs.length-1]+35-xs[0],height:10}};
    };
    const pre=Array.from({length:8},(_,i)=>mk(i,["The text preceding this table is an ordinary paragraph."],[60]));
    const header=mk(8,["x","y","z","U11","U22","U33"],anchors.slice(1));
    const grid=Array.from({length:33},(_,i)=>mk(i+9,[
      "C"+(i+1),"0.354(2)","0.651(4)","1.234(6)","0.019(2)","0.012(3)","0.031(5)",
    ]));
    const post=Array.from({length:5},(_,i)=>mk(i+42,["Discussion continues below the structure parameters."],[60]));
    const original=makeBlock([...pre,header,...grid,...post]);
    const output=detectTableRegionsForPage([original]);
    const recovered=output.tableRegions.find(r=>r.block.id.startsWith("aligned-grid-"));
    expect(recovered).toBeDefined();
    if(!recovered||recovered.block.type!=="paragraph") return;
    expect(recovered.block.lines).toHaveLength(34);
    expect(recovered.block.lines[0].id).toBe("scientific-line-8");
    expect(recovered.block.lines[33].id).toBe("scientific-line-41");
    const allLines=output.regions.flatMap(region=>
      region.block.type==="paragraph"?region.block.lines.map(line=>line.id):[]);
    expect(allLines).toEqual(original.lines.map(line=>line.id));
    expect(new Set(allLines).size).toBe(original.lines.length);
  });

  it("rejects long narrative blocks without a fixed multi-column word grid",()=>{
    const lines=Array.from({length:35},(_,i)=>makeLine(i,[
      "The","scientific","text","varies","in","length",
    ],false));
    // Deliberately perturb successive column positions to emulate prose.
    for(let i=0;i<lines.length;i++){
      lines[i].words.forEach((word,j)=>{word.bounds.x+=i*3+j*2;});
    }
    const result=detectTableRegionsForPage([makeBlock(lines)]);
    expect(result.tableRegions.some(x=>x.block.id.startsWith("aligned-grid-"))).toBe(false);
  });

  it("preserves two sparse edge rows of a long native seven-column table",()=>{
    const anchors=[57,153,226,291,364,429,502];
    const build=(i:number,indexes:number[]):PdfLine=>{
      const y=760-i*14;
      const words:PdfWord[]=indexes.map((column,j)=>({
        id:"sparse-"+i+"-"+j,
        text:"Value"+i+"-"+j,
        pageNumber:1,rotation:0,font:{size:9},
        bounds:{x:anchors[column],y,width:25,height:10},
      }));
      return {id:"sparse-line-"+i,pageNumber:1,words,
        bounds:{x:anchors[indexes[0]],y,
          width:anchors[indexes[indexes.length-1]]+25-anchors[indexes[0]],
          height:10},text:words.map(w=>w.text).join(" ")};
    };
    const proseBefore=Array.from({length:3},(_,i)=>build(i,[0]));
    const header=build(3,[0,1,3,5]);
    const body=Array.from({length:19},(_,i)=>build(i+4,[0,1,2,3,4,5,6]));
    const trailing=build(23,[0,2,4,6]);
    const proseAfter=Array.from({length:2},(_,i)=>build(i+24,[0]));
    const original=makeBlock([...proseBefore,header,...body,trailing,...proseAfter]);
    const output=detectTableRegionsForPage([original]);
    const grid=output.tableRegions.find(r=>r.block.id.startsWith("aligned-grid-"));
    expect(grid).toBeDefined();
    if(!grid||grid.block.type!=="paragraph")return;
    expect(grid.block.lines).toHaveLength(21);
    expect(grid.block.lines[0].id).toBe("sparse-line-3");
    expect(grid.block.lines[20].id).toBe("sparse-line-23");
    expect(output.regions.flatMap(r=>
      r.block.type==="paragraph"?r.block.lines.map(l=>l.id):[]
    )).toEqual(original.lines.map(l=>l.id));
    expect(output.regions.some(r=>r.block.id.startsWith("caption-prose-"))).toBe(true);
  });

  it("rejects short caption-like neighbors that do not align across enough columns",()=>{
    const anchors=[57,153,226,291,364,429,502];
    const build=(i:number,indexes:number[]):PdfLine=>{
      const y=760-i*14;
      const words:PdfWord[]=indexes.map((c,j)=>({
        id:"word-"+i+"-"+j,text:"v"+j,pageNumber:1,rotation:0,
        font:{size:9},bounds:{x:anchors[c],y,width:20,height:10},
      }));
      return {id:"other-"+i,pageNumber:1,words,
        bounds:{x:anchors[indexes[0]],y,
          width:anchors[indexes[indexes.length-1]]+20-anchors[indexes[0]],
          height:10},text:words.map(w=>w.text).join(" ")};
    };
    const lines=[
      build(0,[0,1]), // too few distinct aligned words
      ...Array.from({length:19},(_,i)=>build(i+1,[0,1,2,3,4,5,6])),
      build(20,[0,1,2]), // too few aligned words
    ];
    const source=makeBlock(lines);
    const detected=detectTableRegionsForPage([source]);
    const grid=detected.tableRegions.find(r=>r.block.id.startsWith("aligned-grid-"));
    expect(grid).toBeDefined();
    if(!grid||grid.block.type!=="paragraph")return;
    expect(grid.block.lines).toHaveLength(19);
    expect(grid.block.lines[0].id).toBe("other-1");
    expect(grid.block.lines[18].id).toBe("other-19");
  });

});
