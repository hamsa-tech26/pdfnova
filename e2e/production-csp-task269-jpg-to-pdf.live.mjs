import {test,expect} from "@playwright/test";
import {PDFDocument} from "pdf-lib";
import {readFile} from "node:fs/promises";

const origin="https://kukureku.com";
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

async function canvasImage(page,{name,width,height,mimeType,label,quality=0.92}){
  const dataUrl=await page.evaluate(({width,height,mimeType,label,quality})=>{
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas 2D context is unavailable");
    context.fillStyle="#f4f7fb";
    context.fillRect(0,0,width,height);
    context.fillStyle="#164e86";
    context.fillRect(0,0,width,Math.max(18,Math.round(height*0.16)));
    context.fillStyle="#ffffff";
    context.font="bold 12px sans-serif";
    context.fillText(label,8,Math.min(height-8,Math.max(14,Math.round(height*0.1))));
    context.fillStyle="#16a36a";
    context.fillRect(Math.round(width*0.18),Math.round(height*0.35),
      Math.max(8,Math.round(width*0.55)),Math.max(8,Math.round(height*0.3)));
    return canvas.toDataURL(mimeType,quality);
  },{width,height,mimeType,label,quality});
  const encoded=dataUrl.split(",")[1];
  if(!encoded)throw new Error("Synthetic canvas image did not produce base64 data");
  const buffer=Buffer.from(encoded,"base64");
  const signature=mimeType==="image/png"
    ?Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
    :Buffer.from([0xff,0xd8,0xff]);
  expect(buffer.subarray(0,signature.length)).toEqual(signature);
  expect(buffer.length).toBeGreaterThan(500);
  return {name,mimeType,buffer,signature};
}

function observePrivacy(page,images){
  const patterns=images.flatMap(image=>[
    image.buffer,
    Buffer.from(image.buffer.toString("base64"),"utf8"),
    image.signature
  ]);
  const suspiciousWriteMethods=[];
  const resourceCounts=new Map();
  let writeRequestCount=0;

  page.on("request",request=>{
    const resourceType=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(resourceType)){
      let originCategory="unknown";
      try{
        originCategory=new URL(request.url()).origin===origin
          ?"same-origin":"external";
      }catch{}
      const key=resourceType+"|"+request.method()+"|"+originCategory;
      resourceCounts.set(key,(resourceCounts.get(key)||0)+1);
    }
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    writeRequestCount+=1;
    const body=request.postDataBuffer();
    if(body&&patterns.some(pattern=>body.includes(pattern))){
      suspiciousWriteMethods.push(request.method());
    }
  });

  page.addInitScript(()=>{
    window.__kukurekuTask269CspEvents=[];
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
      window.__kukurekuTask269CspEvents.push({
        directive:event.effectiveDirective,
        destinationCategory,
        disposition:event.disposition,
        sourceCategory,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });

  return {
    suspiciousWriteMethods,
    resourceCounts,
    getWriteRequestCount:()=>writeRequestCount
  };
}

async function openJpgToPdfWithReportOnly(page){
  await page.route(origin+"/jpg-to-pdf",async route=>{
    const response=await route.fetch();
    const headers={
      ...response.headers(),
      "content-security-policy-report-only":policy
    };
    await route.fulfill({response,headers});
  });
  await page.goto("/jpg-to-pdf",{waitUntil:"networkidle"});
}

async function uploadImages(page,images){
  await page.locator('input[type="file"]').first().setInputFiles(images.map(image=>({
    name:image.name,
    mimeType:image.mimeType,
    buffer:image.buffer
  })));
  await expect(page.getByRole("heading",{name:"Selected images ("+String(images.length)+")"}))
    .toBeVisible({timeout:30000});
}

async function downloadAndInspectPdf(page,expectedSizes){
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Create and Download PDF"}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-images.pdf");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const bytes=await readFile(outputPath);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(1000);

  const pdf=await PDFDocument.load(bytes);
  const pages=pdf.getPages();
  expect(pages).toHaveLength(expectedSizes.length);
  const actualSizes=pages.map(page=>{
    const size=page.getSize();
    return {width:size.width,height:size.height};
  });
  for(let index=0;index<expectedSizes.length;index+=1){
    expect(actualSizes[index].width).toBeCloseTo(expectedSizes[index].width,1);
    expect(actualSizes[index].height).toBeCloseTo(expectedSizes[index].height,1);
  }
  const latin1=bytes.toString("latin1");
  const imageXObjectCount=(latin1.match(/\/Subtype\s*\/Image\b/g)||[]).length;
  expect(imageXObjectCount).toBeGreaterThanOrEqual(expectedSizes.length);
  return {bytes,actualSizes,imageXObjectCount};
}

function summarizeCspEvents(events){
  const counts=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destinationCategory+"|"+event.disposition+
      "|"+event.sourceCategory+"|line:"+event.sourceLine;
    counts.set(key,(counts.get(key)||0)+1);
  }
  return [...counts].map(([key,count])=>({key,count})).slice(0,40);
}

test("Task 269 creates an ordered two-page PDF from synthetic JPG and PNG inputs and observes direct image egress",async({page,browserName})=>{
  test.setTimeout(180000);
  const landscape=await canvasImage(page,{
    name:"synthetic-landscape.jpg",width:320,height:180,
    mimeType:"image/jpeg",label:"SYNTHETIC LANDSCAPE"
  });
  const portrait=await canvasImage(page,{
    name:"synthetic-portrait.png",width:120,height:240,
    mimeType:"image/png",label:"SYNTHETIC PORTRAIT"
  });
  const privacy=observePrivacy(page,[landscape,portrait]);
  await openJpgToPdfWithReportOnly(page);
  await uploadImages(page,[landscape,portrait]);

  await page.getByRole("button",{name:"Move Up"}).nth(1).click();
  await expect(page.getByText("1. synthetic-portrait.png",{exact:true})).toBeVisible();
  await expect(page.getByText("2. synthetic-landscape.jpg",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:/Fit to image/}).click();

  const output=await downloadAndInspectPdf(page,[
    {width:120,height:240},
    {width:320,height:180}
  ]);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask269CspEvents||[]);
  console.log(JSON.stringify({
    task:269,
    result:"PASSIVE_JPG_TO_PDF_MIXED_FORMAT_ORDER_AND_FIT_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    route:"/jpg-to-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    inputFormats:["PNG","JPEG"],
    reorderedPageSizes:output.actualSizes,
    pdfPageCount:output.actualSizes.length,
    embeddedImageXObjects:output.imageXObjectCount,
    downloadedPdfVerified:true,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    originalImageBytesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:summarizeCspEvents(events),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Synthetic raster inputs and direct image-byte/signature/base64 checks only; not transformed/encrypted egress, all tools, real customer images, physical mobile devices or CSP enforcement"
  }));
});

test("Task 269 creates a valid A4 PDF page from a synthetic JPEG without direct image egress",async({page,browserName})=>{
  test.setTimeout(180000);
  const image=await canvasImage(page,{
    name:"synthetic-a4-landscape.jpg",width:320,height:180,
    mimeType:"image/jpeg",label:"SYNTHETIC A4 PAGE"
  });
  const privacy=observePrivacy(page,[image]);
  await openJpgToPdfWithReportOnly(page);
  await uploadImages(page,[image]);

  const output=await downloadAndInspectPdf(page,[
    {width:595.28,height:841.89}
  ]);
  expect(privacy.suspiciousWriteMethods).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask269CspEvents||[]);
  console.log(JSON.stringify({
    task:269,
    result:"PASSIVE_JPG_TO_PDF_A4_PAGE_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    route:"/jpg-to-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    inputFormat:"JPEG",
    a4PageSize:output.actualSizes[0],
    pdfPageCount:1,
    embeddedImageXObjects:output.imageXObjectCount,
    downloadedPdfVerified:true,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    originalImageBytesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:summarizeCspEvents(events),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"One synthetic JPEG and direct image-byte/signature/base64 checks only; not transformed/encrypted egress, all tools, real customer images, physical mobile devices or CSP enforcement"
  }));
});
