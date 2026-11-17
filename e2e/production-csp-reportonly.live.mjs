import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {TOOL_ROUTES} from "../scripts/indexNowRoutes.mjs";

// Passive candidate CSP: browser REPORT-ONLY, never enforce.
// No report-uri/report-to endpoint, so no violation reports leave the browser.
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

test("passive CSP violation inventory on synthetic PDF-to-Excel flow",async({page})=>{
  test.setTimeout(180000);
  let injected=false;
  await page.addInitScript(()=>{
    window.__kukurekuSyntheticCspViolations=[];
    document.addEventListener("securitypolicyviolation",event=>{
      let host="inline-or-unknown";
      try {
        const url=new URL(event.blockedURI);
        host=url.origin;
      } catch {
        if(event.blockedURI==="inline"||event.blockedURI==="eval"||event.blockedURI==="data") host=event.blockedURI;
      }
      // Record bounded, non-personal script location category. URLs/query
      // strings and document names must never enter CI output.
      let category="unknown";
      try{
        const source=new URL(event.sourceFile);
        if(source.protocol==="blob:") category="blob-worker-or-script";
        else if(source.hostname===window.location.hostname){
          if(source.pathname.startsWith("/_next/static/")) category="next-static";
          else if(source.pathname==="/pdf-to-excel") category="page-inline";
          else if(source.pathname.startsWith("/_next/")) category="next-runtime";
          else category="other-same-origin";
        } else category="external-script";
      }catch{}
      window.__kukurekuSyntheticCspViolations.push({
        directive:event.effectiveDirective,
        origin:host,
        disposition:event.disposition,
        sourceCategory:category,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
  await page.route("https://kukureku.com/pdf-to-excel",async route=>{
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
    injected=true;
  });
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  expect(injected).toBe(true);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const sheet=pdf.addPage([550,760]);
  sheet.drawText("SYNTHETIC_CSP_TASK257",{x:30,y:700,size:12,font});
  sheet.drawText("Value 123",{x:60,y:650,size:12,font});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic_csp_test.pdf",
    mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible({timeout:30000});
  // No output download is needed; selecting a synthetic PDF exercises the
  // client-side PDF initialization and worker asset path.
  await page.waitForTimeout(1500);
  const events=await page.evaluate(()=>window.__kukurekuSyntheticCspViolations||[]);
  const counts=new Map();
  for(const item of events){
    const key=item.directive+"|"+item.origin+"|"+item.disposition+"|"+item.sourceCategory+"|line:"+item.sourceLine;
    counts.set(key,(counts.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:257,
    result:"PASSIVE_OBSERVATION_ONLY",
    policyMode:"report-only",
    route:"/pdf-to-excel",
    syntheticPdf:true,
    customerPdfCount:0,
    observedViolationSummary:[...counts].map(([key,count])=>({key,count})).slice(0,40),
    totalEvents:events.length,
    limitations:"A single synthetic Chromium flow does not cover every route, all worker paths or production CSP enforcement"
  }));
});


test("passive CSP directive inventory across all 31 public tool entry pages",async({page})=>{
  // Public entry-page audit only. No user files, synthetic PDF content,
  // credentials, or network payloads are read or persisted.
  test.setTimeout(360000);
  expect(TOOL_ROUTES.length).toBe(31);
  const origin="https://kukureku.com";
  const audited=new Set(TOOL_ROUTES);
  let injected=0;
  await page.addInitScript(()=>{
    window.__kukurekuEntryCspEvents=[];
    document.addEventListener("securitypolicyviolation",event=>{
      let destination="inline-or-unknown";
      if(["inline","eval","data","blob"].includes(event.blockedURI))
        destination=event.blockedURI;
      else{
        try{destination=new URL(event.blockedURI).origin;}catch{}
      }
      // Source attribution is a fixed category only. Never retain or print
      // sourceFile, raw URLs, query strings, or document-derived values.
      let sourceCategory="unknown";
      try{
        const source=new URL(event.sourceFile,window.location.href);
        if(source.protocol==="blob:") sourceCategory="blob-worker-or-script";
        else if(source.origin===window.location.origin){
          if(source.pathname.startsWith("/_next/static/")) sourceCategory="next-static";
          else if(source.pathname===window.location.pathname) sourceCategory="page-inline";
          else if(source.pathname.startsWith("/_next/")) sourceCategory="next-runtime";
          else sourceCategory="same-origin-other";
        }else sourceCategory="external";
      }catch{}
      window.__kukurekuEntryCspEvents.push({
        directive:event.effectiveDirective,
        destination,
        disposition:event.disposition,
        sourceCategory,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
  await page.route("https://kukureku.com/**",async route=>{
    if(route.request().resourceType()!=="document"){
      await route.continue();
      return;
    }
    const requestUrl=new URL(route.request().url());
    if(!audited.has(requestUrl.pathname)){
      await route.continue();
      return;
    }
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
    injected++;
  });
  const perRoute=[];
  let total=0;
  for(const route of TOOL_ROUTES){
    const response=await page.goto(route,{waitUntil:"load",timeout:45000});
    expect(response?.status(),"Public route "+route+" must be accessible").toBe(200);
    await page.waitForTimeout(350);
    const events=await page.evaluate(()=>window.__kukurekuEntryCspEvents||[]);
    const byDirective={};
    for(const item of events){
      // Data-free summary only. Never log source URLs, paths, or file data.
      const key=item.directive+"|"+item.destination+"|"+item.disposition+"|"+item.sourceCategory+"|line:"+item.sourceLine;
      byDirective[key]=(byDirective[key]||0)+1;
    }
    total+=events.length;
    perRoute.push({route,events:events.length,byDirective});
  }
  expect(injected,"Candidate report-only CSP injected into each HTML route").toBe(31);
  expect(perRoute).toHaveLength(31);
  console.log(JSON.stringify({
    task:263,
    scope:"PUBLIC_TOOL_ENTRY_PAGES",
    policyMode:"report-only",
    testedRoutes:perRoute.length,
    injectedDocuments:injected,
    totalEvents:total,
    results:perRoute,
    customerPdfCount:0,
    limitation:"Entry-page-only Chromium observations; no user uploads, tool processing, physical iOS, CSP enforcement, or malware exploit test"
  }));
});


test("Task 266 observes report-only CSP during synthetic PDF-to-Excel processing",async({page,browserName})=>{
  test.setTimeout(240000);
  let injected=false;
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const sheet=pdf.addPage([900,760]);
  const xs=[45,120,285,450,605];
  const rows=[
    ["Sl No","Code","Name","Amount","Remarks"],
    ...Array.from({length:12},(_,i)=>[
      String(i+1),String(i+71).padStart(5,"0"),"Station "+(i+1),
      String(1000+i*11),"Reviewed "+(i+1)
    ])
  ];
  rows.forEach((row,i)=>row.forEach((value,j)=>{
    sheet.drawText(value,{x:xs[j],y:690-i*36,size:12,font});
  }));
  const sourceBytes=Buffer.from(await pdf.save());
  const sourceBase64=Buffer.from(sourceBytes.toString("base64"),"utf8");
  const pdfHeader=Buffer.from("%PDF-","utf8");
  const suspiciousWriteMethods=[];
  let writeRequestCount=0;
  const resourceCounts=new Map();

  page.on("request",request=>{
    const resourceType=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(resourceType)){
      let originCategory="unknown";
      try{
        const requestOrigin=new URL(request.url()).origin;
        originCategory=requestOrigin==="https://kukureku.com"?"same-origin":"external";
      }catch{}
      const key=resourceType+"|"+request.method()+"|"+originCategory;
      resourceCounts.set(key,(resourceCounts.get(key)||0)+1);
    }
    if(!["POST","PUT","PATCH"].includes(request.method())) return;
    writeRequestCount++;
    const body=request.postDataBuffer();
    if(!body) return;
    if(body.includes(sourceBytes)||body.includes(sourceBase64)||body.includes(pdfHeader)){
      // Keep only the HTTP method. Never log request URL, headers, body or PDF bytes.
      suspiciousWriteMethods.push(request.method());
    }
  });

  await page.addInitScript(()=>{
    window.__kukurekuProcessingCspEvents=[];
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
        if(source.protocol==="blob:") sourceCategory="blob-worker-or-script";
        else if(source.origin===window.location.origin){
          if(source.pathname.startsWith("/_next/static/")) sourceCategory="next-static";
          else if(source.pathname===window.location.pathname) sourceCategory="page-inline";
          else if(source.pathname.startsWith("/_next/")) sourceCategory="next-runtime";
          else sourceCategory="same-origin-other";
        }else sourceCategory="external";
      }catch{}
      window.__kukurekuProcessingCspEvents.push({
        directive:event.effectiveDirective,
        destinationCategory,
        disposition:event.disposition,
        sourceCategory,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });

  await page.route("https://kukureku.com/pdf-to-excel",async route=>{
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
    injected=true;
  });
  await page.goto("/pdf-to-excel",{waitUntil:"networkidle"});
  expect(injected).toBe(true);
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK266_CSP_PROCESSING.pdf",
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  const convert=page.getByRole("button",{name:/Convert to Excel/i});
  await expect(convert).toBeVisible({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:150000});
  await convert.click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const output=await readFile(outputPath);
  expect(output.subarray(0,2).toString("ascii")).toBe("PK");
  await expect(page.getByRole("heading",{name:"Excel workbook created"})).toBeVisible({timeout:30000});
  await page.waitForTimeout(1200);
  expect(suspiciousWriteMethods,
    "Original synthetic PDF bytes/header/base64 must not appear in outgoing write bodies"
  ).toEqual([]);

  const events=await page.evaluate(()=>window.__kukurekuProcessingCspEvents||[]);
  const counts=new Map();
  for(const item of events){
    const key=item.directive+"|"+item.destinationCategory+"|"+item.disposition+
      "|"+item.sourceCategory+"|line:"+item.sourceLine;
    counts.set(key,(counts.get(key)||0)+1);
  }
  const workerConnectEvents=events.filter(item=>
    item.directive==="worker-src"||item.directive==="connect-src"
  ).length;
  console.log(JSON.stringify({
    task:266,
    result:"PASSIVE_PROCESSING_OBSERVATION",
    browser:browserName,
    policyMode:"report-only",
    route:"/pdf-to-excel",
    syntheticPdf:true,
    customerPdfCount:0,
    xlsxDownloadVerified:true,
    outboundWriteRequestCount:writeRequestCount,
    originalPdfBytesInWriteRequests:0,
    workerConnectEventCount:workerConnectEvents,
    processingResourceRequests:[...resourceCounts].map(([key,count])=>({key,count})),
    totalEvents:events.length,
    observedViolationSummary:[...counts].map(([key,count])=>({key,count})).slice(0,50),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"One synthetic PDF-to-Excel processing flow per browser; not all tool engines, physical iPhone, real customer documents, CSP enforcement or an exploit test"
  }));
});
