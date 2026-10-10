import {test, expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

async function pdfFixture() {
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([600,700]).drawText("PRESERVE ORIGINAL FILE",{x:30,y:620,font,size:14});
  return Buffer.from(await pdf.save());
}

test("at 320px, advanced PDF tool upload controls and responsive navigation remain reachable", async ({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:320,height:680});
  for(const route of ["/organize-pdf","/flatten-pdf","/add-image-stamp-pdf","/workspace-health"]){
    const r=await page.goto(route);
    expect(r?.status(),route).toBe(200);
    await expect(page.locator("main h1").first()).toBeVisible();
    const widths=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      scroll:document.documentElement.scrollWidth
    }));
    expect(widths.scroll,route+" must not require horizontal page scrolling").toBeLessThanOrEqual(widths.viewport+2);
    await page.getByRole("button",{name:"Open workspace menu"}).click();
    const menu=page.getByRole("dialog",{name:"Workspace navigation"});
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Open workspace menu"})).toBeFocused();
  }
});
test("invalid PDF input produces visible recovery and no accidental download", async ({page})=>{
  test.setTimeout(120000);
  const wrong=Buffer.from("not really a PDF document");
  for(const [route,label] of [
    ["/organize-pdf","Unable to load PDF"],
    ["/flatten-pdf","Unable to open PDF form"],
    ["/add-image-stamp-pdf","Unable to open PDF for stamping"],
  ]){
    await page.goto(route);
    const downloads=[];
    page.on("download",d=>downloads.push(d.suggestedFilename()));
    await page.locator('input[type="file"]').first().setInputFiles({
      name:"invalid.pdf",mimeType:"application/pdf",buffer:wrong
    });
    await expect(page.getByText(label,{exact:true})).toBeVisible({timeout:30000});
    await page.getByRole("button",{name:"Choose Another PDF"}).click();
    await expect(page.getByText(label,{exact:true})).toHaveCount(0);
    expect(downloads).toHaveLength(0);
  }
});
test("local output keeps original bytes unchanged after repeated transformation", async ({page})=>{
  const original=await pdfFixture();
  const hash=createHash("sha256").update(original).digest("hex");
  await page.goto("/reverse-pdf");
  for(let i=0;i<2;i++){
    await page.locator('input[type="file"]').first().setInputFiles({
      name:"immutable.pdf",mimeType:"application/pdf",buffer:original
    });
    const event=page.waitForEvent("download");
    await page.getByRole("button",{name:"Reverse and Download PDF"}).click();
    const file=await event;
    const result=await PDFDocument.load(await readFile(await file.path()));
    expect(result.getPageCount()).toBe(1);
    await page.getByRole("button",{name:/Start Again|Another PDF|Process Another|Reverse Another/i}).click();
  }
  expect(createHash("sha256").update(original).digest("hex")).toBe(hash);
});
