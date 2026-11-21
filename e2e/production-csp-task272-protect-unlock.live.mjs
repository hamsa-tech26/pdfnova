import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {readFile} from "node:fs/promises";

const origin="https://kukureku.com";
const password="Task272-Local-Only-Secret-2026!";
const markers=[
  "TASK272_ENCRYPTION_MARKER_ALPHA",
  "TASK272_ENCRYPTION_MARKER_BETA",
  "TASK272_ENCRYPTION_MARKER_OMEGA"
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

async function createSyntheticPdf(){
  const pdf=await PDFDocument.create();
  pdf.setTitle("Synthetic password protection fixture");
  const page=pdf.addPage([612,792]);
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(markers[0],{x:48,y:720,size:16,font});
  page.drawText("Synthetic document content for local AES-256 encryption and decryption acceptance.",{x:48,y:660,size:11,font});
  page.drawText(markers[1],{x:48,y:600,size:14,font});
  page.drawText("Only generated test content. No customer document or private data is used.",{x:48,y:540,size:11,font});
  page.drawText(markers[2],{x:48,y:480,size:16,font});
  return Buffer.from(await pdf.save({useObjectStreams:false,addDefaultPage:false}));
}

function observePrivacy(page,initialPatterns){
  const patterns=[...initialPatterns];
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

  return {
    addPattern(kind,bytes){patterns.push({kind,bytes});},
    resourceCounts,
    suspiciousWriteKinds,
    getOutboundWriteRequestCount:()=>outboundWriteRequestCount
  };
}

async function installReportOnly(page){
  await page.route(origin+"/**",async route=>{
    const request=route.request();
    const pathname=new URL(request.url()).pathname;
    if(request.resourceType()==="document"&&["/protect-pdf","/unlock-pdf"].includes(pathname)){
      const response=await route.fetch();
      await route.fulfill({
        response,
        headers:{
          ...response.headers(),
          "content-security-policy-report-only":reportOnlyPolicy
        }
      });
    }else{
      await route.continue();
    }
  });
  await page.addInitScript(()=>{
    window.__kukurekuTask272CspEvents=[];
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
      window.__kukurekuTask272CspEvents.push({
        directive:event.effectiveDirective,
        destination,
        disposition:event.disposition,
        source,
        line:Number.isFinite(event.lineNumber)?event.lineNumber:0
      });
    });
  });
}

async function readDownload(download,expectedSuffix){
  expect(download.suggestedFilename().toLowerCase()).toMatch(expectedSuffix);
  const path=await download.path();
  expect(path).toBeTruthy();
  const bytes=await readFile(path);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(500);
  return bytes;
}

async function passwordFailure(bytes,attemptedPassword){
  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    ...(attemptedPassword===undefined?{}:{password:attemptedPassword}),
    isEvalSupported:false,
    verbosity:0
  });
  let caught=null;
  try{
    await loadingTask.promise;
  }catch(error){
    caught=error;
  }finally{
    await loadingTask.destroy().catch(()=>{});
  }
  expect(caught).toBeTruthy();
  expect(caught.name).toBe("PasswordException");
  return caught.code;
}

async function inspectReadablePdf(bytes,expectedMarkers){
  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    isEvalSupported:false,
    useSystemFonts:true,
    disableFontFace:true,
    verbosity:0
  });
  const pdf=await loadingTask.promise;
  const pageTexts=[];
  const pageSizes=[];
  try{
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
      const page=await pdf.getPage(pageNumber);
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
  return {pageCount:pdf.numPages,pageSizes,markerCount:expectedMarkers.length,markerOrderVerified:true};
}

async function cspSummary(page){
  const events=await page.evaluate(()=>window.__kukurekuTask272CspEvents||[]);
  const summary=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destination+"|"+event.disposition+"|"+event.source+"|line:"+event.line;
    summary.set(key,(summary.get(key)||0)+1);
  }
  return {count:events.length,summary:[...summary].map(([key,count])=>({key,count})).slice(0,40)};
}

test("Task 272 protects a synthetic PDF with AES-256 and unlocks it locally without password egress",async({page,browserName})=>{
  test.setTimeout(240000);
  const sourceBytes=await createSyntheticPdf();
  const passwordPatterns=[
    {kind:"original-pdf-bytes",bytes:sourceBytes},
    {kind:"original-pdf-base64",bytes:Buffer.from(sourceBytes.toString("base64"),"utf8")},
    {kind:"password-plaintext",bytes:Buffer.from(password,"utf8")},
    {kind:"password-base64",bytes:Buffer.from(Buffer.from(password,"utf8").toString("base64"),"utf8")},
    {kind:"pdf-signature",bytes:Buffer.from("%PDF-","ascii")},
    ...markers.map(marker=>({kind:"source-marker",bytes:Buffer.from(marker,"utf8")}))
  ];
  const privacy=observePrivacy(page,passwordPatterns);
  await installReportOnly(page);

  await page.goto("/protect-pdf",{waitUntil:"networkidle"});
  await expect(page.getByRole("heading",{name:"Password protect PDF privately",exact:true})).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic-task272-source.pdf",
    mimeType:"application/pdf",
    buffer:sourceBytes
  });
  await page.locator("#protect-password").fill(password);
  await page.locator("#protect-password-confirm").fill(password);
  const protectButton=page.getByRole("button",{name:/Protect and Download PDF/});
  await expect(protectButton).toBeVisible();
  await expect(protectButton).toBeEnabled();
  const protectedDownloadPromise=page.waitForEvent("download",{timeout:120000});
  await protectButton.click();
  const protectedDownload=await protectedDownloadPromise;
  const protectedBytes=await readDownload(protectedDownload,/-protected\.pdf$/);

  const protectedRaw=protectedBytes.toString("latin1");
  expect(protectedRaw).toContain("/Encrypt");
  expect(protectedRaw).toContain("/AESV3");
  expect(protectedRaw).toMatch(/\/R\s+6\b/);
  expect(protectedRaw).toMatch(/\/Length\s+256\b/);
  for(const marker of markers){
    expect(protectedBytes.includes(Buffer.from(marker,"utf8"))).toBe(false);
  }
  expect(protectedBytes.includes(Buffer.from(password,"utf8"))).toBe(false);
  expect(await passwordFailure(protectedBytes,undefined)).toBe(1);
  expect(await passwordFailure(protectedBytes,"Definitely-Wrong-Password")).toBe(2);

  const protectedReadable=await inspectReadablePdfWithPassword(protectedBytes,password,markers);
  privacy.addPattern("protected-pdf-bytes",protectedBytes);
  privacy.addPattern("protected-pdf-base64",Buffer.from(protectedBytes.toString("base64"),"utf8"));

  const protectCsp=await cspSummary(page);
  await page.goto("/unlock-pdf",{waitUntil:"networkidle"});
  await expect(page.getByRole("heading",{name:"Unlock PDF with the correct password",exact:true})).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic-task272-protected.pdf",
    mimeType:"application/pdf",
    buffer:protectedBytes
  });
  await page.locator("#pdf-password").fill(password);
  const unlockButton=page.getByRole("button",{name:/Unlock and Download PDF/});
  await expect(unlockButton).toBeVisible();
  await expect(unlockButton).toBeEnabled();
  const unlockedDownloadPromise=page.waitForEvent("download",{timeout:120000});
  await unlockButton.click();
  const unlockedDownload=await unlockedDownloadPromise;
  const unlockedBytes=await readDownload(unlockedDownload,/-unlocked\.pdf$/);
  expect(unlockedBytes.toString("latin1")).not.toContain("/Encrypt");
  const unlockedReadable=await inspectReadablePdf(unlockedBytes,markers);
  const unlockCsp=await cspSummary(page);

  expect(privacy.suspiciousWriteKinds).toEqual([]);
  console.log(JSON.stringify({
    task:272,
    result:"AES256_PROTECT_AND_LOCAL_UNLOCK_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    routes:["/protect-pdf","/unlock-pdf"],
    syntheticInputs:true,
    customerDocumentCount:0,
    passwordLogged:false,
    encryptedPdfBytes:protectedBytes.length,
    encryptedPdfContainsEncryptionDictionary:true,
    aes256Revision6Verified:true,
    plaintextMarkersInEncryptedOutput:0,
    plaintextPasswordInEncryptedOutput:false,
    missingPasswordRejected:true,
    wrongPasswordRejected:true,
    correctPasswordAccepted:true,
    protectedOutput:protectedReadable,
    unlockedPdfBytes:unlockedBytes.length,
    unlockedOutput:unlockedReadable,
    outboundWriteRequestCount:privacy.getOutboundWriteRequestCount(),
    sourcePdfOrProtectedBytesInWriteRequests:0,
    passwordMatchesInWriteRequests:0,
    markerMatchesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    csp:{protect:protectCsp,unlock:unlockCsp},
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Synthetic single-page PDF and one test password only; direct source/password scans do not exclude transformed or encrypted egress, and do not certify all encryption implementations, password policies, real documents, physical mobile devices or CSP enforcement"
  }));
});

async function inspectReadablePdfWithPassword(bytes,correctPassword,expectedMarkers){
  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    password:correctPassword,
    isEvalSupported:false,
    useSystemFonts:true,
    disableFontFace:true,
    verbosity:0
  });
  const pdf=await loadingTask.promise;
  const pageTexts=[];
  const pageSizes=[];
  try{
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
      const page=await pdf.getPage(pageNumber);
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
  return {pageCount:pdf.numPages,pageSizes,markerCount:expectedMarkers.length,markerOrderVerified:true};
}
