import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";

function withExifOrientation(jpegBytes,orientation){
  const exif=Buffer.from([
    0x45,0x78,0x69,0x66,0x00,0x00,
    0x49,0x49,0x2a,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,
    0x12,0x01,0x03,0x00,0x01,0x00,0x00,0x00,
    orientation,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00
  ]);
  const length=exif.length+2;
  const app1=Buffer.from([0xff,0xe1,(length>>8)&0xff,length&0xff]);
  return Buffer.concat([jpegBytes.subarray(0,2),app1,exif,jpegBytes.subarray(2)]);
}

async function syntheticExifJpeg(page,orientation){
  const dataUrl=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");
    canvas.width=64;canvas.height=32;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas unavailable");
    context.fillStyle="#e00000";context.fillRect(0,0,32,16);
    context.fillStyle="#00c800";context.fillRect(32,0,32,16);
    context.fillStyle="#0000e0";context.fillRect(0,16,32,16);
    context.fillStyle="#e0d000";context.fillRect(32,16,32,16);
    return canvas.toDataURL("image/jpeg",1);
  });
  return withExifOrientation(Buffer.from(dataUrl.split(",")[1],"base64"),orientation);
}

async function syntheticPdf(pageCount,consumer){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  const markers=[];
  for(let index=0;index<pageCount;index+=1){
    const marker="KUKUREKU_TASK285_"+consumer+"_PAGE_"+String(index+1);
    markers.push(marker);
    const page=pdf.addPage([612,792]);
    page.drawText(marker,{x:40,y:720,size:14,font});
  }
  return {bytes:Buffer.from(await pdf.save()),markers};
}

function malformedPngHeader(){
  const bytes=Buffer.alloc(24);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(bytes,0);
  bytes.writeUInt32BE(13,8);
  Buffer.from("IHDR","ascii").copy(bytes,12);
  bytes.writeUInt32BE(64,16);
  bytes.writeUInt32BE(32,20);
  return bytes;
}

async function installImageFallbackProbe(page){
  await page.evaluate(()=>{
    window.createImageBitmap=undefined;
    window.__task285ImageFallbackCalls=0;
    const OriginalImage=window.Image;
    window.Image=new Proxy(OriginalImage,{
      construct(target,args,newTarget){
        window.__task285ImageFallbackCalls+=1;
        return Reflect.construct(target,args,newTarget);
      }
    });
    const originalCreate=URL.createObjectURL.bind(URL);
    const originalRevoke=URL.revokeObjectURL.bind(URL);
    const activeImageUrls=new Set();
    window.__task285ObjectUrlMetrics={created:0,revoked:0,active:0};
    URL.createObjectURL=(blob)=>{
      const url=originalCreate(blob);
      if(blob instanceof Blob && blob.type.startsWith("image/")){
        activeImageUrls.add(url);
        window.__task285ObjectUrlMetrics.created+=1;
        window.__task285ObjectUrlMetrics.active=activeImageUrls.size;
      }
      return url;
    };
    URL.revokeObjectURL=(url)=>{
      if(activeImageUrls.has(url)){
        activeImageUrls.delete(url);
        window.__task285ObjectUrlMetrics.revoked+=1;
        window.__task285ObjectUrlMetrics.active=activeImageUrls.size;
      }
      return originalRevoke(url);
    };
  });
}

async function fallbackMetrics(page){
  return page.evaluate(()=>({
    imageFallbackCalls:window.__task285ImageFallbackCalls,
    objectUrls:{...window.__task285ObjectUrlMetrics},
    createImageBitmapAvailable:typeof window.createImageBitmap==="function"
  }));
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
  "width,height=32,64",
  "expected=('blue','red','yellow','green')",
  "candidate=next((img for img in page.get_images(full=True) if img[2]==width and img[3]==height),None)",
  "assert candidate is not None, 'Fallback did not apply EXIF orientation'",
  "extracted=doc.extract_image(candidate[0])['image']",
  "assert b'Exif'+bytes([0,0]) not in extracted",
  "pix=fitz.Pixmap(extracted)",
  "points=[(4,8),(28,8),(4,56),(28,56)]",
  "def sample(x,y):",
  "    offset=(y*pix.width+x)*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "def matches(rgb,name):",
  "    r,g,b=rgb",
  "    if name=='red': return r>135 and r>g+45 and r>b+45",
  "    if name=='green': return g>105 and g>r+40 and g>b+40",
  "    if name=='blue': return b>105 and b>r+40 and b>g+40",
  "    if name=='yellow': return r>125 and g>125 and b<115",
  "    return False",
  "for index,(point,name) in enumerate(zip(points,expected)): assert matches(sample(*point),name), f'Corner {index} expected {name}'",
  "assert not doc.is_repaired",
  "print('TASK285_FALLBACK_IMAGE_OK')"
].join("\n");

const signInspection=[
  "import sys,fitz",
  "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
  "assert len(doc)==2",
  "assert sys.argv[2] in doc[0].get_text('text')",
  "assert sys.argv[3] in doc[1].get_text('text')",
  "assert len(doc[0].get_images(full=True))==0",
  "page=doc[1]",
  "width,height=32,64",
  "expected=('green','yellow','red','blue')",
  "candidate=next((img for img in page.get_images(full=True) if img[2]==width and img[3]==height),None)",
  "assert candidate is not None, 'Fallback did not apply EXIF orientation'",
  "extracted=doc.extract_image(candidate[0])['image']",
  "assert b'Exif'+bytes([0,0]) not in extracted",
  "pix=fitz.Pixmap(extracted)",
  "points=[(4,8),(28,8),(4,56),(28,56)]",
  "def sample(x,y):",
  "    offset=(y*pix.width+x)*pix.n",
  "    return tuple(pix.samples[offset:offset+3])",
  "def matches(rgb,name):",
  "    r,g,b=rgb",
  "    if name=='red': return r>135 and r>g+45 and r>b+45",
  "    if name=='green': return g>105 and g>r+40 and g>b+40",
  "    if name=='blue': return b>105 and b>r+40 and b>g+40",
  "    if name=='yellow': return r>125 and g>125 and b<115",
  "    return False",
  "for index,(point,name) in enumerate(zip(points,expected)): assert matches(sample(*point),name), f'Corner {index} expected {name}'",
  "assert not doc.is_repaired",
  "print('TASK285_FALLBACK_IMAGE_OK')"
].join("\n");

test("Add Image Stamp uses the Image fallback, normalizes EXIF, and revokes its object URL",async({page,browserName})=>{
  const imageBytes=await syntheticExifJpeg(page,6);
  const {bytes,markers}=await syntheticPdf(1,"STAMP");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);
  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({name:"TASK285_STAMP_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes});
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await installImageFallbackProbe(page);
  await page.locator('input[type="file"]').nth(1).setInputFiles({name:"TASK285_FALLBACK_EXIF6.jpg",mimeType:"image/jpeg",buffer:imageBytes});
  await expect(page.getByText("TASK285_FALLBACK_EXIF6.jpg",{exact:true})).toBeVisible({timeout:30000});
  const metrics=await fallbackMetrics(page);
  expect(metrics.createImageBitmapAvailable).toBe(false);
  expect(metrics.imageFallbackCalls).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.created).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.revoked).toBe(metrics.objectUrls.created);
  expect(metrics.objectUrls.active).toBe(0);

  const action=page.getByRole("button",{name:"Add and Download PDF"});
  await expect(action).toBeEnabled({timeout:45000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,stampInspection,[markers[0]])).toContain("TASK285_FALLBACK_IMAGE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:285,case:"add-image-stamp-image-fallback",browser:browserName,orientation:6,independentReader:"PyMuPDF",fallbackCalls:metrics.imageFallbackCalls,objectUrls:metrics.objectUrls,outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});

test("Sign PDF uses the Image fallback and keeps the normalized signature on page 2 only",async({page,browserName})=>{
  const imageBytes=await syntheticExifJpeg(page,8);
  const {bytes,markers}=await syntheticPdf(2,"SIGN");
  const privacy=observePrivacy(page,bytes,imageBytes,markers);
  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({name:"TASK285_SIGN_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes});
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await installImageFallbackProbe(page);
  await page.locator('input[type="file"]').last().setInputFiles({name:"TASK285_FALLBACK_EXIF8.jpg",mimeType:"image/jpeg",buffer:imageBytes});
  await expect(page.getByAltText("Uploaded signature preview")).toBeVisible({timeout:30000});
  await expect(page.getByText("TASK285_FALLBACK_EXIF8.jpg",{exact:true})).toBeVisible({timeout:30000});
  const metrics=await fallbackMetrics(page);
  expect(metrics.createImageBitmapAvailable).toBe(false);
  expect(metrics.imageFallbackCalls).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.created).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.revoked).toBe(metrics.objectUrls.created);
  expect(metrics.objectUrls.active).toBe(0);
  await page.getByLabel("Sign page").selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({timeout:30000});
  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  expect(inspectPdf(outputPath,signInspection,[markers[0],markers[1]])).toContain("TASK285_FALLBACK_IMAGE_OK");
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:285,case:"sign-pdf-image-fallback",browser:browserName,orientation:8,signaturePage:2,independentReader:"PyMuPDF",fallbackCalls:metrics.imageFallbackCalls,objectUrls:metrics.objectUrls,outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});

test("Image fallback revokes its object URL when a small malformed PNG fails to decode",async({page,browserName})=>{
  const {bytes,markers}=await syntheticPdf(1,"MALFORMED");
  const imageBytes=malformedPngHeader();
  const privacy=observePrivacy(page,bytes,imageBytes,markers);
  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({name:"TASK285_MALFORMED_SOURCE.pdf",mimeType:"application/pdf",buffer:bytes});
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await installImageFallbackProbe(page);
  await page.locator('input[type="file"]').nth(1).setInputFiles({name:"TASK285_MALFORMED.png",mimeType:"image/png",buffer:imageBytes});
  await expect(page.locator("#main-content").getByText("Unable to decode the uploaded image.",{exact:true})).toBeVisible({timeout:30000});
  const metrics=await fallbackMetrics(page);
  expect(metrics.createImageBitmapAvailable).toBe(false);
  expect(metrics.imageFallbackCalls).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.created).toBeGreaterThanOrEqual(1);
  expect(metrics.objectUrls.revoked).toBe(metrics.objectUrls.created);
  expect(metrics.objectUrls.active).toBe(0);
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  console.log(JSON.stringify({task:285,case:"malformed-image-fallback-cleanup",browser:browserName,fallbackCalls:metrics.imageFallbackCalls,objectUrls:metrics.objectUrls,decodeErrorShown:true,outboundWriteRequestCount:privacy.getWriteRequestCount(),suspiciousWriteMethods:privacy.suspiciousWriteMethods,rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false}));
});
