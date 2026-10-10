/**
 * Release 54: prepare ONLY a local draft. No document, annotation or
 * consent is invented, and nothing is sent to a web service.
 */
import {mkdir,lstat,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {CATEGORIES,REALWORLD_POLICY} from "./privateGoldenScorer.mjs";
import {PRIVATE_ROOT} from "./privateGoldenLocal.mjs";

const SLOTS={
  "ocr-text":["ocr-scan-one","ocr-scan-two"],
  table:["table-one","table-two"],
  form:["form-one","form-two"],
  layout:["layout-one","layout-two"],
};
const expectedFor=category=>{
  if(category==="ocr-text")return {text:""};
  if(category==="table")return {tableIndex:null,rows:[]};
  if(category==="form")return {visiblePhrases:[]};
  return {pageCount:null,pages:[]};
};
export function makePrivateGoldenDraft(){
  const cases=CATEGORIES.flatMap(category=>SLOTS[category].map(id=>({
    id,category,file:"case-"+id+".pdf",sha256:"",
    rights:"REVIEW_REQUIRED",
    annotation:{annotatorId:"",reviewerId:"",reviewerApproved:false,reviewDate:""},
    expected:expectedFor(category)
  })));
  return {schema:"kukureku-private-golden-v1",provenance:"DRAFT_NOT_REVIEWED",
    reminder:"NOT certified. Independently annotate, approve, hash and verify each actual PDF before promoting this draft.",
    cases};
}
export function scaffoldChecklist(){
  return {schema:"kukureku-release54-intake-plan-v1",
    status:"AWAITING_APPROVED_CORPUS",
    slots:Object.fromEntries(CATEGORIES.map(category=>[category,{
      requested:REALWORLD_POLICY.requiredPerCategory[category],
      filenames:SLOTS[category].map(id=>"case-"+id+".pdf")} ])),
    realWorldDocumentsMeasured:0,qualification:"NOT_RUN",
    nextActions:["Obtain permitted real PDF and independently reviewed ground truth.",
      "Store PDFs and answers only under the local gitignored private directory.",
      "Replace all draft placeholders, secure independent review, and validate source hashes.",
      "Run preflight, private browser suite and fail-closed qualification report."]
  };
}
export async function createLocalDraft(){
  if(process.env.CI)throw Error("Private corpus intake drafts are LOCAL_ONLY.");
  await mkdir(PRIVATE_ROOT,{recursive:true,mode:0o700});
  const dir=await lstat(PRIVATE_ROOT);
  if(!dir.isDirectory()||dir.isSymbolicLink())
    throw Error("PRIVATE_GOLDEN_UNSAFE_INTAKE_DIRECTORY");
  const file=path.join(PRIVATE_ROOT,"manifest.draft.json");
  await writeFile(file,JSON.stringify(makePrivateGoldenDraft(),null,2)+"\n",
    {encoding:"utf8",flag:"wx",mode:0o600});
  console.log(JSON.stringify({status:"DRAFT_CREATED_LOCAL_ONLY",
    documentSlots:8,manifest:"benchmarks/golden/private/manifest.draft.json",
    realWorldMeasured:0,warning:"Requires rights, real SHA-256, independent annotation and second-reviewer approval."},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes("--plan"))console.log(JSON.stringify(scaffoldChecklist(),null,2));
  else await createLocalDraft();
}
