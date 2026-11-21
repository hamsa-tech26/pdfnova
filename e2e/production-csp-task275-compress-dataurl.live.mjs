import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFile} from "node:fs/promises";
import {deflateSync} from "node:zlib";

const origin="http://127.0.0.1:3000";
const reportOnlyPolicy=[
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

const textMarkers=[
  "TASK275_TEXT_PAGE_ONE_START",
  "TASK275_TEXT_PAGE_ONE_END",
  "TASK275_TEXT_PAGE_TWO_START",
  "TASK275_TEXT_PAGE_TWO_END"
];

async function createTextPdf(){
  const pdf=await PDFDocument.create();
  pdf.setTitle("TASK275_TEXT_PDF_COMPRESSION_FIXTURE");
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let pageIndex=0;pageIndex<2;pageIndex+=1){
    const page=pdf.addPage([612,792]);
    page.drawText(textMarkers[pageIndex*2],{x:36,y:760,size:9,font});
    const repeated="REPEATED COMPRESSIBLE PARAGRAPH FOR SYNTHETIC LOCAL PDF OPTIMIZATION. ".repeat(2);
    for(let line=0;line<115;line+=1){
      page.drawText(repeated,{x:36,y:735-line*5.5,size:4.5,font});
    }
    page.drawText(textMarkers[pageIndex*2+1],{x:36,y:85,size:9,font});
  }
  return Buffer.from(await pdf.save({
    useObjectStreams:false,
    addDefaultPage:false,
    objectsPerTick:100
  }));
}

const crcTable=Uint32Array.from({length:256},(_,value)=>{
  let crc=value;
  for(let bit=0;bit<8;bit+=1){
    crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);
  }
  return crc>>>0;
});

function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
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

function createNoisyPng(width,height){
  const rowBytes=width*3;
  const raw=Buffer.alloc((rowBytes+1)*height);
  let seed=0x2712026;
  for(let y=0;y<height;y+=1){
    const rowOffset=y*(rowBytes+1);
    raw[rowOffset]=0;
    for(let x=0;x<rowBytes;x+=3){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      raw[rowOffset+1+x]=seed&0xff;
      raw[rowOffset+2+x]=(seed>>>8)&0xff;
      raw[rowOffset+3+x]=(seed>>>16)&0xff;
    }
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);
  ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;
  ihdr[9]=2;
  ihdr[10]=0;
  ihdr[11]=0;
  ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",ihdr),
    pngChunk("IDAT",deflateSync(raw,{level:9})),
    pngChunk("IEND",Buffer.alloc(0))
  ]);
}

async function createImageOnlyPdf(){
  const pdf=await PDFDocument.create();
  pdf.setTitle("TASK275_IMAGE_ONLY_SOURCE_SENTINEL");
  const png=createNoisyPng(640,840);
  const image=await pdf.embedPng(png);
  const page=pdf.addPage([300,393.75]);
  page.drawImage(image,{x:0,y:0,width:300,height:393.75});
  const bytes=Buffer.from(await pdf.save({
    useObjectStreams:false,
    addDefaultPage:false,
    objectsPerTick:100
  }));
  return {bytes,pngBytes:png};
}

function observePrivacy(page,sourceBytes,extraMarkers=[]){
  const patterns=[
    {kind:"source-pdf-bytes",bytes:sourceBytes},
    {kind:"source-pdf-base64",bytes:Buffer.from(sourceBytes.toString("base64"),"utf8")},
    {kind:"pdf-signature",bytes:Buffer.from("%PDF-","ascii")},
    ...extraMarkers.map(marker=>({kind:"source-marker",bytes:Buffer.from(marker,"utf8")}))
  ];
  const resourceCounts=new Map();
  const suspiciousWriteKinds=[];
  let outboundWriteRequestCount=0;
  page.on("request",request=>{
    const resourceType=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(resourceType)){
      let category="unknown";
      try{
        const url=new URL(request.url());
        category=url.protocol==="data:"?"data-url":
          url.protocol==="blob:"?"blob-url":
          url.origin===origin?"same-origin":"external";
      }catch{}
      const key=resourceType+"|"+request.method()+"|"+category;
      resourceCounts.set(key,(resourceCounts.get(key)||0)+1);
    }
    if(!["POST","PUT","PATCH"].includes(request.method()))return;
    outboundWriteRequestCount+=1;
    const body=request.postDataBuffer();
    if(!body)return;
    for(const pattern of patterns){
      if(body.includes(pattern.bytes))suspiciousWriteKinds.push(pattern.kind);
    }
  });

  page.addInitScript(()=>{
    window.__kukurekuTask275CspEvents=[];
    document.addEventListener("securitypolicyviolation",event=>{
      let destination="unknown";
      if(["inline","eval","data","blob"].includes(event.blockedURI)){
        destination=event.blockedURI;
      }else{
        try{
          const parsed=new URL(event.blockedURI,window.location.href);
          destination=parsed.origin===window.location.origin?"same-origin":"external";
        }catch{}
      }
      let source="unknown";
      try{
        const parsed=new URL(event.sourceFile,window.location.href);
        if(parsed.protocol==="blob:")source="blob-worker-or-script";
        else if(parsed.origin===window.location.origin){
          if(parsed.pathname.startsWith("/_next/static/"))source="next-static";
          else if(parsed.pathname===window.location.pathname)source="page-inline";
          else if(parsed.pathname.startsWith("/_next/"))source="next-runtime";
          else source="same-origin-other";
        }else source="external";
      }catch{}
      window.__kukurekuTask275CspEvents.push({
        directive:event.effectiveDirective,
        destination,
        disposition:event.disposition,
        source,
        line:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });

  return {
    resourceCounts,
    suspiciousWriteKinds,
    getOutboundWriteRequestCount:()=>outboundWriteRequestCount
  };
}

async function openCompressPdf(page){
  await page.route(origin+"/compress-pdf",async route=>{
    const response=await route.fetch();
    await route.fulfill({
      response,
      headers:{
        ...response.headers(),
        "content-security-policy-report-only":reportOnlyPolicy
      }
    });
  });
  await page.goto("/compress-pdf",{waitUntil:"networkidle"});
  await expect(page.getByRole("heading",{
    name:"Compress PDF files in your browser",
    exact:true
  })).toBeVisible();
}

async function inspectDownloadedPdf(download,expectedMarkers,expectedPages){
  expect(download.suggestedFilename().toLowerCase()).toMatch(/-compressed\.pdf$/);
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const bytes=await readFile(outputPath);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(500);
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(expectedPages);

  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    useSystemFonts:true,
    disableFontFace:true,
    isEvalSupported:false,
    verbosity:0
  });
  const parsed=await loadingTask.promise;
  const pageTexts=[];
  const pageSizes=[];
  let annotationCount=0;
  try{
    for(let pageNumber=1;pageNumber<=parsed.numPages;pageNumber+=1){
      const page=await parsed.getPage(pageNumber);
      const content=await page.getTextContent();
      pageTexts.push(content.items
        .filter(item=>typeof item.str==="string")
        .map(item=>item.str)
        .join(" "));
      annotationCount+=(await page.getAnnotations()).length;
      const viewport=page.getViewport({scale:1});
      pageSizes.push({width:Number(viewport.width.toFixed(2)),height:Number(viewport.height.toFixed(2))});
      page.cleanup();
    }
  }finally{
    await loadingTask.destroy();
  }
  const extractedText=pageTexts.join(" ");
  for(const marker of expectedMarkers){
    expect(extractedText.split(marker).length-1).toBe(1);
  }
  const positions=expectedMarkers.map(marker=>extractedText.indexOf(marker));
  expect(positions.every(position=>position>=0)).toBe(true);
  for(let index=1;index<positions.length;index+=1){
    expect(positions[index]).toBeGreaterThan(positions[index-1]);
  }
  return {
    bytes,
    pageCount:pdf.getPageCount(),
    pageSizes,
    markerCount:expectedMarkers.length,
    markerOrderVerified:true,
    extractedTextLength:extractedText.length,
    annotationCount
  };
}

async function runCompression(page,sourceBytes,fileName,level,markers,expectedPages,expectRasterized,caseName,browserName){
  const privacy=observePrivacy(page,sourceBytes,markers);
  await openCompressPdf(page);
  await page.locator('input[type="file"]').first().setInputFiles({
    name:fileName,
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  await page.getByRole("button",{name:new RegExp("^"+level+"\\b")}).click();
  const convertButton=page.getByRole("button",{
    name:/Compress and Download PDF/
  });
  await expect(convertButton).toBeVisible();
  await expect(convertButton).toBeEnabled();
  const downloadPromise=page.waitForEvent("download",{timeout:180000});
  await convertButton.click();
  const download=await downloadPromise;
  const output=await inspectDownloadedPdf(download,markers,expectedPages);
  await expect(page.getByText("Compression result",{exact:true})).toBeVisible({timeout:60000});
  if(expectRasterized){
    await expect(page.getByText(/Visual compression rebuilt this image-only PDF/i)).toBeVisible();
    expect(output.extractedTextLength).toBe(0);
    expect(output.annotationCount).toBe(0);
  }else{
    expect(output.markerOrderVerified).toBe(true);
    expect(output.annotationCount).toBe(0);
    await expect(page.getByText(/Visual compression rebuilt this image-only PDF/i)).toHaveCount(0);
  }
  expect(output.bytes.length).toBeLessThan(sourceBytes.length);
  expect(privacy.suspiciousWriteKinds).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask275CspEvents||[]);
  const dataUrlConnectViolations=events.filter(event=>event.directive==="connect-src"&&event.destination==="data");
  expect(dataUrlConnectViolations).toHaveLength(0);
  const summary=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destination+"|"+event.disposition+"|"+event.source+"|line:"+event.line;
    summary.set(key,(summary.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:275,
    testEnvironment:"local-production-build",
    case:caseName,
    result:expectRasterized?"IMAGE_ONLY_VISUAL_COMPRESSION_VERIFIED":"TEXT_PDF_COMPRESSION_PRESERVED",
    browser:browserName,
    policyMode:"report-only",
    route:"/compress-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    optimizationLevel:level,
    inputBytes:sourceBytes.length,
    outputBytes:output.bytes.length,
    reductionPercent:Number(((sourceBytes.length-output.bytes.length)/sourceBytes.length*100).toFixed(2)),
    outputPageCount:output.pageCount,
    outputPageSizes:output.pageSizes,
    extractedMarkerCount:output.markerCount,
    markerOrderVerified:output.markerOrderVerified,
    extractedTextLength:output.extractedTextLength,
    annotationCount:output.annotationCount,
    outboundWriteRequestCount:privacy.getOutboundWriteRequestCount(),
    originalPdfBytesInWriteRequests:0,
    originalPdfBase64InWriteRequests:0,
    sourceMarkerMatchesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    dataUrlConnectViolations:dataUrlConnectViolations.length,
    cspEventSummary:[...summary].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Synthetic text or image-only PDF only; direct source-byte/base64/signature/marker scans do not exclude transformed or encrypted egress; not arbitrary customer PDFs, accessibility/visual-quality certification, physical iPhone, all tool routes or CSP enforcement"
  }));
}

test("Task 275 preserves text and page order when compressing a synthetic text PDF",async({page,browserName})=>{
  test.setTimeout(240000);
  const sourceBytes=await createTextPdf();
  expect(sourceBytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(sourceBytes.length).toBeGreaterThan(10000);
  await runCompression(
    page,sourceBytes,"synthetic-task271-text.pdf","Medium",
    textMarkers,2,false,"text-preserving-medium",browserName
  );
});

test("Task 275 compresses an image-only PDF and reports rasterization",async({page,browserName})=>{
  test.setTimeout(240000);
  const {bytes:sourceBytes}=await createImageOnlyPdf();
  expect(sourceBytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(sourceBytes.length).toBeGreaterThan(500000);
  await runCompression(
    page,sourceBytes,"synthetic-task271-image-only.pdf","High",
    [],1,true,"image-only-high",browserName
  );
});
