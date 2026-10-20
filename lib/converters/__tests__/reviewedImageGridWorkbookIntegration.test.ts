import {describe,expect,it} from "vitest";
import JSZip from "jszip";
import {createPdfXlsxWorkbook} from "../pdfToXlsx";
import {prepareUserReviewedImageXlsx} from "../reviewedImageTableWorkbook";
import {insertReviewedImageRow,insertReviewedImageColumn,
  inspectReviewedImageGrid} from "../reviewedImageGridEdits";
import type {EmbeddedImageOcrReview} from "../../pdf-engine-v4/ocr/embeddedImageReviewOcr";

const review:EmbeddedImageOcrReview={
  pageNumber:6,sourceBounds:{x:60,y:500,width:340,height:180},
  text:"Untrusted OCR words",wordCount:18,confidence:82,status:"TEXT_REVIEW_ONLY",
};
describe("R139–141 user-approved edited image workbook and provenance",()=>{
  it("emits literal XLSX cells, selected source paint and quality notes after structural edits",async()=>{
    const input="ID\tAmount\n00071\t=2+2";
    const withRow=insertReviewedImageRow(input,1,"00072");
    const withColumn=insertReviewedImageColumn(withRow,1,"Remark");
    expect(inspectReviewedImageGrid(withColumn).emptyDataCells).toBe(3);
    const plan=prepareUserReviewedImageXlsx({
      review,tsv:withColumn,confirmed:true,documentPageCount:14,
      imagePaintIndex:3,manualButtonEdits:2,
    });
    expect(plan.tables[0].rows).toEqual([
      ["ID","Amount","Remark"],["00071","=2+2",""],["00072","",""],
    ]);
    const notes=plan.reviewNotes!.join(" ");
    expect(notes).toContain("page 6 of 14");
    expect(notes).toContain("paint number: 4");
    expect(notes).toContain("3 blank data cells");
    expect(notes).toContain("formula-like source values stored literally");
    expect(notes).toContain("edit actions");
    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    const sheet=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const audit=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(sheet).toContain("00071");
    expect(sheet).toContain("=2+2");
    expect(sheet).not.toContain("<f>");
    expect(audit).toContain("source image paint");
    expect(audit).toContain("NOT independent");
  });
  it("refuses invented edit counts and source image indices",()=>{
    const base={review,tsv:"A\tB\n1\t2",confirmed:true,documentPageCount:14};
    expect(()=>prepareUserReviewedImageXlsx({...base,imagePaintIndex:-1})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...base,imagePaintIndex:42})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...base,manualButtonEdits:1001})).toThrow();
    expect(()=>prepareUserReviewedImageXlsx({...base,manualButtonEdits:0.5})).toThrow();
  });
});
