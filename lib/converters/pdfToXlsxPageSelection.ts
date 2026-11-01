import {validateLocalPdfInput} from "./localPdfInputGate";

export type PdfXlsxPageRange={startPage:number;endPage:number};

export type PdfXlsxPageSelection={
  file:File;
  sourcePageCount:number;
  originalStartPage:number;
  originalEndPage:number;
  reviewNote:string;
};

const MAX_SELECTED_PAGES=25;
const MAX_SOURCE_BYTES=25*1024*1024;

/**
 * Browser-local, explicitly scoped diagnostic extraction. The full source is
 * neither modified nor uploaded; all other pages are deliberately excluded.
 * The existing 25-page converter limit remains unchanged.
 */
export async function selectPdfXlsxSourcePages(
  source:File,range:PdfXlsxPageRange,
):Promise<PdfXlsxPageSelection>{
  await validateLocalPdfInput(source);
  const {startPage,endPage}=range;
  if(!Number.isSafeInteger(startPage)||!Number.isSafeInteger(endPage)||
      startPage<1||endPage<startPage||endPage-startPage+1>MAX_SELECTED_PAGES)
    throw Error("Select a valid consecutive range of 1–25 PDF pages.");

  const {PDFDocument}=await import("pdf-lib");
  const original=await PDFDocument.load(await source.arrayBuffer(),{
    updateMetadata:false,
  });
  const sourcePageCount=original.getPageCount();
  if(endPage>sourcePageCount)
    throw Error(`This PDF has ${sourcePageCount} pages; the selected range is outside it.`);

  const selected=await PDFDocument.create();
  const indices=Array.from({length:endPage-startPage+1},(_,i)=>startPage-1+i);
  const copied=await selected.copyPages(original,indices);
  copied.forEach(page=>selected.addPage(page));
  const bytes=await selected.save();
  if(!bytes.length||bytes.length>MAX_SOURCE_BYTES)
    throw Error("The selected pages exceed the 25 MB local processing limit.");

  const stem=source.name.replace(/\.pdf$/i,"")||"document";
  const file=new File([Uint8Array.from(bytes)],
    `${stem}-pages-${startPage}-${endPage}.pdf`,{type:"application/pdf"});
  await validateLocalPdfInput(file);
  return {
    file,sourcePageCount,originalStartPage:startPage,originalEndPage:endPage,
    reviewNote:`SOURCE PAGE SELECTION: Only original PDF pages ${startPage}–${endPage} `+
      `of ${sourcePageCount} were processed. All other original pages were omitted. `+
      `Page numbers in this extracted workbook refer to the selected subset, `+
      `not the full PDF. Verify every source cell before use.`,
  };
}
