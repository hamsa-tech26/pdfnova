import type {PdfBoundingBox} from "../model/types";

/**
 * R133: source-independent, metadata-only localization audit.
 * IoU measures geometry, NOT cell accuracy or overall model qualification.
 * Use actual detected table bounds; never substitute whole prose blocks.
 */
export type SpatialTableBox={
  pageNumber:number;
  bounds:PdfBoundingBox;
};
export type TopOriginReferenceBox={
  pageNumber:number;
  imageWidth:number;
  imageHeight:number;
  pdfWidth:number;
  pdfHeight:number;
  left:number;
  top:number;
  right:number;
  bottom:number;
};
export type SpatialAuditDetail={
  referenceIndex:number;
  pageNumber:number;
  bestIou:number;
  matchedCandidateIndex:number|null;
};
export type SpatialDetectionAudit={
  truePositive:number;
  falsePositive:number;
  falseNegative:number;
  threshold:number;
  details:SpatialAuditDetail[];
  unmatchedCandidateIndices:number[];
};

function finitePositive(x:number){return Number.isFinite(x)&&x>0;}
function validBox(b:PdfBoundingBox){
  return Number.isFinite(b.x)&&Number.isFinite(b.y)&&
    finitePositive(b.width)&&finitePositive(b.height);
}
export function topOriginToPdfBounds(ref:TopOriginReferenceBox):PdfBoundingBox{
  if(!Number.isSafeInteger(ref.pageNumber)||ref.pageNumber<1||
    ![ref.imageWidth,ref.imageHeight,ref.pdfWidth,ref.pdfHeight].every(finitePositive)||
    ![ref.left,ref.top,ref.right,ref.bottom].every(Number.isFinite)||
    ref.left<0||ref.top<0||ref.right>ref.imageWidth||
    ref.bottom>ref.imageHeight||ref.right<=ref.left||ref.bottom<=ref.top)
    throw Error("Invalid published table box or image/page coordinates.");
  const sx=ref.pdfWidth/ref.imageWidth,sy=ref.pdfHeight/ref.imageHeight;
  return {x:ref.left*sx,y:(ref.imageHeight-ref.bottom)*sy,
    width:(ref.right-ref.left)*sx,height:(ref.bottom-ref.top)*sy};
}
export function tableBoxIou(a:PdfBoundingBox,b:PdfBoundingBox):number{
  if(!validBox(a)||!validBox(b))throw Error("Invalid detected table bounds.");
  const overlapWidth=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const overlapHeight=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const intersection=overlapWidth*overlapHeight;
  const union=a.width*a.height+b.width*b.height-intersection;
  return union>0?intersection/union:0;
}
export function auditTableDetectionBoxes(
  references:readonly TopOriginReferenceBox[],
  candidates:readonly SpatialTableBox[],
  threshold=0.5,
):SpatialDetectionAudit{
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1||
    references.length>200||candidates.length>200||
    candidates.some(c=>!Number.isSafeInteger(c.pageNumber)||c.pageNumber<1||!validBox(c.bounds)))
    throw Error("Spatial table audit inputs exceed bounds or are invalid.");
  const expected=references.map(r=>({page:r.pageNumber,bounds:topOriginToPdfBounds(r)}));
  // Maximum-IoU one-to-one candidate assignment. A single detection must not
  // count for two neighboring published tables.
  const pairs:{ref:number;candidate:number;iou:number}[]=[];
  for(const [i,ref] of expected.entries())
    for(const [j,candidate] of candidates.entries()){
      if(ref.page!==candidate.pageNumber)continue;
      const iou=tableBoxIou(ref.bounds,candidate.bounds);
      if(iou>=threshold)pairs.push({ref:i,candidate:j,iou});
    }
  pairs.sort((a,b)=>b.iou-a.iou||a.ref-b.ref||a.candidate-b.candidate);
  const assignedRefs=new Set<number>(),assignedCandidates=new Set<number>();
  const matchByRef=new Map<number,{candidate:number;iou:number}>();
  for(const pair of pairs){
    if(assignedRefs.has(pair.ref)||assignedCandidates.has(pair.candidate))continue;
    assignedRefs.add(pair.ref);assignedCandidates.add(pair.candidate);
    matchByRef.set(pair.ref,{candidate:pair.candidate,iou:pair.iou});
  }
  const details=expected.map((ref,i)=>{
    const bestIou=candidates.reduce((best,c)=>
      c.pageNumber===ref.page?Math.max(best,tableBoxIou(ref.bounds,c.bounds)):best,0);
    return {referenceIndex:i,pageNumber:ref.page,bestIou,
      matchedCandidateIndex:matchByRef.get(i)?.candidate??null};
  });
  return {truePositive:assignedRefs.size,
    falsePositive:candidates.length-assignedCandidates.size,
    falseNegative:references.length-assignedRefs.size,
    threshold,details,
    unmatchedCandidateIndices:candidates.map((_,i)=>i).filter(i=>!assignedCandidates.has(i))};
}
