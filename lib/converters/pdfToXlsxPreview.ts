import type {PdfV4XlsxExportSource} from "./pdfToXlsxQuality";
import {prepareSelectedPdfV4XlsxExport} from "./pdfToXlsxSelection";

export const PREVIEW_MAX_ROWS=12;
export const PREVIEW_MAX_COLUMNS=8;
export const PREVIEW_MAX_CHARACTERS=140;

/**
 * Preview from the exact selected-table XLSX plan, not an independent
 * approximation of the PDF geometry. Never alters or approves the source,
 * never marks cell values certified, and never exposes raw PDF text to a server.
 */
export type PdfTablePreview={
  sourcePages:number[];
  totalRows:number;
  totalColumns:number;
  visibleRows:number;
  visibleColumns:number;
  trimmedCells:number;
  rows:string[][];
};
function printable(value:unknown):{text:string;trimmed:boolean}{
  const text=String(value??"");
  // Avoid multiline UI distortion while retaining exact original values
  // in the exported spreadsheet; the displayed preview may be abbreviated.
  return text.length>PREVIEW_MAX_CHARACTERS
    ?{text:text.slice(0,PREVIEW_MAX_CHARACTERS)+"…",trimmed:true}
    :{text,trimmed:false};
}
export function buildPdfTablePreview(source:PdfV4XlsxExportSource,index:number):PdfTablePreview{
  // Throws on unsafe candidates exactly as selective conversion does.
  const plan=prepareSelectedPdfV4XlsxExport(source,index);
  const t=source.tables[index];
  const sheet=plan.tables[0];
  const totalRows=sheet.rows.length;
  const totalColumns=Math.max(t.columnCount,...sheet.rows.map(row=>row.length));
  const visibleRows=Math.min(totalRows,PREVIEW_MAX_ROWS);
  const visibleColumns=Math.min(totalColumns,PREVIEW_MAX_COLUMNS);
  let trimmedCells=0;
  const rows=sheet.rows.slice(0,visibleRows).map(row=>
    Array.from({length:visibleColumns},(_,column)=>{
      const v=printable(row[column]);
      if(v.trimmed)trimmedCells++;
      return v.text;
    }));
  const sourcePages=[...new Set(t.rows.map(row=>row.provenance?.pageNumber??t.pageNumber))]
    .sort((a,b)=>a-b);
  return {sourcePages,totalRows,totalColumns,visibleRows,visibleColumns,trimmedCells,rows};
}
