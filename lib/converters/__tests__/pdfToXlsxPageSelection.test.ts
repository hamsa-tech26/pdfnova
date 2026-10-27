import {describe,expect,it} from "vitest";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {selectPdfXlsxSourcePages} from "../pdfToXlsxPageSelection";

async function sourcePdf(pages=38){
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  for(let n=1;n<=pages;n++){
    const page=document.addPage([360,460]);
    page.drawText(`SOURCE-PAGE-${n}`,{x:25,y:400,size:14,font});
  }
  const bytes=await document.save();
  return new File([Uint8Array.from(bytes)],"published-report.pdf",{
    type:"application/pdf",
  });
}

describe("browser-local PDF-to-XLSX source-page selection",()=>{
  it("preserves the full original and copies only the explicitly chosen pages",async()=>{
    const original=await sourcePdf();
    const before=new Uint8Array(await original.arrayBuffer());
    const selected=await selectPdfXlsxSourcePages(original,{startPage:9,endPage:10});
    expect(selected.sourcePageCount).toBe(38);
    expect(selected.file.name).toBe("published-report-pages-9-10.pdf");
    expect(selected.reviewNote).toContain("original PDF pages 9–10 of 38");
    expect(selected.reviewNote).toContain("All other original pages were omitted");
    const excerpt=await PDFDocument.load(await selected.file.arrayBuffer());
    expect(excerpt.getPageCount()).toBe(2);
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading=pdfjs.getDocument({
      data:new Uint8Array(await selected.file.arrayBuffer()),
    });
    const text=await loading.promise;
    try{
      for(const [i,number] of [9,10].entries()){
        const content=await (await text.getPage(i+1)).getTextContent();
        expect(content.items.map(item=>"str" in item?item.str:"").join(" "))
          .toContain(`SOURCE-PAGE-${number}`);
      }
    }finally{await loading.destroy();}
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(before);
    expect((await PDFDocument.load(await original.arrayBuffer())).getPageCount()).toBe(38);
  });

  it("fails closed for malformed, excessive or out-of-range selections",async()=>{
    const original=await sourcePdf();
    for(const range of [
      {startPage:0,endPage:1},
      {startPage:12,endPage:11},
      {startPage:1,endPage:26},
      {startPage:38,endPage:39},
      {startPage:1.5,endPage:2},
      {startPage:2,endPage:Number.NaN},
    ])await expect(selectPdfXlsxSourcePages(original,range)).rejects.toThrow();
  });

  it("rejects an invalid input document before copying",async()=>{
    await expect(selectPdfXlsxSourcePages(
      new File(["not a pdf"],"fake.pdf",{type:"application/pdf"}),
      {startPage:1,endPage:1},
    )).rejects.toThrow(/valid PDF header/);
  });
});
