/**
 * Local-only blind reference starter.
 * Put ORIGINAL source PDF at benchmarks/release37/private/<id>.pdf.
 * Separately inspect the PDF, then manually create <id>-layout.json containing:
 *   { "tables": [{ "pageNumber": 1, "rowCount": 3, "columnCount": 4 }] }
 * The layout must be independently observed; it may NOT be derived from
 * the Inspector's predicted row, table or cell output.
 */
import {PDFDocument} from "pdf-lib";
import {createHash} from "node:crypto";
import {mkdir,lstat,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {makeRelease37BlindReferenceDraft} from "./release37BlindReference.mjs";

const ROOT=path.resolve("benchmarks/release37/private");
const VALID_ID=/^[a-z0-9][a-z0-9._-]{2,99}$/i;
async function safeFile(p,ext){
  if(path.dirname(p)!==ROOT||path.extname(p)!==ext)
    throw Error("Only local private corpus files are accepted.");
  const st=await lstat(p);
  if(!st.isFile()||st.isSymbolicLink()||st.size>30*1024*1024||st.size<8)
    throw Error("Invalid private reference input.");
  return readFile(p);
}
export async function prepareRelease37BlindReference(id){
  if(process.env.CI)throw Error("Independent reviewer drafts must be LOCAL_ONLY.");
  if(!VALID_ID.test(id??""))throw Error("Invalid document ID.");
  await mkdir(ROOT,{recursive:true,mode:0o700});
  const rootStatus=await lstat(ROOT);
  if(!rootStatus.isDirectory()||rootStatus.isSymbolicLink())
    throw Error("Unsafe private reference directory.");
  const pdf=await safeFile(path.join(ROOT,id+".pdf"),".pdf");
  if(pdf.subarray(0,5).toString("ascii")!=="%PDF-")
    throw Error("Expected actual PDF source file.");
  const layoutBytes=await safeFile(path.join(ROOT,id+"-layout.json"),".json");
  if(layoutBytes.length>50000)throw Error("Layout exceeds safe JSON size.");
  const layout=JSON.parse(layoutBytes.toString("utf8"));
  const source=await PDFDocument.load(pdf,{updateMetadata:false});
  const draft=makeRelease37BlindReferenceDraft({
    id,originalPdfSha256:createHash("sha256").update(pdf).digest("hex"),
    sourcePageCount:source.getPageCount(),tables:layout.tables
  });
  const destination=path.join(ROOT,id+"-reference.draft.json");
  await writeFile(destination,JSON.stringify(draft,null,2)+"\n",
    {encoding:"utf8",flag:"wx",mode:0o600});
  return {
    status:"BLIND_DRAFT_NOT_APPROVED",
    documentId:id,pages:draft.sourcePageCount,tables:draft.tables.length,
    referenceSlots:draft.tables.reduce((n,t)=>n+t.rowCount*t.columnCount,0),
    file:path.relative(process.cwd(),destination),
    warning:"All text values are null. Source-first annotation and second reviewer are required."
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const summary=await prepareRelease37BlindReference(process.argv[2]);
  console.log(JSON.stringify(summary,null,2));
}
