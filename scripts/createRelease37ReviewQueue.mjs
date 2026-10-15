import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const root=path.resolve("benchmarks/release37");
const manifest=JSON.parse(await readFile(path.join(root,"pilot-sources.json"),"utf8"));
if(manifest.status!=="PILOT_ONLY_NOT_ANNOTATED"||
   manifest.acceptedCountCredit!==0||!Array.isArray(manifest.sources))
  throw new Error("Review queue requires an entirely unverified pilot manifest.");
const queue=[];
for(const entry of manifest.sources){
  const source=JSON.parse(await readFile(path.join(root,"private",entry.id+"-metadata.json"),"utf8"));
  const report=JSON.parse(await readFile(path.join(root,"reports",entry.id+"-diagnostic.json"),"utf8"));
  if(report.sourceId!==source.id || source.id!==entry.id ||
     report.sourceSha256!==source.sourceSha256 ||
     report.referenceStatus!=="NOT_ANNOTATED"||
     source.realDocumentCountCredit!==0 || report.realDocumentCountCredit!==0||
     source.isRelease37AcceptanceEvidence!==false ||
     report.acceptanceState!=="NOT_VERIFIED")
    throw new Error("Pilot evidence unexpectedly marked as accepted or inconsistent.");
  queue.push({
    id:entry.id,
    sourceUrl:entry.sourceUrl,
    publicationPage:entry.publicationPage,
    sourceSha256:source.sourceSha256,
    sourcePageCount:source.sourcePages,
    diagnosticPageNumbers:source.selectedPageNumbers,
    referenceScope:"FULL ORIGINAL SOURCE PDF REQUIRED; DERIVATIVE EXCERPT DOES NOT COUNT",
    diagnosticTableCount:report.tableCount,
    reviewerTasks:[
      "Confirm report-specific source rights and any third-party content exceptions",
      "Choose the full original source document, not only extracted pilot pages",
      "Record independently verified page/table row/column/span and blank-cell labels",
      "Preserve original source hash and raw Inspector output in PRIVATE local directory",
      "Have a separate reviewer attest and date full reference annotations",
      "Run private real-corpus scoring, inspect errors and record failed criteria"
    ],
    rightsConfirmed:false,
    independentReferenceReview:false,
    annotationStatus:"PENDING",
    requiredReferences:"Private source PDF, independently reviewed table annotations and actual Inspector JSON",
    acceptanceStatus:"NOT_VERIFIED",
    acceptedDocumentCredit:0
  });
}
const output={
  schema:"kukureku-v4-review-queue-v1",
  status:"REVIEW_REQUIRED",
  acceptedDistinctRealDocuments:0,
  pilotCount:queue.length,
  note:"No pilot is approved for corpus scoring; source rights and independent full-document labels are pending.",
  queue
};
await mkdir(path.join(root,"reports"),{recursive:true});
await writeFile(path.join(root,"reports","review-queue.json"),JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({pilotCount:queue.length,acceptedCount:0,reviewPending:queue.length}));
