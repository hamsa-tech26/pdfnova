import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {readFile} from "node:fs/promises";

function observePrivacy(page,sourceBytes,markers){
  const sourceBase64=Buffer.from(sourceBytes.toString("base64"),"utf8");
  const pdfHeader=Buffer.from("%PDF-","utf8");
  const markerBytes=markers.map(marker=>Buffer.from(marker,"utf8"));
  const suspiciousWriteMethods=[];
  let writeRequestCount=0;

  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(!body)return;
    if(
      body.includes(sourceBytes)||
      body.includes(sourceBase64)||
      body.includes(pdfHeader)||
      markerBytes.some(marker=>body.includes(marker))
    ){
      suspiciousWriteMethods.push(request.method());
    }
  });

  return {
    suspiciousWriteMethods,
    getWriteRequestCount:()=>writeRequestCount,
  };
}

async function syntheticPdf(pageCount,task){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK278_"+task+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:60,y:720,size:18,font});
    page.drawRectangle({
      x:72,y:220,width:468,height:260,
      color:index%2===0?rgb(0.12,0.36,0.68):rgb(0.18,0.52,0.34)
    });
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

const sofMarkers=new Set([
  0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,
  0xc9,0xca,0xcb,0xcd,0xce,0xcf
]);

function jpegDimensions(bytes){
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  expect(bytes.length).toBeGreaterThan(500);
  expect(bytes[bytes.length-2]).toBe(0xff);
  expect(bytes[bytes.length-1]).toBe(0xd9);
  let offset=2;
  while(offset+4<bytes.length){
    if(bytes[offset]!==0xff){offset+=1;continue;}
    while(bytes[offset]===0xff)offset+=1;
    const marker=bytes[offset];
    offset+=1;
    if(marker===0xd8||marker===0xd9||marker===0x01||
      (marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>bytes.length)break;
    const length=bytes.readUInt16BE(offset);
    if(length<2)throw new Error("Invalid JPEG segment length");
    if(sofMarkers.has(marker)){
      return {
        height:bytes.readUInt16BE(offset+3),
        width:bytes.readUInt16BE(offset+5)
      };
    }
    offset+=length;
  }
  throw new Error("JPEG Start Of Frame dimensions were not found");
}

function inspectPdfWithPyMuPDF(path,script,args=[]){
  return execFileSync("python",["-c",script,path,...args],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024
  });
}

test("PDF-to-JPG individual page download returns a valid local JPEG",async({page,browserName})=>{
  test.setTimeout(180000);
  const {bytes,markers}=await syntheticPdf(2,"JPG_SINGLE");
  const privacy=observePrivacy(page,bytes,markers);
  await page.goto("/pdf-to-jpg",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK278_SYNTHETIC_JPG.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await expect(page.getByText("PDF Pages (2)",{exact:true})).toBeVisible({timeout:45000});

  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Download JPG",exact:true}).first().click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-page-1.jpg");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const output=await readFile(outputPath);
  const dimensions=jpegDimensions(output);
  expect(dimensions.width).toBe(1224);
  expect(dimensions.height).toBe(1584);
  expect(output.includes(bytes)).toBe(false);
  expect(output.includes(Buffer.from("%PDF-","utf8"))).toBe(false);
  expect(markers.some(marker=>output.includes(Buffer.from(marker,"utf8")))).toBe(false);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:278,case:"pdf-to-jpg-individual-download",browser:browserName,
    source:"synthetic-only",jpeg:true,dimensions,
    sourcePdfBytesInOutput:false,sourceMarkersInOutput:false,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Add Image Stamp embeds its generated canvas PNG in the downloaded PDF",async({page,browserName})=>{
  test.setTimeout(180000);
  const {bytes,markers}=await syntheticPdf(1,"STAMP");
  const privacy=observePrivacy(page,bytes,markers);
  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK278_SYNTHETIC_STAMP.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeVisible({timeout:30000});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK278_SYNTHETIC_STAMP-image-stamp.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==1",
    "page=doc[0]",
    "assert sys.argv[2] in page.get_text('text'), 'Source page marker missing'",
    "images=page.get_images(full=True)",
    "assert len(images)>=1, 'Generated stamp image missing'",
    "rects=[]",
    "for img in images: rects.extend(page.get_image_rects(img[0]))",
    "assert rects and any(r.width>=10 and r.height>=4 for r in rects), 'Stamp image is not visibly placed'",
    "assert all(r.intersects(page.rect) for r in rects), 'Stamp image is outside the page'",
    "assert not doc.is_repaired, 'Downloaded PDF was repaired'",
    "print('TASK278_STAMP_OUTPUT_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,[markers[0]]);
  expect(verified).toContain("TASK278_STAMP_OUTPUT_OK");
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:278,case:"add-image-stamp",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceTextPreserved:true,
    generatedCanvasPngEmbedded:true,independentReader:"PyMuPDF",
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF embeds the typed signature image only on the selected page",async({page,browserName})=>{
  test.setTimeout(180000);
  const {bytes,markers}=await syntheticPdf(2,"SIGN");
  const privacy=observePrivacy(page,bytes,markers);
  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK278_SYNTHETIC_SIGN.pdf",
    mimeType:"application/pdf",
    buffer:bytes
  });
  await page.getByRole("button",{name:"Type",exact:true}).click();
  const typed=page.getByPlaceholder("Type your name");
  await expect(typed).toBeVisible({timeout:15000});
  await typed.fill("QA PERSON 278");
  await expect(page.getByAltText("Typed signature preview")).toBeVisible({timeout:30000});
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect).toBeVisible({timeout:30000});
  await pageSelect.selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});

  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK278_SYNTHETIC_SIGN-signed.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const script=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,page in enumerate(doc,1):",
    "    assert sys.argv[i+1] in page.get_text('text'), 'Source page marker missing'",
    "assert len(doc[0].get_images(full=True))==0, 'Signature appeared on unselected page'",
    "images=doc[1].get_images(full=True)",
    "assert len(images)>=1, 'Typed signature image missing on selected page'",
    "rects=[]",
    "for img in images: rects.extend(doc[1].get_image_rects(img[0]))",
    "assert rects and any(r.width>=15 and r.height>=4 for r in rects), 'Signature image is zero-sized'",
    "assert all(r.intersects(doc[1].rect) for r in rects), 'Signature image is outside page'",
    "assert not doc.is_repaired, 'Downloaded PDF was repaired'",
    "print('TASK278_SIGN_OUTPUT_OK')"
  ].join("\n");
  const verified=inspectPdfWithPyMuPDF(outputPath,script,markers);
  expect(verified).toContain("TASK278_SIGN_OUTPUT_OK");
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:278,case:"sign-pdf-typed-signature",browser:browserName,
    source:"synthetic-only",downloadedPdf:true,sourceTextPreserved:true,
    signatureEmbeddedOnSelectedPageOnly:2,independentReader:"PyMuPDF",
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousWriteMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
