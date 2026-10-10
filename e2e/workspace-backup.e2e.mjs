import {test, expect} from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";

async function fixture(label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([400, 550]).drawText(label,{x:30,y:450,font,size:16});
  return Buffer.from(await doc.save());
}
test("complete private backup restores a composed document graph in a new browser",async({page,browser})=>{
  test.setTimeout(180_000);
  const first=await fixture("BACKUP SOURCE A");
  const second=await fixture("BACKUP SOURCE B");
  await page.setViewportSize({width:320,height:740});
  await page.goto("/merge-pdf");
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"backup-a.pdf",mimeType:"application/pdf",buffer:first},
    {name:"backup-b.pdf",mimeType:"application/pdf",buffer:second},
  ]);
  const mergeDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"Merge and Download PDF"}).click();
  expect((await PDFDocument.load(await readFile(await (await mergeDownload).path()))).getPageCount()).toBe(2);
  await page.goto("/workspace-health");
  await expect(page.getByRole("button",{name:"Download full workspace backup (ZIP)"})).toBeEnabled();
  const dl=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download full workspace backup (ZIP)"}).click();
  const file=await dl;
  expect(file.suggestedFilename()).toBe("kukureku-private-workspace-backup.zip");
  const archive=await readFile(await file.path());
  const zip=await JSZip.loadAsync(archive);
  const manifest=JSON.parse(await zip.file("manifest.json").async("string"));
  expect(manifest.schema).toBe("kukureku-private-workspace-backup-v1");
  expect(manifest.versions).toHaveLength(3);
  expect(manifest.versions.some(v=>v.summary.relationKind==="composition" && v.summary.parentIds.length===2)).toBe(true);
  const secondContext=await browser.newContext({acceptDownloads:true,viewport:{width:375,height:812}});
  try {
    const restored=await secondContext.newPage();
    await restored.goto("/workspace-health");
    await expect(restored.getByRole("button",{name:"Download full workspace backup (ZIP)"})).toBeDisabled();
    await restored.locator("#workspace-backup-upload").setInputFiles({
      name:"kukureku-private-workspace-backup.zip",mimeType:"application/zip",buffer:archive,
    });
    await expect(restored.getByText(/Verified: 3 saved PDF versions/)).toBeVisible();
    await restored.getByRole("button",{name:"Restore verified versions"}).click();
    await expect(restored.getByRole("status").filter({hasText:"3 PDF versions restored"})).toBeVisible();
    await expect(restored.getByText("Saved versions").locator("..").getByText("3",{exact:true})).toBeVisible();
    const dlTwo=restored.waitForEvent("download");
    await restored.getByRole("button",{name:"Download stored PDF backup-a.pdf"}).click();
    const saved=await dlTwo;
    expect((await PDFDocument.load(await readFile(await saved.path()))).getPageCount()).toBe(1);
    const widths=await restored.evaluate(()=>({viewport:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth}));
    expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+1);
  } finally {await secondContext.close();}
});
test("rejects an altered backup before any workspace file is restored", async({page})=>{
  const bytes=await fixture("UNCHANGED PDF");
  await page.goto("/merge-pdf");
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"integrity-a.pdf",mimeType:"application/pdf",buffer:bytes},
    {name:"integrity-b.pdf",mimeType:"application/pdf",buffer:bytes},
  ]);
  const dl=page.waitForEvent("download");
  await page.getByRole("button",{name:"Merge and Download PDF"}).click();
  await dl;
  await page.goto("/workspace-health");
  const backup=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download full workspace backup (ZIP)"}).click();
  const zip=await JSZip.loadAsync(await readFile(await (await backup).path()));
  const manifest=JSON.parse(await zip.file("manifest.json").async("string"));
  zip.file(manifest.versions[0].entry, new TextEncoder().encode("%PDF-1.4\nCORRUPTED\n%%EOF"));
  const modified=await zip.generateAsync({type:"nodebuffer",compression:"STORE"});
  await page.locator("#workspace-backup-upload").setInputFiles({name:"tampered.zip",mimeType:"application/zip",buffer:modified});
  await expect(page.locator("p[role='alert']").filter({hasText:/mismatch|unsafe expanded/i})).toBeVisible();
  await expect(page.getByRole("button",{name:"Restore verified versions"})).toHaveCount(0);
  await expect(page.getByText("Saved versions").locator("..").getByText("3",{exact:true})).toBeVisible();
});
