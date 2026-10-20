import type {PdfPageModel} from "../model/types";
import {listManuallyReviewableImageRegions} from "./embeddedImageRegionPlanner";

/**
 * Release 142: expose pages with explicit safe manual image-paint candidates,
 * not just those preferred by the conservative automatic OCR chooser.
 * This is navigation evidence only. No OCR, table or cell is auto-approved.
 */
export type ImageReviewPageOption={
  pageNumber:number;
  automaticRecommended:boolean;
  manualCandidateCount:number;
};
export function listEmbeddedImageReviewPages(
  pages:readonly PdfPageModel[],
  recommendations:readonly {pageNumber:number;imageReviewRecommended:boolean}[],
):ImageReviewPageOption[]{
  const preferred=new Set(recommendations.filter(x=>x.imageReviewRecommended)
    .map(x=>x.pageNumber));
  const result:ImageReviewPageOption[]=[];
  for(const page of pages){
    if(!Number.isSafeInteger(page.pageNumber)||page.pageNumber<1)continue;
    const automaticRecommended=preferred.has(page.pageNumber);
    const manualCandidateCount=listManuallyReviewableImageRegions(page).length;
    if(!automaticRecommended&&!manualCandidateCount)continue;
    if(result.some(x=>x.pageNumber===page.pageNumber))continue;
    result.push({pageNumber:page.pageNumber,automaticRecommended,manualCandidateCount});
  }
  return result.sort((a,b)=>a.pageNumber-b.pageNumber);
}
