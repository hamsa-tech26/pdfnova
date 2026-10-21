/**
 * Public-document, published-box benchmark prequalification ONLY.
 * Fetch up to 20 distinct PubTables test documents and their publisher PDFs,
 * save source bytes privately to an ephemeral CI runner, and independently
 * score the published detection boxes. ZERO formal real-world certification
 * credit: human rights verification, independent CELL references, Hindi and
 * Bengali, stress, blind reviewer agreement and quality metrics still absent.
 */
import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve,join} from "node:path";
import {PDFDocument} from "pdf-lib";

export const CANDIDATE_CAP=90;
export const SOURCE_TARGET=20;
export const BYTE_CAP=25*1024*1024;
export const digest=b=>createHash("sha256").update(b).digest("hex");
const archiveUrl="https://huggingface.co/datasets/bsmock/pubtables-1m/resolve/main/PubTables-1M-Detection_Annotations_Test.tar.gz";
const archiveSha="6787eb4da4b6e975ec5df46d1d836d072cce3fb645e150039ac88fd02d056b48";
const root=resolve("benchmarks/release166"),hidden=join(root,"private");

export function candidateDocumentIds(listing){
  if(!Array.isArray(listing)||listing.length>100000)return [];
  const group=new Set();
  for(const item of listing){
    const match=/^(?:[^/\n]+\/)*((?:PMC\d{5,10}))_(\d{1,3})\.xml$/.exec(item);
    if(match&&Number(match[2])<=25)group.add(match[1]);
  }
  // Deterministic and dataset-blind selection; no table detector output may
  // influence corpus selection. A hash-based ordering avoids prefix bias.
  return [...group].sort((a,b)=>digest("v4-public20-v1:"+a)
    .localeCompare(digest("v4-public20-v1:"+b))).slice(0,CANDIDATE_CAP);
}
async function fetchBounded(url,maxBytes,ms=24000){
  const u=new URL(url);
  if(u.protocol!=="https:"||
    !["huggingface.co","pmc-oa-opendata.s3.amazonaws.com"].includes(u.hostname))
    throw Error("Refused foreign or insecure benchmark source");
  const response=await fetch(url,{signal:AbortSignal.timeout(ms),redirect:"follow"});
  if(!response.ok||!response.body)throw Error("HTTP "+response.status);
  const declared=Number(response.headers.get("content-length")||0);
  if(declared>maxBytes)throw Error("File over byte limit");
  const chunks=[];let n=0;
  for await(const chunk of response.body){
    n+=chunk.length;
    if(n>maxBytes)throw Error("File over byte limit");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function run(){
  await mkdir(hidden,{recursive:true});
  await mkdir(join(root,"reports"),{recursive:true});
  const archive=await fetchBounded(archiveUrl,5000000,90000);
  if(digest(archive)!==archiveSha)throw Error("Published archive SHA256 mismatch");
  const archivePath=join(hidden,"published-annotations.tar.gz");
  await writeFile(archivePath,archive);
  const listing=execFileSync("tar",["-tzf",archivePath],{
    encoding:"utf8",timeout:45000,maxBuffer:16*1024*1024,
  }).split(/\r?\n/).filter(Boolean);
  const lookup=new Map();
  for(const item of listing){
    const match=/(?:^|\/)(PMC\d{5,10})_(\d{1,3})\.xml$/.exec(item);
    if(!match||Number(match[2])>25)continue;
    const group=lookup.get(match[1])??[];
    group.push({page:Number(match[2]),path:item});
    lookup.set(match[1],group);
  }
  const locked=JSON.parse(await readFile(join(root,"locked-sources.json"),"utf8"));
  if(locked.schema!=="kukureku-pubtables-heldout-test20-locked-v1"||
    locked.formalStableDocumentCredit!==0||
    locked.annotationArchiveSha256!==archiveSha||
    locked.documents?.length!==SOURCE_TARGET)
    throw Error("Invalid independently published source pin set");
  const chosen=[];let attempted=0,skipped=0;
  for(const pinned of locked.documents){
    const id=pinned.id;
    if(!/^PMC\d{5,10}$/.test(id)||!lookup.has(id))
      throw Error("Locked publisher source missing from official annotation archive");
    if(chosen.length>=SOURCE_TARGET)break;
    attempted++;
    const source="https://pmc-oa-opendata.s3.amazonaws.com/"+id+".1/"+id+".1.pdf";
    try{
      const bytes=await fetchBounded(source,BYTE_CAP);
      if(bytes.length<1000||bytes.subarray(0,5).toString()!=="%PDF-")
        throw Error("Invalid PDF header");
      const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
      const pages=pdf.getPageCount();
      if(pages<1||pages>25)throw Error("Page limit");
      const annotations=(lookup.get(id)??[]).filter(x=>x.page<=pages)
        .sort((a,b)=>a.page-b.page);
      if(!annotations.length||annotations.length>25)
        throw Error("Annotation count unsuitable");
      const sourceHash=digest(bytes);
      if(sourceHash!==pinned.sourcePdfSha256||pages!==pinned.sourcePages)
        throw Error("Locked original PDF hash or page count changed");
      await writeFile(join(hidden,id+".pdf"),bytes);
      const references=[];
      for(const entry of annotations){
        const xml=execFileSync("tar",["-xOzf",archivePath,entry.path],{
          encoding:"utf8",timeout:20000,maxBuffer:1024*1024});
        // Reference XML content remains runner-local; only bounded numeric
        // region metadata is retained in resulting CI evidence artifacts.
        await writeFile(join(hidden,id+"_"+entry.page+".xml"),xml);
        references.push({page:entry.page,annotation:id+"_"+entry.page+".xml"});
      }
      chosen.push({id,source,sha256:sourceHash,
        pageCount:pages,referencePages:references});
      console.log(JSON.stringify({id,pages,referencePages:references.length,
        publishedHashVerified:true,formalV4Credit:0}));
    }catch(err){
      // Locked sources are mandatory. Do not silently substitute a different
      // original PDF and bias results or silently lose failed documents.
      throw Error("Pinned publisher document unavailable or mismatched: "+id);
    }
  }
  const manifest={schema:"kukureku-pubtables-test20-v1",
    status:chosen.length===SOURCE_TARGET?"PUBLISHED_BOX_BENCHMARK_READY":"INCOMPLETE",
    source:"PubTables-1M held-out detection TEST annotations",
    annotationArchiveSha256:archiveSha,
    sampledDeterministically:true,lockedSourceHashesVerified:true,
    acceptedFormalV4DocumentCredit:0,
    rightsAndIndependentCellReferenceStatus:"NOT_REVIEWED",
    attemptedCandidates:attempted,skippedCandidates:skipped,
    documents:chosen};
  await writeFile(join(hidden,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify({type:"PUBLISHED20_SOURCE_DISCOVERY",
    availableOriginalPdfCount:chosen.length,attempted,skipped,
    distinctHashes:new Set(chosen.map(x=>x.sha256)).size,
    formalV4DocumentCredit:0}));
  if(chosen.length!==SOURCE_TARGET||new Set(chosen.map(x=>x.sha256)).size!==SOURCE_TARGET)
    throw Error("Insufficient distinct published-PDF benchmarks. No certification attempted.");
}
await run();
