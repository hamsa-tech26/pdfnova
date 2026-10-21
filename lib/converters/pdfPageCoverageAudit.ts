import type {PdfPageModel} from "../pdf-engine-v4/model/types";
import type {LogicalTable} from "../pdf-engine-v4/model/logicalTable";
import {listManuallyReviewableImageRegions} from "../pdf-engine-v4/ocr/embeddedImageRegionPlanner";

/** Evidence about actual source pages, not a table detector or accuracy score. */
export type PdfPageCoverageFlag={
  pageNumber:number;
  nativeTextStatus:PdfPageModel["textExtraction"]["status"];
  tableCandidateCount:number;
  paintedImageCount:number;
  manualImages:{imagePaintIndex:number;nativeWordOverlap:number}[];
  reason:"native-text-no-table"|"painted-content-needs-review"|"no-reviewable-content";
};
/**
 * R156: surface source pages where PDF table export may be incomplete.
 * Native table candidates (even high-confidence ones) never certify image
 * paints. This report does not read the published reference box corpus or
 * synthesize any table, cell, OCR request, or missing table assertion.
 */
export function auditPdfPageCoverage(
  pages:readonly PdfPageModel[],tables:readonly LogicalTable[],
):PdfPageCoverageFlag[]{
  if(pages.length>25||tables.length>100)
    throw Error("Page coverage exceeds bounded local review limits.");
  const flags:PdfPageCoverageFlag[]=[];
  const seen=new Set<number>();
  for(const page of pages){
    if(!Number.isSafeInteger(page.pageNumber)||page.pageNumber<1||
      page.pageNumber>25||seen.has(page.pageNumber))
      throw Error("Invalid source PDF page number for manual review.");
    seen.add(page.pageNumber);
    const tableCandidateCount=tables.filter(t=>
      t.pageNumber===page.pageNumber||
      t.rows.some(r=>r.provenance?.pageNumber===page.pageNumber)).length;
    const paintedImageCount=Math.max(page.imagePaintRegions?.length??0,
      Number.isSafeInteger(page.imagePaintCount)&&page.imagePaintCount!>=0?
        page.imagePaintCount!:0);
    const manualImages=listManuallyReviewableImageRegions(page)
      .slice(0,2).map(i=>({imagePaintIndex:i.imagePaintIndex,
        nativeWordOverlap:i.nativeWordOverlap}));
    const nativeTextStatus=page.textExtraction.status;
    if(paintedImageCount>0){
      flags.push({pageNumber:page.pageNumber,nativeTextStatus,
        tableCandidateCount,paintedImageCount,manualImages,
        reason:"painted-content-needs-review"});
    }else if(!tableCandidateCount&&page.words.length>0){
      flags.push({pageNumber:page.pageNumber,nativeTextStatus,
        tableCandidateCount,paintedImageCount,manualImages,
        reason:"native-text-no-table"});
    }else if(!tableCandidateCount&&nativeTextStatus!=="sufficient"){
      flags.push({pageNumber:page.pageNumber,nativeTextStatus,
        tableCandidateCount,paintedImageCount,manualImages,
        reason:"no-reviewable-content"});
    }
  }
  return flags;
}
