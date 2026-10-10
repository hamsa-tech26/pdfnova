import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const directory=path.resolve("test-fixtures/golden");
const manifest=JSON.parse(await readFile("benchmarks/golden/manifest.json","utf8"));
const caseById=new Map(manifest.cases.map(f=>[f.id,f]));
async function choose(page,id){
  const spec=caseById.get(id);
  if(!spec)throw new Error("Unknown fixture");
  const bytes=await readFile(path.join(directory,spec.file));
  await page.locator('input[type="file"]').first().setInputFiles({
    name:spec.file,mimeType:"application/pdf",buffer:bytes
  });
  await expect(page.getByText(spec.file).first()).toBeVisible({timeout:45000});
  return bytes;
}
async function download(page,label,timeout=90000){
  const promise=page.waitForEvent("download",{timeout});
  await page.getByRole("button",{name:label}).click();
  const result=await promise;
  return {name:result.suggestedFilename(),bytes:await readFile(await result.path())};
}
test("Golden layout text extraction matches every page's exact expected phrases",async({page})=>{
  const expected=caseById.get("layout").expected;
  await page.goto("/pdf-to-text");const source=await choose(page,"layout");
  const before=createHash("sha256").update(source).digest("hex");
  const output=await download(page,"Convert and Download TXT");
  expect(output.name).toMatch(/\.txt$/);
  const text=output.bytes.toString("utf8");
  for(const row of expected.textPerPage)for(const phrase of row)expect(text).toContain(phrase);
  expect(createHash("sha256").update(source).digest("hex")).toBe(before);
});
test("Golden standard AcroForm flattens known fields without losing visible answer",async({page})=>{
  await page.goto("/flatten-pdf");await choose(page,"form");
  const result=await download(page,"Flatten and Download PDF");
  const pdf=await PDFDocument.load(result.bytes,{updateMetadata:false});
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getForm().getFields()).toHaveLength(0);
  // Read the actual downloadable output, not just the original input or status UI.
  const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task=getDocument({
    data:new Uint8Array(result.bytes),disableFontFace:true,useSystemFonts:true,isEvalSupported:false
  });
  const inspected=await task.promise;
  try {
    const pageOne=await inspected.getPage(1);
    const content=await pageOne.getTextContent();
    const visibleText=content.items.map(item=>String(item.str??"")).join(" ");
    expect(visibleText).toContain("EXAMPLE ALPHA");
    pageOne.cleanup();
  } finally {
    await task.destroy();
  }
  // The original form remains in its source; the exported flattened copy is noneditable.
  const original=await PDFDocument.load(await readFile(path.join(directory,"golden-form.pdf")));
  expect(original.getForm().getTextField("qa.full_name").getText()).toBe("EXAMPLE ALPHA");
  expect(original.getForm().getCheckBox("qa.accepted").isChecked()).toBe(true);
});
test("Golden rotated CropBox survives actual reverse-page download",async({page})=>{
  await page.goto("/reverse-pdf");await choose(page,"layout");
  const result=await download(page,"Reverse and Download PDF");
  const pdf=await PDFDocument.load(result.bytes,{updateMetadata:false});
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages().map(p=>Math.round(p.getWidth()))).toEqual([640,600]);
  expect(pdf.getPages().map(p=>p.getRotation().angle)).toEqual([90,0]);
  expect(pdf.getPage(0).getCropBox()).toMatchObject({x:24,y:30,width:580,height:740});
});
test("Image-only golden scan records real OCR output separately from accuracy qualification",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/ocr-pdf");await choose(page,"scan");
  const output=await download(page,"Run OCR and Download TXT",150000);
  expect(output.name).toMatch(/\.txt$/);
  const actual=output.bytes.toString("utf8");
  const expected=caseById.get("scan").expected.ocrExpectedText;
  // This is a diagnostic measurement, NOT an accuracy acceptance pass.
  const normalize=s=>s.normalize("NFKC").replace(/\s+/g," ").trim().toUpperCase();
  const result={schema:"kukureku-golden-ocr-diagnostic-v1",fixture:"scan",provenance:"synthetic",
    status:"MEASURED_DIAGNOSTIC_ONLY",expectedCharacters:expected.length,
    extractedCharacters:actual.length,fullPhrasePresent:normalize(actual).includes(normalize(expected)),
    gate:"NOT_CERTIFIED",notes:"One synthetic bitmap scan. No OCR accuracy threshold or real-world claim."};
  await mkdir("benchmarks/golden/reports",{recursive:true});
  await writeFile("benchmarks/golden/reports/scan-ocr-diagnostic.json",JSON.stringify(result,null,2)+"\n");
  expect(typeof result.fullPhrasePresent).toBe("boolean");
});
