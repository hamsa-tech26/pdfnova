import { test, expect } from "@playwright/test";
import { PDFDocument, PDFDict, PDFName, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

// Release 48: exercise browser UI, inspect the actual downloaded output.
// Never grade a success toast, extension, or page count as content fidelity.
async function fixture() {
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(const [index,width] of [301,403,509].entries()){
    pdf.addPage([width,700]).drawText(["Certification Alpha","Certification Beta","Certification Gamma"][index],
      {x:25,y:625,font,size:14});
  }
  return Buffer.from(await pdf.save());
}
async function choose(page,bytes,name="qualify.pdf",type="application/pdf"){
  await page.locator('input[type="file"]').first().setInputFiles({name,mimeType:type,buffer:bytes});
  await expect(page.getByText(name).first()).toBeVisible({timeout:45000});
}
async function downloaded(page,label,timeout=90000){
  const capture=page.waitForEvent("download",{timeout});
  await page.getByRole("button",{name:label}).click();
  const entry=await capture;
  const bytes=await readFile(await entry.path());
  expect(bytes.byteLength).toBeGreaterThan(100);
  return {bytes,name:entry.suggestedFilename()};
}
async function pdfOutput(page,label){
  const result=await downloaded(page,label);
  expect(result.name).toMatch(/\.pdf$/i);
  expect(result.bytes.subarray(0,5).toString()).toBe("%PDF-");
  return {...result,pdf:await PDFDocument.load(result.bytes,{updateMetadata:false})};
}
async function extractedText(bytes) {
  const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:true,isEvalSupported:false});
  const doc=await task.promise;
  try {
    const texts=[];
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i);
      const content=await page.getTextContent();
      texts.push(content.items.map(x=>x.str??"").join(" "));
      page.cleanup();
    }
    return texts;
  } finally {await doc.destroy();}
}
function imageCount(pdf,pageNumber){
  const page=pdf.getPage(pageNumber);
  const resource=page.node.Resources();
  const objects=resource?.get(PDFName.of("XObject"));
  return objects?pdf.context.lookup(objects,PDFDict)?.keys().length??0:0;
}
function jpegDimensions(bytes){
  expect(bytes[0]).toBe(0xff);expect(bytes[1]).toBe(0xd8);
  let i=2;
  while(i<bytes.length){
    if(bytes[i++]!==0xff)continue;
    let marker=bytes[i++];
    while(marker===0xff)marker=bytes[i++];
    if(marker===0xd9||marker===0xda)break;
    const length=(bytes[i]<<8)|bytes[i+1];
    if(length<2)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {height:(bytes[i+3]<<8)|bytes[i+4],width:(bytes[i+5]<<8)|bytes[i+6]};
    }
    i+=length;
  }
  throw new Error("No JPEG frame dimensions found");
}

test("Organize PDF exports actual moved, rotated and deleted page tree",async({page})=>{
  test.setTimeout(150000);
  await page.goto("/organize-pdf");
  await choose(page,await fixture());
  await expect(page.getByRole("heading",{name:"PDF Pages (3)"})).toBeVisible({timeout:60000});
  const cards=page.locator("article").filter({has:page.locator('img[alt^="PDF page "]')});
  await expect(cards).toHaveCount(3);
  await cards.first().getByRole("button",{name:"Move Down"}).click();
  await cards.nth(1).getByRole("button",{name:"Rotate"}).click();
  await cards.nth(2).getByRole("button",{name:"Delete"}).click();
  await expect(page.getByRole("heading",{name:"PDF Pages (2)"})).toBeVisible();
  const {pdf}=await pdfOutput(page,"Save PDF");
  expect(pdf.getPages().map(p=>Math.round(p.getWidth()))).toEqual([403,301]);
  expect(pdf.getPage(1).getRotation().angle).toBe(90);
});

test("Flatten PDF removes editing fields while retaining filled visible text",async({page})=>{
  const form=await PDFDocument.create();
  const sheet=form.addPage([600,700]);
  const field=form.getForm().createTextField("qualification.answer");
  field.addToPage(sheet,{x:80,y:450,width:260,height:40});
  field.setText("CERTIFIED RESPONSE");
  const source=Buffer.from(await form.save());
  await page.goto("/flatten-pdf");
  await choose(page,source,"filled-form.pdf");
  const {pdf,bytes}=await pdfOutput(page,"Flatten and Download PDF");
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getForm().getFields()).toHaveLength(0);
  expect((await extractedText(bytes)).join(" ")).toContain("CERTIFIED RESPONSE");
});

test("Add Image Stamp writes image XObjects only to the chosen page",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/add-image-stamp-pdf");
  await choose(page,await fixture());
  await page.getByRole("combobox",{name:"PDF page"}).selectOption("2");
  await expect(page.getByRole("button",{name:"Add and Download PDF"})).toBeEnabled({timeout:45000});
  const {pdf}=await pdfOutput(page,"Add and Download PDF");
  expect(pdf.getPageCount()).toBe(3);
  expect([0,1,2].map(i=>imageCount(pdf,i))).toEqual([0,1,0]);
});

test("Compression low output keeps selectable source text, dimensions and pages",async({page})=>{
  test.setTimeout(150000);
  await page.goto("/compress-pdf");
  await choose(page,await fixture());
  await page.getByRole("button",{name:/Low/}).click();
  const {pdf,bytes}=await pdfOutput(page,"Compress and Download PDF");
  expect(pdf.getPages().map(p=>Math.round(p.getWidth()))).toEqual([301,403,509]);
  expect((await extractedText(bytes)).join(" ")).toContain("Certification Gamma");
});

test("Word to PDF output has actual selectable DOCX text",async({page})=>{
  test.setTimeout(120000);
  const word=new Document({sections:[{children:[new Paragraph("CERTIFIED DOCX TEXT 4820")]}]});
  await page.goto("/word-to-pdf");
  await choose(page,Buffer.from(await Packer.toBuffer(word)),"qualify.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const {bytes}=await pdfOutput(page,"Convert and Download PDF");
  expect((await extractedText(bytes)).join(" ")).toContain("CERTIFIED DOCX TEXT 4820");
});

test("JPG to PDF creates distinct image resources in correct page order",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/jpg-to-pdf");
  const pngs=await page.evaluate(()=>{
    const canvas=document.createElement("canvas"),context=canvas.getContext("2d");
    canvas.width=8;canvas.height=6;
    return ["#ff0000","#0000ff"].map(color=>{
      context.fillStyle=color;context.fillRect(0,0,8,6);
      return canvas.toDataURL("image/png").split(",")[1];
    });
  });
  await page.locator('input[type="file"]').first().setInputFiles(pngs.map((b,i)=>({
    name:"input-"+i+".png",mimeType:"image/png",buffer:Buffer.from(b,"base64")
  })));
  await expect(page.getByRole("heading",{name:"Selected images (2)"})).toBeVisible();
  const {pdf}=await pdfOutput(page,"Create and Download PDF");
  expect(pdf.getPageCount()).toBe(2);
  expect([0,1].map(i=>imageCount(pdf,i))).toEqual([1,1]);
});

test("PDF to JPG ZIP contains decodable JPEG markers and nonzero dimensions",async({page})=>{
  test.setTimeout(150000);
  await page.goto("/pdf-to-jpg");
  await choose(page,await fixture());
  await expect(page.getByRole("heading",{name:"PDF Pages (3)"})).toBeVisible({timeout:60000});
  await page.getByRole("button",{name:"Select All"}).click();
  const {name,bytes}=await downloaded(page,"Download All as ZIP");
  expect(name).toMatch(/\.zip$/);
  const zip=await JSZip.loadAsync(bytes);
  const files=Object.keys(zip.files).filter(name=>name.endsWith(".jpg")).sort();
  expect(files).toHaveLength(3);
  for(const f of files){
    const image=await zip.file(f).async("uint8array");
    const size=jpegDimensions(image);
    expect(size.width).toBeGreaterThan(100);
    expect(size.height).toBeGreaterThan(100);
  }
});

test("Page numbering actually appends readable page numbers on each page",async({page})=>{
  await page.goto("/add-page-numbers");await choose(page,await fixture());
  const {bytes}=await pdfOutput(page,"Add Page Numbers and Download");
  const text=await extractedText(bytes);
  expect(text).toHaveLength(3);
  for(let i=0;i<3;i++){
    expect(text[i]).toContain("Certification");
    expect(text[i]).toMatch(new RegExp("\\b"+(i+1)+"\\b"));
  }
});

test("Header and footer export contains expanded page count tokens on every page",async({page})=>{
  await page.goto("/header-footer-pdf");await choose(page,await fixture());
  const {bytes}=await pdfOutput(page,"Add Header & Footer and Download");
  const pages=await extractedText(bytes);
  expect(pages).toHaveLength(3);
  for(let i=0;i<3;i++){
    expect(pages[i]).toContain("Certification");
    expect(pages[i].replace(/\\s+/g," ")).toContain("Page "+(i+1)+" of 3");
  }
});

test("Watermark export embeds actual readable watermark on all pages",async({page})=>{
  await page.goto("/watermark-pdf");await choose(page,await fixture());
  const {bytes}=await pdfOutput(page,"Add Watermark and Download");
  const pages=await extractedText(bytes);
  expect(pages).toHaveLength(3);
  for(const text of pages){
    expect(text).toContain("Certification");
    expect(text.toLowerCase()).toContain("kukureku");
  }
});

test("Release privacy: real PDF edits send no source bytes to server",async({page})=>{
  const requests=[];
  page.on("request",request=>{
    if(!["GET","HEAD","OPTIONS"].includes(request.method())){
      requests.push({method:request.method(),url:request.url()});
    }
  });
  await page.goto("/reverse-pdf");
  await choose(page,await fixture(),"private-certification.pdf");
  const {pdf}=await pdfOutput(page,"Reverse and Download PDF");
  expect(pdf.getPageCount()).toBe(3);
  expect(requests.filter(r=>r.url.includes("/api/")||/upload|convert/i.test(r.url))).toEqual([]);
});
