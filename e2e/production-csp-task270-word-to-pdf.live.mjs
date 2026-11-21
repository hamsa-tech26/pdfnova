import {test,expect} from "@playwright/test";
import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType} from "docx";
import {PDFDocument} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
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

const markers=[
  "TASK270_PARAGRAPH_ALPHA",
  "TASK270_PARAGRAPH_BETA",
  "TASK270_TABLE_LEFT",
  "TASK270_TABLE_RIGHT",
  "TASK270_PARAGRAPH_OMEGA"
];

async function createSyntheticDocx(){
  const table=new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      new TableRow({children:[
        new TableCell({children:[new Paragraph({children:[new TextRun(markers[2])]})]}),
        new TableCell({children:[new Paragraph({children:[new TextRun(markers[3])]})]})
      ]})
    ]
  });
  const document=new Document({
    sections:[{
      children:[
        new Paragraph({children:[new TextRun({text:markers[0],bold:true})]}),
        new Paragraph({children:[new TextRun(markers[1])]}),
        table,
        new Paragraph({children:[new TextRun(markers[4])]})
      ]
    }]
  });
  return await Packer.toBuffer(document);
}

function observePrivacy(page,sourceBytes){
  const patterns=[
    sourceBytes,
    Buffer.from(sourceBytes.toString("base64"),"utf8"),
    ...markers.map(marker=>Buffer.from(marker,"utf8"))
  ];
  const suspiciousWriteMethods=[];
  const resourceCounts=new Map();
  let writeRequestCount=0;

  page.on("request",request=>{
    const resourceType=request.resourceType();
    if(["worker","serviceworker","fetch","xhr"].includes(resourceType)){
      let originCategory="unknown";
      try{
        originCategory=new URL(request.url()).origin===origin?"same-origin":"external";
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
    window.__kukurekuTask270CspEvents=[];
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
      window.__kukurekuTask270CspEvents.push({
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

async function openWordToPdfWithReportOnly(page){
  await page.route(origin+"/word-to-pdf",async route=>{
    const response=await route.fetch();
    const headers={
      ...response.headers(),
      "content-security-policy-report-only":policy
    };
    await route.fulfill({response,headers});
  });
  await page.goto("/word-to-pdf",{waitUntil:"networkidle"});
}

async function inspectDownloadedPdf(download){
  expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
  const outputPath=await download.path();
  expect(outputPath).toBeTruthy();
  const bytes=await readFile(outputPath);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(500);

  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(0);

  const loadingTask=getDocument({
    data:new Uint8Array(bytes),
    useSystemFonts:true,
    disableFontFace:true,
    isEvalSupported:false,
    verbosity:0
  });
  const parsed=await loadingTask.promise;
  const pageText=[];
  for(let index=1;index<=parsed.numPages;index+=1){
    const page=await parsed.getPage(index);
    const content=await page.getTextContent();
    pageText.push(content.items
      .filter(item=>typeof item.str==="string")
      .map(item=>item.str)
      .join(" "));
  }
  const extractedText=pageText.join(" ");
  await loadingTask.destroy();

  for(const marker of markers){
    expect(extractedText.split(marker).length-1).toBe(1);
  }
  const positions=markers.map(marker=>extractedText.indexOf(marker));
  expect(positions.every(position=>position>=0)).toBe(true);
  for(let index=1;index<positions.length;index+=1){
    expect(positions[index]).toBeGreaterThan(positions[index-1]);
  }

  return {
    bytes,
    pageCount:pdf.getPageCount(),
    pageSizes:pdf.getPages().map(page=>{
      const size=page.getSize();
      return {width:size.width,height:size.height};
    }),
    markerCount:markers.length,
    markerOrderVerified:true
  };
}

test("Task 270 converts a synthetic DOCX with paragraphs and a basic table into a readable PDF without direct source egress",async({page,browserName})=>{
  test.setTimeout(180000);
  const sourceBytes=await createSyntheticDocx();
  expect(sourceBytes.subarray(0,2).toString("ascii")).toBe("PK");
  expect(sourceBytes.length).toBeGreaterThan(1000);

  const privacy=observePrivacy(page,sourceBytes);
  await openWordToPdfWithReportOnly(page);
  await expect(page.getByRole("heading",{name:"Convert Word to PDF in your browser",exact:true})).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles({
    name:"synthetic-task270.docx",
    mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer:sourceBytes
  });

  const convertButton=page.getByRole("button",{
    name:/convert.*pdf|create.*pdf|download.*pdf/i
  }).last();
  await expect(convertButton).toBeVisible({timeout:30000});
  await expect(convertButton).toBeEnabled();

  const downloadPromise=page.waitForEvent("download",{timeout:120000});
  await convertButton.click();
  const download=await downloadPromise;
  const output=await inspectDownloadedPdf(download);

  expect(privacy.suspiciousWriteMethods).toEqual([]);
  const events=await page.evaluate(()=>window.__kukurekuTask270CspEvents||[]);
  const cspSummary=new Map();
  for(const event of events){
    const key=event.directive+"|"+event.destinationCategory+"|"+event.disposition+
      "|"+event.sourceCategory+"|line:"+event.sourceLine;
    cspSummary.set(key,(cspSummary.get(key)||0)+1);
  }

  console.log(JSON.stringify({
    task:270,
    result:"WORD_TO_PDF_SYNTHETIC_DOCX_TEXT_AND_TABLE_VERIFIED",
    browser:browserName,
    policyMode:"report-only",
    route:"/word-to-pdf",
    syntheticInputs:true,
    customerDocumentCount:0,
    inputFormat:"DOCX",
    outputPageCount:output.pageCount,
    outputPageSizes:output.pageSizes,
    extractedMarkerCount:output.markerCount,
    markerOrderVerified:output.markerOrderVerified,
    downloadedPdfVerified:true,
    outboundWriteRequestCount:privacy.getWriteRequestCount(),
    originalDocxBytesInWriteRequests:0,
    sourceMarkerMatchesInWriteRequests:0,
    processingResourceRequests:[...privacy.resourceCounts].map(([key,count])=>({key,count})),
    cspEventCount:events.length,
    cspEventSummary:[...cspSummary].map(([key,count])=>({key,count})).slice(0,40),
    rawUrlsLogged:false,
    requestBodiesLogged:false,
    documentBytesLogged:false,
    limitation:"Synthetic DOCX with basic paragraphs/table and direct source-byte/base64/marker checks only; not complex Word layout, images, headers/footers, transformed or encrypted egress, all tools, real customer documents, physical mobile devices or CSP enforcement"
  }));
});
