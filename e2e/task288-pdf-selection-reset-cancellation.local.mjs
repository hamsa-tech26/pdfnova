import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticPdf(pageCount,label){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK288_"+label+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

async function installDelayedPdfRead(page){
  await page.addInitScript(()=>{
    const original=Blob.prototype.arrayBuffer;
    window.__task288PdfReadState={slowStarted:false,slowResolved:false};
    Blob.prototype.arrayBuffer=function(...args){
      const isSlowFile=this instanceof File && this.name==="SLOW_CANCEL.pdf";
      if(!isSlowFile)return original.apply(this,args);
      window.__task288PdfReadState.slowStarted=true;
      return new Promise((resolve,reject)=>{
        window.setTimeout(()=>{
          original.apply(this,args).then(value=>{
            window.__task288PdfReadState.slowResolved=true;
            resolve(value);
          },reject);
        },1600);
      });
    };
  });
}

async function beginSlowPdf(page,input,bytes){
  await input.setInputFiles({name:"SLOW_CANCEL.pdf",mimeType:"application/pdf",buffer:bytes});
  await page.waitForFunction(()=>window.__task288PdfReadState?.slowStarted===true);
}

async function waitForSlowPdf(page){
  await page.waitForFunction(()=>window.__task288PdfReadState?.slowResolved===true,{timeout:30000});
  await page.waitForTimeout(500);
}

function observeWrites(page,sources){
  const secrets=sources.flatMap(source=>[
    source.bytes,
    Buffer.from(source.bytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    ...source.markers.map(marker=>Buffer.from(marker,"utf8"))
  ]);
  let writeRequestCount=0;
  const suspiciousWriteMethods=[];
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret)))suspiciousWriteMethods.push(request.method());
  });
  return {getWriteRequestCount:()=>writeRequestCount,suspiciousWriteMethods};
}

function inspectPdf(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,
    encoding:"utf8",
    maxBuffer:256*1024
  });
}

async function loadInitialPdf(page,input,initial){
  await input.setInputFiles({name:"INITIAL.pdf",mimeType:"application/pdf",buffer:initial.bytes});
}

async function resetDuringPendingRead(page,input,slow){
  await beginSlowPdf(page,input,slow.bytes);
  await page.getByRole("button",{name:"Remove PDF"}).click();
  await expect(page.getByLabel(/PDF page|Sign page/)).toHaveCount(0);
  await waitForSlowPdf(page);
  await expect(page.getByRole("button",{name:"Remove PDF"})).toHaveCount(0);
  await expect(page.getByLabel(/PDF page|Sign page/)).toHaveCount(0);
}

test("Add Image Stamp reset invalidates a pending PDF read and allows a fresh selection",async({page,browserName})=>{
  await installDelayedPdfRead(page);
  const initial=await syntheticPdf(2,"INITIAL");
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const latest=await syntheticPdf(2,"AFTER_RESET");
  const privacy=observeWrites(page,[initial,slow,latest]);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await loadInitialPdf(page,input,initial);
  const pageSelect=page.getByLabel("PDF page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});

  await resetDuringPendingRead(page,input,slow);
  await input.setInputFiles({name:"AFTER_RESET.pdf",mimeType:"application/pdf",buffer:latest.bytes});
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});
  await pageSelect.selectOption("2");

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const inspection=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "texts=[page.get_text('text') for page in doc]",
    "assert sys.argv[2] in texts[0] and sys.argv[3] in texts[1]",
    "assert all('KUKUREKU_TASK288_SLOW_OLD' not in text for text in texts)",
    "assert all('KUKUREKU_TASK288_INITIAL' not in text for text in texts)",
    "print('TASK288_ADD_IMAGE_STAMP_RESET_OK')"
  ].join("\n");
  expect(inspectPdf(outputPath,inspection,latest.markers)).toContain("TASK288_ADD_IMAGE_STAMP_RESET_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:288,case:"add-image-stamp-reset-during-pending-pdf-read",browser:browserName,resetInvalidatedSlowRead:true,latestSelection:"AFTER_RESET.pdf",independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});

test("Sign PDF reset invalidates a pending PDF read and allows a fresh selection",async({page,browserName})=>{
  await installDelayedPdfRead(page);
  const initial=await syntheticPdf(2,"INITIAL");
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const latest=await syntheticPdf(2,"AFTER_RESET");
  const privacy=observeWrites(page,[initial,slow,latest]);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await loadInitialPdf(page,input,initial);
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});

  await resetDuringPendingRead(page,input,slow);
  await input.setInputFiles({name:"AFTER_RESET.pdf",mimeType:"application/pdf",buffer:latest.bytes});
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});
  await page.getByRole("button",{name:"Type",exact:true}).click();
  await page.getByLabel("Signature name").fill("TASK288 RESET VERIFIED");
  await pageSelect.selectOption("2");

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const inspection=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "texts=[page.get_text('text') for page in doc]",
    "assert sys.argv[2] in texts[0] and sys.argv[3] in texts[1]",
    "assert all('KUKUREKU_TASK288_SLOW_OLD' not in text for text in texts)",
    "assert all('KUKUREKU_TASK288_INITIAL' not in text for text in texts)",
    "assert len(doc[0].get_images(full=True))==0",
    "assert len(doc[1].get_images(full=True))>=1",
    "print('TASK288_SIGN_PDF_RESET_OK')"
  ].join("\n");
  expect(inspectPdf(outputPath,inspection,latest.markers)).toContain("TASK288_SIGN_PDF_RESET_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:288,case:"sign-pdf-reset-during-pending-pdf-read",browser:browserName,resetInvalidatedSlowRead:true,latestSelection:"AFTER_RESET.pdf",signaturePage:2,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});
