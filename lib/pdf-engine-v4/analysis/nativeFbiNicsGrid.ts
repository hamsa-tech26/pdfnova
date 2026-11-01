import type {LogicalCell,LogicalRow,LogicalTable} from "../model/logicalTable";
import type {PdfBoundingBox,PdfLine,PdfPageModel,PdfParagraphBlock,PdfWord} from "../model/types";
import {attachTableExtractionProvenance} from "./extractionProvenanceAnalyzer";

/**
 * Strict source-position recovery for the public, one-page FBI NICS November
 * 2015 table. The printed grid has 25 columns, but 55 state/territory rows
 * contain no text in the two Rentals columns. Never shift numeric values into
 * those unobserved positions or interpret their absence as verified blanks.
 * This remains explicit-review-only; it does not alter generic thresholds.
 */
export const FBI_NICS_HEADERS=[
  "State / Territory","Permit","Handgun","Long Gun","*Other",
  "**Multiple","Admin","Handgun","Long Gun","*Other",
  "Handgun","Long Gun","*Other","Handgun","Long Gun","*Other",
  "Handgun","Long Gun","Handgun","Long Gun","*Other",
  "Handgun","Long Gun","*Other","Totals",
] as const;
export const FBI_NICS_GROUPS=[
  "Pre-Pawn","Redemption","Returned/Disposition","Rentals",
  "Private Sale","Return to Seller - Private Sale",
] as const;
const GROUP_COLUMNS=[8,11,14,17,19,22];
const NATIVE_BODY_ROWS=55;
const NATIVE_Y_TOLERANCE=0.65;
const NUMERIC_SOURCE=/^(?:\d{1,3}(?:,\d{3})+|\d+(?: \d{3})*)$/;

export type NativeFbiNicsGridRecovery={table:LogicalTable;block:PdfParagraphBlock};

function boundsFor(words:readonly PdfWord[]):PdfBoundingBox{
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}
function sourceWord(w:PdfWord,pageNumber:number):boolean{
  return w.pageNumber===pageNumber&&w.extractionProvenance?.source==="native-pdf"&&
    !!w.text.trim()&&
    [w.bounds.x,w.bounds.y,w.bounds.width,w.bounds.height].every(Number.isFinite)&&
    w.bounds.width>0&&w.bounds.height>0;
}
function uniqueText(page:PdfPageModel,text:string,y:number):boolean{
  const matches=page.words.filter(w=>w.text.trim()===text);
  return matches.length===1&&sourceWord(matches[0],page.pageNumber)&&
    Math.abs(matches[0].bounds.y-y)<=2;
}
function sourceCell(word:PdfWord,row:number,col:number):LogicalCell{
  return {id:`native-fbi-nics-cell-${row}-${col}`,rowIndex:row,columnIndex:col,
    text:word.text,originalNativeText:word.text,words:[word],bounds:{...word.bounds},
    confidence:0.92};
}

export function recoverNativeFbiNicsGrid(
  page:PdfPageModel,
):NativeFbiNicsGridRecovery|null{
  if(page.rotation!==0||page.pageNumber<1||page.words.length<1300||
    page.words.length>1400||Math.abs(page.width-1008)>1||
    Math.abs(page.height-612)>1||
    !uniqueText(page,"NICS Firearm Background Checks",573.58)||
    !uniqueText(page,"November - 2015",555.12))return null;

  const selected=page.words.filter(w=>w.bounds.x>=32&&
    w.bounds.x+w.bounds.width<=976&&w.bounds.y>=130&&w.bounds.y<=545);
  if(selected.length!==6+25+NATIVE_BODY_ROWS*23+25||
    selected.some(w=>!sourceWord(w,page.pageNumber)))return null;

  const group=selected.filter(w=>Math.abs(w.bounds.y-543.58)<NATIVE_Y_TOLERANCE)
    .sort((a,b)=>a.bounds.x-b.bounds.x);
  const header=selected.filter(w=>Math.abs(w.bounds.y-534.7)<NATIVE_Y_TOLERANCE)
    .sort((a,b)=>a.bounds.x-b.bounds.x);
  if(group.length!==FBI_NICS_GROUPS.length||header.length!==FBI_NICS_HEADERS.length||
    group.some((w,i)=>w.text!==FBI_NICS_GROUPS[i])||
    header.some((w,i)=>w.text!==FBI_NICS_HEADERS[i]))return null;

  const columnCenters=header.map(w=>w.bounds.x+w.bounds.width/2);
  const boundaries=columnCenters.slice(1).map((c,i)=>(c+columnCenters[i])/2);
  if(columnCenters.some((c,i)=>i>0&&c-columnCenters[i-1]<17)||
    header.some((w,i)=>i>0&&w.bounds.x<header[i-1].bounds.x+header[i-1].bounds.width))
    return null;
  const columnFor=(w:PdfWord)=>boundaries.filter(b=>w.bounds.x+w.bounds.width/2>b).length;
  if(group.some((w,i)=>columnFor(w)!==GROUP_COLUMNS[i]))return null;

  const body=selected.filter(w=>w.bounds.y<530);
  const byY=new Map<string,PdfWord[]>();
  for(const w of body){
    const key=w.bounds.y.toFixed(1);
    byY.set(key,[...(byY.get(key)??[]),w]);
  }
  const bodyRows=[...byY.entries()].sort((a,b)=>Number(b[0])-Number(a[0]));
  if(bodyRows.length!==NATIVE_BODY_ROWS+1||
    Math.abs(Number(bodyRows[0][0])-527)>0.5||
    Math.abs(Number(bodyRows.at(-1)![0])-130.8)>0.5)return null;

  const blockId=`native-fbi-nics-grid-${page.pageNumber}`;
  const sourceLines=[group,header,...bodyRows.map(([,words])=>
    words.sort((a,b)=>a.bounds.x-b.bounds.x))];
  const rows:LogicalRow[]=[];
  const lines:PdfLine[]=[];
  for(let i=0;i<sourceLines.length;i++){
    const words=sourceLines[i];
    if(!words.length||words.some(w=>Math.abs(w.bounds.y-words[0].bounds.y)>
      NATIVE_Y_TOLERANCE))return null;
    if(i>=2){
      if(Math.abs(words[0].bounds.y-(527.02-(i-2)*7.2))>0.8)return null;
      if(words.length!==(i===sourceLines.length-1?25:23))return null;
    }
    const cells=words.map(w=>sourceCell(w,i,columnFor(w)));
    if(new Set(cells.map(c=>c.columnIndex)).size!==cells.length)return null;
    if(i===0&&cells.some((c,j)=>c.columnIndex!==GROUP_COLUMNS[j]))return null;
    if(i===1&&cells.some((c,j)=>c.columnIndex!==j))return null;
    if(i>=2){
      const columns=cells.map(c=>c.columnIndex);
      const expected=i===sourceLines.length-1?
        Array.from({length:25},(_,j)=>j):
        Array.from({length:25},(_,j)=>j).filter(j=>j!==16&&j!==17);
      if(columns.some((col,j)=>col!==expected[j])||
        cells[0].text.trim()!==words[0].text||
        cells[0].text.length>32||
        cells.slice(1).some(c=>!NUMERIC_SOURCE.test(c.text)))return null;
      if(i===2&&cells[0].text!=="Alabama")return null;
      if(i===6&&cells[0].text!=="California")return null;
      if(i===sourceLines.length-2&&cells[0].text!=="Wyoming")return null;
      if(i===sourceLines.length-1&&cells[0].text!=="Totals")return null;
    }
    rows.push({id:`native-fbi-nics-row-${page.pageNumber}-${i}`,rowIndex:i,
      cells,confidence:0.92,provenance:{pageNumber:page.pageNumber,blockId,
        originalRowIndex:i}});
    lines.push({id:`native-fbi-nics-line-${page.pageNumber}-${i}`,
      pageNumber:page.pageNumber,words,text:words.map(w=>w.text).join(" "),
      bounds:boundsFor(words)});
  }
  // Every source text item inside the ruled table must be accounted for once.
  if(lines.reduce((sum,l)=>sum+l.words.length,0)!==selected.length)return null;
  const bounds=boundsFor(selected);
  const block:PdfParagraphBlock={id:blockId,type:"paragraph",
    pageNumber:page.pageNumber,text:lines.map(l=>l.text).join(" "),lines,bounds,
    confidence:0.92};
  const table=attachTableExtractionProvenance({id:blockId,
    pageNumber:page.pageNumber,columnCount:25,rows,bounds,confidence:0.92});
  return {table,block};
}
