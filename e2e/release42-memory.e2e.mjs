import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";

test("PDF to JPG previews at most eight pages at a time, keeps selected pages and exports all pages",async({page})=>{
  test.setTimeout(180_000);
  await page.setViewportSize({width:375,height:812});
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<12;i++)pdf.addPage([280,320]).drawText("Preview bounded page "+(i+1),{x:20,y:250,font,size:12});
  const fixture=Buffer.from(await pdf.save());
  await page.goto("/pdf-to-jpg");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"twelve-pages.pdf",mimeType:"application/pdf",buffer:fixture
  });
  await expect(page.getByRole("heading",{name:"PDF Pages (12)"})).toBeVisible({timeout:90000});
  await expect(page.getByRole("status").filter({hasText:"Previewing pages 1–8 of 12"})).toBeVisible();
  await expect(page.locator("img")).toHaveCount(8,{timeout:25000});
  await page.getByRole("button",{name:"Select All"}).click();
  await expect(page.getByText("Selected: 12")).toBeVisible();
  await page.getByRole("button",{name:"Next previews"}).click();
  await expect(page.getByRole("status").filter({hasText:"Previewing pages 9–12 of 12"})).toBeVisible();
  await expect(page.locator("img")).toHaveCount(4);
  await expect(page.getByText("Selected: 12")).toBeVisible();
  const dl=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download All as ZIP"}).click();
  const saved=await dl;
  expect(saved.suggestedFilename()).toBe("kukureku-all-jpg-pages.zip");
  const zip=await JSZip.loadAsync(await readFile(await saved.path()));
  const names=Object.keys(zip.files).filter(x=>x.endsWith(".jpg"));
  expect(names.length).toBe(12);
  expect(names).toContain("kukureku-page-1.jpg");
  expect(names).toContain("kukureku-page-12.jpg");
});
