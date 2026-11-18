import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
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

async function task267SourcePdf(){
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  const page=document.addPage([612,792]);
  page.drawText("KUKUREKU_TASK267_ALPHA",{x:72,y:700,size:15,font});
  page.drawText("KUKUREKU_TASK267_MIDDLE",{x:72,y:620,size:15,font});
  page.drawText("KUKUREKU_TASK267_OMEGA",{x:72,y:540,size:15,font});
  return Buffer.from(await document.save());
}

test("Task 267 observes report-only CSP and direct PDF egress during synthetic PDF-to-Word conversion",async({page,browserName})=>{
  test.setTimeout(180000);
  const sourceBytes=await task267SourcePdf();
  const sourceBase64=Buffer.from(sourceBytes.toString("base64"),"utf8");
  const pdfHeader=Buffer.from("%PDF-","utf8");
  const suspiciousWriteMethods=[];
  const resourceCounts=new Map();
  let writeRequestCount=0;
  let injected=false;

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
    writeRequestCount++;
    const body=request.postDataBuffer();
    if(!body)return;
    if(body.includes(sourceBytes)||body.includes(sourceBase64)||body.includes(pdfHeader)){
      // Retain only the method; never record URL, headers, body or PDF bytes.
      suspiciousWriteMethods.push(request.method());
    }
  });

  await page.addInitScript(()=>{
    window.__kukurekuTask267CspEvents=[];
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
      window.__kukurekuTask267CspEvents.push({
        directive:event.effectiveDirective,
        destinationCategory,
        disposition:event.disposition,
        sourceCategory,
        sourceLine:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });

  await page.route("https://kukureku.com/pdf-to-word",async route=>{
    const response=await route.fetch();
    const headers={...response.headers(),"content-security-policy-report-only":policy};
    await route.fulfill({response,headers});
    injected=true;
  });

  await page.goto("/pdf-to-word",{waitUntil:"networkidle"});
  expect(injected).toBe(true);
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK267_READABLE.pdf",
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  const conversion=page.getByRole("button",{name:"Convert and Download Word"});
  await expect(conversion).toBeVisible({timeout:15000});
  const pending=page.waitForEvent("download",{timeout:90000});
  await conversion.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("SYNTHETIC_TASK267_READABLE.docx");
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();

  const archive=await JSZip.loadAsync(await readFile(outputPath));
  expect(archive.file("[Content_Types].xml")).toBeTruthy();
  const documentXml=await archive.file("word/document.xml")?.async("string");
  expect(documentXml).toBeTruthy();
  const markers=[
    "KUKUREKU_TASK267_ALPHA",
    "KUKUREKU_TASK267_MIDDLE",
    "KUKUREKU_TASK267_OMEGA"
  ];
  for(const marker of markers)expect(documentXml).toContain(marker);
  const positions=markers.map(marker=>documentXml.indexOf(marker));
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  for(const marker of markers){
    expect(documentXml.split(marker)).toHaveLength(2);
  }
  await expect(page.getByRole("button",{name:"Download Word Again"})).toBeVisible();
  expect(suspiciousWriteMethods,
    "Original synthetic PDF bytes/header/base64 must not appear in outgoing write bodies"
  ).toEqual([]);

  const events=await page.evaluate(()=>window.__kukurekuTask267CspEvents||[]);
  const counts=new Map();
  for(const item of events){
    const key=item.directive+"|"+item.destinationCategory+"|"+item.disposition+
      "|"+item.sourceCategory+"|line:"+item.sourceLine;
    counts.set(key,(counts.get(key)||0)+1);
  }
  console.log(JSON.stringify({
    task:267,
    result:"PASSIVE_PDF_TO_WORD_PROCESSING_OBSERVATION",
    browser:browserName,
    policyMode:"report-only",
    route:"/pdf-to-word",
    syntheticPdf:true,
    customerPdfCount:0,
    docxDownloadVerified:true,
    independentZipXmlInspection:true,
    sourceMarkerCount:markers.length,
    sourceOrderPreserved:true,
    outboundWriteRequestCount:writeRequestCount,
    originalPdfBytesInWriteRequests:0,
    processingResourceRequests:[...resourceCounts].map(([key,count])=>({key,count})),
    totalEvents:events.length,
    observedViolationSummary:[...counts].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"One synthetic PDF-to-Word flow per browser; checks direct source bytes/header/base64 only, not transformed or encrypted exfiltration, complex DOCX layout, physical iPhone, real customer files or CSP enforcement"
  }));
});
