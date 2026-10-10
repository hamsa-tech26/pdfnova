import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";

async function pdfFixture(message) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595,842]).drawText(message,{x:24,y:720,font,size:14});
  return Buffer.from(await pdf.save());
}

async function slowFileReads(page) {
  await page.addInitScript(() => {
    const original=File.prototype.arrayBuffer;
    File.prototype.arrayBuffer=async function () {
      if (window.__kukurekuSlowRead) {
        await new Promise(resolve=>setTimeout(resolve,1250));
      }
      return original.call(this);
    };
  });
}

test("cancelled merge never downloads an unfinished PDF, sources can retry, and the copy can be released", async ({page}) => {
  test.setTimeout(180_000);
  await slowFileReads(page);
  const inputA=await pdfFixture("RETAIN SOURCE A");
  const inputB=await pdfFixture("RETAIN SOURCE B");
  await page.goto("/merge-pdf");
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"cancel-a.pdf",mimeType:"application/pdf",buffer:inputA},
    {name:"cancel-b.pdf",mimeType:"application/pdf",buffer:inputB}
  ]);
  await expect(page.getByRole("heading",{name:"Selected files (2)"})).toBeVisible();
  await page.evaluate(()=>{window.__kukurekuSlowRead=true});
  const received=[];
  page.on("download",d=>received.push(d.suggestedFilename()));
  await page.getByRole("button",{name:"Merge and Download PDF"}).click();
  await page.getByRole("button",{name:"Cancel merge"}).click();
  await expect(page.getByRole("status").filter({hasText:"Merge cancelled. No new PDF was downloaded"})).toBeVisible({timeout:15000});
  expect(received).toEqual([]);
  await expect(page.getByRole("heading",{name:"Selected files (2)"})).toBeVisible();
  await page.evaluate(()=>{window.__kukurekuSlowRead=false});
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Merge and Download PDF"}).click();
  const exported=await download;
  expect(exported.suggestedFilename()).toBe("kukureku-merged.pdf");
  const bytes=await readFile(await exported.path());
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  await expect(page.getByText("Saved as a new composed document in this browser workspace")).toBeVisible();
  await page.getByRole("button",{name:"Release downloaded copy from memory"}).click();
  await expect(page.getByRole("button",{name:"Merge and Download PDF"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Selected files (2)"})).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading",{name:"kukureku-merged.pdf"})).toBeVisible();
});

test("JPG to PDF locks image order during export and produces valid local output",async({page})=>{
  test.setTimeout(180_000);
  await slowFileReads(page);
  await page.setViewportSize({width:375,height:812});
  await page.goto("/jpg-to-pdf");
  const pngBase64=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=4;canvas.height=4;
    const context=canvas.getContext("2d");
    context.fillStyle="#1547aa";
    context.fillRect(0,0,4,4);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const png=Buffer.from(pngBase64,"base64");
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"one.png",mimeType:"image/png",buffer:png},
    {name:"two.png",mimeType:"image/png",buffer:png}
  ]);
  await expect(page.getByRole("heading",{name:"Selected images (2)"})).toBeVisible();
  await page.evaluate(()=>{window.__kukurekuSlowRead=true});
  const downloaded=page.waitForEvent("download");
  await page.getByRole("button",{name:"Create and Download PDF"}).click();
  await expect(page.getByRole("button",{name:"Delete"}).first()).toBeDisabled();
  await expect(page.getByRole("button",{name:"Move Up"}).last()).toBeDisabled();
  await expect(page.getByRole("button",{name:/A4 pages/})).toBeDisabled();
  const result=await downloaded;
  const output=await PDFDocument.load(await readFile(await result.path()));
  expect(output.getPageCount()).toBe(2);
  await expect(page.getByRole("button",{name:"Delete"}).first()).toBeEnabled();
});
