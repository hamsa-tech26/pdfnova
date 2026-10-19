import {describe,it,expect} from "vitest";
import type {PdfPageModel} from "../../model/types";
import {collectImageContentReview} from "../embeddedImageReview";

function page(num:number,status:PdfPageModel["textExtraction"]["status"],images?:number):PdfPageModel{
  return {pageNumber:num,width:600,height:800,words:[],lines:[],blocks:[],
    imagePaintCount:images,textExtraction:{status,wordCount:0,lineCount:0,
      characterCount:0,qualityScore:0}};
}
describe("R115-R116 embedded image review must be evidence-only",()=>{
  it("flags only image-painted pages with sufficient native text",()=>{
    const rows=collectImageContentReview([
      page(1,"sufficient",3),page(2,"sufficient",0),
      page(3,"none",2),page(4,"low",3),
    ]);
    expect(rows.filter(x=>x.imageReviewRecommended).map(x=>x.pageNumber)).toEqual([1]);
    expect(rows[0].reason).toBe("native-text-with-images");
    expect(rows[1].reason).toBe("native-only");
    expect(rows[2].reason).toBe("page-ocr-routed");
  });
  it("never asserts images are tables or implies OCR was performed",()=>{
    const x=collectImageContentReview([page(1,"sufficient",undefined)])[0];
    expect(x.reason).toBe("not-inspected");
    expect(x.imagePaintCount).toBe(0);
    expect(x.imageReviewRecommended).toBe(false);
    const fallback=collectImageContentReview([page(2,"sufficient",Number.NaN)])[0];
    expect(fallback.imageReviewRecommended).toBe(false);
  });
});
