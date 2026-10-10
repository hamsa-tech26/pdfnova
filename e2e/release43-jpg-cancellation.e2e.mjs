import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

test("cancel multi-page JPG export without a partial download and retry a subset", async ({page}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({width: 375, height: 812});
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 28; i++) {
    pdf.addPage([800, 1100]).drawText("Cancel export page " + i, {x:40,y:950,font,size:22});
  }
  const bytes = Buffer.from(await pdf.save());
  await page.goto("/pdf-to-jpg");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"cancel-jpg-export.pdf", mimeType:"application/pdf", buffer:bytes,
  });
  await expect(page.getByRole("heading",{name:"PDF Pages (28)"})).toBeVisible({timeout:90000});
  await page.getByRole("button",{name:"Download All as ZIP"}).click();
  await expect(page.getByRole("button",{name:"Cancel ZIP export"})).toBeVisible({timeout:15000});
  await page.getByRole("button",{name:"Cancel ZIP export"}).click();
  await expect(page.getByRole("button",{name:"Cancel ZIP export"})).toHaveCount(0,{timeout:90000});
  await expect(page.getByRole("button",{name:"Download All as ZIP"})).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button",{name:"Next previews"}).click();
  await expect(page.getByRole("status").filter({hasText:"Previewing pages 9–16 of 28"})).toBeVisible();
  await page.getByRole("button",{name:"Clear Selection"}).click().catch(()=>{});
  // One visible page is enough to prove the same input remains retryable.
  await page.getByRole("checkbox",{name:/PDF page 9/i}).first().check();
  await page.getByRole("button",{name:"Download Selected as ZIP"}).click();
  const saved = await download;
  const zip = await JSZip.loadAsync(await readFile(await saved.path()));
  expect(Object.keys(zip.files).filter(name=>name.endsWith(".jpg"))).toEqual(["kukureku-page-9.jpg"]);
});
