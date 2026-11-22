import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

async function syntheticJpeg(page){
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=32;
    canvas.height=16;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas 2D context unavailable");
    context.fillStyle="#d82a48";
    context.fillRect(0,0,16,16);
    context.fillStyle="#18a078";
    context.fillRect(16,0,16,16);
    context.fillStyle="#f1c40f";
    context.fillRect(0,8,32,8);
    return canvas.toDataURL("image/jpeg",0.92);
  });
  const payload=dataUrl.split(",")[1];
  if(!payload)throw new Error("Synthetic JPEG data URL payload missing");
  return Buffer.from(payload,"base64");
}

async function syntheticPdf(pageCount,task){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK280_"+task+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:60,y:720,size:18,font});
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
  return {
    suspiciousWriteMethods,
    getWriteRequestCount:()=>writeRequestCount
  };
}

function inspectPdfWithPyMuPDF(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024
  });
}

test("Add Image Stamp decodes an uploaded JPEG data URL and embeds the original image",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticJpeg(page);
  const {bytes,markers}=await syntheticPdf(1,"UPLOADED_STAMP");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK280_SYNTHETIC_STAMP_SOURCE.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name:"TASK280_UPLOADED_STAMP.jpg",
    mimeType:"image/jpeg",
    buffer:imageBytes
  });
  await expect(page.getByText("TASK280_UPLOADED_STAMP.jpg",{exact:true})).toBeVisible({timeout:30000});

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK280_SYNTHETIC_STAMP_SOURCE-image-stamp.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==1",
    "page=doc[0]",
    "assert sys.argv[2] in page.get_text('text'), 'Source marker missing'",
    "images=page.get_images(full=True)",
    "assert any(img[2]==32 and img[3]==16 for img in images), 'Uploaded JPEG dimensions not preserved'",
    "rects=[]",
    "for img in images: rects.extend(page.get_image_rects(img[0]))",
    "assert rects and any(r.width>=10 and r.height>=4 for r in rects), 'Uploaded JPEG not visibly placed'",
    "assert all(r.intersects(page.rect) for r in rects)",
    "assert not doc.is_repaired",
    "print('TASK280_UPLOADED_JPEG_STAMP_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,[markers[0]]);
  expect(verified).toContain("TASK280_UPLOADED_JPEG_STAMP_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:280,case:"add-image-stamp-uploaded-jpeg",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceMarkerPreserved:true,
    uploadedJpegEmbedded:true,jpegDimensions:{width:32,height:16},
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF decodes an uploaded JPEG data URL and places it only on the selected page",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticJpeg(page);
  const {bytes,markers}=await syntheticPdf(2,"UPLOADED_SIGN");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK280_SYNTHETIC_SIGN_SOURCE.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await page.locator('input[type="file"]').last().setInputFiles({
    name:"TASK280_UPLOADED_SIGNATURE.jpg",
    mimeType:"image/jpeg",
    buffer:imageBytes
  });
  await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
  await expect(page.getByText("TASK280_UPLOADED_SIGNATURE.jpg",{exact:true})).toBeVisible({timeout:30000});
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect).toBeVisible({timeout:30000});
  await pageSelect.selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK280_SYNTHETIC_SIGN_SOURCE-signed.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,page in enumerate(doc,1):",
    "    assert sys.argv[i+1] in page.get_text('text'), 'Source marker missing'",
    "assert len(doc[0].get_images(full=True))==0, 'Uploaded JPEG signature appeared on unselected page'",
    "images=doc[1].get_images(full=True)",
    "assert any(img[2]==32 and img[3]==16 for img in images), 'Uploaded JPEG dimensions not preserved'",
    "rects=[]",
    "for img in images: rects.extend(doc[1].get_image_rects(img[0]))",
    "assert rects and any(r.width>=10 and r.height>=4 for r in rects), 'Uploaded JPEG signature not visibly placed'",
    "assert all(r.intersects(doc[1].rect) for r in rects)",
    "assert not doc.is_repaired",
    "print('TASK280_UPLOADED_JPEG_SIGNATURE_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,markers);
  expect(verified).toContain("TASK280_UPLOADED_JPEG_SIGNATURE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:280,case:"sign-pdf-uploaded-jpeg",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceMarkersPreserved:true,
    uploadedJpegEmbeddedOnlyOnPage:2,jpegDimensions:{width:32,height:16},
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
