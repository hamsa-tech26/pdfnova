import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {readFile} from "node:fs/promises";

test("saved workspace PDF deletion requires confirmation, survives reload and permits explicit backup restore",async({page})=>{
  test.setTimeout(180000);
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  document.addPage([612,792]).drawText("SYNTHETIC_WORKSPACE_DELETE_200",{
    x:70,y:650,size:14,font,
  });
  const source=Buffer.from(await document.save());
  const filename="SYNTHETIC_TASK200_DELETE.pdf";

  await page.goto("/magic-drop",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:filename,mimeType:"application/pdf",buffer:source,
  });
  await expect(page.getByText(/This source PDF is saved locally in this browser/)).toBeVisible();
  await page.goto("/workspace-health",{waitUntil:"domcontentloaded"});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();

  const backupPending=page.waitForEvent("download",{timeout:60000});
  await page.getByRole("button",{name:"Download full workspace backup (ZIP)"}).click();
  const backup=Buffer.from(await readFile(await (await backupPending).path()));
  expect(backup.byteLength).toBeGreaterThan(source.byteLength);

  await page.getByRole("button",{name:"Delete all saved PDFs",exact:true}).click();
  await expect(page.locator('section[role="alert"]')).toContainText("cannot be undone");
  await page.getByRole("button",{name:"Cancel deletion"}).click();
  await expect(page.getByText(filename,{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Delete all saved PDFs",exact:true}).click();
  await page.getByRole("button",{name:"Confirm delete all saved PDFs"}).click();
  await expect(page.getByText(/No stored documents yet/)).toBeVisible();
  await expect(page.getByText(/All saved workspace PDFs were removed/)).toBeVisible();
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByText(/No stored documents yet/)).toBeVisible();

  await page.locator("#workspace-backup-upload").setInputFiles({
    name:"synthetic-task200-backup.zip",mimeType:"application/zip",buffer:backup,
  });
  await expect(page.getByText(/Backup verified locally/)).toBeVisible();
  await page.getByRole("button",{name:"Restore verified versions"}).click();
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  console.log(JSON.stringify({check:"TASK200_WORKSPACE_DELETE_CONFIRMATION",
    result:"PASS",source:"SYNTHETIC_ONLY",cancelPreservesData:true,
    confirmedDeletionPersists:true,explicitBackupRestoreWorks:true,
    privateDocumentBytesLogged:false}));
});
