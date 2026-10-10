import {describe,it,expect} from "vitest";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {inspectPrivatePdfStructure} from "../privateGoldenPreflight.mjs";

async function fixture({form=false,text=false,images=false,pages=1}={}){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<pages;i++){
    const page=pdf.addPage([612,792]);
    if(text)page.drawText("TEXT LAYER EXISTS",{x:25,y:700,font,size:14});
  }
  if(form){
    const field=pdf.getForm().createTextField("qa.approved");
    field.addToPage(pdf.getPage(0),{x:25,y:250,width:200,height:30});
    field.setText("VALID");
  }
  if(images){
    const png=await pdf.embedPng(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4GQAAAAASUVORK5CYII=",
      "base64"
    ));
    pdf.getPage(0).drawImage(png,{x:40,y:400,width:140,height:140});
  }
  return Buffer.from(await pdf.save());
}
const specimen=(category,expected={})=>({category,expected});
describe("Release 53 local real-world intake preflight",()=>{
 it("refuses corrupt or empty PDF input without exposing its text",async()=>{
  const res=await inspectPrivatePdfStructure(specimen("layout",{pageCount:1}),Buffer.from("not pdf"));
  expect(res.status).toBe("BLOCKED");
  expect(res.reasonCode).toBe("UNSUPPORTED_OR_UNREADABLE_PDF");
 });
 it("requires real AcroForm fields in form qualification",async()=>{
  expect((await inspectPrivatePdfStructure(specimen("form"),await fixture())).reasonCode)
    .toBe("NO_INTERACTIVE_ACROFORM_FIELDS");
  expect((await inspectPrivatePdfStructure(specimen("form"),await fixture({form:true}))).status)
    .toBe("READY");
 });
 it("requires source page count to match independently annotated layout",async()=>{
  const original=await fixture({pages:2,text:true});
  expect((await inspectPrivatePdfStructure(specimen("layout",{pageCount:2}),original)).status)
    .toBe("READY");
  expect((await inspectPrivatePdfStructure(specimen("layout",{pageCount:3}),original)).reasonCode)
    .toBe("SOURCE_PAGE_COUNT_MISMATCH");
 });
 it("rejects selectable-text PDFs from raster-only OCR benchmark",async()=>{
  const original=await fixture({text:true});
  expect((await inspectPrivatePdfStructure(specimen("ocr-text"),original)).reasonCode)
    .toBe("SOURCE_ALREADY_HAS_SELECTABLE_TEXT");
 });
 it("rejects blank vector pages from raster-only OCR benchmark",async()=>{
  const original=await fixture();
  expect((await inspectPrivatePdfStructure(specimen("ocr-text"),original)).reasonCode)
    .toBe("NO_IMAGE_CONTENT_FOUND");
 });
 it("allows parseable supported table PDFs for downstream actual browser measurement",async()=>{
  const original=await fixture({text:true});
  expect((await inspectPrivatePdfStructure(specimen("table"),original)).status)
    .toBe("READY");
 });
});
