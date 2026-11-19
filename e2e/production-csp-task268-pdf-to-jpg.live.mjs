import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";

const policy=[
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

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

async function syntheticPdf(pageCount){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.HelveticaBold);
  for(let index=0;index<pageCount;index+=1){
    const page=pdf.addPage([612,792]);
    page.drawText("KUKUREKU_TASK268_PAGE_"+String(index+1),{
      x:72,y:700,size:22,font
    });
    page.drawRectangle({
      x:72,y:220,width:468,height:260,
      color:index%2===0?rgb(0.12,0.36,0.68):rgb(0.18,0.52,0.34)
    });
    page.drawText("SYNTHETIC IMAGE EXPORT ONLY",{
      x:92,y:340,size:18,font,color:rgb(1,1,1)
    });
  }
  return Buffer.from(await pdf.save());
}

function observePrivacy(page,sourceBytes){
  const sourceBase64=Buffer.from(sourceBytes.toString("base64"),"utf8");
  const pdfHeader=Buffer.from("%PDF-","utf8");
  const suspiciousWriteMethods=[];
  const resourceCounts=new Map();
  let writeRequestCount=0;

  page.on("request",request=>{
    const resourceType=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(resourceType)){
      let originCategory="unknown";
      try{
        originCategory=new URL(request.url()).origin==="https://kukureku.com"
          ?"same-origin":"external";
      }catch{}
      const key=resourceType+"|"+request.method()+"|"+originCategory;
      resourceCounts.set(key,(resourceCounts.get(key)||0)+1);
    }
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(!body)return;
    if(body.includes(sourceBytes)||body.includes(sourceBase64)||body.includes(pdfHeader)){
      suspiciousWriteMethods.push(request.method());
    }
  });

  page.addInitScript(()=>{
    window.__kukurekuTask268CspEvents=[];
    document.addEventListener("securitypolicyviolation",event=>{
      let destinationCategory="unknown";
      if(["inline","eval","data","blob"].includes(event.blockedURI)){
        destinationCategory=event.blockedURI;
      }else{
        try{
          const destination=new URL(event.blockedURI,window.location.href);
          destinationCategory=destination.origin===window.location.origin
            ?"same-origin":"external";
        }catch{}
      }
      let sourceCategory="unknown";
      try{
        const source=new URL(event.sourceFile,window.location.href);
        if(source.protocol==="blob:")sourceCategory="blob-worker-or-script";
        else if(source.origin===window.location.origin){
          if(source.pathname.startsWith("/_next/static/"))sourceCategory="next-static";
          else if(source.pathname===window.location.pathname)sourceCategory="page-inline";
          else if(source.pathname.startsWith("/_next/"))sourceCategory="next-runtime";
          else sourceCategory="same-origin-other";
        }else sourceCategory="external";
      }catch{}
      window.__kukurekuTask268CspEvents.push({
        directive:event.effectiveDirective,
        destinationCategory,
        disposition:event.disposition,
        sourceCategory,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });

  return {suspiciousWriteMethods,resourceCounts,getWriteRequestCount:()=>writeRequestCount};
}

async function openPdfToJpgWithReportOnly(page){
  await page.route("https://kukureku.com/pdf-to-jpg",async route=>{
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
  });
  await page.goto("/pdf-to-jpg",{waitUntil:"networkidle"});
}

async function uploadSyntheticPdf(page,sourceBytes,pageCount){
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK268_"+String(pageCount)+"_PAGES.pdf",
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  await expect(page.getByText("PDF Pages ("+String(pageCount)+")",{exact:true}))
    .toBeVisible({timeout:45000});
}

test("Task 268 exports independently inspectable JPG pages and observes direct PDF egress under report-only CSP",async({page,browserName})=>{
  test.setTimeout(180000);
  const sourceBytes=await syntheticPdf(2);
  const privacy=observePrivacy(page,sourceBytes);
  await openPdfToJpgWithReportOnly(page);
  await uploadSyntheticPdf(page,sourceBytes,2);

  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Download All as ZIP"}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-all-jpg-pages.zip");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const zipBytes=await readFile(outputPath);
  expect(zipBytes.includes(sourceBytes)).toBe(false);
  expect(zipBytes.includes(Buffer.from("%PDF-","utf8"))).toBe(false);
  expect(zipBytes.includes(Buffer.from(sourceBytes.toString("base64"),"utf8"))).toBe(false);
  const archive=await JSZip.loadAsync(zipBytes);
  const names=Object.keys(archive.files).filter(name=>!archive.files[name].dir).sort();
  expect(names).toEqual(["kukureku-page-1.jpg","kukureku-page-2.jpg"]);

  const dimensions=[];
  for(const name of names){
    const entry=archive.file(name);
    expect(entry).toBeTruthy();
    const bytes=await entry.async("nodebuffer");
    const size=jpegDimensions(bytes);
    expect(size.width).toBeGreaterThan(500);
    expect(size.height).toBeGreaterThan(500);
    expect(size.width).toBeLessThanOrEqual(3200);
    expect(size.height).toBeLessThanOrEqual(3200);
    expect(Math.abs(size.width/size.height-612/792)).toBeLessThan(0.03);
    dimensions.push(size);
  }

  expect(privacy.suspiciousWriteMethods).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask268CspEvents||[]);
  const eventCounts=new Map();
  for(const item of events){
    const key=item.directive+"|"+item.destinationCategory+"|"+item.disposition+
      "|"+item.sourceCategory+"|line:"+item.sourceLine;
    eventCounts.set(key,(eventCounts.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:268,
    result:"PASSIVE_PDF_TO_JPG_ZIP_OBSERVATION",
    browser:browserName,
    policyMode:"report-only",
    route:"/pdf-to-jpg",
    syntheticPdf:true,
    customerDocumentCount:0,
    downloadedZipVerified:true,
    jpgEntries:names.length,
    jpegMarkersAndDimensionsVerified:true,
    dimensions,
    originalPdfBytesInArchive:false,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    originalPdfBytesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:[...eventCounts].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Two synthetic pages and direct source-byte/header/base64 checks only; not transformed/encrypted egress, all tools, real customer PDFs, physical iPhone or CSP enforcement"
  }));
});

test("Task 268 cancellation emits no partial JPG ZIP and restores export controls",async({page,browserName})=>{
  test.setTimeout(180000);
  const sourceBytes=await syntheticPdf(16);
  const privacy=observePrivacy(page,sourceBytes);
  let downloadCount=0;
  page.on("download",()=>{downloadCount+=1;});
  await openPdfToJpgWithReportOnly(page);
  await uploadSyntheticPdf(page,sourceBytes,16);

  await page.getByRole("button",{name:"Download All as ZIP"}).click();
  const cancel=page.getByRole("button",{name:"Cancel ZIP export"});
  await expect(cancel).toBeVisible({timeout:15000});
  await expect(page.getByText(/Rendering JPG [0-9]+ of 16/)).toBeVisible({timeout:15000});
  await cancel.click();

  await expect(page.getByText("JPG export cancelled. No partial ZIP was downloaded.",{exact:true}))
    .toBeVisible({timeout:30000});
  await expect(page.getByRole("button",{name:"Download All as ZIP"}))
    .toBeEnabled({timeout:30000});
  await expect(cancel).not.toBeVisible();
  await page.waitForTimeout(750);
  expect(downloadCount).toBe(0);
  expect(privacy.suspiciousWriteMethods).toEqual([]);

  console.log(JSON.stringify({
    task:268,
    result:"PASSIVE_PDF_TO_JPG_CANCEL_NO_PARTIAL_DOWNLOAD",
    browser:browserName,
    policyMode:"report-only",
    route:"/pdf-to-jpg",
    syntheticPdf:true,
    sourcePages:16,
    cancellationAcknowledged:true,
    partialDownloadCount:downloadCount,
    exportControlsRestored:true,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    originalPdfBytesInWriteRequests:0,
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Synthetic cancellation timing only; not a performance benchmark or real-document qualification"
  }));
});
