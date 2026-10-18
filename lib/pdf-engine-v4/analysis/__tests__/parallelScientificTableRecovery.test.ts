import {describe,it,expect} from "vitest";
import type {PdfLine,PdfWord,PdfParagraphBlock} from "../../model/types";
import {splitParallelScientificTables,detectParallelNativeColumns} from "../parallelScientificTableRecovery";
import {detectStableColumnsV4} from "../stableColumnDetector";
import {detectTableRegionsForPage} from "../tableRegionDetector";
import {detectAdaptiveRowsV4} from "../adaptiveRowDetector";
import {buildSmartTableV4} from "../smartCellBuilder";

function line(id:number,y:number,parts:[number,string][]):PdfLine{
 const words:PdfWord[]=parts.map(([x,text],j)=>({
   id:"word-"+id+"-"+j,text,pageNumber:3,rotation:0,font:{size:9},
   bounds:{x,y,width:Math.max(9,text.length*3),height:9},
 }));
 const x=Math.min(...words.map(w=>w.bounds.x));
 return {id:"line-"+id,pageNumber:3,words,text:words.map(w=>w.text).join(" "),
   bounds:{x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,height:9}};
}
function makeMixed(){
 let id=0;
 const lines:PdfLine[]=[
   line(id++,720,[[64,"Table"],[98,"1."],[159,"Features"],[230,"Number"],
     [321,"Table"],[355,"2."],[440,"Taxonomy"],[489,"Counts"]])
 ];
 for(let i=0;i<40;i++){
   const y=697-i*12.5;
   const labels:Record<number,string>={
      26:"Non-ECF family s factors",
      27:"ECF family s/anti-s factor pairs",
      33:"Within e-Proteobacterial taxa",
      38:"Only in non e-Proteobacterial taxa",
   };
   const left:[number,string][]=[[i%3===0?78:71,labels[i]??("Class-"+i)]];
   const right:[number,string][]=[[321,"Taxon-"+i],[435,"12"],[461,"13"],[489,"14"]];
   if(i!==20)left.push([230,String(i)]);
   lines.push(line(id++,y,[...left,...right]));
   if(i===8)lines.push(line(id++,y-6,[[112,"nested-label"]]));
   if(i===20)lines.push(line(id++,y-6,[[230,"20"]]));
 }
 for(let j=0;j<12;j++)
   lines.push(line(id++,186-j*10,[[64,"Narrative-" + j],[321,"Reference-"+j]]));
 const all=lines.flatMap(l=>l.words);
 const x=Math.min(...all.map(w=>w.bounds.x));
 const block:PdfParagraphBlock={id:"source-mixed",pageNumber:3,type:"paragraph",
   lines,text:lines.map(l=>l.text).join(" "),confidence:0.95,
   bounds:{x,y:70,width:550,height:660}};
 return block;
}
describe("R80 source-aligned two-column PDF table recovery",()=>{
 it("preserves every native source token and recovers forty logical rows",()=>{
   const source=makeMixed();
   const blocks=splitParallelScientificTables([source]);
   const table=blocks.find(b=>b.id.startsWith("native-two-col-grid-"));
   expect(table?.type).toBe("paragraph");
   if(!table||table.type!=="paragraph")return;
   expect(table.lines).toHaveLength(40);
   const originalIds=source.lines.flatMap(l=>l.words.map(w=>w.id));
   const emitted=blocks.flatMap(b=>b.type==="paragraph"
     ?b.lines.flatMap(l=>l.words.map(w=>w.id)):[]);
   expect(emitted.length).toBe(originalIds.length);
   expect(new Set(emitted)).toEqual(new Set(originalIds));
   const columns=detectParallelNativeColumns(table,detectStableColumnsV4(table));
   expect(columns?.columns).toHaveLength(2);
   if(!columns)return;
   const rows=detectAdaptiveRowsV4(table,columns.columns);
   expect(rows.rows).toHaveLength(40);
   expect(rows.rows.every(r=>r.reason==="parallel-native-scientific-physical-row")).toBe(true);
   const structured=buildSmartTableV4(3,rows.rows,columns.columns).table;
   expect(structured?.rows).toHaveLength(40);
   const expected:Record<number,string>={
     26:"Non-ECF family σ factors",
     27:"ECF family σ/anti-σ factor pairs",
     33:"Within ε-Proteobacterial taxa",
     38:"Only in non ε-Proteobacterial taxa",
   };
   for(const [index,label] of Object.entries(expected)){
     const row=structured?.rows[Number(index)];
     expect(row?.cells.find(c=>c.columnIndex===0)?.text).toBe(label);
     const before=row?.cells.find(c=>c.columnIndex===0)?.originalNativeText;
     expect(before).toBeDefined();
     expect(before).not.toBe(label);
     expect(row?.cells.find(c=>c.columnIndex===0)?.nativeTextAdjustmentReasons?.length).toBe(1);
   }
   expect(structured?.rows[0].cells[0].originalNativeText).toBeUndefined();
   expect(detectTableRegionsForPage([source]).tableRegions.some(r=>
     r.block.id.startsWith("native-two-col-grid-"))).toBe(true);
 });
 it("refuses OCR, uncaptioned narrative and insufficient page grids",()=>{
   const full=makeMixed();
   expect(splitParallelScientificTables([{...full,lines:full.lines.slice(0,15)}]))
     .toHaveLength(1);
   const first={...full.lines[0],words:full.lines[0].words.map((w,i)=>
      i===0?{...w,text:"Appendix"}:w)};
   expect(splitParallelScientificTables([{...full,lines:[first,...full.lines.slice(1)]}]))
      .toHaveLength(1);
   const ocr={...full,lines:full.lines.map(l=>({...l,
     words:l.words.map(w=>({...w,extractionProvenance:{source:"ocr-tesseract" as const}}))}))};
   expect(splitParallelScientificTables([ocr])).toHaveLength(1);
 });
});
