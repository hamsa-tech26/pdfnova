import {test,expect} from "@playwright/test";

function oversizedPngHeader(width=5000,height=4000){
  const bytes=Buffer.alloc(24);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(bytes,0);
  bytes.writeUInt32BE(13,8);
  Buffer.from("IHDR","ascii").copy(bytes,12);
  bytes.writeUInt32BE(width,16);
  bytes.writeUInt32BE(height,20);
  return bytes;
}

function oversizedJpegHeader(width=5000,height=4000){
  return Buffer.from([
    0xff,0xd8,
    0xff,0xe1,0x00,0x04,0x45,0x78,
    0xff,0xc0,0x00,0x11,0x08,
    (height>>8)&0xff,height&0xff,
    (width>>8)&0xff,width&0xff,
    0x03,
    0x01,0x11,0x00,
    0x02,0x11,0x00,
    0x03,0x11,0x00,
    0xff,0xd9
  ]);
}

async function syntheticPdf(){
  const {PDFDocument,StandardFonts}=await import("pdf-lib");
  const pdf=await PDFDocument.create();
  const page=pdf.addPage([612,792]);
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("KUKUREKU_TASK284_SYNTHETIC_SOURCE",{x:40,y:720,size:16,font});
  return Buffer.from(await pdf.save());
}

async function observeDecodeAttempts(page){
  await page.evaluate(()=>{
    window.__task284ImageDecodeAttempts=0;
    const originalBitmap=window.createImageBitmap?.bind(window);
    if(originalBitmap){
      Object.defineProperty(window,"createImageBitmap",{
        configurable:true,
        writable:true,
        value:(...args)=>{
          window.__task284ImageDecodeAttempts+=1;
          return originalBitmap(...args);
        }
      });
    }
    const OriginalImage=window.Image;
    window.Image=new Proxy(OriginalImage,{
      construct(target,args,newTarget){
        window.__task284ImageDecodeAttempts+=1;
        return Reflect.construct(target,args,newTarget);
      }
    });
  });
}

async function decodeAttempts(page){
  return page.evaluate(()=>window.__task284ImageDecodeAttempts);
}

function observeWrites(page,sourceBytes,imageBytes){
  const suspiciousMethods=[];
  let writeRequestCount=0;
  const secrets=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    Buffer.from("%PDF-","utf8"),
    Buffer.from("KUKUREKU_TASK284_SYNTHETIC_SOURCE","utf8"),
    imageBytes,
    Buffer.from(imageBytes.toString("base64"),"utf8")
  ];
  page.on("request",request=>{
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&secrets.some(secret=>body.includes(secret)))suspiciousMethods.push(request.method());
  });
  return {suspiciousMethods,getWriteRequestCount:()=>writeRequestCount};
}

test("Add Image Stamp rejects an oversized PNG before browser image decoding",async({page,browserName})=>{
  const sourceBytes=await syntheticPdf();
  const imageBytes=oversizedPngHeader();
  const privacy=observeWrites(page,sourceBytes,imageBytes);

  await page.goto("/add-image-stamp-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK284_SOURCE.pdf",mimeType:"application/pdf",buffer:sourceBytes
  });
  await page.getByRole("button",{name:"Upload image",exact:true}).click();
  await observeDecodeAttempts(page);
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name:"TASK284_OVERSIZED.png",mimeType:"image/png",buffer:imageBytes
  });

  await expect(page.locator("#main-content").getByText(
    "This image is too large to process safely. Please use an image up to 16 megapixels and 8,192 pixels per side.",
    {exact:true}
  )).toBeVisible({timeout:30000});
  expect(await decodeAttempts(page)).toBe(0);
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousMethods).toEqual([]);

  console.log(JSON.stringify({
    task:284,case:"add-image-stamp-oversized-png",browser:browserName,
    source:"synthetic-only",rejectedBeforeDecode:true,imageDecodeAttempts:0,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});

test("Sign PDF rejects an oversized JPEG before browser image decoding",async({page,browserName})=>{
  const sourceBytes=await syntheticPdf();
  const imageBytes=oversizedJpegHeader();
  const privacy=observeWrites(page,sourceBytes,imageBytes);

  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK284_SIGN_SOURCE.pdf",mimeType:"application/pdf",buffer:sourceBytes
  });
  await page.getByRole("button",{name:"Upload",exact:true}).click();
  await observeDecodeAttempts(page);
  await page.locator('input[type="file"]').last().setInputFiles({
    name:"TASK284_OVERSIZED.jpg",mimeType:"image/jpeg",buffer:imageBytes
  });

  await expect(page.locator("#main-content").getByText(
    "This image is too large to process safely. Please use an image up to 16 megapixels and 8,192 pixels per side.",
    {exact:true}
  )).toBeVisible({timeout:30000});
  expect(await decodeAttempts(page)).toBe(0);
  expect(privacy.getWriteRequestCount()).toBe(0);
  expect(privacy.suspiciousMethods).toEqual([]);

  console.log(JSON.stringify({
    task:284,case:"sign-pdf-oversized-jpeg",browser:browserName,
    source:"synthetic-only",rejectedBeforeDecode:true,imageDecodeAttempts:0,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    suspiciousWriteMethods:privacy.suspiciousMethods,
    rawUrlsLogged:false,requestBodiesLogged:false,documentBytesLogged:false
  }));
});
