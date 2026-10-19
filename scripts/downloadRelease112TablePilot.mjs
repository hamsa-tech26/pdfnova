import {createHash} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve,join} from "node:path";

const root=resolve("benchmarks/release112");
const hidden=join(root,"private");
const manifest=JSON.parse(await readFile(join(root,"sources.json"),"utf8"));
if(manifest.scope!=="EXTERNAL_TABLE_DETECTION_DIAGNOSTIC_ONLY"||
  manifest.acceptedFormalV4DocumentCredit!==0||
  manifest.documents?.length!==2)throw Error("Unsupported diagnostic scope");
const digest=b=>createHash("sha256").update(b).digest("hex");
async function download(url,maxBytes){
  const u=new URL(url);
  if(u.protocol!=="https:"||u.username||u.password||
    !["huggingface.co","pmc-oa-opendata.s3.amazonaws.com"].includes(u.hostname))
    throw Error("Unapproved data source");
  const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(90000)});
  if(!response.ok||!response.body)throw Error("Publisher download failed: "+response.status);
  const declared=Number(response.headers.get("content-length")||0);
  if(declared>maxBytes)throw Error("Source above byte cap");
  const chunks=[];let count=0;
  for await(const part of response.body){
    const buffer=Buffer.from(part);count+=buffer.length;
    if(count>maxBytes)throw Error("Source exceeded byte cap");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
await mkdir(hidden,{recursive:true});
const tar=manifest.annotationArchive;
const archive=await download(tar.url,tar.maximumBytes);
if(digest(archive)!==tar.sha256)throw Error("PubTables published sample checksum differs");
const archivePath=join(hidden,"published-detection-annotations.tar.gz");
await writeFile(archivePath,archive);
const listing=execFileSync("tar",["-tzf",archivePath],{
  encoding:"utf8",timeout:45000,maxBuffer:16*1024*1024}).trim().split("\n");
let count=0;
for(const item of manifest.documents){
  const source=await download(item.source,25*1024*1024);
  if(digest(source)!==item.sha256)throw Error(item.id+": unexpected publisher PDF SHA256");
  if(source.subarray(0,5).toString()!=="%PDF-")throw Error(item.id+": not PDF");
  await writeFile(join(hidden,item.id+".pdf"),source);
  for(const page of item.referencePages){
    const matching=listing.filter(path=>path===page.annotation||path.endsWith("/"+page.annotation));
    if(matching.length!==1)throw Error(item.id+" page "+page.page+": missing or duplicate detection XML");
    const xml=execFileSync("tar",["-xOzf",archivePath,matching[0]],{
      encoding:"utf8",timeout:30000,maxBuffer:1024*1024});
    await writeFile(join(hidden,page.annotation),xml);
    count++;
  }
  console.log(JSON.stringify({document:item.id,pageCountExpected:item.sourcePages,
    referencePageCount:item.referencePages.length,hashVerified:true,
    formalV4DocumentCredit:0}));
}
console.log(JSON.stringify({annotationArchiveHashVerified:true,annotationXmlCount:count,
  // Five annotated pages contain six published boxes, not six documents.
  publishedBoxesExpected:6,formalV4DocumentCredit:0}));
