/**
 * Kukureku Release 85: two independently transcribed, source-first original
 * PDF annotations. Pure, privacy-preserving comparison only. It never
 * creates a reference, asks the V4 extractor for answers, or grants a formal
 * acceptance credit. Agreement is NECESSARY, not SUFFICIENT, for approval.
 */
import {createHash} from "node:crypto";
import {BLIND_REFERENCE_SCHEMA} from "./release37BlindReference.mjs";

const HEX=/^[a-f0-9]{64}$/i;
const VALID_ID=/^[a-z0-9][a-z0-9._-]{2,99}$/i;
const MAX_SLOTS=5000,MAX_DIFF_COORDINATES=80;
const normalized=s=>s.normalize("NFC").replace(/\u00a0/gu," ")
  .replace(/[\t\r\n ]+/gu," ").trim();
const fingerprint=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const location=(table,row,column)=>({table:table+1,row:row+1,column:column+1});
const key=(r,c)=>r+":"+c;
function verifyAnnotation(a,label,sourceSha256,sourcePageCount){
  const errors=[];
  if(a?.schema!==BLIND_REFERENCE_SCHEMA||
     a?.provenance!=="DRAFT_NOT_REVIEWED"){
    errors.push(label+": expected source-first UNAPPROVED blind reference draft.");
  }
  if(typeof a?.id!=="string"||!VALID_ID.test(a.id))
    errors.push(label+": invalid document identifier.");
  if(!HEX.test(String(a?.originalPdfSha256??""))||
     String(a.originalPdfSha256).toLowerCase()!==sourceSha256.toLowerCase())
    errors.push(label+": original PDF source hash mismatch.");
  if(!Number.isSafeInteger(a?.sourcePageCount)||
     a.sourcePageCount!==sourcePageCount)
    errors.push(label+": original PDF page count mismatch.");
  const review=a?.review??{};
  if(typeof review.annotatorId!=="string"||review.annotatorId.trim().length<3||
     review.sourceInspected!==true||
     review.method!=="SOURCE_PDF_BLIND_TO_ENGINE_OUTPUT"||
     review.reviewerApproved===true){
    errors.push(label+": complete original-source-first annotator attestation missing.");
  }
  if(!Array.isArray(a?.tables)||a.tables.length<1||a.tables.length>40){
    errors.push(label+": 1–40 source-observed tables required.");
    return {errors,sections:[],slots:0};
  }
  let slots=0;
  const sections=[];
  a.tables.forEach((t,index)=>{
    const good=Number.isSafeInteger(t?.pageNumber)&&t.pageNumber>=1&&t.pageNumber<=sourcePageCount&&
      Number.isSafeInteger(t?.rowCount)&&t.rowCount>=1&&t.rowCount<=200&&
      Number.isSafeInteger(t?.columnCount)&&t.columnCount>=1&&t.columnCount<=50;
    if(!good){
      errors.push(label+": invalid source table layout at index "+(index+1)+".");
      return;
    }
    slots+=t.rowCount*t.columnCount;
    if(slots>MAX_SLOTS){
      errors.push(label+": source reference exceeds 5,000 cell slots.");
      return;
    }
    const map=new Map(),coverage=new Set();
    if(!Array.isArray(t.cells)){
      errors.push(label+": table "+(index+1)+" missing explicit cell annotations.");
      sections.push({page:t.pageNumber,rows:t.rowCount,columns:t.columnCount,map});
      return;
    }
    for(const cell of t.cells){
      const r=cell?.rowIndex,c=cell?.columnIndex,
        rs=cell?.rowSpan??1,cs=cell?.columnSpan??1;
      if(!Number.isSafeInteger(r)||!Number.isSafeInteger(c)||
         !Number.isSafeInteger(rs)||!Number.isSafeInteger(cs)||
         r<0||c<0||rs<1||cs<1||r+rs>t.rowCount||c+cs>t.columnCount||
         typeof cell?.text!=="string"){
        errors.push(label+": invalid or incomplete cell at table "+(index+1)+".");
        continue;
      }
      const id=key(r,c);
      if(map.has(id)){
        errors.push(label+": duplicate cell at table "+(index+1)+", row "+(r+1)+", column "+(c+1)+".");
        continue;
      }
      for(let dr=0;dr<rs;dr++)for(let dc=0;dc<cs;dc++){
        const slot=key(r+dr,c+dc);
        if(coverage.has(slot))errors.push(label+": overlapping merged-cell source slots.");
        coverage.add(slot);
      }
      map.set(id,{text:normalized(cell.text),rowSpan:rs,columnSpan:cs});
    }
    if(coverage.size!==t.rowCount*t.columnCount)
      errors.push(label+": missing explicit source cell slots (including blanks) at table "+(index+1)+".");
    sections.push({page:t.pageNumber,rows:t.rowCount,columns:t.columnCount,map});
  });
  return {errors,sections,slots};
}
/**
 * Both annotations must be created BEFORE viewing Kukureku predictions and
 * independently of each other. The software can validate their structures
 * and agreement but CANNOT establish genuine reviewer independence itself.
 *
 * No original PDF text, annotator IDs, cell values or raw annotations appear
 * in the returned summary. Distinct original documents—not PDF excerpts—
 * must be evaluated separately.
 */
export function compareRelease85BlindAnnotations(first,second,source){
  const sha=String(source?.sha256??"");
  const pages=source?.pageCount;
  if(!HEX.test(sha)||!Number.isSafeInteger(pages)||pages<1||pages>500)
    return {status:"BLOCKED",errors:["Verified original PDF hash and page count required."],
      acceptedDocumentCredit:0};
  const a=verifyAnnotation(first,"Annotation A",sha,pages);
  const b=verifyAnnotation(second,"Annotation B",sha,pages);
  const errors=[...a.errors,...b.errors];
  if(first?.id!==second?.id)
    errors.push("The separately completed references belong to different original documents.");
  if(first?.review?.annotatorId?.trim()===second?.review?.annotatorId?.trim())
    errors.push("Two distinct original-source annotators required.");
  // The hash of the reference JSON identifies the exact draft versions. It
  // is not a signature proving independent authorship or reviewer approval.
  if(errors.length)return {status:"BLOCKED",errors,
    acceptedDocumentCredit:0};

  let compared=0,matching=0,layoutDisagreements=0,spanDisagreements=0,
    textDisagreements=0;
  const differences=[];
  const totalTables=Math.max(a.sections.length,b.sections.length);
  for(let t=0;t<totalTables;t++){
    const left=a.sections[t],right=b.sections[t];
    if(!left||!right||left.page!==right.page||
       left.rows!==right.rows||left.columns!==right.columns){
      layoutDisagreements++;
      if(differences.length<MAX_DIFF_COORDINATES)
        differences.push({table:t+1,pageA:left?.page??null,pageB:right?.page??null,
          issue:"SOURCE_TABLE_GEOMETRY"});
      continue;
    }
    const all=new Set([...left.map.keys(),...right.map.keys()]);
    for(const slot of all){
      compared++;
      const x=left.map.get(slot),y=right.map.get(slot);
      const [r,c]=slot.split(":").map(Number);
      const pos=location(t,r,c);
      if(!x||!y||x.rowSpan!==y.rowSpan||x.columnSpan!==y.columnSpan){
        spanDisagreements++;
        if(differences.length<MAX_DIFF_COORDINATES)differences.push({...pos,issue:"SPAN_OR_ANCHOR"});
      }else if(x.text!==y.text){
        textDisagreements++;
        if(differences.length<MAX_DIFF_COORDINATES)differences.push({...pos,issue:"SOURCE_CELL_TEXT"});
      }else matching++;
    }
  }
  const disagreements=layoutDisagreements+spanDisagreements+textDisagreements;
  return {
    status:disagreements===0?"MATCHED_PENDING_INDEPENDENT_APPROVAL":"DISAGREEMENTS_REQUIRE_BLIND_ADJUDICATION",
    schema:"kukureku-v4-r85-double-blind-comparison-v1",
    comparedTables:totalTables,comparedAnchorCells:compared,
    matchingAnchorCells:matching,layoutDisagreements,spanDisagreements,
    textDisagreements,totalDisagreements:disagreements,
    mismatchLocations: differences,
    truncatedLocationCount:Math.max(0,disagreements-differences.length),
    sourceSha256:sha.toLowerCase(),
    annotationDigestA:fingerprint(first),annotationDigestB:fingerprint(second),
    acceptedDocumentCredit:0,
    warning:"Even perfect agreement does not prove reviewer independence, source rights, complete table coverage, cell fidelity or V4 Stable acceptance."
  };
}
