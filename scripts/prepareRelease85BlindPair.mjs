/**
 * Creates two EMPTY source-first worksheets under gitignored private storage.
 * This is a local convenience tool, not an annotator or independent reviewer.
 * The first and second annotators must each first prepare their own independently observed layout-a/layout-b JSON and fill the generated drafts separately WITHOUT seeing
 * each other's work or Kukureku output. It never populates expected cells.
 *
 * Usage: node scripts/prepareRelease85BlindPair.mjs <id>
 */
import {PDFDocument} from "pdf-lib";
import {createHash} from "node:crypto";
import {mkdir,lstat,readFile,writeFile,unlink} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {makeRelease37BlindReferenceDraft} from "./release37BlindReference.mjs";

const ROOT=path.resolve("benchmarks/release37/private");
const VALID_ID=/^[a-z0-9][a-z0-9._-]{2,99}$/i;
async function sourceFile(id,suffix,maxBytes){
  const file=path.join(ROOT,id+suffix);
  if(path.dirname(file)!==ROOT)throw Error("Refused non-private source path.");
  const stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes||stat.size<8)
    throw Error("Invalid private input file.");
  return readFile(file);
}
export async function prepareRelease85BlindPair(id){
  if(process.env.CI)throw Error("BLIND_SOURCE_DRAFTS_MUST_BE_LOCAL_ONLY");
  if(typeof id!=="string"||!VALID_ID.test(id))throw Error("Invalid original PDF ID.");
  await mkdir(ROOT,{recursive:true,mode:0o700});
  const dir=await lstat(ROOT);
  if(!dir.isDirectory()||dir.isSymbolicLink())
    throw Error("Private reference root must be a real directory.");
  const pdf=await sourceFile(id,".pdf",30*1024*1024);
  if(pdf.length<500||pdf.subarray(0,5).toString("ascii")!=="%PDF-")
    throw Error("Expected a real original PDF.");
  // Independent SOURCE-OBSERVED layouts from the two annotators are essential:
  // sharing one layout pre-populates the geometry and destroys geometry
  // blindness, even when the cell text was annotated separately.
  const [layoutA,layoutB]=await Promise.all([
    sourceFile(id,"-layout-a.json",50_000),
    sourceFile(id,"-layout-b.json",50_000),
  ]);
  const source=await PDFDocument.load(pdf,{updateMetadata:false});
  const input={
    id,originalPdfSha256:createHash("sha256").update(pdf).digest("hex"),
    sourcePageCount:source.getPageCount(),
  };
  const emptyA=makeRelease37BlindReferenceDraft({
    ...input,tables:JSON.parse(layoutA.toString("utf8")).tables,
  });
  const emptyB=makeRelease37BlindReferenceDraft({
    ...input,tables:JSON.parse(layoutB.toString("utf8")).tables,
  });
  const a=path.join(ROOT,id+"-annotator-a.json");
  const b=path.join(ROOT,id+"-annotator-b.json");
  // Deliberately never replace a reviewer's work. On failure to create B,
  // undo only the fresh A created during this call.
  await writeFile(a,JSON.stringify(emptyA,null,2)+"\n",
    {encoding:"utf8",flag:"wx",mode:0o600});
  try {
    await writeFile(b,JSON.stringify(emptyB,null,2)+"\n",
      {encoding:"utf8",flag:"wx",mode:0o600});
  } catch (error){
    await unlink(a);
    throw error;
  }
  return {
    status:"TWO_EMPTY_PRIVATE_DRAFTS_CREATED_NO_REVIEW_CREDIT",
    originalDocumentId:id,
    sourcePages:emptyA.sourcePageCount,
    layoutATables:emptyA.tables.length,
    layoutBTables:emptyB.tables.length,
    blankSourceCellSlotsA:emptyA.tables.reduce((n,t)=>n+t.rowCount*t.columnCount,0),
    blankSourceCellSlotsB:emptyB.tables.reduce((n,t)=>n+t.rowCount*t.columnCount,0),
    acceptedDocumentCredit:0,
    warning:"Two distinct reviewers must separately transcribe original PDF cells. This script produces EMPTY copies, not independent review."
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await prepareRelease85BlindPair(process.argv[2]),null,2))}
  catch {
    console.error("Blind draft preparation blocked: private original PDF, source-first layout, safe files and unused output names required.");
    process.exitCode=1;
  }
}
