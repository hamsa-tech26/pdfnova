import {expect,test} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

async function originalReport(){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let n=1;n<=38;n++){
    const page=pdf.addPage([420,600]);
    page.drawText(`Independent original page ${n}`,{x:40,y:520,font,size:15});
  }
  return Buffer.from(await pdf.save());
}

test("38-page original uses explicit browser-local page 9–10 selection",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"long-report.pdf",mimeType:"application/pdf",buffer:await originalReport(),
  });
  await page.getByLabel("First original page").fill("9");
  await page.getByLabel("Last original page").fill("10");
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByRole("status").filter({
    hasText:"Only original PDF pages 9–10 of 38 were processed",
  })).toBeVisible({timeout:60000});
  await expect(page.getByText("All other original pages were omitted",{
    exact:false,
  })).toBeVisible();
  await expect(page.getByRole("button",{name:"Inspect & choose a table"}))
    .toHaveCount(0);
});

test("refuses an oversized original-page selection",async({page})=>{
  test.setTimeout(60000);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"long-report.pdf",mimeType:"application/pdf",buffer:await originalReport(),
  });
  await page.getByLabel("First original page").fill("9");
  await page.getByLabel("Last original page").fill("35");
  await page.getByRole("button",{name:"Inspect & choose a table"}).click();
  await expect(page.getByText("Select a valid consecutive range of 1–25 PDF pages.",{
    exact:false,
  })).toBeVisible();
  await expect(page.getByRole("status").filter({
    hasText:"SOURCE PAGE SELECTION",
  })).toHaveCount(0);
});
