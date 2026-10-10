import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";

async function fixture(message) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595,842]).drawText(message,{x:32,y:700,font,size:14});
  return Buffer.from(await pdf.save());
}
async function downloadedPageCount(page, buttonLabel = "Merge and Download PDF") {
  const filePromise = page.waitForEvent("download");
  await page.getByRole("button",{name:buttonLabel}).click();
  const result=await filePromise;
  const doc=await PDFDocument.load(await readFile(await result.path()));
  return doc.getPageCount();
}

test("review-first workflow planner orders linked steps and never executes uploads",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto("/workflow-planner");
  await expect(page.getByRole("heading",{name:/Describe your PDF task/})).toBeVisible();
  await page.getByLabel("What would you like to do?").fill("Merge PDFs, compress, add page numbers and protect.");
  await page.getByRole("button",{name:/Create manual plan/}).click();
  await expect(page.getByRole("heading",{name:"Your proposed steps (4)"})).toBeVisible();
  const routes=await page.locator("ol a").evaluateAll(links=>links.map(link=>link.getAttribute("href")));
  expect(routes).toEqual(["/merge-pdf","/compress-pdf","/add-page-numbers","/protect-pdf"]);
  await page.getByLabel(/1\. Merge PDF/).check();
  await expect(page.getByText(/checking one does not process a file/)).toBeVisible();
  await page.getByLabel("What would you like to do?").fill("Summarize and email the PDF");
  await page.getByRole("button",{name:/Create manual plan/}).click();
  await expect(page.getByText(/No supported operation was identified/)).toBeVisible();
});

test("workspace version health exports a metadata-only inventory, not PDFs",async({page})=>{
  const one=await fixture("WORKSPACE HEALTH INPUT ONE");
  const two=await fixture("WORKSPACE HEALTH INPUT TWO");
  await page.goto("/workspace-health");
  await expect(page.getByRole("heading",{name:"Understand your local document versions"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Export metadata-only JSON"})).toBeDisabled();
  await page.goto("/merge-pdf");
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"health-one.pdf",mimeType:"application/pdf",buffer:one},
    {name:"health-two.pdf",mimeType:"application/pdf",buffer:two}
  ]);
  expect(await downloadedPageCount(page)).toBe(2);
  await expect(page.getByText("Saved as a new composed document in this browser workspace")).toBeVisible();
  await page.goto("/workspace-health");
  await expect(page.getByText("kukureku-merged.pdf").first()).toBeVisible();
  const downloaded=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export metadata-only JSON"}).click();
  const manifest=await downloaded;
  expect(manifest.suggestedFilename()).toBe("kukureku-workspace-manifest.json");
  const json=JSON.parse((await readFile(await manifest.path())).toString());
  expect(json.schema).toBe("kukureku-local-manifest-v1");
  expect(json.warning).toMatch(/Does not contain actual PDF files/);
  expect(json.versions.some(x=>x.name==="kukureku-merged.pdf")).toBe(true);
  expect(json.versions.some(x=>"blob" in x || "bytes" in x)).toBe(false);
});

test("twenty-source merge enforces file count, preserves selections, and recovers for another run",async({page})=>{
  test.setTimeout(360_000);
  await page.setViewportSize({width:375,height:812});
  await page.goto("/merge-pdf");
  const input=page.locator('input[type="file"]').first();
  const pdf=await fixture("TWENTY FILE BROWSER STRESS");
  await input.setInputFiles(Array.from({length:20},(_,i)=>({
    name:"stress-"+String(i+1).padStart(2,"0")+".pdf",mimeType:"application/pdf",buffer:pdf
  })));
  await expect(page.getByRole("heading",{name:"Selected files (20)"})).toBeVisible({timeout:90000});
  await input.setInputFiles({name:"twenty-first.pdf",mimeType:"application/pdf",buffer:pdf});
  const alert=page.getByRole("alert").filter({hasText:"20 PDF files"});
  await expect(alert).toContainText("Choose no more than 20");
  await expect(page.getByRole("heading",{name:"Selected files (20)"})).toBeVisible();
  expect(await downloadedPageCount(page, "Retry Merge")).toBe(20);
  await expect(page.getByText("Saved as a new composed document in this browser workspace")).toBeVisible();
  await page.getByRole("button",{name:"Merge Another Set"}).click();
  await expect(page.getByRole("heading",{name:"Selected files (20)"})).toHaveCount(0);
  await input.setInputFiles([
    {name:"repeat-first.pdf",mimeType:"application/pdf",buffer:pdf},
    {name:"repeat-second.pdf",mimeType:"application/pdf",buffer:pdf}
  ]);
  await expect(page.getByRole("heading",{name:"Selected files (2)"})).toBeVisible();
  expect(await downloadedPageCount(page)).toBe(2);
});

test("320px tool layout keeps upload and recovery actions accessible",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  for (const route of ["/merge-pdf","/compress-pdf","/pdf-to-word","/protect-pdf","/workflow-planner","/workspace-health"]) {
    const response=await page.goto(route,{waitUntil:"domcontentloaded"});
    expect(response?.status(),route+" HTTP status").toBe(200);
    await expect(page.locator("main h1").first(),route+" heading").toBeVisible();
    const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth}));
    expect(width.scroll,route+" horizontal overflow").toBeLessThanOrEqual(width.viewport+1);
  }
});
