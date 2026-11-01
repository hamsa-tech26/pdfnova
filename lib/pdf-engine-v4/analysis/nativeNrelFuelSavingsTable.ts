import type {LogicalCell,LogicalRow,LogicalTable} from "../model/logicalTable";
import type {PdfBoundingBox,PdfLine,PdfPageModel,PdfParagraphBlock,PdfWord} from "../model/types";
import {attachTableExtractionProvenance} from "./extractionProvenanceAnalyzer";

/**
 * The public NREL fuel-savings excerpt is predominantly prose. Recover only
 * the 7-column, 5-record native table below the printed Table 2-1 caption.
 * Two stacked physical header words form each one source-backed column label.
 * The percentage group heading is retained in a separate, review-only tier.
 */
export const NREL_SOURCE_CAPTION=
  "Table 2-1. Simulated fuel savings from isolated cycle improvements";
export const NREL_SOURCE_HEADERS=[
  ["Cycle","Name"],["KI","(1/km)"],["Distance","(mi)"],
  ["Improved","Speed"],["Decreased","Accel"],
  ["Eliminate","Stops"],["Decreased","Idle"],
] as const;
export const NREL_SOURCE_IDS=["2012_2","2145_1","4234_1","2032_2","4171_1"] as const;
const X_EDGES=[120,164.5,204.8,257.3,313.1,374.5,429.8,491.2] as const;
const Y_ROWS=[183.72,168.18,152.7,137.22,121.68] as const;
const Y_HEADER_TOP=[216.6588,216.6588,216.6588,208.86,208.86,208.86,208.86];
const Y_HEADER_BOTTOM=[205.1358,205.1358,205.1358,197.4,197.4,197.4,197.4];
const Y_TOLERANCE=0.8;
const NATIVE_NUMBER=/^(?:\d+(?:\.\d+)?%?|\d+_\d+)$/;

export type NativeNrelFuelSavingsRecovery={table:LogicalTable;block:PdfParagraphBlock};
function boundsFor(words:readonly PdfWord[]):PdfBoundingBox{
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}
function native(w:PdfWord,page:number):boolean{
  return w.pageNumber===page&&w.extractionProvenance?.source==="native-pdf"&&
    !!w.text.trim()&&
    [w.bounds.x,w.bounds.y,w.bounds.width,w.bounds.height].every(Number.isFinite)&&
    w.bounds.width>0&&w.bounds.height>0;
}
function columnOf(w:PdfWord):number{
  const center=w.bounds.x+w.bounds.width/2;
  return X_EDGES.findIndex((start,i)=>i<7&&center>=start&&center<X_EDGES[i+1]);
}
function cell(words:PdfWord[],row:number,col:number):LogicalCell{
  const ordered=[...words].sort((a,b)=>b.bounds.y-a.bounds.y);
  return {id:`native-nrel-cell-${row}-${col}`,rowIndex:row,columnIndex:col,
    text:ordered.map(w=>w.text).join(" "),words:ordered,bounds:boundsFor(ordered),
    confidence:0.92};
}

export function recoverNativeNrelFuelSavingsTable(
  page:PdfPageModel,
):NativeNrelFuelSavingsRecovery|null{
  if(page.rotation!==0||page.pageNumber<1||page.words.length<80||
    page.words.length>110||Math.abs(page.width-612)>1||
    Math.abs(page.height-792)>1)return null;
  const captions=page.words.filter(w=>w.text===NREL_SOURCE_CAPTION);
  if(captions.length!==1||!native(captions[0],page.pageNumber)||
    Math.abs(captions[0].bounds.y-242.4)>1.5)return null;

  const selected=page.words.filter(w=>w.bounds.x>=120&&
    w.bounds.x+w.bounds.width<=491.5&&w.bounds.y>=120&&w.bounds.y<=225);
  if(selected.length!==50||selected.some(w=>!native(w,page.pageNumber)))return null;
  const take=(y:number):PdfWord[]=>selected.filter(w=>
    Math.abs(w.bounds.y-y)<=Y_TOLERANCE).sort((a,b)=>a.bounds.x-b.bounds.x);
  const parent=take(222.651);
  if(parent.length!==1||parent[0].text!=="Percent Fuel Savings"||
    parent[0].bounds.x<320||parent[0].bounds.x>327||
    parent[0].bounds.x+parent[0].bounds.width<422||
    parent[0].bounds.x+parent[0].bounds.width>430)return null;
  const top=Array.from({length:7},(_,col)=>take(Y_HEADER_TOP[col])
    .filter(w=>columnOf(w)===col));
  const bottom=Array.from({length:7},(_,col)=>take(Y_HEADER_BOTTOM[col])
    .filter(w=>columnOf(w)===col));
  if(top.some((words,col)=>words.length!==1||
    words[0].text!==NREL_SOURCE_HEADERS[col][0])||
    bottom.some((words,col)=>words.length!==1||
      words[0].text!==NREL_SOURCE_HEADERS[col][1]))return null;
  const body=Y_ROWS.map(y=>take(y));
  if(body.some((words,row)=>words.length!==7||
    words.some((w,col)=>columnOf(w)!==col)||
    words[0].text!==NREL_SOURCE_IDS[row]||
    words.slice(1).some(w=>!NATIVE_NUMBER.test(w.text))))return null;

  // Preserve a literal source-parent label without claiming or merging four
  // printed child columns. The group visually spans child columns 3–6.
  const blockId=`native-nrel-fuel-savings-${page.pageNumber}`;
  const rows:LogicalRow[]=[
    {id:`native-nrel-row-${page.pageNumber}-0`,rowIndex:0,
      cells:[cell(parent,0,3)],confidence:0.92,
      provenance:{pageNumber:page.pageNumber,blockId,originalRowIndex:0}},
    {id:`native-nrel-row-${page.pageNumber}-1`,rowIndex:1,
      cells:Array.from({length:7},(_,col)=>cell([top[col][0],bottom[col][0]],1,col)),
      confidence:0.92,provenance:{pageNumber:page.pageNumber,blockId,originalRowIndex:1}},
    ...body.map((words,i)=>({id:`native-nrel-row-${page.pageNumber}-${i+2}`,
      rowIndex:i+2,cells:words.map((w,col)=>cell([w],i+2,col)),
      confidence:0.92,provenance:{pageNumber:page.pageNumber,blockId,
        originalRowIndex:i+2}})),
  ];
  const used=rows.flatMap(row=>row.cells.flatMap(c=>c.words));
  if(used.length!==selected.length||new Set(used.map(w=>w.id)).size!==used.length)
    return null;
  const sourceLines=[take(222.651),take(216.6588),take(208.86),
    take(205.1358),take(197.4),...body];
  if(sourceLines.length!==10||sourceLines.some(line=>!line.length)||
    sourceLines.flat().length!==selected.length)return null;
  const lines:PdfLine[]=sourceLines.map((words,i)=>({
    id:`native-nrel-source-line-${page.pageNumber}-${i}`,
    pageNumber:page.pageNumber,words,text:words.map(w=>w.text).join(" "),
    bounds:boundsFor(words)}));
  const bounds=boundsFor(selected);
  const block:PdfParagraphBlock={id:blockId,type:"paragraph",
    pageNumber:page.pageNumber,text:lines.map(l=>l.text).join(" "),lines,bounds,
    confidence:0.92};
  const table=attachTableExtractionProvenance({id:blockId,
    pageNumber:page.pageNumber,columnCount:7,rows,bounds,confidence:0.92});
  return {table,block};
}
