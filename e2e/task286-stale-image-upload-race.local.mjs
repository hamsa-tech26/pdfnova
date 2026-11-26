import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticJpeg(page,color){
  const dataUrl=await page.evaluate((fill)=>{
    const canvas=document.createElement("canvas");
    canvas.width=32;canvas.height=16;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas unavailable");
    context.fillStyle=fill;
    context.fillRect(0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",1);
  },color);
  return Buffer.from(dataUrl.split(",")[1],"base64");
}

async function syntheticPdf(pageCount,consumer){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK286_"+consumer+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

async function installDelayedReader(page){
  await page.addInitScript(()=>{
    const original=FileReader.prototype.readAsDataURL;
    window.__task286ReaderState={slowStarted:false,slowReleased:false};
    FileReader.prototype.readAsDataURL=function(file){
      if(file && file.name==="SLOW_RED.jpg"){
        window.__task286ReaderState.slowStarted=true;
        window.setTimeout(()=>{
          window.__task286ReaderState.slowReleased=true;
          original.call(this,file);
        },1200);
        return;
      }
      original.call(this,file);
    };
  });
}

async function startSlowThenFastUpload(page,input,slowBytes,fastBytes){
  await input.setInputFiles({
    name:"SLOW_RED.jpg",
    mimeType:"image/jpeg",
    buffer:slowBytes
  });
  await page.waitForFunction(()=>window.__task286ReaderState?.slowStarted===true);
  await input.setInputFiles({
    name:"FAST_GREEN.jpg",
    mimeType:"image/jpeg",
    buffer:fastBytes
  });
  await expect(page.getByText("FAST_GREEN.jpg",{exact:true})).toBeVisible({timeout:30000});
  await page.waitForFunction(()=>window.__task286ReaderState?.slowReleased===true,{timeout:30000});
  await page.waitForTimeout(500);
  await expect(page.getByText("FAST_GREEN.jpg",{exact:true})).toBeVisible();
  await expect(page.getByText("SLOW_RED.jpg",{exact:true})).toHaveCount(0);
}

function observePrivacy(page,sourceBytes,imageBytes,markers){
  const secrets=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    ...imageBytes,
    ...imageBytes.map(bytes=>Buffer.from(bytes.toString("base64"),"utf8")),
    ...markers.map(marker=>Buffer.from(marker,"utf8"))
  ];
  const suspiciousWriteMethods=[];
  let writeRequestCount=0;
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret)))suspiciousWriteMethods.push(request.method());
  });
  return {suspiciousWriteMethods,getWriteRequestCount:()=>writeRequestCount};
}

function inspectPdf(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:256*1024
  });
}

const stampInspection=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==1",
  "page=doc[0]",
  "assert sys.argv[2] in page.get_text('text')",
  "images=[img for img in page.get_images(full=True) if img[2]==32 and img[3]==16]",
  "assert len(images)==1, f'Expected one 32x16 selected image, got {len(images)}'",
  "pix=fitz.Pixmap(doc.extract_image(images[0][0])['image'])",
  "r,g,b=pix.pixel(16,8)[:3]",
  "assert g>r+55 and g>b+55 and g>100, f'Latest green upload did not win: {(r,g,b)}'",
  "print('TASK286_LATEST_IMAGE_OK')"
].join("\n");

const signInspection=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==2",
  "assert sys.argv[2] in doc[0].get_text('text')",
  "assert sys.argv[3] in doc[1].get_text('text')",
  "assert len(doc[0].get_images(full=True))==0",
  "images=[img for img in doc[1].get_images(full=True) if img[2]==32 and img[3]==16]",
  "assert len(images)==1, f'Expected one signature image on page 2, got {len(images)}'",
  "pix=fitz.Pixmap(doc.extract_image(images[0][0])['image'])",
  "r,g,b=pix.pixel(16,8)[:3]",
  "assert g>r+55 and g>b+55 and g>100, f'Latest green signature did not win: {(r,g,b)}'",
  "print('TASK286_LATEST_SIGNATURE_OK')"
].join("\n");

test("Add Image Stamp keeps the latest completed upload when an older FileReader finishes later",async({page,browserName})=>{
  await installDelayedReader(page);
  const slowBytes=await syntheticJpeg(page,"#e00000");
  const fastBytes=await syntheticJpeg(page,"#00c800");
  const {bytes,markers}=await syntheticPdf(1,"STAMP");
  const privacy=observePrivacy(page,bytes,[slowBytes,fastBytes],markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK286_STAMP_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await startSlowThenFastUpload(page,page.locator('input[type="file"]').nth(1),slowBytes,fastBytes);

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,stampInspection,[markers[0]])).toContain("TASK286_LATEST_IMAGE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:286,case:"stamp-latest-upload-wins",browser:browserName,selected:"FAST_GREEN.jpg",olderUploadFinishedAfterNewer:true,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});

test("Sign PDF keeps the latest completed signature upload on the selected page",async({page,browserName})=>{
  await installDelayedReader(page);
  const slowBytes=await syntheticJpeg(page,"#e00000");
  const fastBytes=await syntheticJpeg(page,"#00c800");
  const {bytes,markers}=await syntheticPdf(2,"SIGN");
  const privacy=observePrivacy(page,bytes,[slowBytes,fastBytes],markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK286_SIGN_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await startSlowThenFastUpload(page,page.locator('input[type="file"]').last(),slowBytes,fastBytes);
  await page.getByLabel("Sign page").selectOption("2");

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,signInspection,[markers[0],markers[1]])).toContain("TASK286_LATEST_SIGNATURE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:286,case:"sign-latest-upload-wins",browser:browserName,selected:"FAST_GREEN.jpg",signaturePage:2,olderUploadFinishedAfterNewer:true,independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});

test("An invalid replacement upload cancels an older pending image selection",async({page,browserName})=>{
  await installDelayedReader(page);
  const slowBytes=await syntheticJpeg(page,"#e00000");
  const {bytes,markers}=await syntheticPdf(1,"INVALIDATE");
  const privacy=observePrivacy(page,bytes,[slowBytes],markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK286_INVALIDATE_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  const input=page.locator('input[type="file"]').nth(1);
  await input.setInputFiles({
    name:"SLOW_RED.jpg",mimeType:"image/jpeg",buffer:slowBytes
  });
  await page.waitForFunction(()=>window.__task286ReaderState?.slowStarted===true);
  await input.setInputFiles({
    name:"TASK286_NOT_AN_IMAGE.txt",mimeType:"text/plain",buffer:Buffer.from("synthetic invalid input")
  });
  await expect(page.getByText("Please choose a PNG, JPG, or JPEG image.",{exact:true})).toBeVisible();
  await page.waitForFunction(()=>window.__task286ReaderState?.slowReleased===true,{timeout:30000});
  await page.waitForTimeout(500);
  await expect(page.getByText("Please choose a PNG, JPG, or JPEG image.",{exact:true})).toBeVisible();
  await expect(page.getByAltText("Image placement preview")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add and Download PDF"})).toHaveCount(0);
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:286,case:"invalid-replacement-invalidates-pending-upload",browser:browserName,decodeOfOlderUploadFinishedAfterInvalidSelection:true,staleImageApplied:false,outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});
