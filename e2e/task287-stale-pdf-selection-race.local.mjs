import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticPdf(pageCount,label){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK287_"+label+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

async function installDelayedPdfRead(page){
  await page.addInitScript(()=>{
    const original=Blob.prototype.arrayBuffer;
    window.__task287PdfReadState={slowStarted:false,slowResolved:false};
    Blob.prototype.arrayBuffer=function(...args){
      const isSlowFile=this instanceof File && this.name==="SLOW_OLD.pdf";
      if(!isSlowFile)return original.apply(this,args);
      window.__task287PdfReadState.slowStarted=true;
      return new Promise((resolve,reject)=>{
        window.setTimeout(()=>{
          original.apply(this,args).then((value)=>{
            window.__task287PdfReadState.slowResolved=true;
            resolve(value);
          },reject);
        },1400);
      });
    };
  });
}

async function beginSlowPdf(page,input,bytes){
  await input.setInputFiles({
    name:"SLOW_OLD.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.waitForFunction(()=>window.__task287PdfReadState?.slowStarted===true);
}

async function waitForOlderPdfToFinish(page){
  await page.waitForFunction(()=>window.__task287PdfReadState?.slowResolved===true,{timeout:30000});
  // Allow the asynchronous PDF parser and React state queue to settle after the delayed read.
  await page.waitForTimeout(650);
}

function observeWrites(page,sourceBytes,markers){
  const secrets=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    ...markers.map(marker=>Buffer.from(marker,"utf8"))
  ];
  let writeRequestCount=0;
  const suspiciousWriteMethods=[];
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret)))suspiciousWriteMethods.push(request.method());
  });
  return {
    getWriteRequestCount:()=>writeRequestCount,
    suspiciousWriteMethods
  };
}

function inspectPdf(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,
    encoding:"utf8",
    maxBuffer:256*1024
  });
}

const twoPageInspection=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==2, f'Expected newest two-page PDF, got {len(doc)} pages'",
  "texts=[page.get_text('text') for page in doc]",
  "assert sys.argv[2] in texts[0]",
  "assert sys.argv[3] in texts[1]",
  "assert all('KUKUREKU_TASK287_SLOW_OLD' not in text for text in texts)",
  "print('TASK287_LATEST_PDF_OUTPUT_OK')"
].join("\n");

const signInspection=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==2, f'Expected newest two-page PDF, got {len(doc)} pages'",
  "assert sys.argv[2] in doc[0].get_text('text')",
  "assert sys.argv[3] in doc[1].get_text('text')",
  "assert all('KUKUREKU_TASK287_SLOW_OLD' not in page.get_text('text') for page in doc)",
  "assert len(doc[0].get_images(full=True))==0, 'Signature must not appear on page 1'",
  "assert len(doc[1].get_images(full=True))>=1, 'Typed signature image must appear on page 2'",
  "print('TASK287_LATEST_SIGNED_PDF_OK')"
].join("\n");

test("Add Image Stamp keeps the newest PDF when an older read finishes later",async({page,browserName})=>{
  await installDelayedPdfRead(page);
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const fast=await syntheticPdf(2,"FAST_NEW");
  const privacy=observeWrites(page,fast.bytes,fast.markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await beginSlowPdf(page,input,slow.bytes);
  await input.setInputFiles({
    name:"FAST_NEW.pdf",
    mimeType:"application/pdf",
    buffer:fast.bytes
  });

  const pageSelect=page.getByLabel("PDF page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});
  await waitForOlderPdfToFinish(page);
  await expect(pageSelect.locator("option")).toHaveCount(2);
  await pageSelect.selectOption("2");

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,twoPageInspection,fast.markers)).toContain("TASK287_LATEST_PDF_OUTPUT_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:287,case:"add-image-stamp-latest-pdf-wins",browser:browserName,selected:"FAST_NEW.pdf",olderPdfReadFinishedAfterNewer:true,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});

test("Sign PDF keeps the newest PDF when an older read finishes later",async({page,browserName})=>{
  await installDelayedPdfRead(page);
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const fast=await syntheticPdf(2,"FAST_NEW");
  const privacy=observeWrites(page,fast.bytes,fast.markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await beginSlowPdf(page,input,slow.bytes);
  await input.setInputFiles({
    name:"FAST_NEW.pdf",
    mimeType:"application/pdf",
    buffer:fast.bytes
  });

  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});
  await waitForOlderPdfToFinish(page);
  await expect(pageSelect.locator("option")).toHaveCount(2);

  await page.getByRole("button",{name:"Type",exact:true}).click();
  await page.getByLabel("Signature name").fill("TASK287 APPROVED");
  await pageSelect.selectOption("2");

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,signInspection,fast.markers)).toContain("TASK287_LATEST_SIGNED_PDF_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:287,case:"sign-pdf-latest-pdf-wins",browser:browserName,selected:"FAST_NEW.pdf",signaturePage:2,olderPdfReadFinishedAfterNewer:true,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});

test("An invalid newer PDF selection prevents an older pending PDF from becoming active",async({page,browserName})=>{
  await installDelayedPdfRead(page);
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const privacy=observeWrites(page,slow.bytes,slow.markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await beginSlowPdf(page,input,slow.bytes);
  await input.setInputFiles({
    name:"TASK287_INVALID.txt",
    mimeType:"text/plain",
    buffer:Buffer.from("synthetic invalid file")
  });

  await expect(page.getByText("Please select a valid PDF file.",{exact:true}).first()).toBeVisible();
  await waitForOlderPdfToFinish(page);
  await expect(page.getByText("Please select a valid PDF file.",{exact:true}).first()).toBeVisible();
  await expect(page.getByLabel("PDF page")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add and Download PDF"})).toHaveCount(0);
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:287,case:"invalid-newer-pdf-invalidates-pending-older-pdf",browser:browserName,olderPdfReadFinishedAfterInvalidSelection:true,stalePdfApplied:false,outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});
