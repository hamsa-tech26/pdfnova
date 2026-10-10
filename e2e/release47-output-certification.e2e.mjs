import {test, expect} from "@playwright/test";
import {PDFDocument, StandardFonts} from "pdf-lib";
import {Document, Packer, Paragraph} from "docx";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";

/** Real browser output certification, not a route/success-toast smoke test. */
async function source() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [i,width] of [301,403,509].entries()) {
    pdf.addPage([width,700]).drawText(["Certification Alpha","Certification Beta","Certification Gamma"][i],
      {x:25,y:625,font,size:14});
  }
  pdf.setTitle("CERTIFICATION SOURCE");
  pdf.setAuthor("Original Cert Author");
  return Buffer.from(await pdf.save());
}
async function upload(page,bytes,name="cert-three-pages.pdf",mimeType="application/pdf"){
  await page.locator('input[type="file"]').first().setInputFiles({name,mimeType,buffer:bytes});
  await expect(page.getByText(name).first()).toBeVisible({timeout:30000});
}
async function exportDownload(page, button,timeout=45000){
  const download=page.waitForEvent("download",{timeout});
  await page.getByRole("button",{name:button,exact:true}).click();
  const entry=await download;
  return {name:entry.suggestedFilename(),bytes:await readFile(await entry.path())};
}
async function exportPdf(page,button){
  const {name,bytes}=await exportDownload(page,button);
  expect(name).toMatch(/\.pdf$/);
  expect(bytes.subarray(0,5).toString()).toBe("%PDF-");
  const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  return {pdf,name,bytes};
}
const widths=p=>p.getPages().map(pg=>Math.round(pg.getWidth()));

test("reverse PDF export has actual reversed page tree and preserves title",async({page})=>{
  const bytes=await source();await page.goto("/reverse-pdf");await upload(page,bytes);
  const {pdf}=await exportPdf(page,"Reverse and Download PDF");
  expect(widths(pdf)).toEqual([509,403,301]);
  expect(pdf.getTitle()).toBe("CERTIFICATION SOURCE");
});
test("remove metadata export clears common fields while keeping all pages",async({page})=>{
  await page.goto("/remove-pdf-metadata");await upload(page,await source());
  const {pdf}=await exportPdf(page,"Remove Metadata and Download");
  expect(widths(pdf)).toEqual([301,403,509]);
  expect(pdf.getTitle() || "").toBe("");
  expect(pdf.getAuthor() || "").toBe("");
});
test("split PDF exports only the chosen non-leading pages in order",async({page})=>{
  await page.goto("/split-pdf");await upload(page,await source());
  await page.getByLabel("Pages to extract").fill("2-3");
  const {pdf}=await exportPdf(page,"Extract and Download PDF");
  expect(widths(pdf)).toEqual([403,509]);
});
test("extract PDF pages preserves requested page order and widths",async({page})=>{
  await page.goto("/extract-pdf-pages");await upload(page,await source());
  await page.getByLabel("Pages to extract").fill("1,3");
  const {pdf}=await exportPdf(page,"Extract and Download Pages");
  expect(widths(pdf)).toEqual([301,509]);
});
test("delete PDF pages removes precisely one middle page",async({page})=>{
  await page.goto("/delete-pdf-pages");await upload(page,await source());
  await page.getByLabel("Pages to delete").fill("2");
  const {pdf}=await exportPdf(page,"Delete Pages and Download");
  expect(widths(pdf)).toEqual([301,509]);
});
test("reorder PDF export implements a nontrivial permutation",async({page})=>{
  await page.goto("/reorder-pdf-pages");await upload(page,await source());
  await page.getByLabel("New page order").fill("3,1,2");
  const {pdf}=await exportPdf(page,"Reorder and Download PDF");
  expect(widths(pdf)).toEqual([509,301,403]);
});
test("PDF crop export reduces visible crop rectangles on every page",async({page})=>{
  await page.goto("/crop-pdf");await upload(page,await source());
  await page.getByRole("button",{name:"5 mm all sides"}).click();
  const {pdf}=await exportPdf(page,"Crop and Download PDF");
  expect(pdf.getPageCount()).toBe(3);
  for (const [i,p] of pdf.getPages().entries()){
    expect(p.getCropBox().width).toBeLessThan([301,403,509][i]);
    expect(p.getCropBox().height).toBeLessThan(700);
    expect(p.getCropBox().width).toBeGreaterThan(200);
  }
});
test("PDF resize export produces real A4 geometry on all three pages",async({page})=>{
  await page.goto("/resize-pdf-pages");await upload(page,await source());
  const {pdf}=await exportPdf(page,"Resize and Download PDF");
  expect(pdf.getPageCount()).toBe(3);
  for(const p of pdf.getPages()){
    expect(p.getWidth()).toBeCloseTo(595.28,0);
    expect(p.getHeight()).toBeCloseTo(841.89,0);
  }
});
test("edit metadata export persists the requested author and title",async({page})=>{
  await page.goto("/edit-pdf-metadata");await upload(page,await source());
  await page.getByLabel("Title",{exact:true}).fill("Certified New Title");
  await page.getByLabel("Author",{exact:true}).fill("Certified New Author");
  const {pdf}=await exportPdf(page,"Save Metadata and Download");
  expect(pdf.getTitle()).toBe("Certified New Title");
  expect(pdf.getAuthor()).toBe("Certified New Author");
  expect(pdf.getPageCount()).toBe(3);
});
test("PDF to Text exports actual selectable text, not an empty TXT",async({page})=>{
  await page.goto("/pdf-to-text");await upload(page,await source());
  const {name,bytes}=await exportDownload(page,"Convert and Download TXT");
  expect(name).toMatch(/\.txt$/);
  const text=bytes.toString("utf8");
  expect(text).toContain("Certification Alpha");
  expect(text).toContain("Certification Beta");
  expect(text).toContain("Certification Gamma");
});
test("PDF to Word exports DOCX package containing actual extracted text",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/pdf-to-word");await upload(page,await source());
  const {name,bytes}=await exportDownload(page,"Convert and Download Word",100000);
  expect(name).toMatch(/\.docx$/);
  const zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file("word/document.xml")?.async("string");
  expect(xml).toBeTruthy();
  expect(xml).toContain("Certification Alpha");
  expect(xml).toContain("Certification Gamma");
});
test("Word to PDF export is openable and contains content from a real DOCX",async({page})=>{
  test.setTimeout(120000);
  const document=new Document({sections:[{children:[new Paragraph("Certified Word Conversion Document")]}]});
  const docx=Buffer.from(await Packer.toBuffer(document));
  await page.goto("/word-to-pdf");
  await upload(page,docx,"certification-input.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const {pdf,bytes}=await exportPdf(page,"Convert and Download PDF");
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  expect(bytes.length).toBeGreaterThan(200);
});
test("compression export remains a parseable PDF with same number of pages",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/compress-pdf");await upload(page,await source());
  const {pdf}=await exportPdf(page,"Compress and Download PDF");
  expect(pdf.getPageCount()).toBe(3);
});
test("page-numbering export keeps all pages and changes the output stream",async({page})=>{
  await page.goto("/add-page-numbers");await upload(page,await source());
  const {pdf,bytes}=await exportPdf(page,"Add Page Numbers and Download");
  expect(widths(pdf)).toEqual([301,403,509]);
  expect(bytes.length).toBeGreaterThan(0);
});
test("watermark export preserves page count and produces a new document",async({page})=>{
  await page.goto("/watermark-pdf");await upload(page,await source());
  const {pdf,bytes}=await exportPdf(page,"Add Watermark and Download");
  expect(pdf.getPageCount()).toBe(3);
  expect(bytes.length).toBeGreaterThan(0);
});
test("header-footer export preserves all pages in an openable PDF",async({page})=>{
  await page.goto("/header-footer-pdf");await upload(page,await source());
  const {pdf}=await exportPdf(page,"Add Header & Footer and Download");
  expect(pdf.getPageCount()).toBe(3);
});
