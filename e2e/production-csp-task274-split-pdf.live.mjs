import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFile} from "node:fs/promises";

const origin="https://kukureku.com";
const markers=[
  "TASK274_SOURCE_PAGE_ONE",
  "TASK274_SOURCE_PAGE_TWO",
  "TASK274_SOURCE_PAGE_THREE",
  "TASK274_SOURCE_PAGE_FOUR"
];
const expectedMarkers=[markers[0],markers[2],markers[3]];
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

async function createSyntheticPdf(){
  const pdf=await PDFDocument.create();
  pdf.setTitle("Task 274 synthetic split source");
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let index=0;index<markers.length;index+=1){
    const page=pdf.addPage([612,792]);
    page.drawText(markers[index],{x:48,y:720,size:18,font});
    page.drawText("Synthetic source page "+(index+1)+" for local page extraction acceptance.",{
      x:48,y:660,size:11,font
    });
  }
  return Buffer.from(await pdf.save({useObjectStreams:false,addDefaultPage:false}));
}

function observePrivacy(page,sourceBytes){
  const patterns=[
    {kind:"source-pdf-bytes",bytes:sourceBytes},
    {kind:"source-pdf-base64",bytes:Buffer.from(sourceBytes.toString("base64"),"utf8")},
    {kind:"pdf-signature",bytes:Buffer.from("%PDF-","ascii")},
    ...markers.map(marker=>({kind:"source-marker",bytes:Buffer.from(marker,"utf8")}))
  ];
  const resourceCounts=new Map();
  const suspiciousWriteKinds=[];
  let outboundWriteRequestCount=0;
  page.on("request",request=>{
    const type=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(type)){
      let category="unknown";
      try{
        const url=new URL(request.url());
        category=url.protocol==="data:"?"data-url":
          url.protocol==="blob:"?"blob-url":
          url.origin===origin?"same-origin":"external";
      }catch{}
      const key=type+"|"+request.method()+"|"+category;
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
  return {
    resourceCounts,
    suspiciousWriteKinds,
    getOutboundWriteRequestCount:()=>outboundWriteRequestCount
  };
}

async function openSplitPdf(page){
  await page.route(origin+"/split-pdf",async route=>{
    const response=await route.fetch();
    await route.fulfill({
      response,
      headers:{
        ...response.headers(),
        "content-security-policy-report-only":reportOnlyPolicy
      }
    });
  });
  await page.addInitScript(()=>{
    window.__kukurekuTask274CspEvents=[];
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
      window.__kukurekuTask274CspEvents.push({
        directive:event.effectiveDirective,
        destination,
        disposition:event.disposition,
        source,
        line:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
  await page.goto("/split-pdf",{waitUntil:"networkidle"});
  await expect(page.getByRole("heading",{
    name:"Split PDF and extract pages privately",
    exact:true
  })).toBeVisible();
}

async function inspectExtractedPdf(download){
  expect(download.suggestedFilename()).toBe("synthetic-task274-source-extracted.pdf");
  const path=await download.path();
  expect(path).toBeTruthy();
  const bytes=await readFile(path);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(3);
  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    isEvalSupported:false,
    useSystemFonts:true,
    disableFontFace:true,
    verbosity:0
  });
  const parsed=await loadingTask.promise;
  const pageTexts=[];
  const pageSizes=[];
  try{
    for(let pageNumber=1;pageNumber<=parsed.numPages;pageNumber+=1){
      const page=await parsed.getPage(pageNumber);
      const content=await page.getTextContent();
      pageTexts.push(content.items.filter(item=>typeof item.str==="string").map(item=>item.str).join(" "));
      const viewport=page.getViewport({scale:1});
      pageSizes.push({width:Number(viewport.width.toFixed(2)),height:Number(viewport.height.toFixed(2))});
      page.cleanup();
    }
  }finally{
    await loadingTask.destroy();
  }
  const text=pageTexts.join(" ");
  for(const marker of expectedMarkers){
    expect(text.split(marker).length-1).toBe(1);
  }
  const positions=expectedMarkers.map(marker=>text.indexOf(marker));
  expect(positions.every(position=>position>=0)).toBe(true);
  for(let index=1;index<positions.length;index+=1){
    expect(positions[index]).toBeGreaterThan(positions[index-1]);
  }
  return {bytes,pageCount:pdf.getPageCount(),pageSizes,markerCount:expectedMarkers.length,markerOrder:expectedMarkers};
}

test("Task 274 rejects invalid page ranges and extracts the requested pages locally without direct source egress",async({page,browserName})=>{
  test.setTimeout(240000);
  const sourceBytes=await createSyntheticPdf();
  const privacy=observePrivacy(page,sourceBytes);
  await openSplitPdf(page);
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic-task274-source.pdf",
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  await expect(page.getByText("Available pages: 1-4",{exact:true})).toBeVisible();
  let downloadCount=0;
  page.on("download",()=>{downloadCount+=1;});

  await page.locator("#page-range").fill("1,5");
  const extractButton=page.getByRole("button",{name:/Extract and Download PDF/});
  await expect(extractButton).toBeVisible();
  await extractButton.click();
  await expect(page.getByRole("heading",{name:"PDF page extraction failed",exact:true})).toBeVisible();
  await expect(page.getByText(/Page 5 is outside the available 1-4 pages/).first()).toBeVisible();
  expect(downloadCount).toBe(0);

  await page.locator("#page-range").fill("1,3-4");
  const validButton=page.getByRole("button",{name:/Extract and Download PDF/});
  await expect(validButton).toBeVisible();
  await expect(validButton).toBeEnabled();
  const downloadPromise=page.waitForEvent("download",{timeout:120000});
  await validButton.click();
  const download=await downloadPromise;
  const output=await inspectExtractedPdf(download);
  await expect(page.getByText("Your extracted PDF is ready",{exact:true})).toBeVisible({timeout:60000});
  expect(downloadCount).toBe(1);
  expect(privacy.suspiciousWriteKinds).toEqual([]);

  const events=await page.evaluate(()=>window.__kukurekuTask274CspEvents||[]);
  const summary=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destination+"|"+event.disposition+"|"+event.source+"|line:"+event.line;
    summary.set(key,(summary.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:274,
    result:"INVALID_RANGE_REJECTED_AND_LOCAL_EXTRACTION_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    route:"/split-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    sourcePageCount:4,
    invalidRange:"1,5",
    invalidRangeRejected:true,
    downloadsAfterInvalidRange:0,
    validRange:"1,3-4",
    outputPageCount:output.pageCount,
    outputPageSizes:output.pageSizes,
    extractedMarkerCount:output.markerCount,
    outputMarkerOrder:output.markerOrder,
    downloadsAfterValidRange:downloadCount,
    outboundWriteRequestCount:privacy.getOutboundWriteRequestCount(),
    originalPdfBytesInWriteRequests:0,
    originalPdfBase64InWriteRequests:0,
    sourceMarkerMatchesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:[...summary].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Four-page synthetic PDF, one invalid and one valid range only; direct byte/base64/marker scans do not exclude transformed or encrypted egress, arbitrary customer documents, physical mobile devices or CSP enforcement"
  }));
});
