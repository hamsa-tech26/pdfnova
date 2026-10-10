import {lstat,readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validatePrivateManifest,assessRealWorldCoverage,REALWORLD_POLICY} from "./privateGoldenScorer.mjs";

// ALL original PDFs, annotations and actual output remain under this gitignored folder.
export const PRIVATE_ROOT=path.resolve("benchmarks/golden/private");
export const RUNNER_VERSION="release52-browser-v1";
const sha256=buffer=>createHash("sha256").update(buffer).digest("hex");
const failure=()=>{throw new Error("PRIVATE_GOLDEN_DATA_UNAVAILABLE_OR_INVALID");};
const annotationHash=entry=>sha256(Buffer.from(JSON.stringify({annotation:entry.annotation,expected:entry.expected})));
async function regular(file){
  const i=await lstat(file);
  if(!i.isFile()||i.isSymbolicLink())failure();
  return i;
}
export async function privateCorpus(){
  try{
    const dir=await lstat(PRIVATE_ROOT);
    if(!dir.isDirectory()||dir.isSymbolicLink())failure();
    const file=path.join(PRIVATE_ROOT,"manifest.json");
    const info=await regular(file);
    if(info.size>1048576)failure();
    const manifest=JSON.parse(await readFile(file,"utf8"));
    validatePrivateManifest(manifest);return manifest;
  }catch{failure();}
}
export async function readPrivatePdf(entry){
  try{
    const file=path.join(PRIVATE_ROOT,entry.file);
    if(path.dirname(file)!==PRIVATE_ROOT)failure();
    const info=await regular(file);
    if(info.size<16||info.size>REALWORLD_POLICY.maxPdfBytes)failure();
    const bytes=await readFile(file);
    if(bytes.subarray(0,5).toString("ascii")!=="%PDF-"||sha256(bytes)!==entry.sha256.toLowerCase())failure();
    return bytes;
  }catch{failure();}
}
export async function writePrivateResult(entry,result){
  const output=path.join(PRIVATE_ROOT,"results");
  await mkdir(output,{recursive:true,mode:0o700});
  const row={
    id:entry.id,category:entry.category,status:result.status,
    reasonCode:result.reasonCode??"UNKNOWN",metrics:result.metrics??{},
    pdfHash:entry.sha256.toLowerCase(),annotationHash:annotationHash(entry),
    runnerVersion:RUNNER_VERSION};
  await writeFile(path.join(output,entry.id+".json"),JSON.stringify(row,null,2)+"\n",{mode:0o600});
}
export async function summarizePrivate(requireComplete=false){
  try{
    const manifest=await privateCorpus();
    const measured=[];
    for(const entry of manifest.cases){
      let status="NOT_RUN";
      try{
        const file=path.join(PRIVATE_ROOT,"results",entry.id+".json");
        const info=await regular(file);
        if(info.size>50000)failure();
        const r=JSON.parse(await readFile(file,"utf8"));
        if(r.id===entry.id&&r.category===entry.category&&
          r.pdfHash===entry.sha256.toLowerCase()&&r.annotationHash===annotationHash(entry)&&
          r.runnerVersion===RUNNER_VERSION&&["PASS","FAIL"].includes(r.status))status=r.status;
      }catch{}
      measured.push({id:entry.id,status});
    }
    const summary=assessRealWorldCoverage(manifest,measured);
    await writeFile(path.join(PRIVATE_ROOT,"local-qualification.json"),JSON.stringify(summary,null,2)+"\n",{mode:0o600});
    if(requireComplete&&summary.status!=="PASS_SCOPED_REAL_WORLD")process.exitCode=2;
    console.log(JSON.stringify(summary,null,2));return summary;
  }catch{
    const summary={schema:"kukureku-private-golden-coverage-v1",status:"NOT_RUN",
      realWorldCases:0,passed:0,failed:0,notRun:0,
      note:"No approved independently reviewed real-world PDF corpus has been measured."};
    if(requireComplete)process.exitCode=2;
    console.log(JSON.stringify(summary,null,2));return summary;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await summarizePrivate(process.argv.includes("--require-complete"));
