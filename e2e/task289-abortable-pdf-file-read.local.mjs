import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticPdf(pageCount,label){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK289_"+label+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

async function installAbortableFileReaderProbe(page){
  await page.addInitScript(()=>{
    const originalRead=FileReader.prototype.readAsArrayBuffer;
    const originalAbort=FileReader.prototype.abort;
    window.__task289State={
      slowStarted:false,
      nativeReadStarted:false,
      abortCount:0,
      slowReadAborted:false
    };
    FileReader.prototype.readAsArrayBuffer=function(blob){
      if(blob instanceof File&&blob.name==="SLOW_ABORT.pdf"){
        window.__task289State.slowStarted=true;
        this.__task289Timer=window.setTimeout(()=>{
          if(!this.__task289Aborted){
            window.__task289State.nativeReadStarted=true;
            originalRead.call(this,blob);
          }
        },2500);
        return;
      }
      return originalRead.call(this,blob);
    };
    FileReader.prototype.abort=function(){
      if(this.__task289Timer){
        window.clearTimeout(this.__task289Timer);
        this.__task289Timer=null;
        this.__task289Aborted=true;
        window.__task289State.abortCount+=1;
        window.__task289State.slowReadAborted=true;
        return;
      }
      return originalAbort.call(this);
    };
  });
}

async function beginSlowPdf(page,input,bytes){
  await input.setInputFiles({name:"SLOW_ABORT.pdf",mimeType:"application/pdf",buffer:bytes});
  await page.waitForFunction(()=>window.__task289State?.slowStarted===true);
}

async function waitForReadAbort(page){
  await page.waitForFunction(()=>window.__task289State?.abortCount===1,{timeout:10000});
  await page.waitForTimeout(300);
  const state=await page.evaluate(()=>window.__task289State);
  expect(state.slowReadAborted).toBe(true);
  expect(state.nativeReadStarted).toBe(false);
  expect(state.abortCount).toBe(1);
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

test("Add Image Stamp aborts the pending FileReader on PDF reset",async({page,browserName})=>{
  await installAbortableFileReaderProbe(page);
  const initial=await syntheticPdf(2,"INITIAL");
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const latest=await syntheticPdf(2,"AFTER_ABORT");
  const privacy=observeWrites(page,[initial,slow,latest]);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await input.setInputFiles({name:"INITIAL.pdf",mimeType:"application/pdf",buffer:initial.bytes});
  const pageSelect=page.getByLabel("PDF page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});

  await beginSlowPdf(page,input,slow.bytes);
  await page.getByRole("button",{name:"Remove PDF"}).click();
  await waitForReadAbort(page);
  await expect(pageSelect).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Remove PDF"})).toHaveCount(0);

  await input.setInputFiles({name:"AFTER_ABORT.pdf",mimeType:"application/pdf",buffer:latest.bytes});
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
    "assert all('KUKUREKU_TASK289_SLOW_OLD' not in text for text in texts)",
    "assert all('KUKUREKU_TASK289_INITIAL' not in text for text in texts)",
    "print('TASK289_STAMP_ABORT_OK')"
  ].join("\n");
  expect(inspectPdf(outputPath,inspection,latest.markers)).toContain("TASK289_STAMP_ABORT_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:289,case:"add-image-stamp-aborts-pending-file-reader",browser:browserName,fileReaderAbortCount:1,nativeSlowReadStarted:false,latestSelection:"AFTER_ABORT.pdf",independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});

test("Sign PDF aborts the pending FileReader on PDF reset",async({page,browserName})=>{
  await installAbortableFileReaderProbe(page);
  const initial=await syntheticPdf(2,"INITIAL");
  const slow=await syntheticPdf(1,"SLOW_OLD");
  const latest=await syntheticPdf(2,"AFTER_ABORT");
  const privacy=observeWrites(page,[initial,slow,latest]);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  const input=page.locator('input[type="file"]').first();
  await input.setInputFiles({name:"INITIAL.pdf",mimeType:"application/pdf",buffer:initial.bytes});
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});

  await beginSlowPdf(page,input,slow.bytes);
  await page.getByRole("button",{name:"Remove PDF"}).click();
  await waitForReadAbort(page);
  await expect(pageSelect).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Remove PDF"})).toHaveCount(0);

  await input.setInputFiles({name:"AFTER_ABORT.pdf",mimeType:"application/pdf",buffer:latest.bytes});
  await expect(pageSelect.locator("option")).toHaveCount(2,{timeout:45000});
  await page.getByRole("button",{name:"Type",exact:true}).click();
  await page.getByLabel("Signature name").fill("TASK289 ABORT VERIFIED");
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
    "assert all('KUKUREKU_TASK289_SLOW_OLD' not in text for text in texts)",
    "assert all('KUKUREKU_TASK289_INITIAL' not in text for text in texts)",
    "assert len(doc[0].get_images(full=True))==0",
    "assert len(doc[1].get_images(full=True))>=1",
    "print('TASK289_SIGN_ABORT_OK')"
  ].join("\n");
  expect(inspectPdf(outputPath,inspection,latest.markers)).toContain("TASK289_SIGN_ABORT_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:289,case:"sign-pdf-aborts-pending-file-reader",browser:browserName,fileReaderAbortCount:1,nativeSlowReadStarted:false,latestSelection:"AFTER_ABORT.pdf",signaturePage:2,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,documentBytesLogged:false}));
});
