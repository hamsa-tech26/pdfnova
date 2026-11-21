import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFile} from "node:fs/promises";

const origin="https://kukureku.com";
const inputFiles=[
  {name:"synthetic-task273-A.pdf",marker:"TASK273_SOURCE_A_MARKER"},
  {name:"synthetic-task273-B.pdf",marker:"TASK273_SOURCE_B_MARKER"},
  {name:"synthetic-task273-C.pdf",marker:"TASK273_SOURCE_C_MARKER"}
];
const expectedOrder=[
  "TASK273_SOURCE_C_MARKER",
  "TASK273_SOURCE_A_MARKER",
  "TASK273_SOURCE_B_MARKER"
];
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

async function createSourcePdf(marker,index){
  const pdf=await PDFDocument.create();
  pdf.setTitle("Task 273 synthetic source "+index);
  const page=pdf.addPage([612,792]);
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(marker,{x:48,y:720,size:18,font});
  page.drawText("Synthetic source document "+index+" for browser-local merge ordering verification.",{
    x:48,y:660,size:11,font
  });
  page.drawText("No customer or private content is used.",{x:48,y:600,size:11,font});
  return Buffer.from(await pdf.save({useObjectStreams:false,addDefaultPage:false}));
}

function observePrivacy(page,sourcePatterns){
  const patterns=[...sourcePatterns];
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

async function openMergePdf(page){
  await page.route(origin+"/merge-pdf",async route=>{
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
    window.__kukurekuTask273CspEvents=[];
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
      window.__kukurekuTask273CspEvents.push({
        directive:event.effectiveDirective,
        destination,
        disposition:event.disposition,
        source,
        line:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
  await page.goto("/merge-pdf",{waitUntil:"networkidle"});
  await expect(page.getByRole("heading",{
    name:"Merge PDF files online, privately",
    exact:true
  })).toBeVisible();
}

async function inspectMergedPdf(download){
  expect(download.suggestedFilename()).toBe("kukureku-merged.pdf");
  const path=await download.path();
  expect(path).toBeTruthy();
  const bytes=await readFile(path);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(500);
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
  for(const marker of expectedOrder){
    expect(text.split(marker).length-1).toBe(1);
  }
  const positions=expectedOrder.map(marker=>text.indexOf(marker));
  expect(positions.every(position=>position>=0)).toBe(true);
  for(let index=1;index<positions.length;index+=1){
    expect(positions[index]).toBeGreaterThan(positions[index-1]);
  }
  return {
    bytes,
    pageCount:pdf.getPageCount(),
    pageSizes,
    markerCount:expectedOrder.length,
    markerOrder:expectedOrder
  };
}

test("Task 273 merges multiple synthetic PDFs in the exact user-selected order without direct source egress",async({page,browserName})=>{
  test.setTimeout(240000);
  const buffers=await Promise.all(inputFiles.map((item,index)=>createSourcePdf(item.marker,index+1)));
  const privacy=observePrivacy(page,[
    ...buffers.map((bytes,index)=>({kind:"source-pdf-"+(index+1),bytes})),
    ...buffers.map((bytes,index)=>({kind:"source-pdf-base64-"+(index+1),bytes:Buffer.from(bytes.toString("base64"),"utf8")})),
    {kind:"pdf-signature",bytes:Buffer.from("%PDF-","ascii")},
    ...inputFiles.map(item=>({kind:"source-marker",bytes:Buffer.from(item.marker,"utf8")}))
  ]);
  await openMergePdf(page);
  await page.locator('input[type="file"]').first().setInputFiles(
    inputFiles.map((item,index)=>({
      name:item.name,
      mimeType:"application/pdf",
      buffer:buffers[index]
    }))
  );
  await expect(page.getByText("Selected files (3)",{exact:true})).toBeVisible({timeout:30000});
  const rows=page.locator("p.break-words.font-semibold");
  await expect(rows).toHaveText([
    "1. synthetic-task273-A.pdf",
    "2. synthetic-task273-B.pdf",
    "3. synthetic-task273-C.pdf"
  ]);

  const moveUp=page.getByRole("button",{name:"Move Up",exact:true});
  await moveUp.nth(2).click();
  await expect(rows).toHaveText([
    "1. synthetic-task273-A.pdf",
    "2. synthetic-task273-C.pdf",
    "3. synthetic-task273-B.pdf"
  ]);
  await page.getByRole("button",{name:"Move Up",exact:true}).nth(1).click();
  await expect(rows).toHaveText([
    "1. synthetic-task273-C.pdf",
    "2. synthetic-task273-A.pdf",
    "3. synthetic-task273-B.pdf"
  ]);

  const mergeButton=page.getByRole("button",{name:/Merge and Download PDF/});
  await expect(mergeButton).toBeVisible();
  await expect(mergeButton).toBeEnabled();
  const downloadPromise=page.waitForEvent("download",{timeout:120000});
  await mergeButton.click();
  const download=await downloadPromise;
  const output=await inspectMergedPdf(download);
  await expect(page.getByText("Your merged PDF is ready",{exact:true})).toBeVisible({timeout:60000});
  expect(privacy.suspiciousWriteKinds).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask273CspEvents||[]);
  const cspSummary=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destination+"|"+event.disposition+"|"+event.source+"|line:"+event.line;
    cspSummary.set(key,(cspSummary.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:273,
    result:"MULTI_PDF_MERGE_ORDER_AND_LOCAL_EGRESS_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    route:"/merge-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    inputFileCount:3,
    inputOrder:["A","B","C"],
    userReorderedTo:["C","A","B"],
    outputPageCount:output.pageCount,
    outputPageSizes:output.pageSizes,
    extractedMarkerCount:output.markerCount,
    outputMarkerOrder:output.markerOrder,
    outboundWriteRequestCount:privacy.getOutboundWriteRequestCount(),
    originalPdfBytesInWriteRequests:0,
    originalPdfBase64InWriteRequests:0,
    sourceMarkerMatchesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:[...cspSummary].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Three synthetic one-page PDFs and one reorder sequence only; direct byte/base64/marker scans do not exclude transformed or encrypted egress, and do not certify arbitrary documents, physical mobile devices or CSP enforcement"
  }));
});
