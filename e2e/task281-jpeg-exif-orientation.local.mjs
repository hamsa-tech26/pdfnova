import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

function withExifOrientation(jpegBytes,orientation){
  if(![3,6,8].includes(orientation))throw new Error("Unsupported test EXIF orientation");
  const exif=Buffer.from([
    0x45,0x78,0x69,0x66,0x00,0x00,
    0x49,0x49,0x2a,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,
    0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,
    orientation,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00
  ]);
  const segmentLength=exif.length+2;
  const app1=Buffer.from([0xff,0xe1,(segmentLength>>8)&0xff,segmentLength&0xff]);
  return Buffer.concat([jpegBytes.subarray(0,2),app1,exif,jpegBytes.subarray(2)]);
}

async function syntheticExifJpeg(page,orientation){
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=32;
    canvas.height=16;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas 2D context unavailable");
    context.fillStyle="#e00000";
    context.fillRect(0,0,16,16);
    context.fillStyle="#00c800";
    context.fillRect(16,0,16,16);
    return canvas.toDataURL("image/jpeg",1);
  });
  const payload=dataUrl.split(",")[1];
  if(!payload)throw new Error("Synthetic JPEG payload missing");
  return withExifOrientation(Buffer.from(payload,"base64"),orientation);
}

async function syntheticPdf(pageCount,task){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK281_"+task+"_PAGE_"+String(index+1);
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
  return {suspiciousWriteMethods,getWriteRequestCount:()=>writeRequestCount};
}

function inspectPdfWithPyMuPDF(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024
  });
}

const orientationCheck = (marker) => [
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==1",
  "page=doc[0]",
  "assert sys.argv[2] in page.get_text('text'), 'Source marker missing'",
  "images=page.get_images(full=True)",
  "candidate=next((img for img in images if img[2]==16 and img[3]==32),None)",
  "assert candidate is not None, 'EXIF-rotated image dimensions were not normalized to 16x32'",
  "extracted=doc.extract_image(candidate[0])['image']",
  "assert b'Exif\x00\x00' not in extracted, 'EXIF orientation metadata remained in embedded image'",
  "pix=fitz.Pixmap(extracted)",
  "assert (pix.width,pix.height)==(16,32)",
  "def sample(x,y):",
  "    offset=(y*pix.width+x)*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "top=sample(8,4)",
  "bottom=sample(8,28)",
  "if sys.argv[3]=='red':",
  "    assert top[0]>top[1]+35 and top[0]>top[2]+35, f'Unexpected top pixel {top}'",
  "    assert bottom[1]>bottom[0]+35 and bottom[1]>bottom[2]+35, f'Unexpected bottom pixel {bottom}'",
  "else:",
  "    assert top[1]>top[0]+35 and top[1]>top[2]+35, f'Unexpected top pixel {top}'",
  "    assert bottom[0]>bottom[1]+35 and bottom[0]>bottom[2]+35, f'Unexpected bottom pixel {bottom}'",
  "rects=page.get_image_rects(candidate[0])",
  "assert rects and abs((rects[0].width/rects[0].height)-(16/32))<0.04, 'Placement aspect ratio does not match normalized orientation'",
  "assert not doc.is_repaired",
  "print('TASK281_EXIF_ORIENTATION_NORMALIZED_OK')"
].join("\n");

test("Add Image Stamp normalizes EXIF orientation 6 before embedding the uploaded JPEG",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticExifJpeg(page,6);
  const {bytes,markers}=await syntheticPdf(1,"STAMP_EXIF_6");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK281_EXIF_6_STAMP_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name:"TASK281_EXIF_6_UPLOADED.jpg",mimeType:"image/jpeg",buffer:imageBytes
  });
  await expect(page.getByText("TASK281_EXIF_6_UPLOADED.jpg",{exact:true})).toBeVisible({timeout:30000});
  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK281_EXIF_6_STAMP_SOURCE-image-stamp.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const verified=inspectPdfWithPyMuPDF(outputPath,orientationCheck(markers[0]),[markers[0],"red"]);
  expect(verified).toContain("TASK281_EXIF_ORIENTATION_NORMALIZED_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:281,case:"add-image-stamp-exif-6",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,normalizedDimensions:{width:16,height:32},
    exifOrientationMetadataRemoved:true,independentReader:"PyMuPDF",
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF normalizes EXIF orientation 8 and embeds the uploaded JPEG only on the selected page",async({page,browserName})=>{
  test.setTimeout(180000);
  const imageBytes=await syntheticExifJpeg(page,8);
  const {bytes,markers}=await syntheticPdf(2,"SIGN_EXIF_8");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK281_EXIF_8_SIGN_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await page.locator('input[type="file"]').last().setInputFiles({
    name:"TASK281_EXIF_8_UPLOADED.jpg",mimeType:"image/jpeg",buffer:imageBytes
  });
  await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
  await expect(page.getByText("TASK281_EXIF_8_UPLOADED.jpg",{exact:true})).toBeVisible({timeout:30000});
  await page.getByLabel("Sign page").selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});
  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK281_EXIF_8_SIGN_SOURCE-signed.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,page in enumerate(doc,1): assert sys.argv[i+1] in page.get_text('text'), 'Source marker missing'",
    "assert len(doc[0].get_images(full=True))==0, 'Signature appeared on unselected page'",
    "page=doc[1]",
    "images=page.get_images(full=True)",
    "candidate=next((img for img in images if img[2]==16 and img[3]==32),None)",
    "assert candidate is not None, 'EXIF-rotated signature dimensions were not normalized to 16x32'",
    "extracted=doc.extract_image(candidate[0])['image']",
    "assert b'Exif\x00\x00' not in extracted, 'EXIF orientation metadata remained in embedded signature'",
    "pix=fitz.Pixmap(extracted)",
    "assert (pix.width,pix.height)==(16,32)",
    "def sample(x,y):",
    "    offset=(y*pix.width+x)*pix.n",
    "    return tuple(pix.samples[offset:offset+3])",
    "top=sample(8,4)",
    "bottom=sample(8,28)",
    "assert top[1]>top[0]+35 and top[1]>top[2]+35, f'Unexpected top pixel {top}'",
    "assert bottom[0]>bottom[1]+35 and bottom[0]>bottom[2]+35, f'Unexpected bottom pixel {bottom}'",
    "rects=page.get_image_rects(candidate[0])",
    "assert rects and abs((rects[0].width/rects[0].height)-(16/32))<0.04, 'Placement aspect ratio does not match normalized orientation'",
    "assert not doc.is_repaired",
    "print('TASK281_EXIF_ORIENTATION_NORMALIZED_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,markers);
  expect(verified).toContain("TASK281_EXIF_ORIENTATION_NORMALIZED_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:281,case:"sign-pdf-exif-8",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,normalizedDimensions:{width:16,height:32},
    exifOrientationMetadataRemoved:true,signatureOnSelectedPageOnly:2,
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
