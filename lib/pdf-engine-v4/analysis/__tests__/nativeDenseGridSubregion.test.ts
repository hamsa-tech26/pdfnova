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
  it("keeps neighboring right-aligned tables separate across a larger-font section heading",()=>{
    const label="Long native description for an independently positioned numeric grid";
    const formats=["1","12","123","1,234","12,345","123,456","1,234,567"];
    const ys=[616.07,...Array.from({length:17},(_,i)=>600.95-i*8.4),451.91];
    const grid=(offset:number,index:number)=>ys.map((y,i)=>{
      const value=formats[i%formats.length];
      const row=line(index+i,y-offset,[[label,30],
        ...[320,392,466,539].map(right=>[value,right-value.length*4] as [string,number])]);
      row.bounds.height=6.96;
      for(const word of row.words)word.bounds.height=6.96;
      row.words[0].bounds.width=200;
      return row;
    });
    const before=[685.19,658.79,649.19,634.55].map((y,i)=>line(i,y,[["Introductory section",29]]));
    const boundary=line(23,424.07,[["Section 2 report",29]]);
    boundary.bounds.height=8.88;boundary.words[0].bounds.height=8.88;
    const source=block([...before,...grid(0,4),boundary,...grid(210.24,24),
      ...Array.from({length:4},(_,i)=>line(i+43,229-i*12,[["Concluding section",29]]))]);
    const found=findNativeDenseGridSubregions([source]);
    expect(found).toHaveLength(2);
    expect(found[0].lastLineIndex).toBeLessThan(found[1].firstLineIndex);
    const detected=detectTableRegionsForPage([source]);
    expect(detected.tableRegions.filter(r=>r.block.id.startsWith("native-dense-grid-"))).toHaveLength(2);
    const ids=detected.regions.flatMap(r=>r.block.type==="paragraph"?
      r.block.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
    expect(ids).toHaveLength(source.lines.flatMap(l=>l.words).length);
    expect(new Set(ids)).toEqual(new Set(source.lines.flatMap(l=>l.words.map(w=>w.id))));
  });
  it("recognizes numeric right edges when one-to-seven-digit values shift the left edges",()=>{
    const label="Long description occupying its own native source cell rather than prose";
    const formats=["1","12","123","1,234","12,345","123,456","1,234,567"];
    const data=Array.from({length:19},(_,i)=>{
      const value=formats[i%formats.length];
      const row=line(i+4,616-i*8.4,[[label,30],
        ...[320,392,466,539].map(right=>[value,right-value.length*4] as [string,number])]);
      row.words[0].bounds.width=245;
      return row;
    });
    const before=Array.from({length:4},(_,i)=>line(i,690-i*12,[["Introductory narrative",30]]));
    const after=Array.from({length:5},(_,i)=>line(i+23,440-i*12,[["Following narrative",30]]));
    const source=block([...before,...data,...after]);
    expect(findNativeDenseGridSubregions([source])).toHaveLength(1);
    expect(detectTableRegionsForPage([source]).tableRegions.some(r=>
      r.block.id.startsWith("native-dense-grid-"))).toBe(true);
  });
  it("recovers a short, widely spaced eight-numeric-column grid without lowering the ordinary minimum",()=>{
    const before=Array.from({length:20},(_,i)=>line(i,800-i*12,[["Narrative surrounding the source grid",64]]));
    const data=Array.from({length:5},(_,i)=>line(21+i,393-i*29.45,[
      ["Metric-"+i,95],...Array.from({length:8},(_,c)=>[
        i===0?String(2001+c):String(100+c+i),
        177+c*44-(i===0?39:24),
      ] as [string,number]),
    ]));
    // The numeric header is centred differently; four distinct body rows
    // support the same eight source column edges.
    for(const row of data)for(const word of row.words.slice(1))word.bounds.width=24;
    const after=Array.from({length:10},(_,i)=>line(26+i,235-i*12,[["Narrative after the source grid",64]]));
    const source=block([...before,line(20,422,[["Units",308]]),...data,...after]);
    const found=findNativeDenseGridSubregions([source]);
    expect(found).toHaveLength(1);
    expect(found[0].block.lines.map(l=>l.id)).toEqual(data.map(l=>l.id));
    expect(detectTableRegionsForPage([source]).tableRegions.some(r=>r.block.id===found[0].block.id)).toBe(true);
    const tooShort=block([...before,...data.slice(0,4),...after]);
    expect(findNativeDenseGridSubregions([tooShort])).toEqual([]);
    const fewerColumns=block([...before,...data.map(row=>({...row,words:row.words.slice(0,8)})),...after]);
    expect(findNativeDenseGridSubregions([fewerColumns])).toEqual([]);
    const drifting=block([...before,...data.map((row,i)=>({...row,words:row.words.map(w=>({
      ...w,bounds:{...w.bounds,x:w.bounds.x+i*15},
    }))})),...after]);
    expect(findNativeDenseGridSubregions([drifting])).toEqual([]);
  });
  it("recovers two long-label numeric grids while retaining every source word once",()=>{
    const longLabel="An independently positioned description cell with more than thirty-eight characters";
    const first=Array.from({length:19},(_,i)=>line(i+4,616-i*8.4,[
      [longLabel,30],["1,210",299],["3,450",375],["8,130",451],["4,980",519],
    ]));
    const second=Array.from({length:19},(_,i)=>line(i+24,406-i*8.4,[
      [longLabel,30],["2,310",299],["4,560",375],["9,240",451],["5,090",519],
    ]));
    const before=Array.from({length:4},(_,i)=>line(i,690-i*12,[["Ordinary introductory narrative",30]]));
    const source=block([...before,...first,line(23,424,[["Section heading",30]]),...second,
      ...Array.from({length:4},(_,i)=>line(i+43,220-i*12,[["Concluding narrative",30]]))]);
    // Label width is deliberately bounded independently of character count:
    // PDF text items can contain an entire description cell.
    for(const row of [...first,...second])row.words[0].bounds.width=245;
    const found=findNativeDenseGridSubregions([source]);
    expect(found).toHaveLength(2);
    const detected=detectTableRegionsForPage([source]);
    expect(detected.tableRegions.filter(r=>r.block.id.startsWith("native-dense-grid-"))).toHaveLength(2);
    const all=detected.regions.flatMap(r=>r.block.type==="paragraph"?
      r.block.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
    const original=source.lines.flatMap(l=>l.words.map(w=>w.id));
    expect(all).toHaveLength(original.length);
    expect(new Set(all)).toEqual(new Set(original));
  });
  it("rejects long prose with incidental numerals, additional long cells or drifting columns",()=>{
    const longLabel="An article sentence with several incidental numbers in its description";
    const rows=Array.from({length:26},(_,i)=>line(i,740-i*12,[
      [longLabel,30],["12 cases",299],["34 observations",375],["56 participants",451],["78 months",519],
    ]));
    expect(findNativeDenseGridSubregions([block(rows)])).toEqual([]);
    const numeric=rows.map((row,i)=>line(i,740-i*12,[
      [longLabel,30],["120",299+i*10],["340",375+i*10],["560",451+i*10],["780",519+i*10],
    ]));
    expect(findNativeDenseGridSubregions([block(numeric)])).toEqual([]);
    const extraLong=rows.map((row,i)=>line(i,740-i*12,[
      [longLabel,30],[longLabel,299],["340",375],["560",451],["780",519],
    ]));
    expect(findNativeDenseGridSubregions([block(extraLong)])).toEqual([]);
  });
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

describe("Releases 113-114: multiple native scientific grids",()=>{
  it("recovers two disjoint native numeric regions from one oversized paragraph",()=>{
    const before=Array.from({length:8},(_,i)=>line(i,760-i*12,[["Explanatory prose surrounding independent scientific results",55]]));
    const first=Array.from({length:8},(_,i)=>line(i+8,620-i*14,[
      ["Case-"+i,61],["12"+i,120],["2."+i,179],["6."+i,347]
    ]));
    const between=Array.from({length:4},(_,i)=>line(i+16,470-i*13,[["Narrative notes after the first matrix",55]]));
    const second=Array.from({length:8},(_,i)=>line(i+20,365-i*14,[
      ["Sample-"+i,61],["31"+i,120],["4."+i,179],["9."+i,347]
    ]));
    const after=Array.from({length:5},(_,i)=>line(i+28,205-i*14,[["Concluding narrative notes after table",55]]));
    const source=block([...before,...first,...between,...second,...after]);
    const originalIds=source.lines.flatMap(l=>l.words).map(w=>w.id);
    const found=findNativeDenseGridSubregions([source]);
    expect(found).toHaveLength(2);
    expect(found[0].lastLineIndex).toBeLessThan(found[1].firstLineIndex-1);
    expect(found[0].block.id).not.toBe(found[1].block.id);
    expect(found.flatMap(x=>x.block.lines).some(l=>l.id==="line-0")).toBe(false);
    expect(found.flatMap(x=>x.block.lines).some(l=>l.id==="line-32")).toBe(false);
    expect(source.lines.flatMap(l=>l.words).map(w=>w.id)).toEqual(originalIds);
    const detected=detectTableRegionsForPage([source]);
    expect(detected.regions.filter(x=>x.block.id.startsWith("native-dense-grid-"))).toHaveLength(2);
  });
  it("does not duplicate neighboring runs when multiple start positions qualify",()=>{
    const numeric=Array.from({length:12},(_,i)=>line(i,740-i*14,[
      ["Specimen-"+i,61],["40"+i,120],["3."+i,179],["5."+i,347]
    ]));
    const prose=Array.from({length:12},(_,i)=>line(i+12,530-i*14,[
      ["Published article contextual description",55]
    ]));
    expect(findNativeDenseGridSubregions([block([...numeric,...prose])])).toHaveLength(1);
  });
});
