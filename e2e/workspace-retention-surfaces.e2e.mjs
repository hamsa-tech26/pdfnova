import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

const HISTORY_KEY="kukureku-recent-files";

async function cacheCount(page){
  return page.evaluate(async()=>{
    const request=indexedDB.open("kukureku-private-intelligence-v2",1);
    const db=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try {
      const count=db.transaction("records","readonly").objectStore("records").count();
      return await new Promise((resolve,reject)=>{
        count.onsuccess=()=>resolve(count.result);
        count.onerror=()=>reject(count.error);
      });
    } finally { db.close(); }
  });
}

test("Dashboard history and indexed text can be cleared without deleting saved workspace PDFs",async({page})=>{
  test.setTimeout(180000);
  const filename="SYNTHETIC_TASK202_STORAGE.pdf";
  const recentName="SYNTHETIC_TASK202_RECENT.txt";
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  document.addPage([612,792]).drawText("TASK202_SYNTHETIC_STORAGE_ONLY",{
    x:72,y:650,size:14,font,
  });
  const source=Buffer.from(await document.save());

  await page.goto("/magic-drop",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:filename,mimeType:"application/pdf",buffer:source,
  });
  await expect(page.getByText(/This source PDF is saved locally in this browser/)).toBeVisible();

  // Seed only synthetic browser-local history and a synthetic intelligence record.
  // The test verifies the public cleanup controls, not OCR generation quality.
  await page.evaluate(({recentName})=>{
    localStorage.setItem("kukureku-recent-files",JSON.stringify([{
      id:"synthetic-task202-recent",fileName:recentName,
      toolName:"PDF to Text",createdAt:new Date().toISOString(),
    }]));
  },{recentName});

  await page.evaluate(async()=>{
    const request=indexedDB.open("kukureku-private-intelligence-v2",1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains("records"))
        request.result.createObjectStore("records",{keyPath:"nodeId"});
    };
    const db=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try {
      const tx=db.transaction("records","readwrite");
      tx.objectStore("records").put({
        nodeId:"synthetic-task202-cache",fingerprint:"synthetic-task202",
        signal:{rawText:"TASK202_SYNTHETIC_INDEXED_TEXT",pages:[]},
        index:{coverage:{pageCount:1,chunkCount:1}},facts:[],
        cachedAt:new Date().toISOString(),schemaVersion:2,
      });
      await new Promise((resolve,reject)=>{
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
    } finally {db.close();}
  });
  expect(await cacheCount(page)).toBe(1);

  await page.goto("/dashboard",{waitUntil:"networkidle"});
  await expect(page.getByText(recentName,{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Clear history"}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),HISTORY_KEY)).toBeNull();
  expect(await cacheCount(page)).toBe(1);

  await page.goto("/workspace-health",{waitUntil:"networkidle"});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();

  await page.goto("/workspace-privacy",{waitUntil:"networkidle"});
  await page.getByRole("button",{name:"Clear intelligence cache"}).click();
  await expect.poll(()=>cacheCount(page),{timeout:20000}).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),HISTORY_KEY)).toBeNull();

  await page.goto("/workspace-health",{waitUntil:"networkidle"});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  await page.reload({waitUntil:"networkidle"});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  console.log(JSON.stringify({check:"TASK202_RETENTION_SURFACE_INDEPENDENCE",
    result:"PASS",source:"SYNTHETIC_ONLY",recentHistoryCleared:true,
    intelligenceCacheCleared:true,savedPdfRemained:true,persistentAfterReload:true,
    crossTabOrDeviceErasureVerified:false,privateDocumentBytesLogged:false,
    limitation:"Injected synthetic history/cache fixtures; not all browser retention surfaces"}));
});
