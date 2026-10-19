import type {PdfPageModel,PdfBoundingBox} from "../model/types";
import {preparePdfV4OcrPages} from "./ocrPageRenderer";
import {recognizePdfV4OcrRegions} from "./ocrRecognizer";
import {imageRegionToOcrRectangle,planEmbeddedImageOcrRegions} from "./embeddedImageRegionPlanner";

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
};
export type EmbeddedImageOcrReviewResult={
  attempted:boolean;
  sourceRegionCount:number;
  reviews:EmbeddedImageOcrReview[];
  warning:string;
};
export async function reviewEmbeddedImageRegions(
  file:File,pages:PdfPageModel[],
):Promise<EmbeddedImageOcrReviewResult>{
  if(typeof window==="undefined")throw Error("Embedded OCR review requires a browser.");
  const planned=planEmbeddedImageOcrRegions(pages);
  const warning="OCR is unverified text for human review only; no logical table or Excel cells were changed.";
  if(planned.length===0)return {
    attempted:false,sourceRegionCount:0,reviews:[],warning,
  };
  const selectedPages=[...new Set(planned.map(x=>x.pageNumber))];
  const rendered=await preparePdfV4OcrPages(file,selectedPages);
  const requests=planned.flatMap(candidate=>{
    const page=pages.find(p=>p.pageNumber===candidate.pageNumber);
    const image=rendered.find(p=>p.pageNumber===candidate.pageNumber);
    if(!page||!image)return [];
    const rectangle=imageRegionToOcrRectangle(candidate.sourceBounds,
      page.width,page.height,image.width,image.height);
    return rectangle?[{page:image,rectangle}]:[];
  });
  if(!requests.length)return{attempted:false,sourceRegionCount:0,reviews:[],warning};
  const raw=await recognizePdfV4OcrRegions(requests);
  const reviews=raw.map((r,i)=>{
    const source=planned[i];
    const wordCount=r.words.filter(w=>w.text.trim().length>0&&w.confidence>=35).length;
    const accepted=r.confidence>=45&&wordCount>=2;
    return {pageNumber:r.pageNumber,
      sourceBounds:source.sourceBounds,
      text:accepted?r.text:"",
      wordCount,confidence:r.confidence,
      status:(accepted?"TEXT_REVIEW_ONLY":"NO_RELIABLE_TEXT") as EmbeddedImageOcrReview["status"]};
  });
  return {attempted:true,sourceRegionCount:requests.length,reviews,warning};
}
