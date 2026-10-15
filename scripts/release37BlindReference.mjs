/**
 * Phase 10.20 real-world evidence: BLIND reference scaffolding and verification.
 *
 * Never derive expected rows, columns, cell contents or merge spans from
 * Kukureku V4 Inspector output. Manual source-PDF review is essential.
 * Passing these structural checks is not proof that the reviewer really was
 * independent; approvals still require human audit.
 */
import {scoreRelease37Case} from "./scoreRelease37Cases.mjs";

export const BLIND_REFERENCE_SCHEMA="kukureku-v4-blind-reference-v1";
const ID=/^[a-z0-9][a-z0-9._-]{2,99}$/i;
const HASH=/^[a-f0-9]{64}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const MAX_TOTAL_SLOTS=5000;

export function makeRelease37BlindReferenceDraft({id,originalPdfSha256,sourcePageCount,tables}){
  if(typeof id!=="string"||!ID.test(id)||
     typeof originalPdfSha256!=="string"||!HASH.test(originalPdfSha256)||
     !Number.isSafeInteger(sourcePageCount)||sourcePageCount<1||sourcePageCount>500)
    throw Error("Invalid original source document metadata.");
  if(!Array.isArray(tables)||!tables.length||tables.length>40)
    throw Error("Manually selected reference table layouts required.");
  let slots=0;
  const refTables=tables.map((layout,index)=>{
    const {pageNumber,rowCount,columnCount}=layout??{};
    if(!Number.isSafeInteger(pageNumber)||pageNumber<1||pageNumber>sourcePageCount||
       !Number.isSafeInteger(rowCount)||rowCount<1||rowCount>200||
       !Number.isSafeInteger(columnCount)||columnCount<1||columnCount>50||
       slots+rowCount*columnCount>MAX_TOTAL_SLOTS)
      throw Error("Invalid or oversized independently selected table layout #"+index);
    slots+=rowCount*columnCount;
    return {
      pageNumber,rowCount,columnCount,
      // All cell text is intentionally NULL, not populated from predictions.
      // The reviewer must fill every source cell, including empty strings.
      cells:Array.from({length:rowCount*columnCount},(_,i)=>({
        rowIndex:Math.floor(i/columnCount),columnIndex:i%columnCount,text:null
      }))
    };
  });
  return {
    schema:BLIND_REFERENCE_SCHEMA,
    id,originalPdfSha256:originalPdfSha256.toLowerCase(),sourcePageCount,
    provenance:"DRAFT_NOT_REVIEWED",
    review:{
      annotatorId:"",reviewerId:"",reviewedAt:"",
      sourceInspected:false,reviewerApproved:false,allSourceTablesReviewed:false,
      method:"SOURCE_PDF_BLIND_TO_ENGINE_OUTPUT"
    },
    // Remove covered non-anchor slots and add rowSpan / columnSpan to the
    // anchor when a HUMAN observes genuinely merged cells in the source.
    tables:refTables,
    warning:"NOT_VERIFIED: expected text must be independently transcribed from the original PDF."
  };
}

export function validateRelease37ReviewedReference(reference,actualPdfHash,entry){
  const errors=[];
  if(reference?.schema!==BLIND_REFERENCE_SCHEMA ||
     reference?.provenance!=="INDEPENDENT_REFERENCE_REVIEW")
    errors.push("Reference is not an independently approved blind annotation.");
  if(!HASH.test(String(actualPdfHash??"")) ||
     String(reference?.originalPdfSha256??"").toLowerCase()!==String(actualPdfHash).toLowerCase())
    errors.push("Reference source hash differs from original PDF bytes.");
  if(reference?.id!==entry?.id) errors.push("Reference document ID mismatch.");
  const review=reference?.review;
  const annotator=typeof review?.annotatorId==="string"?review.annotatorId.trim():"";
  const reviewer=typeof review?.reviewerId==="string"?review.reviewerId.trim():"";
  if(annotator.length<3||reviewer.length<3||annotator===reviewer ||
     review?.sourceInspected!==true||review?.reviewerApproved!==true ||
     review?.allSourceTablesReviewed!==true ||
     review?.method!=="SOURCE_PDF_BLIND_TO_ENGINE_OUTPUT"||
     !DATE.test(String(review?.reviewedAt??""))||
     Number.isNaN(Date.parse(review?.reviewedAt??"")))
    errors.push("Separate annotator and reviewer attestations required.");
  if(entry?.reviewedBy!==reviewer||entry?.reviewedAt!==review?.reviewedAt ||
     entry?.independentReferenceReview!==true)
    errors.push("Manifest reviewer claim differs from reviewed source evidence.");
  if(!Number.isSafeInteger(reference?.sourcePageCount)||reference.sourcePageCount<1||reference.sourcePageCount>500)
    errors.push("Original PDF page-count evidence missing or invalid.");
  if(!Array.isArray(reference?.tables)||!reference.tables.length||reference.tables.length>40)
    errors.push("Reviewed tables must be present.");
  else {
    let total=0;
    for(const table of reference.tables){
      if(!Number.isSafeInteger(table?.pageNumber)||table.pageNumber<1||
         table.pageNumber>reference.sourcePageCount ||
         !Number.isSafeInteger(table.rowCount)||!Number.isSafeInteger(table.columnCount)||
         table.rowCount<1||table.columnCount<1||table.rowCount>200||
         table.columnCount>50)
        errors.push("Invalid reviewed page or table dimensions.");
      else total+=table.rowCount*table.columnCount;
      if(!Array.isArray(table.cells)||table.cells.some(c=>typeof c?.text!=="string"))
        errors.push("All reference cell text must be manually filled; null placeholders are forbidden.");
    }
    if(total>MAX_TOTAL_SLOTS)errors.push("Reference exceeds bounded table cells.");
    if(!errors.length){
      try{
        // Reuse production independent scorer's strict span/slot validator:
        // no missing blanks, overlapping cells, or duplicate anchor cells.
        scoreRelease37Case(reference,{tables:[]});
      }catch {errors.push("Incomplete, duplicated or overlapping reviewed reference grid.");}
    }
  }
  return {status:errors.length?"BLOCKED":"REVIEW_METADATA_VALID",errors};
}
