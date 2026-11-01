import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";


async function nativeTablePdf(){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([900,760]);
  const xs=[45,120,285,450,605];
  const rows=[["Sl No","Code","Name","Amount","Remarks"],
    ...Array.from({length:12},(_,i)=>[
      String(i+1),String(i+71).padStart(5,"0"),"Station "+(i+1),
      String(1000+i*11),"Reviewed "+(i+1)])];
  rows.forEach((row,i)=>row.forEach((value,j)=>{
    page.drawText(value,{x:xs[j],y:690-i*36,size:12,font});
  }));
  return Buffer.from(await pdf.save());
}
test("live Kukureku accepts a synthetic PDF and exports a real XLSX with source values",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/pdf-to-excel",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_RELEASE142_TABLE.pdf",mimeType:"application/pdf",
    buffer:await nativeTablePdf(),
  });
  // Converter action appears after a valid file is chosen, not at page load.
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible();
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const download=await pending,path=await download.path();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(path).toBeTruthy();
  const zip=await JSZip.loadAsync(await readFile(path));
  const cells=await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  const review=await zip.file("xl/worksheets/sheet2.xml")?.async("string");
  expect(cells).toContain("00071");
  expect(cells).toContain("Station 12");
  expect(cells).not.toContain("<f>");
  expect(review).toContain("EXTRACTION NOT VERIFIED");
  const opened=execFileSync("python",["-c",
    "import sys,io; from openpyxl import load_workbook; "+
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=True); "+
    "s=w['Table 1']; r=list(s.values); "+
    "assert any(len(x)>=5 and x[1]=='00071' and x[2]=='Station 1' for x in r); "+
    "assert any(len(x)>=5 and x[2]=='Station 12' for x in r); "+
    "assert 'Review Notes' in w.sheetnames; print('LIVE_XLSX_OK')",
    path],{encoding:"utf8"});
  expect(opened).toContain("LIVE_XLSX_OK");
  await expect(page.getByRole("heading",{name:"Excel workbook created"})).toBeVisible();
  // A user-supplied real PDF is never used for this live smoke.
  console.log(JSON.stringify({test:"LIVE_RELEASE142_NATIVE_XLSX",
    result:"PASS",source:"SYNTHETIC_ONLY",sourceUpload:false,
    sourceContainsPersonalData:false,sourceCellsVerified:2,independentReader:true}));
});
test("live converter safely refuses scanned-only or text-free input",async({page})=>{
  test.setTimeout(120000);
  const pdf=await PDFDocument.create(),sheet=pdf.addPage([600,400]);
  sheet.drawRectangle({x:50,y:50,width:300,height:120});
  await page.goto("/pdf-to-excel",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_RELEASE142_NO_TEXT.pdf",mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  let downloaded=false;
  page.on("download",()=>{downloaded=true});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  await expect(page.getByText(/image-only or low-text pages/i)).toBeVisible();
  expect(downloaded).toBe(false);
  console.log(JSON.stringify({test:"LIVE_RELEASE142_SAFE_REFUSAL",result:"PASS",
    source:"SYNTHETIC_ONLY",sourceUpload:false}));
});

test("live PDF-to-Excel does not transmit original synthetic PDF bytes in request bodies",async({page})=>{
  test.setTimeout(180000);
  const source=await nativeTablePdf();
  const originalPdfHeader=Buffer.from("%PDF-","utf8");
  const sourceBase64=Buffer.from(source.toString("base64"),"utf8");
  const sourceAsBytes=Buffer.from(source);
  const violations=[];
  let observedWriteRequests=0;

  // Checks the exposed browser request payloads. This is intentionally
  // narrower than a blanket assertion that no network traffic exists:
  // loading assets and privacy-disclosed analytics can involve requests.
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    observedWriteRequests++;
    const body=request.postDataBuffer();
    if(!body)return;
    if(body.includes(sourceAsBytes)||body.includes(originalPdfHeader)||
        body.includes(sourceBase64)){
      let destination="unavailable";
      try{destination=new URL(request.url()).hostname}catch{}
      violations.push({method:request.method(),destination});
    }
  });

  await page.goto("/pdf-to-excel",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK189_NO_PERSONAL_DATA.pdf",
    mimeType:"application/pdf",
    buffer:source,
  });
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible();
  const downloading=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const result=await downloading;
  expect(result.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(violations,"Original PDF bytes/header or direct base64 appeared in an outgoing write request").toEqual([]);
  // Do not log request payload, source PDF contents, browser storage or identifiers.
  console.log(JSON.stringify({check:"LIVE_V1_SYNTHETIC_SOURCE_NETWORK",
    result:"PASS",source:"SYNTHETIC_ONLY",outboundWriteRequestCount:observedWriteRequests,
    suspiciousRequestCount:violations.length,networkBodyDataLogged:false,
    limitation:"Covers direct PDF/header/base64 payload bytes, not transformed or encrypted exfiltration"}));
});

test("live redaction export independently removes selectable text but preserves raster marks",async({page})=>{
  test.setTimeout(180000);
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.HelveticaBold);
  const sheet=document.addPage([600,800]);
  sheet.drawText("SYNTHETIC_REDACTION_SECRET_9137",{x:80,y:650,size:22,font});
  sheet.drawText("PUBLIC_CONTROL_2026",{x:80,y:420,size:22,font});
  const synthetic=Buffer.from(await document.save());
  await page.goto("/redact-pdf",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK190_REDACTION.pdf",
    mimeType:"application/pdf",buffer:synthetic,
  });
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls=page.getByRole("group",{name:"Redaction area on page 1"});
  await controls.getByLabel("Left %").fill("10");
  await controls.getByLabel("Top %").fill("10");
  await controls.getByLabel("Width %").fill("75");
  await controls.getByLabel("Height %").fill("22");
  await page.getByRole("button",{name:"Add redaction area"}).click();
  await expect(page.getByText("Page 1: 1 redaction area marked.")).toBeVisible();
  const downloadPending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Redact and Download PDF"}).click();
  const download=await downloadPending;
  expect(download.suggestedFilename()).toBe("SYNTHETIC_TASK190_REDACTION-redacted.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const source=await readFile(outputPath);
  expect(source.subarray(0,5).toString("ascii")).toBe("%PDF-");

  // Independent PyMuPDF reader: requires the runner-pinned PyMuPDF dependency.
  // Checks both non-extractability and the image pixel result, since a fully
  // blank PDF could otherwise pass a simple "no text" assertion.
  const python=String.raw`
import json,sys,fitz
doc=fitz.open(sys.argv[1])
assert len(doc)==1, "Expected exactly one output page"
page=doc[0]
assert not page.get_text().strip(), "Original PDF text remains extractable"
assert len(page.get_images(full=True))>=1, "Redacted PDF lacks image content"
pix=page.get_pixmap(alpha=False)
def rgb(x,y): return pix.pixel(int(pix.width*x),int(pix.height*y))[:3]
black=rgb(.55,.20)
white=rgb(.85,.83)
assert max(black)<60, "Expected opaque dark redaction in source-sensitive region"
assert min(white)>195, "Outside blank page region was unexpectedly dark"
dark=0
for y in range(int(pix.height*.45),int(pix.height*.52),2):
  for x in range(int(pix.width*.13),int(pix.width*.60),2):
    if max(pix.pixel(x,y)[:3])<155: dark+=1
assert dark>=25, "Expected unredacted public control text to remain visually present"
print(json.dumps({"pageCount":len(doc),"extractableChars":0,"imageCount":len(page.get_images(full=True)),"blackRedaction":True,"publicTextPixels":True}))
`;
  const check=JSON.parse(execFileSync("python",["-c",python,outputPath],{encoding:"utf8"}));
  expect(check.pageCount).toBe(1);
  expect(check.extractableChars).toBe(0);
  expect(check.blackRedaction).toBe(true);
  expect(check.publicTextPixels).toBe(true);
  console.log(JSON.stringify({check:"LIVE_V1_REDACTION_OUTPUT_INDEPENDENT",
    result:"PASS",source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF",
    pageCount:check.pageCount,extractableChars:0,pixelPlacementVerified:true,
    documentBytesLogged:false,limitation:"One bounded page and rectangle, not certification of all document structures"}));
});

test("live Protect and Unlock PDF enforce real password access and preserve content",async({page})=>{
  test.setTimeout(240000);
  const password="Task191-QA-Only-2026!";
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const first=pdf.addPage([612,792]);
  first.drawText("TASK191_ALPHA_SOURCE",{x:72,y:660,size:18,font});
  const second=pdf.addPage([612,792]);
  second.drawText("TASK191_BRAVO_SOURCE",{x:72,y:660,size:18,font});
  const input=Buffer.from(await pdf.save());

  await page.goto("/protect-pdf",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK191.pdf",mimeType:"application/pdf",buffer:input
  });
  await page.locator("#protect-password").fill(password);
  await page.locator("#protect-password-confirm").fill(password);
  const protectedPending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Protect and Download PDF"}).click();
  const protectedDownload=await protectedPending;
  expect(protectedDownload.suggestedFilename()).toBe("SYNTHETIC_TASK191-protected.pdf");
  const protectedPath=await protectedDownload.path();
  expect(protectedPath).toBeTruthy();
  const protectedCheck=JSON.parse(execFileSync("python",[
    "scripts/verifySyntheticPdfEncryption.py","protected",protectedPath
  ],{encoding:"utf8",env:{...process.env,KUKUREKU_QA_PASSWORD:password}}));
  expect(protectedCheck.requiresPassword).toBe(true);
  expect(protectedCheck.pageCount).toBe(2);
  expect(protectedCheck.markerCount).toBe(2);

  await page.goto("/unlock-pdf",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:protectedDownload.suggestedFilename(),
    mimeType:"application/pdf",buffer:await readFile(protectedPath)
  });
  await page.locator("#pdf-password").fill("incorrect-synthetic-password");
  await page.getByRole("button",{name:"Unlock and Download PDF"}).click();
  await expect(page.getByText("The PDF could not be unlocked. Check the password",{exact:false}).first()).toBeVisible();

  await page.locator("#pdf-password").fill(password);
  const unlockedPending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Unlock and Download PDF"}).click();
  const unlockedDownload=await unlockedPending;
  expect(unlockedDownload.suggestedFilename()).toBe("SYNTHETIC_TASK191-protected-unlocked.pdf");
  const unlockedPath=await unlockedDownload.path();
  expect(unlockedPath).toBeTruthy();
  const unlockedCheck=JSON.parse(execFileSync("python",[
    "scripts/verifySyntheticPdfEncryption.py","unlocked",unlockedPath
  ],{encoding:"utf8",env:{...process.env,KUKUREKU_QA_PASSWORD:password}}));
  expect(unlockedCheck.requiresPassword).toBe(false);
  expect(unlockedCheck.pageCount).toBe(2);
  expect(unlockedCheck.markerCount).toBe(2);
  console.log(JSON.stringify({check:"LIVE_V1_PDF_PASSWORD_INDEPENDENT",result:"PASS",
    source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF",
    wrongPasswordRejected:true,correctPasswordAccepted:true,unlockedContentPreserved:true,
    actualPasswordLogged:false,sourceBytesLogged:false,
    limitation:"Two synthetic text pages; not arbitrary encryption interoperability or real-world certification"}));
});
