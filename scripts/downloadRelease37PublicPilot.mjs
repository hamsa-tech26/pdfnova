import {PDFDocument} from "pdf-lib";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const SOURCE = "https://pubs.usgs.gov/sir/2024/5103/sir20245103.pdf";
const RIGHTS = "https://pubs.usgs.gov/documentation/faq";
const SOURCE_PAGE = "https://pubs.usgs.gov/publication/sir20245103";
const MAX_BYTES = 25*1024*1024;
const outputDir=path.resolve("benchmarks/release37/private");
const sha=data=>createHash("sha256").update(data).digest("hex");

async function fetchPublisherPdf(url){
  const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(90000),headers:{
    "User-Agent":"Kukureku-PDF-Release37-Public-Pilot/1.0 (research benchmark; no redistribution)",
    "Accept":"application/pdf",
  }});
  if(!response.ok)throw new Error("Publisher returned HTTP "+response.status);
  const redirected=new URL(response.url);
  if(redirected.protocol!=="https:"||redirected.hostname!=="pubs.usgs.gov"){
    throw new Error("Unexpected public source redirect host.");
  }
  const sizeHeader=Number(response.headers.get("content-length")??0);
  if(sizeHeader>MAX_BYTES)throw new Error("Public source exceeds 25 MB benchmark limit.");
  const chunks=[];let length=0;
  for await(const item of response.body){
    const chunk=Buffer.from(item);
    length+=chunk.length;
    if(length>MAX_BYTES)throw new Error("Public source exceeds 25 MB benchmark limit.");
    chunks.push(chunk);
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")throw new Error("USGS response was not a PDF.");
  return bytes;
}

const source=await fetchPublisherPdf(SOURCE);
const original=await PDFDocument.load(source,{ignoreEncryption:false});
const pages=Math.min(3,original.getPageCount());
if(pages<1)throw new Error("No pages in public PDF");
const sampled=await PDFDocument.create();
const indices=Array.from({length:pages},(_,i)=>i);
for(const p of await sampled.copyPages(original,indices))sampled.addPage(p);
const subset=Buffer.from(await sampled.save());
await mkdir(outputDir,{recursive:true});
await writeFile(path.join(outputDir,"usgs-public-pilot.pdf"),subset);
const metadata={
  id:"usgs-sir20245103-pilot",originalSourceUrl:SOURCE,publicationPage:SOURCE_PAGE,rightsGuidanceUrl:RIGHTS,
  sourceSha256:sha(source),subsetSha256:sha(subset),
  originalBytes:source.length,subsetBytes:subset.length,sourcePages:original.getPageCount(),
  selectedPageNumbers:indices.map(i=>i+1),sourceType:"real published USGS report",
  selection:"real pages copied into a synthetic test excerpt without changing page contents",
  rightsStatus:"REVIEW_REQUIRED: verify report-specific third-party content before accepting for benchmark redistribution or release gate",
  referenceStatus:"NOT_ANNOTATED",isRelease37AcceptanceEvidence:false,
};
await writeFile(path.join(outputDir,"usgs-public-pilot-metadata.json"),JSON.stringify(metadata,null,2)+"\n");
console.log(JSON.stringify(metadata));
