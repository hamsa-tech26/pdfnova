import { describe,expect,it } from "vitest";
import { PDF_JPG_PREVIEW_BATCH_SIZE, pdfPreviewPageNumbers } from "../render";

describe("bounded PDF thumbnail page selection",()=>{
  it("limits first preview to eight pages even if PDF has thousands",()=>{
    expect(PDF_JPG_PREVIEW_BATCH_SIZE).toBe(8);
    expect(pdfPreviewPageNumbers(1,10000)).toEqual([1,2,3,4,5,6,7,8]);
  });
  it("handles final incomplete window without missing pages",()=>{
    expect(pdfPreviewPageNumbers(9,12)).toEqual([9,10,11,12]);
    expect(pdfPreviewPageNumbers(17,12)).toEqual([]);
  });
  it("rejects invalid index values",()=>{
    expect(pdfPreviewPageNumbers(0,1)).toEqual([]);
    expect(pdfPreviewPageNumbers(1,0)).toEqual([]);
    expect(pdfPreviewPageNumbers(1,Number.NaN)).toEqual([]);
  });
});
