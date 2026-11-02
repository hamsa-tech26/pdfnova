import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {readFile} from "node:fs/promises";

// All evidence is fictional, generated inside the runner, and never retained
// as a CI artifact. This checks directly observable requests; it is not a
// blanket proof against transformed/encrypted payloads or service workers.
async function syntheticSource(marker){
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  const page=document.addPage([612,792]);
  page.drawText(marker,{x:70,y:650,size:14,font});
  page.drawText("PUBLIC_SYNTHETIC_CONTROL_2026",{x:70,y:450,size:14,font});
  return Buffer.from(await document.save());
}

function watchDirectOutboundDisclosure(page,source,marker){
  const raw=Buffer.from(source);
  const base64=Buffer.from(raw.toString("base64"));
  const markerBytes=Buffer.from(marker);
  const findings=[];
  let writes=0;
  let requests=0;
  const onRequest=request=>{
    requests++;
    const method=request.method();
    const url=request.url();
    let host="unknown";
    try{host=new URL(url).hostname}catch{}
    if(url.includes(marker)||url.includes(encodeURIComponent(marker))){
      findings.push({vector:"url",method,host});
    }
    if(!["POST","PUT","PATCH","DELETE"].includes(method))return;
    writes++;
    let body;
    try{body=request.postDataBuffer()}catch{return}
    if(!body)return;
    if(body.includes(raw)||body.includes(base64)||body.includes(markerBytes)||body.includes(Buffer.from("%PDF-"))){
      findings.push({vector:"request_body",method,host});
    }
  };
  page.on("request",onRequest);
  return {
    assertClean(label){
      page.off("request",onRequest);
      console.log(JSON.stringify({check:label,requests,writes,findings,
        source:"SYNTHETIC_ONLY",requestBodiesLogged:false,
        limitation:"Only direct source bytes, PDF header, base64 and marker leakage in observable browser requests"}));
      expect(findings,"No direct synthetic document data may leave in URLs or write request bodies").toEqual([]);
    },
  };
}

test("live Magic Drop and full workspace backup keep synthetic PDF content out of browser requests",async({page})=>{
  test.setTimeout(180000);
  const marker="KUKUREKU_NETWORK_FIXTURE_199_A";
  const source=await syntheticSource(marker);
  const filename="SYNTHETIC_TASK199_WORKSPACE.pdf";
  const audit=watchDirectOutboundDisclosure(page,source,marker);

  await page.goto("/magic-drop",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:filename,mimeType:"application/pdf",buffer:source,
  });
  await expect(page.getByText(/This source PDF is saved locally in this browser/)).toBeVisible();
  await page.goto("/workspace-health",{waitUntil:"domcontentloaded"});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  const pending=page.waitForEvent("download",{timeout:60000});
  await page.getByRole("button",{name:"Download full workspace backup (ZIP)"}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  expect((await readFile(await download.path())).byteLength).toBeGreaterThan(source.byteLength);
  audit.assertClean("LIVE_V1_WORKSPACE_IMPORT_BACKUP_NETWORK_PRIVACY");
});

test("live redaction and password protection do not directly transmit synthetic PDF bytes",async({page})=>{
  test.setTimeout(240000);
  const marker="KUKUREKU_NETWORK_FIXTURE_199_B";
  const source=await syntheticSource(marker);
  const audit=watchDirectOutboundDisclosure(page,source,marker);

  await page.goto("/redact-pdf",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK199_REDACTION.pdf",mimeType:"application/pdf",buffer:source,
  });
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls=page.getByRole("group",{name:"Redaction area on page 1"});
  await controls.getByLabel("Left %").fill("10");
  await controls.getByLabel("Top %").fill("10");
  await controls.getByLabel("Width %").fill("75");
  await controls.getByLabel("Height %").fill("22");
  await page.getByRole("button",{name:"Add redaction area"}).click();
  const redacted=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Redact and Download PDF"}).click();
  expect((await redacted).suggestedFilename()).toMatch(/redacted\.pdf$/);

  await page.goto("/protect-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK199_PROTECTION.pdf",mimeType:"application/pdf",buffer:source,
  });
  await page.locator("#protect-password").fill("Synthetic-QA-Password-199!");
  await page.locator("#protect-password-confirm").fill("Synthetic-QA-Password-199!");
  const protectedFile=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Protect and Download PDF"}).click();
  expect((await protectedFile).suggestedFilename()).toMatch(/protected\.pdf$/);
  audit.assertClean("LIVE_V1_REDACT_PROTECT_NETWORK_PRIVACY");
});
