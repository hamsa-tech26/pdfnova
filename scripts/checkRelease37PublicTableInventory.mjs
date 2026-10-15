/**
 * Only public table locations, not annotated truth or any V4 predictions.
 * This check must remain red if inventory metadata is promoted to "reviewed"
 * without a real independent reference-review workflow.
 */
import {readFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

/** @typedef {{id:string,sourceSha256:string,sourcePages:number,selectedPageNumbers:number[],referenceStatus:string,realDocumentCountCredit:number}} PublicSourceMetadata */
/** @param {PublicSourceMetadata | null} [sourceMetadata] */
export function checkRelease37PublicInventory(doc,sourceMetadata=null){
  const failures=[];
  if(doc?.schema!=="kukureku-v4-original-table-inventory-v1"||
     doc?.sourceId!=="usgs-ofr20241025"||
     doc?.inventoryProvenance!=="PUBLIC_PUBLISHER_TABLE_LIST_NOT_HUMAN_REVIEWED")
    failures.push("Publisher inventory provenance or schema is missing.");
  if(doc?.independentSourceReview!==false||
     doc?.allSourceTablesReviewed!==false||
     doc?.rightsConfirmed!==false||doc?.acceptedDocumentCredit!==0||
     doc?.reviewStatus!=="PENDING_ORIGINAL_PDF_VISUAL_AND_RIGHTS_REVIEW")
    failures.push("Unreviewed public inventory must never grant acceptance credit.");
  if(!/^https:\/\/pubs\.usgs\.gov\/of\/2024\/1025\/ofr20241025\.pdf$/.test(doc?.sourceUrl??""))
    failures.push("Unexpected source URL.");
  if(!/^[a-f0-9]{64}$/.test(doc?.originalPdfSha256FromPilot??"")||
     doc?.originalPdfPagesFromPilot!==30)
    failures.push("Unexpected publisher original file metadata.");
  if(!Array.isArray(doc?.tables)||doc.tables.length!==5||
     doc.tables.some((t,i)=>
       t.id!==["T1","T2","T3","T4","T5"][i]||
       t.originalPdfPageNumber!==[14,17,18,19,20][i]||
       t.rowCount!==null||t.columnCount!==null||t.cells!==null||
       t.referenceStatus!=="NOT_ANNOTATED"||t.verifiedBy!==null))
    failures.push("All five publisher tables must be uniquely listed without inferred reference labels.");
  if(sourceMetadata!==null){
    if(sourceMetadata.id!==doc.sourceId||
       sourceMetadata.sourceSha256!==doc.originalPdfSha256FromPilot||
       sourceMetadata.sourcePages!==doc.originalPdfPagesFromPilot||
       sourceMetadata.referenceStatus!=="NOT_ANNOTATED"||
       sourceMetadata.realDocumentCountCredit!==0)
      failures.push("Current publisher PDF metadata differs or claimed unreviewed credit.");
    if(!sourceMetadata.selectedPageNumbers?.every(x=>[14,17,18,19,20].includes(x))||
       ![14,19,20].every(x=>sourceMetadata.selectedPageNumbers.includes(x)))
      failures.push("Diagnostic pilot must exercise three structurally diverse publisher table pages.");
  }
  return {status:failures.length?"BLOCKED":"PUBLISHER_INVENTORY_PENDING_REVIEW",failures,
    listedTables:Array.isArray(doc?.tables)?doc.tables.length:0,
    acceptedDocuments:0};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const file=path.resolve("benchmarks/release37/public-table-inventory.json");
  const doc=JSON.parse(await readFile(file,"utf8"));
  const metadata=process.argv[2]?JSON.parse(await readFile(path.resolve(process.argv[2]),"utf8")):null;
  const result=checkRelease37PublicInventory(doc,metadata);
  console.log(JSON.stringify(result));
  if(result.status==="BLOCKED")process.exitCode=1;
}
