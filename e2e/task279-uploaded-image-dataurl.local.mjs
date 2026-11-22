import {deflateSync} from "node:zlib";
import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc^=byte;
    for(let bit=0;bit<8;bit+=1){
      crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);
    }
  }
  return (crc^0xffffffff)>>>0;
}

function pngChunk(type,data){
  const typeBytes=Buffer.from(type,"ascii");
  const length=Buffer.alloc(4);
  length.writeUInt32BE(data.length,0);
  const checksum=Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes,data])),0);
  return Buffer.concat([length,typeBytes,data,checksum]);
}

function syntheticPng(width=32,height=16){
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);
  header.writeUInt32BE(height,4);
  header[8]=8;
  header[9]=2;
  header[10]=0;
  header[11]=0;
  header[12]=0;

  const raw=Buffer.alloc(height*(1+width*3));
  for(let y=0;y<height;y+=1){
    const rowStart=y*(1+width*3);
    raw[rowStart]=0;
    for(let x=0;x<width;x+=1){
      const offset=rowStart+1+x*3;
      raw[offset]=x<width/2?220:24;
      raw[offset+1]=y<height/2?40:160;
      raw[offset+2]=72;
    }
  }

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",header),
    pngChunk("IDAT",deflateSync(raw)),
    pngChunk("IEND",Buffer.alloc(0))
  ]);
}

async function syntheticPdf(pageCount,task){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK279_"+task+"_PAGE_"+String(index+1);
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

test("Add Image Stamp decodes an uploaded PNG data URL and embeds the original image",async({page,browserName})=>{
  test.setTimeout(180000);
  const {bytes,markers}=await syntheticPdf(1,"UPLOADED_STAMP");
  const imageBytes=syntheticPng();
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK279_SYNTHETIC_STAMP_SOURCE.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name:"TASK279_UPLOADED_STAMP.png",
    mimeType:"image/png",
    buffer:imageBytes
  });
  await expect(page.getByText("TASK279_UPLOADED_STAMP.png",{exact:true})).toBeVisible({timeout:30000});

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK279_SYNTHETIC_STAMP_SOURCE-image-stamp.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==1",
    "page=doc[0]",
    "assert sys.argv[2] in page.get_text('text'), 'Source marker missing'",
    "images=page.get_images(full=True)",
    "assert any(img[2]==32 and img[3]==16 for img in images), 'Uploaded PNG dimensions not preserved'",
    "rects=[]",
    "for img in images: rects.extend(page.get_image_rects(img[0]))",
    "assert rects and any(r.width>=10 and r.height>=4 for r in rects), 'Uploaded stamp image not visibly placed'",
    "assert all(r.intersects(page.rect) for r in rects), 'Stamp image outside page'",
    "assert not doc.is_repaired",
    "print('TASK279_UPLOADED_STAMP_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,[markers[0]]);
  expect(verified).toContain("TASK279_UPLOADED_STAMP_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:279,case:"add-image-stamp-uploaded-png",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceMarkerPreserved:true,
    uploadedPngEmbedded:true,pngDimensions:{width:32,height:16},
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF decodes an uploaded PNG data URL and places it only on the selected page",async({page,browserName})=>{
  test.setTimeout(180000);
  const {bytes,markers}=await syntheticPdf(2,"UPLOADED_SIGN");
  const imageBytes=syntheticPng();
  const privacy=observePrivacy(page,bytes,imageBytes,markers);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK279_SYNTHETIC_SIGN_SOURCE.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await page.locator('input[type="file"]').last().setInputFiles({
    name:"TASK279_UPLOADED_SIGNATURE.png",
    mimeType:"image/png",
    buffer:imageBytes
  });
  await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
  await expect(page.getByText("TASK279_UPLOADED_SIGNATURE.png",{exact:true})).toBeVisible({timeout:30000});
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect).toBeVisible({timeout:30000});
  await pageSelect.selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK279_SYNTHETIC_SIGN_SOURCE-signed.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,page in enumerate(doc,1):",
    "    assert sys.argv[i+1] in page.get_text('text'), 'Source marker missing'",
    "assert len(doc[0].get_images(full=True))==0, 'Uploaded signature appeared on unselected page'",
    "images=doc[1].get_images(full=True)",
    "assert any(img[2]==32 and img[3]==16 for img in images), 'Uploaded signature image dimensions not preserved'",
    "rects=[]",
    "for img in images: rects.extend(doc[1].get_image_rects(img[0]))",
    "assert rects and any(r.width>=10 and r.height>=4 for r in rects), 'Uploaded signature is not visibly placed'",
    "assert all(r.intersects(doc[1].rect) for r in rects), 'Signature outside selected page'",
    "assert not doc.is_repaired",
    "print('TASK279_UPLOADED_SIGNATURE_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,markers);
  expect(verified).toContain("TASK279_UPLOADED_SIGNATURE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:279,case:"sign-pdf-uploaded-png",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceMarkersPreserved:true,
    uploadedPngEmbeddedOnlyOnPage:2,pngDimensions:{width:32,height:16},
    independentReader:"PyMuPDF",outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
