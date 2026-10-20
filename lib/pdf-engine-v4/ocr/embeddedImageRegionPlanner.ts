import type {PdfPageModel,PdfBoundingBox} from "../model/types";
import type {PdfV4OcrRectangle} from "./ocrRecognizer";

/**
 * Conservative opt-in review plan for embedded painted images on pages with
 * sufficient native text. DOES NOT classify images as tables or merge OCR.
 */
export type EmbeddedImageRegionPlan={
  pageNumber:number;
  sourceBounds:PdfBoundingBox;
  imagePaintIndex:number;
  nativeWordOverlap:number;
};
export type EmbeddedOcrRequest={
  pageNumber:number;
  bounds:PdfBoundingBox;
  rectangle:PdfV4OcrRectangle;
};
const contains=(box:PdfBoundingBox,x:number,y:number)=>
  x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
export function planEmbeddedImageOcrRegions(pages:PdfPageModel[]):EmbeddedImageRegionPlan[]{
  const selected:EmbeddedImageRegionPlan[]=[];
  for(const page of pages){
    if(page.textExtraction.status!=="sufficient"||!page.imagePaintRegions?.length)continue;
    const candidates=page.imagePaintRegions.map((image,index)=>({image,index}))
      .filter(({image})=>image.areaFraction>=0.02&&image.areaFraction<=0.78&&
        image.bounds.width>=75&&image.bounds.height>=40);
    const ranked=candidates.map(({image,index})=>{
      const nativeWordOverlap=page.words.filter(w=>contains(image.bounds,
        w.bounds.x+w.bounds.width/2,w.bounds.y+w.bounds.height/2)).length;
      return {pageNumber:page.pageNumber,sourceBounds:image.bounds,
        imagePaintIndex:index,nativeWordOverlap,
        areaFraction:image.areaFraction};
    }).filter(item=>item.nativeWordOverlap<=2)
      .sort((a,b)=>b.areaFraction-a.areaFraction);
    for(const candidate of ranked.slice(0,2)){
      if(selected.length>=4)return selected;
      if(selected.some(item=>item.pageNumber===page.pageNumber&&
        intersectRatio(item.sourceBounds,candidate.sourceBounds)>0.65))continue;
      const {areaFraction,...safe}=candidate;
      selected.push(safe);
    }
  }
  return selected;
}
/**
 * R136: explicit human-selectable image-paint inventory. This deliberately
 * includes bounded image regions with native text overlay that the existing
 * automatic review planner rejects. Selection is an opt-in OCR *request*
 * only, never evidence that an image is a table. Limited to eight per page.
 */
export function listManuallyReviewableImageRegions(
  page:PdfPageModel,
):EmbeddedImageRegionPlan[]{
  if(page.textExtraction.status!=="sufficient"||
    !Number.isSafeInteger(page.pageNumber)||page.pageNumber<1||
    !Number.isFinite(page.width)||!Number.isFinite(page.height)||
    page.width<=0||page.height<=0)return [];
  const regions=page.imagePaintRegions??[];
  const eligible=regions.flatMap((image,index)=>{
    const b=image.bounds;
    if(![b.x,b.y,b.width,b.height,image.areaFraction].every(Number.isFinite)||
      b.x<0||b.y<0||b.width<75||b.height<40||
      b.x+b.width>page.width+1||b.y+b.height>page.height+1||
      image.areaFraction<0.02||image.areaFraction>0.78)return [];
    const nativeWordOverlap=page.words.filter(w=>contains(b,
      w.bounds.x+w.bounds.width/2,w.bounds.y+w.bounds.height/2)).length;
    return [{pageNumber:page.pageNumber,sourceBounds:{...b},
      imagePaintIndex:index,nativeWordOverlap,areaFraction:image.areaFraction}];
  }).sort((a,b)=>b.areaFraction-a.areaFraction||
    a.imagePaintIndex-b.imagePaintIndex);
  const selected:EmbeddedImageRegionPlan[]=[];
  for(const candidate of eligible){
    if(selected.length>=8)break;
    if(selected.some(existing=>
      intersectRatio(existing.sourceBounds,candidate.sourceBounds)>0.65))continue;
    const {areaFraction,...metadata}=candidate;
    selected.push(metadata);
  }
  return selected;
}
function intersectRatio(a:PdfBoundingBox,b:PdfBoundingBox){
  const width=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const height=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return width*height/Math.max(1,Math.min(a.width*a.height,b.width*b.height));
}
/** Bottom-origin PDF rectangle -> top-origin rendered pixels, bounded and
 * slightly padded so source-image border glyphs are not clipped.
 */
export function imageRegionToOcrRectangle(
  box:PdfBoundingBox,pageWidth:number,pageHeight:number,
  renderedWidth:number,renderedHeight:number,
):PdfV4OcrRectangle|null{
  if([box.x,box.y,box.width,box.height,pageWidth,pageHeight,
    renderedWidth,renderedHeight].some(n=>!Number.isFinite(n))||
    box.width<=0||box.height<=0||pageWidth<=0||pageHeight<=0||
    renderedWidth<=0||renderedHeight<=0)return null;
  const scaleX=renderedWidth/pageWidth,scaleY=renderedHeight/pageHeight;
  const paddingX=Math.min(12,box.width*.025)*scaleX;
  const paddingY=Math.min(12,box.height*.025)*scaleY;
  const left=Math.max(0,Math.floor(box.x*scaleX-paddingX));
  const top=Math.max(0,Math.floor((pageHeight-box.y-box.height)*scaleY-paddingY));
  const right=Math.min(renderedWidth,Math.ceil((box.x+box.width)*scaleX+paddingX));
  const bottom=Math.min(renderedHeight,
    Math.ceil((pageHeight-box.y)*scaleY+paddingY));
  if(right-left<10||bottom-top<10)return null;
  return {left,top,width:right-left,height:bottom-top};
}
