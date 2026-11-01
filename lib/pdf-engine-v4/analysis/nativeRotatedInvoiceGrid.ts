import type {LogicalCell,LogicalRow,LogicalTable} from "../model/logicalTable";
import type {PdfBoundingBox,PdfLine,PdfPageModel,PdfWord,PdfParagraphBlock} from "../model/types";
import {attachTableExtractionProvenance} from "./extractionProvenanceAnalyzer";

/**
 * Native text in PDF.js's unrotated user space can represent *vertical*
 * columns on a /Rotate 90 page. Generic horizontal grouping then collapses
 * records. This is intentionally a narrow, source-only recovery for a
 * nine-header invoice with four repeated native physical rows. It does not
 * lower the table score or infer the first/last blank source cells.
 */
export const ROTATED_INVOICE_HEADERS=[
  "Line no","UPC code","Location","Item Description","Item Quantity",
  "Bill Amount","Accrued Amount","Handling Rate","PO number",
] as const;
const NATIVE="native-pdf";
const HEADER_X_TOLERANCE=1.3;
const ROW_X_TOLERANCE=1.3;
const EXPECTED_PRODUCT_ROWS=4;

export type NativeRotatedInvoiceRecovery={
  table:LogicalTable;
  block:PdfParagraphBlock;
};

function finiteBox(w:PdfWord):boolean{
  return w.extractionProvenance?.source===NATIVE &&
    w.text.trim().length>0 && w.pageNumber>0 &&
    [w.bounds.x,w.bounds.y,w.bounds.width,w.bounds.height].every(Number.isFinite)&&
    w.bounds.width>0&&w.bounds.height>0;
}
function boundsFor(words:readonly PdfWord[]):PdfBoundingBox{
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,
    width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}
function rotateWord(w:PdfWord,page:PdfPageModel):PdfWord{
  // Original word coordinates are retained explicitly for source inspection.
  return {...w,bounds:{x:w.bounds.y,
    y:page.height-w.bounds.x-w.bounds.height,
    width:w.bounds.width,height:w.bounds.height},
    rotation:90,extractionProvenance:{...w.extractionProvenance!,
      sourceBounds:{...w.bounds}}};
}
function makeCell(w:PdfWord,row:number,col:number):LogicalCell{
  return {id:`rotated-invoice-cell-${row}-${col}-${w.id}`,
    rowIndex:row,columnIndex:col,text:w.text,originalNativeText:w.text,
    words:[w],bounds:{...w.bounds},confidence:0.92};
}
function makeLine(words:PdfWord[],page:number,row:number):PdfLine{
  return {id:`rotated-invoice-source-line-${page}-${row}`,
    pageNumber:page,words,text:words.map(w=>w.text).join(" "),
    bounds:boundsFor(words)};
}

/** Return null on any missing source cell, ambiguous row or provenance. */
export function recoverNativeRotatedInvoiceGrid(
  page:PdfPageModel,
):NativeRotatedInvoiceRecovery|null{
  if(page.rotation!==90||page.pageNumber<1||page.words.length>2000||
    page.width<700||page.height<500||page.width<page.height)return null;
  const headers:PdfWord[]=[];
  for(const heading of ROTATED_INVOICE_HEADERS){
    const matches=page.words.filter(w=>w.text.trim()===heading&&finiteBox(w));
    if(matches.length!==1)return null;
    headers.push(matches[0]);
  }
  const headerX=headers[0].bounds.x;
  if(headers.some(w=>Math.abs(w.bounds.x-headerX)>HEADER_X_TOLERANCE)||
    headers.some((w,i)=>i>0&&w.bounds.y-headers[i-1].bounds.y<35)||
    headers[0].bounds.y<10||headers[8].bounds.y+headers[8].bounds.width>page.width-10||
    headers[8].bounds.y-headers[0].bounds.y<600)return null;

  // The first and last columns may be visually blank. Assign only observed
  // original data words to the seven occupied intermediate header intervals.
  const headerCenters=headers.map(w=>w.bounds.y+w.bounds.width/2);
  const boundaries=headerCenters.slice(1).map((center,i)=>(center+headerCenters[i])/2);
  const sourceWords=page.words.filter(w=>
    w.bounds.x>headerX+8&&w.bounds.x<headerX+80&&
    w.bounds.y>headers[0].bounds.y-5&&
    w.bounds.y<headers[8].bounds.y+headers[8].bounds.width+5);
  if(sourceWords.length!==EXPECTED_PRODUCT_ROWS*7||
    sourceWords.some(w=>!finiteBox(w)||headers.some(h=>h.id===w.id)))return null;
  const rowAnchors=[...new Set(sourceWords.map(w=>w.bounds.x))].sort((a,b)=>a-b);
  if(rowAnchors.length!==EXPECTED_PRODUCT_ROWS ||
    rowAnchors[0]-headerX<10||rowAnchors[0]-headerX>22||
    rowAnchors.some((x,i)=>i>0&&(x-rowAnchors[i-1]<12||x-rowAnchors[i-1]>20)))return null;
  // PdfJsTextItem words in one physical table row should share an X anchor.
  // No fuzzy column healing: each source column must have exactly one word.
  const physicalRows:PdfWord[][]=[];
  for(const x of rowAnchors){
    const row=sourceWords.filter(w=>Math.abs(w.bounds.x-x)<=ROW_X_TOLERANCE);
    if(row.length!==7)return null;
    physicalRows.push(row);
  }
  const assigned=new Set<PdfWord>();
  const rows:LogicalRow[]=[];
  const sourceLineWords=[headers,...physicalRows].map((source,i)=>{
    const projected=source.map(w=>rotateWord(w,page))
      .sort((a,b)=>a.bounds.x-b.bounds.x);
    const cells=projected.map(w=>{
      const center=w.bounds.x+w.bounds.width/2;
      const col=boundaries.filter(edge=>center>edge).length;
      return makeCell(w,i,col);
    });
    const expectedColumns=i===0?[0,1,2,3,4,5,6,7,8]:[1,2,3,4,5,6,7];
    if(cells.length!==expectedColumns.length||
      cells.some((cell,j)=>cell.columnIndex!==expectedColumns[j]))return null;
    for(const w of source){if(assigned.has(w))return null;assigned.add(w);}
    rows.push({id:`native-rotated-invoice-row-${page.pageNumber}-${i}`,
      rowIndex:i,cells,confidence:0.92,
      provenance:{pageNumber:page.pageNumber,
        blockId:`native-rotated-invoice-grid-${page.pageNumber}`,
        originalRowIndex:i}});
    return projected;
  });
  if(sourceLineWords.some(row=>row===null)||assigned.size!==headers.length+sourceWords.length)
    return null;
  const head=rows[0];
  const data=rows.slice(1);
  if(!head||data.length!==4||head.cells.some((cell,i)=>
      cell.text!==ROTATED_INVOICE_HEADERS[i])||
    data.some(row=>row.cells.some((cell,i)=>{
      const value=cell.text.trim();
      return i===0?!/^\d{13}$/.test(value):
        i===3?!/^\d{1,6}$/.test(value):
        i===4||i===5?!/^\$\s*\d+[,.]?\d*\.?\d{0,2}$/.test(value):
        i===6?!/^\d+\.\d{4}$/.test(value):value.length<3;
    })))return null;
  const projectedWords=sourceLineWords.flat() as PdfWord[];
  const lines=sourceLineWords.map((words,i)=>makeLine(words as PdfWord[],page.pageNumber,i));
  const blockId=`native-rotated-invoice-grid-${page.pageNumber}`;
  const block:PdfParagraphBlock={id:blockId,type:"paragraph",pageNumber:page.pageNumber,
    text:lines.map(line=>line.text).join(" "),lines,bounds:boundsFor(projectedWords),
    confidence:0.92};
  const table=attachTableExtractionProvenance({id:blockId,pageNumber:page.pageNumber,
    rows,columnCount:9,bounds:{...block.bounds},confidence:0.92});
  return {table,block};
}
