import type {PdfPageModel} from "../model/types";

/**
 * R116: a page can contain enough selectable native text to suppress
 * automatic whole-page OCR while still painting inline/embedded images.
 * An image paint operation is NOT evidence of a table or successful OCR.
 */
export type PdfV4ImageContentReview={
  pageNumber:number;
  imagePaintCount:number;
  nativeTextStatus:PdfPageModel["textExtraction"]["status"];
  imageReviewRecommended:boolean;
  reason:"native-text-with-images"|"native-only"|"page-ocr-routed"|"not-inspected";
};
export function collectImageContentReview(pages:PdfPageModel[]):PdfV4ImageContentReview[]{
  return pages.map(page=>{
    const count=page.imagePaintCount;
    const sufficient=page.textExtraction.status==="sufficient";
    const inspected=count!==undefined;
    const present=typeof count==="number"&&Number.isFinite(count)&&count>0;
    const reason:PdfV4ImageContentReview["reason"]=
      !inspected?"not-inspected":
      sufficient?(present?"native-text-with-images":"native-only"):
      "page-ocr-routed";
    return {pageNumber:page.pageNumber,imagePaintCount:present?count:0,
      nativeTextStatus:page.textExtraction.status,
      imageReviewRecommended:sufficient&&present,reason};
  });
}
