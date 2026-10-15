import {describe,expect,it} from "vitest";
import {
  BLIND_REFERENCE_SCHEMA,
  makeRelease37BlindReferenceDraft,
  validateRelease37ReviewedReference,
} from "../../../../scripts/release37BlindReference.mjs";

const PDF_HASH="a".repeat(64);
const validEntry=()=>({id:"reviewed-source-001",reviewedBy:"Reviewer Two",reviewedAt:"2026-10-15",independentReferenceReview:true});
function draft(){
  return makeRelease37BlindReferenceDraft({
    id:"reviewed-source-001",originalPdfSha256:PDF_HASH,sourcePageCount:4,
    tables:[{pageNumber:2,rowCount:2,columnCount:2}]
  });
}
function annotated(){
  const ref=draft();
  ref.provenance="INDEPENDENT_REFERENCE_REVIEW";
  Object.assign(ref.review,{
    annotatorId:"Annotator One",reviewerId:"Reviewer Two",
    reviewedAt:"2026-10-15",sourceInspected:true,reviewerApproved:true,
    allSourceTablesReviewed:true
  });
  Object.assign(ref.tables[0].cells[0],{text:"Serial"});
  Object.assign(ref.tables[0].cells[1],{text:"Amount"});
  Object.assign(ref.tables[0].cells[2],{text:"1"});
  Object.assign(ref.tables[0].cells[3],{text:""});
  return ref;
}
describe("Engine V4 source-first blind table reference intake",()=>{
  it("starts with NULL expected cells, not engine-inferred content",()=>{
    const d=draft();
    expect(d.schema).toBe(BLIND_REFERENCE_SCHEMA);
    expect(d.provenance).toBe("DRAFT_NOT_REVIEWED");
    expect(d.tables[0].cells).toHaveLength(4);
    expect(d.tables[0].cells.every(x=>x.text===null)).toBe(true);
    expect(validateRelease37ReviewedReference(d,PDF_HASH,validEntry()).status).toBe("BLOCKED");
  });
  it("blocks unreviewed or copied placeholders despite fake manifest approval",()=>{
    const ref=annotated();
    ref.tables[0].cells[3].text=null;
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).errors.join(" ")).toMatch(/null placeholders/);
  });
  it("blocks source hash substitution and mismatched document IDs",()=>{
    const ref=annotated();
    expect(validateRelease37ReviewedReference(ref,"b".repeat(64),validEntry()).status).toBe("BLOCKED");
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,{...validEntry(),id:"other-id"}).status).toBe("BLOCKED");
  });
  it("requires two different people, independent source inspection and matching date",()=>{
    const ref=annotated();
    ref.review.reviewerId="Annotator One";
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
    ref.review.reviewerId="Reviewer Two";
    ref.review.sourceInspected=false;
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
    ref.review.sourceInspected=true;
    ref.review.reviewerApproved=false;
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
    ref.review.reviewerApproved=true;
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,{...validEntry(),reviewedAt:"2026-10-14"}).status).toBe("BLOCKED");
  });
  it("never measures a selected-only table subset as complete-source accuracy",()=>{
    const ref=annotated();
    ref.review.allSourceTablesReviewed=false;
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
  });
  it("rejects missing full-original PDF page count in reviewed metadata",()=>{
    const ref=annotated();
    Object.assign(ref,{sourcePageCount:undefined});
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
  });
  it("blocks duplicate or missing cells and unsupported spans",()=>{
    const ref=annotated();
    ref.tables[0].cells.push({...ref.tables[0].cells[0]});
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
    ref.tables[0].cells.pop();
    ref.tables[0].cells.pop();
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
  });
  it("permits a structurally complete human-asserted reference without auto-certifying accuracy",()=>{
    const ref=annotated();
    const out=validateRelease37ReviewedReference(ref,PDF_HASH,validEntry());
    expect(out.status).toBe("REVIEW_METADATA_VALID");
    expect(out.errors).toEqual([]);
  });
  it("supports legitimate merge spans only when all covered slots are explicitly represented",()=>{
    const ref=annotated();
    const head=ref.tables[0].cells[0];
    Object.assign(head,{columnSpan:2});
    ref.tables[0].cells.splice(1,1);
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("REVIEW_METADATA_VALID");
    ref.tables[0].cells.push(Object.assign({},ref.tables[0].cells[0],{rowIndex:0,columnIndex:1}));
    expect(validateRelease37ReviewedReference(ref,PDF_HASH,validEntry()).status).toBe("BLOCKED");
  });
  it("bounds unsafe reference sizes and source page numbers",()=>{
    expect(()=>makeRelease37BlindReferenceDraft({
      id:"test-source",originalPdfSha256:PDF_HASH,sourcePageCount:2,
      tables:[{pageNumber:3,rowCount:1,columnCount:1}]
    })).toThrow(/layout/);
    expect(()=>makeRelease37BlindReferenceDraft({
      id:"test-source",originalPdfSha256:PDF_HASH,sourcePageCount:2,
      tables:[{pageNumber:1,rowCount:200,columnCount:50}]
    })).toThrow(/layout/);
  });
});
