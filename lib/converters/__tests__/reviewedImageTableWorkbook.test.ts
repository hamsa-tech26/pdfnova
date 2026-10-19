import {describe,expect,it} from "vitest";
import {parseUserReviewedImageGrid,prepareUserReviewedImageXlsx,updateUserReviewedImageCell} from "../reviewedImageTableWorkbook";
import type {EmbeddedImageOcrReview} from "../../pdf-engine-v4/ocr/embeddedImageReviewOcr";
const review:EmbeddedImageOcrReview={pageNumber:6,
  sourceBounds:{x:60,y:520,width:480,height:140},
  text:"Original untrusted OCR",wordCount:12,confidence:73,
  status:"TEXT_REVIEW_ONLY"};
describe("Release 123 explicit image-table export safety",()=>{
  it("accepts a user-confirmed corrected TSV grid, preserves literal formulas/IDs",()=>{
    const rows=parseUserReviewedImageGrid("Code\tValue\n00071\t=2+2\nR9\t00100");
    expect(rows).toEqual([["Code","Value"],["00071","=2+2"],["R9","00100"]]);
    const plan=prepareUserReviewedImageXlsx({
      review,tsv:"Code\tValue\n00071\t=2+2\nR9\t00100",
      confirmed:true,documentPageCount:14});
    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].name).toBe("User-Reviewed Image Table");
    expect(plan.tables[0].rows).toEqual(rows);
    expect(plan.tables[0].numericColumns).toBeUndefined();
    expect(plan.reviewNotes?.join(" ")).toContain("PDF page 6 of 14");
    expect(plan.reviewNotes?.join(" ")).toContain("not an automated PDF table detection");
  });
  it("rejects unchecked OCR and empty, jagged, single-column, oversized or ambiguous grids",()=>{
    expect(()=>prepareUserReviewedImageXlsx({review,tsv:"A\tB\n1\t2",confirmed:false,documentPageCount:14})).toThrow(/Confirm/);
    for(const text of ["", "A\tB", "A\nB", "A\tB\n1", "A\t\n1\t2","A\tB\n\n1\t2",
      "A\tB\n\t", "A\tB\n1\t"+ "X".repeat(1100)]){
      expect(()=>parseUserReviewedImageGrid(text)).toThrow();
    }
  });
  it("refuses OCR regions that have not passed minimal source review",()=>{
    const input={review,tsv:"A\tB\n1\t2",confirmed:true,documentPageCount:14};
    expect(()=>prepareUserReviewedImageXlsx({...input,review:{...review,status:"NO_RELIABLE_TEXT"}})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...input,review:{...review,confidence:40}})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...input,review:{...review,wordCount:1}})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...input,review:{...review,pageNumber:15}})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...input,review:{...review,sourceBounds:{x:60,y:520,width:-2,height:140}}})).toThrow();
  });
});

describe("Release 129: explicit cell editing for user-reviewed image grids",()=>{
  it("corrects exactly one cell and preserves identifiers and literal formula-like text",()=>{
    const source="ID\\tAmount\\tNotes\\n00071\\t=2+2\\told\\n00090\\t00456\\tgood";
    const edited=updateUserReviewedImageCell(source,1,2,"Checked against image");
    expect(parseUserReviewedImageGrid(edited)).toEqual([
      ["ID","Amount","Notes"],["00071","=2+2","Checked against image"],
      ["00090","00456","good"],
    ]);
    expect(updateUserReviewedImageCell(source,2,1,"=SUM(A1:A9)"))
      .toContain("00090\\t=SUM(A1:A9)\\tgood");
  });
  it("preserves empty cells at the first or last column without losing table geometry",()=>{
    expect(parseUserReviewedImageGrid("First\\tLast\\n\\t0012\\n3\\t")).toEqual([
      ["First","Last"],["","0012"],["3",""],
    ]);
    expect(parseUserReviewedImageGrid(updateUserReviewedImageCell(
      "First\\tLast\\n7\\t2",1,1,"",
    ))).toEqual([["First","Last"],["7",""]]);
  });
  it("rejects out-of-range, invalid, or inconsistent edits",()=>{
    const source="Name\\tAmount\\nA\\t1";
    expect(()=>updateUserReviewedImageCell(source,-1,0,"x")).toThrow();
    expect(()=>updateUserReviewedImageCell(source,2,1,"x")).toThrow();
    expect(()=>updateUserReviewedImageCell(source,0,2,"x")).toThrow();
    expect(()=>updateUserReviewedImageCell(source,0,0,"")).toThrow(/heading/i);
    expect(()=>updateUserReviewedImageCell(source,1,0,"")).not.toThrow();
    expect(()=>updateUserReviewedImageCell("Name\\tAmount\\nA\\t",1,0,"")).toThrow(/Empty reviewed data row/);
    expect(()=>updateUserReviewedImageCell(source,1,1,"new\\tcolumn")).toThrow(/tabs or line breaks/);
    expect(()=>updateUserReviewedImageCell(source,1,1,"new\\nrow")).toThrow(/tabs or line breaks/);
    expect(()=>updateUserReviewedImageCell(source,1,1,"x".repeat(1001))).toThrow(/1,000/);
  });
});
