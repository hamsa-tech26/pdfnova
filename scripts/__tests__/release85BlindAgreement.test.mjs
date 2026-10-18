import {test} from "node:test";
import assert from "node:assert/strict";
import {makeRelease37BlindReferenceDraft} from "../release37BlindReference.mjs";
import {compareRelease85BlindAnnotations} from "../release85BlindAgreement.mjs";

const SHA="d".repeat(64);
function pair(){
  const draft=makeRelease37BlindReferenceDraft({
    id:"review-document-001",originalPdfSha256:SHA,sourcePageCount:4,
    tables:[{pageNumber:2,rowCount:2,columnCount:3}],
  });
  function fill(name){
    const a=structuredClone(draft);
    a.review.annotatorId=name;
    a.review.sourceInspected=true;
    a.tables[0].cells.forEach((c,i)=>{c.text=i===3?"":"value-"+i;});
    return a;
  }
  return [fill("Reviewer from source A"),fill("Reviewer from source B")];
}
const compare=(a,b,sha256=SHA,pageCount=4)=>
  compareRelease85BlindAnnotations(a,b,{sha256,pageCount});
test("85: two source-first transcriptions agree but do not create approved-document credit",()=>{
  const [a,b]=pair();
  const result=compare(a,b);
  assert.equal(result.status,"MATCHED_PENDING_INDEPENDENT_APPROVAL");
  assert.equal(result.comparedAnchorCells,6);
  assert.equal(result.matchingAnchorCells,6);
  assert.equal(result.totalDisagreements,0);
  assert.equal(result.acceptedDocumentCredit,0);
  assert.equal(result.mismatchLocations.length,0);
  assert.match(result.annotationDigestA,/^[a-f0-9]{64}$/);
  assert.match(result.annotationDigestB,/^[a-f0-9]{64}$/);
  assert.notEqual(result.annotationDigestA,result.annotationDigestB);
  const output=JSON.stringify(result);
  assert.doesNotMatch(output,/value-[0-9]|Reviewer from source/);
});
test("85: mismatch reports exact coordinate and nothing from cell values",()=>{
  const [a,b]=pair();
  b.tables[0].cells[4].text="SENSITIVE-PRIVATE-CELL-B";
  const result=compare(a,b);
  assert.equal(result.status,"DISAGREEMENTS_REQUIRE_BLIND_ADJUDICATION");
  assert.equal(result.matchingAnchorCells,5);
  assert.equal(result.textDisagreements,1);
  assert.deepEqual(result.mismatchLocations,[{table:1,row:2,column:2,issue:"SOURCE_CELL_TEXT"}]);
  assert.equal(result.acceptedDocumentCredit,0);
  assert.doesNotMatch(JSON.stringify(result),/SENSITIVE|value-/);
});
test("85: disagreements in table shapes cannot be falsely counted as cell parity",()=>{
  const [a,b]=pair();
  b.tables[0].columnCount=2;
  b.tables[0].cells=b.tables[0].cells.filter(c=>c.columnIndex<2);
  assert.equal(compare(a,b).status,"DISAGREEMENTS_REQUIRE_BLIND_ADJUDICATION");
  assert.equal(compare(a,b).layoutDisagreements,1);
});
test("85: only explicit source cells, including blanks, are permitted",()=>{
  const [a,b]=pair();
  a.tables[0].cells[3].text=null;
  assert.equal(compare(a,b).status,"BLOCKED");
  const [c,d]=pair();
  c.tables[0].cells.splice(1,1);
  assert.equal(compare(c,d).status,"BLOCKED");
  const [e,f]=pair();
  e.tables[0].cells.push({...e.tables[0].cells[0]});
  assert.equal(compare(e,f).status,"BLOCKED");
});
test("85: source SHA, original page count, IDs and distinct reviewers are mandatory",()=>{
  const [a,b]=pair();
  assert.equal(compare(a,b,"e".repeat(64)).status,"BLOCKED");
  assert.equal(compare(a,b,SHA,5).status,"BLOCKED");
  b.review.annotatorId=a.review.annotatorId;
  assert.equal(compare(a,b).status,"BLOCKED");
  b.review.annotatorId="Reviewer from source B";
  b.id="different-source";
  assert.equal(compare(a,b).status,"BLOCKED");
});
test("85: unsupported approvals, same-person duplicates and uninspected drafts are blocked",()=>{
  const [a,b]=pair();
  a.provenance="INDEPENDENT_REFERENCE_REVIEW";
  assert.equal(compare(a,b).status,"BLOCKED");
  a.provenance="DRAFT_NOT_REVIEWED";
  b.review.reviewerApproved=true;
  assert.equal(compare(a,b).status,"BLOCKED");
  b.review.reviewerApproved=false;
  b.review.sourceInspected=false;
  assert.equal(compare(a,b).status,"BLOCKED");
});
test("85: matching human-reviewed merge spans must cover all slots without overlap",()=>{
  const [a,b]=pair();
  for(const annotation of [a,b]){
    const cells=annotation.tables[0].cells;
    cells[0].columnSpan=2;
    cells.splice(1,1); // covered slot intentionally has no separate cell
  }
  const good=compare(a,b);
  assert.equal(good.status,"MATCHED_PENDING_INDEPENDENT_APPROVAL");
  assert.equal(good.comparedAnchorCells,5);
  b.tables[0].cells[0].columnSpan=1;
  const bad=compare(a,b);
  assert.equal(bad.status,"BLOCKED"); // missing covered slot
  const [c,d]=pair();
  c.tables[0].cells[0].columnSpan=2; // adjacent anchor still present
  assert.equal(compare(c,d).status,"BLOCKED");
});
test("85: differing valid merged anchor geometry is recorded, not accepted",()=>{
  const [a,b]=pair();
  // Two valid but differing complete source-first cell grids.
  a.tables[0].cells[0].columnSpan=2;
  a.tables[0].cells.splice(1,1);
  b.tables[0].cells[3].columnSpan=2;
  b.tables[0].cells.splice(4,1);
  const v=compare(a,b);
  assert.equal(v.status,"DISAGREEMENTS_REQUIRE_BLIND_ADJUDICATION");
  assert.ok(v.spanDisagreements>0);
  assert.equal(v.acceptedDocumentCredit,0);
});
