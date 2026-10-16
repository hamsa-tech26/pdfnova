import {PDFDocument} from "pdf-lib";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const MAX_BYTES=25*1024*1024;
const MAX_PILOTS=5;
const pilotRoot=path.resolve("benchmarks/release37/private");
const configPath=path.resolve("benchmarks/release37/pilot-sources.json");
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");

function validatePilotConfig(config){
  if(config?.status!=="PILOT_ONLY_NOT_ANNOTATED"||config.acceptedCountCredit!==0||
      !Array.isArray(config.sources)||!config.sources.length||config.sources.length>MAX_PILOTS)
    throw new Error("Unverified pilot manifest must contain 1–5 non-qualifying sources.");
  const ids=new Set(),urls=new Set();
  for(const candidate of config.sources){
    if(!/^usgs-[a-z0-9-]{5,45}$/.test(candidate?.id)||ids.has(candidate.id))
      throw new Error("Pilot ID invalid or duplicated.");
    ids.add(candidate.id);
    if(typeof candidate.sourceUrl!=="string"||urls.has(candidate.sourceUrl))
      throw new Error("Source URL duplicated.");
    urls.add(candidate.sourceUrl);
    const uri=new URL(candidate.sourceUrl);
    if(uri.protocol!=="https:"||uri.hostname!=="pubs.usgs.gov"||
       uri.username||uri.password||!uri.pathname.endsWith(".pdf"))
      throw new Error("Only approved HTTPS publisher PDF URLs are allowed.");
    if(!Array.isArray(candidate.selectedPageNumbers)||!candidate.selectedPageNumbers.length||
       candidate.selectedPageNumbers.length>5||
       candidate.selectedPageNumbers.some(p=>!Number.isInteger(p)||p<1||p>200)||
       new Set(candidate.selectedPageNumbers).size!==candidate.selectedPageNumbers.length)
      throw new Error("Pilot must choose 1–5 unique, bounded PDF page numbers.");
    if(candidate.rightsStatus!=="REVIEW_REQUIRED")
      throw new Error("Pilot rights review may not be auto-approved.");
  }
}

async function fetchPublisherPdf(url){
  const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(90000),headers:{
    "User-Agent":"Kukureku-EngineV4-Research-Pilot/1.0 (no redistribution)",
    "Accept":"application/pdf"
  }});
  if(!response.ok)throw new Error("Publisher returned HTTP "+response.status);
  const resolved=new URL(response.url);
  if(resolved.protocol!=="https:"||resolved.hostname!=="pubs.usgs.gov")
    throw new Error("Unexpected publisher redirect host.");
  const declared=Number(response.headers.get("content-length")??0);
  if(declared>MAX_BYTES)throw new Error("Publisher PDF exceeds 25 MB.");
  if(!response.body)throw new Error("Publisher returned no PDF body.");
  const chunks=[];let size=0;
  for await(const item of response.body){
    const chunk=Buffer.from(item);size+=chunk.length;
    if(size>MAX_BYTES)throw new Error("Publisher PDF exceeds 25 MB.");
    chunks.push(chunk);
  }
  const bytes=Buffer.concat(chunks);
  if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")
    throw new Error("Publisher response was not PDF.");
  return bytes;
}

const config=JSON.parse(await readFile(configPath,"utf8"));
validatePilotConfig(config);
await mkdir(pilotRoot,{recursive:true});
const sourceHashes=new Set();
for(const candidate of config.sources){
  const source=await fetchPublisherPdf(candidate.sourceUrl);
  const digest=sha(source);
  if(sourceHashes.has(digest))throw new Error("Different pilots share identical publisher PDF bytes.");
  sourceHashes.add(digest);
  const original=await PDFDocument.load(source,{ignoreEncryption:false});
  const sourcePages=original.getPageCount();
  if(candidate.selectedPageNumbers.some(p=>p>sourcePages))
    throw new Error(candidate.id+": selected page outside publisher PDF.");
  const copied=await PDFDocument.create();
  const indices=candidate.selectedPageNumbers.map(p=>p-1);
  for(const page of await copied.copyPages(original,indices))copied.addPage(page);
  const excerpt=Buffer.from(await copied.save());
  const metadata={
    id:candidate.id,sourceUrl:candidate.sourceUrl,
    publicationPage:candidate.publicationPage,
    rightsGuidanceUrl:config.rightsGuidanceUrl,
    sourceSha256:digest,subsetSha256:sha(excerpt),
    originalBytes:source.length,subsetBytes:excerpt.length,sourcePages,
    selectedPageNumbers:[...candidate.selectedPageNumbers],
    reviewFocus:candidate.reviewFocus,
    rightsStatus:"REVIEW_REQUIRED: third-party content not independently cleared",
    referenceStatus:"NOT_ANNOTATED",
    realDocumentCountCredit:0,
    isRelease37AcceptanceEvidence:false,
  };
  // Source bytes only exist on the ephemeral CI runner; never upload or commit.
  await writeFile(path.join(pilotRoot,candidate.id+"-pilot.pdf"),excerpt);
  await writeFile(path.join(pilotRoot,candidate.id+"-metadata.json"),JSON.stringify(metadata,null,2)+"\n");
  console.log(JSON.stringify({id:metadata.id,sourcePages,selectedPageNumbers:metadata.selectedPageNumbers,
    originalBytes:metadata.originalBytes,subsetBytes:metadata.subsetBytes,
    sourceSha256:metadata.sourceSha256,acceptedCountCredit:0,referenceStatus:"NOT_ANNOTATED"}));
}
