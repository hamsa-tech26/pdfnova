import type {PdfV4XlsxExportSource} from "./pdfToXlsxQuality";
import {prepareSelectedPdfV4XlsxExport} from "./pdfToXlsxSelection";

export const PREVIEW_MAX_ROWS=12;
export const PREVIEW_MAX_COLUMNS=8;
export const PREVIEW_MAX_CHARACTERS=140;

export type PdfTablePreviewWindow={
  rowStart?:number;
  columnStart?:number;
};

/**
 * An actual window into the exact selected XLSX source cell matrix.
 * Window navigation and display clipping NEVER modify exported bytes.
 * The original PDF and values remain on the user's device.
 */
export type PdfTablePreview={
  sourcePages:number[];
  totalRows:number;
  totalColumns:number;
  rowStart:number;
  columnStart:number;
  rowEnd:number;
  columnEnd:number;
  visibleRows:number;
  visibleColumns:number;
  trimmedCells:number;
  visibleRowPages:number[];
  /** Pair merges can render only when all seven header columns are visible. */
  pairedHeaderLayout:boolean;
  rows:string[][];
};

function printable(value:unknown):{text:string;trimmed:boolean}{
  const text=String(value??"");
  return text.length>PREVIEW_MAX_CHARACTERS
    ?{text:text.slice(0,PREVIEW_MAX_CHARACTERS)+"…",trimmed:true}
    :{text,trimmed:false};
}

/** Validate the same fail-closed source-export gate for EVERY window. */
export function buildPdfTablePreview(
  source:PdfV4XlsxExportSource,index:number,
  window:PdfTablePreviewWindow={},
):PdfTablePreview{
  const plan=prepareSelectedPdfV4XlsxExport(source,index);
  const t=source.tables[index];
  const sheet=plan.tables[0];
  const totalRows=sheet.rows.length;
  const totalColumns=Math.max(t.columnCount,...sheet.rows.map(row=>row.length));
  const rowStart=window.rowStart??0;
  const columnStart=window.columnStart??0;
  if(!Number.isSafeInteger(rowStart)||rowStart<0||rowStart>=totalRows||
    !Number.isSafeInteger(columnStart)||columnStart<0||columnStart>=totalColumns){
    throw new Error("Preview row/column offset is outside the verified source table.");
  }
  const rowEnd=Math.min(totalRows,rowStart+PREVIEW_MAX_ROWS);
  const columnEnd=Math.min(totalColumns,columnStart+PREVIEW_MAX_COLUMNS);
  const visibleRows=rowEnd-rowStart;
  const visibleColumns=columnEnd-columnStart;
  let trimmedCells=0;
  const rows=sheet.rows.slice(rowStart,rowEnd).map(row=>
    Array.from({length:visibleColumns},(_,offset)=>{
      const v=printable(row[columnStart+offset]);
      if(v.trimmed)trimmedCells++;
      return v.text;
    }));
  const sourcePages=[...new Set(t.rows.map(row=>
    row.provenance?.pageNumber??t.pageNumber))].sort((a,b)=>a-b);
  const visibleRowPages=Array.from({length:visibleRows},(_,offset)=>
    t.rows[rowStart+offset]?.provenance?.pageNumber??t.pageNumber);
  return {sourcePages,totalRows,totalColumns,
    rowStart,columnStart,rowEnd,columnEnd,visibleRows,visibleColumns,
    trimmedCells,visibleRowPages,
    pairedHeaderLayout:sheet.nativePairedHeader===true &&
      rowStart===0 && columnStart===0 && visibleColumns>=7,rows};
}

/** User-readable A1 address, pure and independent of source cell content. */
export function pdfTableCellAddress(rowIndex:number,columnIndex:number):string{
  if(!Number.isSafeInteger(rowIndex)||rowIndex<0||rowIndex>=2000||
    !Number.isSafeInteger(columnIndex)||columnIndex<0||columnIndex>=128)
    throw new Error("Invalid Excel cell position.");
  let col=columnIndex+1,letters="";
  while(col>0){
    col--;letters=String.fromCharCode(65+col%26)+letters;
    col=Math.floor(col/26);
  }
  return letters+(rowIndex+1);
}

/** Only addresses within the selected source table qualify; never coerce. */
export function parsePdfTableCellAddress(address:string,totalRows:number,totalColumns:number)
  :{rowIndex:number;columnIndex:number}|null{
  if(typeof address!=="string"||address.length>12)return null;
  const match=/^([A-Za-z]{1,3})([1-9]\d{0,3})$/.exec(address.trim());
  if(!match)return null;
  const columnIndex=[...match[1].toUpperCase()].reduce((n,ch)=>
    n*26+ch.charCodeAt(0)-64,0)-1;
  const rowIndex=Number(match[2])-1;
  if(!Number.isSafeInteger(totalRows)||totalRows<1||totalRows>2000||
    !Number.isSafeInteger(totalColumns)||totalColumns<1||totalColumns>128||
    rowIndex<0||rowIndex>=totalRows||
    columnIndex<0||columnIndex>=totalColumns)return null;
  return {rowIndex,columnIndex};
}

/** Exact value view for any validated source cell, including the hidden tail. */
export function inspectPdfTableCell(
  source:PdfV4XlsxExportSource,index:number,rowIndex:number,columnIndex:number,
):{address:string;value:string;sourcePage:number}{
  // Same quality gate and export plan as the XLSX/CSV download.
  const plan=prepareSelectedPdfV4XlsxExport(source,index);
  const table=source.tables[index];
  const sheet=plan.tables[0];
  const totalColumns=Math.max(table.columnCount,...sheet.rows.map(row=>row.length));
  const address=pdfTableCellAddress(rowIndex,columnIndex);
  if(rowIndex>=sheet.rows.length||columnIndex>=totalColumns)
    throw new Error("The requested cell is outside this source table.");
  const sourcePage=table.rows[rowIndex]?.provenance?.pageNumber??table.pageNumber;
  return {address,value:String(sheet.rows[rowIndex][columnIndex]??""),sourcePage};
}
