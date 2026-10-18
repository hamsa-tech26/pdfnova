import type {PdfXlsxInput} from "./pdfToXlsx";
import {preparePdfV4XlsxExport,type PdfV4XlsxExportSource} from "./pdfToXlsxQuality";

/** A candidate passes unchanged V4 export checks, not an independent content review. */
export type PdfXlsxTableChoice={
  index:number;pageLabel:string;rows:number;columns:number;
  eligible:boolean;reason:string;
};
const MAX_CANDIDATES=100;
function checkCandidateLimit(source:PdfV4XlsxExportSource){
  if(!source||!Array.isArray(source.tables)||source.tables.length<1||
    source.tables.length>MAX_CANDIDATES)
    throw new Error("No supported table candidates available for individual selection (limit: 100).");
}
/**
 * Export exactly the explicitly selected candidate, with all existing
 * fail-closed page/provenance/native-content/cell overlap checks unchanged.
 * Do not run the all-document eight-column special recovery for a single table.
 */
export function prepareSelectedPdfV4XlsxExport(
  source:PdfV4XlsxExportSource,index:number,
):PdfXlsxInput{
  checkCandidateLimit(source);
  if(!Number.isInteger(index)||index<0||index>=source.tables.length)
    throw new Error("Select a detected table from this PDF before exporting.");
  const plan=preparePdfV4XlsxExport({
    document:source.document,
    nativePageTextExtraction:source.nativePageTextExtraction,
    tables:[source.tables[index]],
  });
  return {
    ...plan,
    tables:plan.tables.map(t=>({...t,name:"Selected Table "+(index+1)})),
    reviewNotes:[
      "SELECTIVE EXPORT: The user chose detected table "+(index+1)+" of "+
        source.tables.length+". "+(source.tables.length-1)+
        " other candidate(s) were deliberately not exported.",
      "Other source tables and pages may contain omitted data. "+
        "Neither this table nor its contents are independently verified.",
      ...(plan.reviewNotes??[]),
    ],
  };
}
export function inspectPdfV4XlsxChoices(
  source:PdfV4XlsxExportSource,
):PdfXlsxTableChoice[]{
  checkCandidateLimit(source);
  return source.tables.map((table,index)=>{
    const pages=[...new Set(table.rows.map(row=>row.provenance?.pageNumber??table.pageNumber))]
      .filter(p=>Number.isInteger(p)&&p>=1&&p<=source.document.pages.length)
      .sort((a,b)=>a-b);
    const pageLabel=pages.length>1?
      "Pages "+pages[0]+"–"+pages[pages.length-1]:
      "Page "+(pages[0]??table.pageNumber);
    try{
      prepareSelectedPdfV4XlsxExport(source,index);
      return {index,pageLabel,rows:table.rows.length,columns:table.columnCount,
        eligible:true,reason:"Passes automatic export checks. Review all cell values against the PDF."};
    }catch(cause){
      return {index,pageLabel,rows:table.rows.length,columns:table.columnCount,
        eligible:false,reason:cause instanceof Error?cause.message:"Export safety check failed."};
    }
  });
}
