import {describe,it,expect} from "vitest";
import {validateLocalPdfInput} from "../localPdfInputGate";

const pdf=(body:string)=>new Blob([body],{type:"application/pdf"});
describe("R153 browser-local PDF input signature preflight",()=>{
  it("accepts a native PDF 1.x or 2.0 header, including a bounded preamble",async()=>{
    await expect(validateLocalPdfInput(pdf("%PDF-1.7\ntext"))).resolves.toBeUndefined();
    await expect(validateLocalPdfInput(pdf("prefix\n%PDF-2.0\ntext"))).resolves.toBeUndefined();
  });
  it("refuses renamed HTML, fake MIME types and truncated PDF signatures",async()=>{
    for(const body of ["<!doctype html><script>bad</script>","not a PDF","%PDF-\n",
      "%PDF-ABC","PNG000000000000"]){
      await expect(validateLocalPdfInput(pdf(body))).rejects.toThrow(/PDF/);
    }
  });
  it("rejects late signatures and byte limits without allocating whole file",async()=>{
    await expect(validateLocalPdfInput(pdf("x".repeat(1020)+"%PDF-1.7")))
      .rejects.toThrow(/valid PDF header/);
    await expect(validateLocalPdfInput(new Blob([]))).rejects.toThrow(/between 8 bytes/);
    const oversized=new Blob([new Uint8Array(25*1024*1024+1)]);
    await expect(validateLocalPdfInput(oversized)).rejects.toThrow(/25 MB/);
  });
});
