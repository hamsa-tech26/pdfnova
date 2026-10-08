import {readFile,writeFile,mkdir,realpath} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {scoreRelease37Case,aggregateRelease37Scores} from "./scoreRelease37Cases.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const allowedCategories=new Set(["native","scanned","hybrid","complex","multipage","rotated","hindi","bengali"]);
const allowedRights=new Set(["public-domain","licensed","consented","de-identified"]);
const privateRoot=path.resolve("benchmarks/release37/private");
function validHttps(uri) {
  try {const u=new URL(uri);return u.protocol==="https:" && !!u.hostname && !u.username && !u.password;}
  catch {return false;}
}
export function validateRelease37Entry(entry) {
  const errors=[];
  if(typeof entry?.id!=="string"||!/^[a-z0-9][a-z0-9._-]{2,99}$/i.test(entry.id)) errors.push("invalid document ID");
  if(entry?.origin!=="real-world")errors.push("not a real-world document");
  if(!allowedRights.has(entry?.usageRights))errors.push("unverified rights category");
  if(!validHttps(entry?.rightsUrl))errors.push("rights evidence URL missing");
  if(!validHttps(entry?.sourceUrl))errors.push("source URL missing");
  if(entry?.rightsConfirmed!==true)errors.push("human rights clearance missing");
  if(!Array.isArray(entry?.categories)||entry.categories.length===0||
     entry.categories.some(c=>!allowedCategories.has(c))) errors.push("unrecognized or missing categories");
  if(!/^[a-f0-9]{64}$/i.test(String(entry?.sha256??"")))errors.push("invalid original PDF SHA-256");
  if(!entry?.independentReferenceReview||typeof entry?.reviewedBy!=="string"||
     entry.reviewedBy.trim().length<3||! /^\d{4}-\d\d-\d\d$/.test(entry?.reviewedAt??"")) {
    errors.push("independently reviewed reference labels missing");
  }
  for(const key of ["localPdf","referenceJson","inspectorJson"]) {
    if(typeof entry?.[key]!=="string"||!entry[key].trim())errors.push(key+" path missing");
  }
  return errors;
}
async function readPrivateFile(filename,allowedExt){
  if(typeof filename!=="string")throw new Error("File path missing.");
  const candidate=path.resolve(filename);
  // Never read arbitrary developer files, secrets, or external user folders.
  if(!candidate.startsWith(privateRoot+path.sep))throw new Error("Corpus files must stay in benchmarks/release37/private");
  if(path.extname(candidate).toLowerCase()!==allowedExt)throw new Error("Invalid corpus input extension");
  const resolved=await realpath(candidate);
  const root=await realpath(privateRoot);
  if(!resolved.startsWith(root+path.sep))throw new Error("Corpus symlink escapes the private directory");
  return readFile(resolved);
}
export function buildRelease37CorpusReport(measuredRecords,extra={}) {
  const categories=[...allowedCategories];
  const summary={};
  for(const category of categories) {
    const records=measuredRecords.filter(record=>record.categories.includes(category));
    const totals=aggregateRelease37Scores(records.map(r=>r.score));
    const allMeasured=records.length>0&&["cells","rows","structure"].every(key=>totals[key].total>0);
    const ocrCategory=["scanned","hindi","bengali"].includes(category);
    const language=category==="hindi"?"hin":category==="bengali"?"ben":null;
    const actualOcrAttempted=ocrCategory&&records.length>0&&records.every(r=>
      r.score.actualOcrAttempted && (!language || r.score.ocrLanguages.includes(language)));
    const evidenceDigest=sha(records.map(r=>[
      r.id,r.pdfSha,r.goldSha,r.outputSha,JSON.stringify(r.score),
    ].join(":")).sort().join("\n"));
    summary[category]={
      status:allMeasured?"MEASURED":"NOT_VERIFIED",
      source:"real-world",documentCount:records.length,actualOcrAttempted,
      cellPct:totals.cells.pct,rowPct:totals.rows.pct,structurePct:totals.structure.pct,
      scoredFromFiles:allMeasured,groundTruthVerified:records.length>0&&records.every(r=>r.independentReferenceReview),
      evidenceDigest:allMeasured?evidenceDigest:null,
      counts:totals,
    };
  }
  return {
    status:"INCOMPLETE_PENDING_FORMAL_GATE",
    corpus:{documents:measuredRecords.map(r=>({
      id:r.id,origin:"real-world",usageRights:r.usageRights,rightsUrl:r.rightsUrl,sourceUrl:r.sourceUrl,
      sha256:r.pdfSha,categories:r.categories,
      independentReferenceReview:r.independentReferenceReview,
    }))},
    metrics:summary,
    phases:extra.phases??{},
    regressions:extra.regressions??{},
    performance:extra.performance??{},
    syntheticPhase10_14:extra.syntheticPhase10_14??{status:"NOT_VERIFIED"},
    summary:{measuredDocuments:measuredRecords.length,
      warning:"Scores are diagnostic until all independent acceptance criteria pass. Source text and PDFs are never included."},
  };
}
export async function collectRelease37Corpus(manifest){
  if(!Array.isArray(manifest?.documents))throw new Error("manifest.documents[] required");
  const uniqueIds=new Set();
  const records=[];
  for(const entry of manifest.documents) {
    const errors=validateRelease37Entry(entry);
    if(errors.length)throw new Error(String(entry?.id??"unknown")+": "+errors.join("; "));
    if(uniqueIds.has(entry.id))throw new Error("Duplicated document ID: "+entry.id);
    uniqueIds.add(entry.id);
    const pdf=await readPrivateFile(entry.localPdf,".pdf");
    if(pdf.length<500||pdf.subarray(0,5).toString("ascii")!=="%PDF-")throw new Error(entry.id+": not a valid PDF signature");
    if(pdf.length>30*1024*1024)throw new Error(entry.id+": exceeds 30 MB benchmark intake limit");
    const pdfSha=sha(pdf);
    if(pdfSha.toLowerCase()!==entry.sha256.toLowerCase())throw new Error(entry.id+": input PDF SHA-256 mismatch");
    const goldBytes=await readPrivateFile(entry.referenceJson,".json");
    const resultBytes=await readPrivateFile(entry.inspectorJson,".json");
    const gold=JSON.parse(goldBytes.toString("utf8"));
    const result=JSON.parse(resultBytes.toString("utf8"));
    // Requiring a full Inspector result discourages fabricated CSV-only metrics.
    if(!Array.isArray(result.document?.pages)||!Array.isArray(result.tables)||
       !result.processingTimes || !result.ocrDecision)throw new Error(entry.id+": incomplete V4 Inspector output");
    const score=scoreRelease37Case(gold,result);
    records.push({
      id:entry.id,usageRights:entry.usageRights,rightsUrl:entry.rightsUrl,sourceUrl:entry.sourceUrl,
      categories:[...new Set(entry.categories)],independentReferenceReview:true,
      pdfSha,goldSha:sha(goldBytes),outputSha:sha(resultBytes),score,
    });
  }
  return buildRelease37CorpusReport(records);
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const input=process.argv[2]??"benchmarks/release37/private/manifest.json";
  const manifest=JSON.parse(await readPrivateFile(input,".json").then(bytes=>bytes.toString("utf8")));
  const report=await collectRelease37Corpus(manifest);
  const destination=path.resolve("benchmarks/release37/reports/real-corpus.json");
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({report:destination,documents:report.summary.measuredDocuments,
    categories:Object.fromEntries(Object.entries(report.metrics).map(([name,x])=>[name,{
      count:x.documentCount,state:x.status,cellPct:x.cellPct,rowPct:x.rowPct,structurePct:x.structurePct,
    }]))},null,2));
  if(report.summary.measuredDocuments===0)process.exitCode=2;
}
