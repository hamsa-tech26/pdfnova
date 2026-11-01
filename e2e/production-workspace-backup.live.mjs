import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");

test("live workspace ZIP hashes original PDF and restores safely in a clean browser",async({page,browser})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const sheet=pdf.addPage([612,792]);
  sheet.drawText("SYNTHETIC_TASK192_WORKSPACE_ORIGINAL",{x:70,y:650,size:16,font});
  const source=Buffer.from(await pdf.save());
  const name="SYNTHETIC_TASK192_WORKSPACE.pdf";

  await page.goto("/magic-drop",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name,mimeType:"application/pdf",buffer:source
  });
  await expect(page.getByText(/This source PDF is saved locally in this browser/)).toBeVisible();

  await page.goto("/workspace-health",{waitUntil:"domcontentloaded"});
  await expect(page.getByText(name,{exact:true})).toBeVisible();
  const zipPending=page.waitForEvent("download",{timeout:60000});
  await page.getByRole("button",{name:"Download full workspace backup (ZIP)"}).click();
  const download=await zipPending;
  expect(download.suggestedFilename()).toBe("kukureku-private-workspace-backup.zip");
  const zipBytes=await readFile(await download.path());
  const archive=await JSZip.loadAsync(zipBytes);
  const manifest=JSON.parse(await archive.file("manifest.json").async("string"));
  expect(manifest.schema).toBe("kukureku-private-workspace-backup-v1");
  expect(manifest.versions).toHaveLength(1);
  expect(manifest.versions[0].summary.name).toBe(name);
  const entry=manifest.versions[0];
  const stored=await archive.file(entry.entry).async("nodebuffer");
  expect(sha256(stored)).toBe(entry.sha256);
  expect(sha256(stored)).toBe(sha256(source));

  // An altered PDF inside a syntactically valid ZIP must be refused before import.
  const bad=Buffer.from(stored);
  bad[bad.length-1]^=1;
  archive.file(entry.entry,bad,{compression:"STORE"});
  const tampered=await archive.generateAsync({type:"nodebuffer",compression:"STORE"});

  const isolated=await browser.newContext({acceptDownloads:true});
  try {
    const fresh=await isolated.newPage();
    await fresh.goto("/workspace-health",{waitUntil:"domcontentloaded"});
    await expect(fresh.getByText(/No stored documents yet/)).toBeVisible();
    await fresh.locator("#workspace-backup-upload").setInputFiles({
      name:"tampered-synthetic-backup.zip",mimeType:"application/zip",buffer:tampered
    });
    await expect(fresh.getByRole("alert").getByText(/SHA-256 mismatch/)).toBeVisible();
    await expect(fresh.getByText(/No stored documents yet/)).toBeVisible();

    await fresh.locator("#workspace-backup-upload").setInputFiles({
      name:"original-synthetic-backup.zip",mimeType:"application/zip",buffer:zipBytes
    });
    await expect(fresh.getByText(/Backup verified locally/)).toBeVisible();
    await expect(fresh.getByText(/Verified: 1 saved PDF versions/)).toBeVisible();
    await fresh.getByRole("button",{name:"Restore verified versions"}).click();
    await expect(fresh.getByText(/1 PDF versions restored as new documents/)).toBeVisible();
    await expect(fresh.getByText(name,{exact:true})).toBeVisible();

    const restoredPending=fresh.waitForEvent("download",{timeout:60000});
    await fresh.getByRole("button",{name:"Download stored PDF "+name}).click();
    const restored=await restoredPending;
    expect(restored.suggestedFilename()).toBe(name);
    expect(sha256(await readFile(await restored.path()))).toBe(sha256(source));
  }finally{await isolated.close();}
  console.log(JSON.stringify({check:"LIVE_V1_WORKSPACE_BACKUP_INTEGRITY",result:"PASS",
    source:"SYNTHETIC_ONLY",versionCount:1,sha256ManifestVerified:true,
    corruptedArchiveRejected:true,freshBrowserRestoreVerified:true,restoredBytesMatchSource:true,
    documentDataLogged:false,limitation:"One source version; larger version graphs, collisions and browsers need separate checks"}));
});
