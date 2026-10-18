/**
 * Run LOCALLY only, after two annotators have separately filled the source
 * PDF's blind references. No cell values or original PDF bytes leave this
 * machine. Never run on hosted CI with real source data.
 *
 * Usage: node scripts/compareRelease85BlindAnnotations.mjs <document-id>
 * Files under benchmarks/release37/private/:
 *    <document-id>.pdf
 *    <document-id>-annotator-a.json
 *    <document-id>-annotator-b.json
 */
import {readFile,lstat,realpath} from "node:fs/promises";
import {createHash} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {compareRelease85BlindAnnotations} from "./release85BlindAgreement.mjs";

const ROOT=path.resolve("benchmarks/release37/private");
const ID=/^[a-z0-9][a-z0-9._-]{2,99}$/i;
async function safeRead(file,ext,max){
  const resolved=path.resolve(ROOT,file);
  if(path.dirname(resolved)!==ROOT||path.extname(resolved).toLowerCase()!==ext)
    throw Error("Refused a path outside the private reference directory.");
  const root=await realpath(ROOT);
  const rootStat=await lstat(ROOT);
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink())
    throw Error("Unsafe private corpus root.");
  const st=await lstat(resolved);
  if(!st.isFile()||st.isSymbolicLink()||st.size<8||st.size>max)
    throw Error("Invalid local private source or annotation file.");
  const fileReal=await realpath(resolved);
  if(path.dirname(fileReal)!==root)
    throw Error("Private corpus symlink escapes local source directory.");
  return readFile(fileReal);
}
export async function compareRelease85LocalBlindReviews(id){
  if(process.env.CI)throw Error("REAL_BLIND_ANNOTATION_MUST_BE_LOCAL_ONLY");
  if(typeof id!=="string"||!ID.test(id))throw Error("Invalid document identifier.");
  const pdf=await safeRead(id+".pdf",".pdf",30*1024*1024);
  if(pdf.length<500||pdf.subarray(0,5).toString("ascii")!=="%PDF-")
    throw Error("Original source is not a supported PDF.");
  const [left,right]=await Promise.all([
    safeRead(id+"-annotator-a.json",".json",1024*1024),
    safeRead(id+"-annotator-b.json",".json",1024*1024),
  ]);
  const actual=await PDFDocument.load(pdf,{updateMetadata:false});
  const sha256=createHash("sha256").update(pdf).digest("hex");
  const a=JSON.parse(left.toString("utf8")),b=JSON.parse(right.toString("utf8"));
  const comparison=compareRelease85BlindAnnotations(a,b,{
    sha256,pageCount:actual.getPageCount(),
  });
  return {documentId:id,...comparison};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try {
    const result=await compareRelease85LocalBlindReviews(process.argv[2]);
    console.log(JSON.stringify(result,null,2));
    if(result.status!=="MATCHED_PENDING_INDEPENDENT_APPROVAL")
      process.exitCode=2;
  } catch {
    // Do not leak filenames, raw PDF content or JSON parse excerpts to logs.
    console.error("Blind comparison blocked: check private source files, independent annotation, source hash and permissions.");
    process.exitCode=1;
  }
}
