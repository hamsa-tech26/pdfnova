import type {PdfPageModel,PdfBoundingBox} from "../model/types";
import {preparePdfV4OcrPages} from "./ocrPageRenderer";
import {recognizePdfV4OcrRegions} from "./ocrRecognizer";
import {imageRegionToOcrRectangle,planEmbeddedImageOcrRegions,listManuallyReviewableImageRegions} from "./embeddedImageRegionPlanner";
import {suggestEmbeddedImageGrid,type ImageGridProposal} from "./embeddedImageGridSuggestion";
import {createEmbeddedImageSourcePreview} from "./embeddedImageSourcePreview";

/**
 * R120: human-requested inline-image OCR on hybrid/native PDF pages.
 * Local Tesseract. NEVER changes native words, table cells, or XLSX export.
 */
export type EmbeddedImageOcrReview={
  pageNumber:number;
  sourceBounds:PdfBoundingBox;
  text:string;
  wordCount:number;
  confidence:number;
  status:"TEXT_REVIEW_ONLY"|"NO_RELIABLE_TEXT";
  /** Unverified geometry proposal, never an approved spreadsheet or source table. */
  gridProposal?:ImageGridProposal;
  /** Ephemeral locally-rendered crop for manual visual cross-check. Not exported. */
  sourcePreviewDataUrl?:string;
};
export type EmbeddedImageOcrReviewResult={
  attempted:boolean;
  sourceRegionCount:number;
  reviews:EmbeddedImageOcrReview[];
  warning:string;
};
export async function reviewEmbeddedImageRegions(
  file:File,pages:PdfPageModel[],
  options?:{imagePaintIndex?:number},
):Promise<EmbeddedImageOcrReviewResult>{
  if(typeof window==="undefined")throw Error("Embedded OCR review requires a browser.");
  const selectedIndex=options?.imagePaintIndex;
  // Only an exact, user-selected candidate from the bounded paint inventory
  // can override the conservative auto-selection rules.
  if(selectedIndex!==undefined&&
     (!Number.isSafeInteger(selectedIndex)||selectedIndex<0||
      pages.length!==1))
    throw Error("Choose one valid image region on one PDF page.");
  const planned=selectedIndex===undefined?planEmbeddedImageOcrRegions(pages):
    listManuallyReviewableImageRegions(pages[0]).filter(candidate=>
      candidate.imagePaintIndex===selectedIndex);
  if(selectedIndex!==undefined&&planned.length!==1)
    throw Error("Selected PDF image region is unavailable or outside safe review bounds.");
  const warning="OCR is unverified text for human review only; no logical table or Excel cells were changed."+
    (selectedIndex!==undefined?
      " You explicitly selected an image paint region; it may contain ordinary graphics or overlay native text.": "");
  if(planned.length===0)return {
    attempted:false,sourceRegionCount:0,reviews:[],warning,
  };
  const selectedPages=[...new Set(planned.map(x=>x.pageNumber))];
  const rendered=await preparePdfV4OcrPages(file,selectedPages);
  const selected=planned.flatMap(candidate=>{
    const page=pages.find(p=>p.pageNumber===candidate.pageNumber);
    const image=rendered.find(p=>p.pageNumber===candidate.pageNumber);
    if(!page||!image)return [];
    const rectangle=imageRegionToOcrRectangle(candidate.sourceBounds,
      page.width,page.height,image.width,image.height);
    return rectangle?[{request:{page:image,rectangle},candidate}]:[];
  });
  if(!selected.length)return{attempted:false,sourceRegionCount:0,reviews:[],warning};
  const raw=await recognizePdfV4OcrRegions(selected.map(entry=>entry.request));
  // Preview errors must NEVER block the original opt-in OCR result. No image
  // pixels or preview URLs are persisted or uploaded.
  const previews=await Promise.all(selected.map(async entry=>{
    try{
      return await createEmbeddedImageSourcePreview(
        entry.request.page,entry.request.rectangle);
    }catch{return null;}
  }));
  const reviews=raw.map((r,i)=>{
    const source=selected[i].candidate;
    const wordCount=r.words.filter(w=>w.text.trim().length>0&&w.confidence>=35).length;
    const accepted=r.confidence>=45&&wordCount>=2;
    return {pageNumber:r.pageNumber,
      sourceBounds:source.sourceBounds,
      ...(previews[i]?{sourcePreviewDataUrl:previews[i]}:{}),
      text:accepted?r.text:"",
      wordCount,confidence:r.confidence,
      gridProposal:accepted?suggestEmbeddedImageGrid(r.words,r.renderedWidth,r.renderedHeight):
        suggestEmbeddedImageGrid([],r.renderedWidth,r.renderedHeight),
      status:(accepted?"TEXT_REVIEW_ONLY":"NO_RELIABLE_TEXT") as EmbeddedImageOcrReview["status"]};
  });
  return {attempted:true,sourceRegionCount:selected.length,reviews,warning};
}
