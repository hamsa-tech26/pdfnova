import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticTransparentPng(page){
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=32;
    canvas.height=16;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas 2D context unavailable");
    context.clearRect(0,0,32,16);
    context.fillStyle="#e00000";
    context.fillRect(0,0,16,16);
    return canvas.toDataURL("image/png");
  });
  const payload=dataUrl.split(",")[1];
  if(!payload)throw new Error("Synthetic transparent PNG payload missing");
  return Buffer.from(payload,"base64");
}

async function syntheticPdf(pageCount,task){
  const {PDFDocument,StandardFonts,rgb}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK282_"+task+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(0,0,1)});
    page.drawText(marker,{x:60,y:720,size:18,font,color:rgb(1,1,1)});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

function observePrivacy(page,sourceBytes,imageBytes,markers){
  const secrets=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    imageBytes,
    Buffer.from(imageBytes.toString("base64"),"utf8"),
    ...markers.map(marker=>Buffer.from(marker,"utf8"))
  ];
  const suspiciousWriteMethods=[];
  let writeRequestCount=0;
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret))){
      suspiciousWriteMethods.push(request.method());
    }
  });
  return {suspiciousWriteMethods,getWriteRequestCount:()=>writeRequestCount};
}

function inspectPdfWithPyMuPDF(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024
  });
}

const stampScript=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==1",
  "page=doc[0]",
  "assert sys.argv[2] in page.get_text('text'), 'Source marker missing'",
  "images=page.get_images(full=True)",
  "candidate=next((img for img in images if img[2]==32 and img[3]==16),None)",
  "assert candidate is not None, 'Uploaded PNG dimensions were not preserved'",
  "assert candidate[1]>0, 'PNG soft mask missing; transparency may have been flattened'",
  "rects=page.get_image_rects(candidate[0])",
  "assert rects, 'Image placement rectangle missing'",
  "pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)",
  "rect=rects[0]",
  "def sample(x,y):",
  "    px=int((x-pix.x)*2)",
  "    py=int((y-pix.y)*2)",
  "    offset=py*pix.stride+px*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "left=sample(rect.x0+rect.width*0.25,rect.y0+rect.height*0.5)",
  "right=sample(rect.x0+rect.width*0.75,rect.y0+rect.height*0.5)",
  "assert left[0]>left[1]+60 and left[0]>left[2]+60, f'Opaque red PNG region missing: {left}'",
  "assert right[2]>right[0]+60 and right[2]>right[1]+60, f'Transparent PNG region did not reveal blue PDF background: {right}'",
  "assert not doc.is_repaired",
  "print('TASK282_PNG_ALPHA_PRESERVED_OK')"
].join("\n");

test("Add Image Stamp preserves transparent PNG pixels in the downloaded PDF",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticTransparentPng(page);
  const {bytes,markers}=await syntheticPdf(1,"STAMP_ALPHA");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK282_TRANSPARENT_STAMP_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name:"TASK282_TRANSPARENT_STAMP.png",mimeType:"image/png",buffer:imageBytes
  });
  await expect(page.getByText("TASK282_TRANSPARENT_STAMP.png",{exact:true})).toBeVisible({timeout:30000});
  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK282_TRANSPARENT_STAMP_SOURCE-image-stamp.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const verified=inspectPdfWithPyMuPDF(outputPath,stampScript,[markers[0]]);
  expect(verified).toContain("TASK282_PNG_ALPHA_PRESERVED_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:282,case:"add-image-stamp-transparent-png",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,pngDimensions:{width:32,height:16},
    pdfSoftMaskPresent:true,transparentRegionShowsUnderlyingBluePage:true,
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF preserves transparent PNG pixels and limits the signature to selected page 2",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticTransparentPng(page);
  const {bytes,markers}=await syntheticPdf(2,"SIGN_ALPHA");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK282_TRANSPARENT_SIGN_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await page.locator('input[type="file"]').last().setInputFiles({
    name:"TASK282_TRANSPARENT_SIGNATURE.png",mimeType:"image/png",buffer:imageBytes
  });
  await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
  await expect(page.getByText("TASK282_TRANSPARENT_SIGNATURE.png",{exact:true})).toBeVisible({timeout:30000});
  await page.getByLabel("Sign page").selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});
  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK282_TRANSPARENT_SIGN_SOURCE-signed.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,page in enumerate(doc,1): assert sys.argv[i+1] in page.get_text('text'), 'Source marker missing'",
    "assert len(doc[0].get_images(full=True))==0, 'Signature image appeared on unselected page'",
    "page=doc[1]",
    "images=page.get_images(full=True)",
    "candidate=next((img for img in images if img[2]==32 and img[3]==16),None)",
    "assert candidate is not None, 'Uploaded signature PNG dimensions were not preserved'",
    "assert candidate[1]>0, 'PNG signature soft mask missing; transparency may have been flattened'",
    "rects=page.get_image_rects(candidate[0])",
    "assert rects, 'Signature placement rectangle missing'",
    "pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)",
    "rect=rects[0]",
    "def sample(x,y):",
    "    px=int((x-pix.x)*2)",
    "    py=int((y-pix.y)*2)",
    "    offset=py*pix.stride+px*pix.n",
    "    return tuple(pix.samples[offset:offset+3])",
    "left=sample(rect.x0+rect.width*0.25,rect.y0+rect.height*0.5)",
    "right=sample(rect.x0+rect.width*0.75,rect.y0+rect.height*0.5)",
    "assert left[0]>left[1]+60 and left[0]>left[2]+60, f'Opaque red signature region missing: {left}'",
    "assert right[2]>right[0]+60 and right[2]>right[1]+60, f'Transparent signature region did not reveal blue PDF background: {right}'",
    "assert not doc.is_repaired",
    "print('TASK282_PNG_ALPHA_PRESERVED_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,markers);
  expect(verified).toContain("TASK282_PNG_ALPHA_PRESERVED_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:282,case:"sign-pdf-transparent-png",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,pngDimensions:{width:32,height:16},
    pdfSoftMaskPresent:true,transparentRegionShowsUnderlyingBluePage:true,
    signatureOnSelectedPageOnly:2,independentReader:"PyMuPDF",
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
