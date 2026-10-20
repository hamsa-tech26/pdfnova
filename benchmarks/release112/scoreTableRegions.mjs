/**
 * R112: independent published detection-box evaluator (not V4 Stable).
 * Comparison uses actual logical table bounds, never prose-block proxies.
 */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const validRect=r=>r&&["x","y","width","height"].every(k=>finite(r[k]))&&r.width>0&&r.height>0;
export function rectangleIoU(a,b){
  if(!validRect(a)||!validRect(b))return 0;
  const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const intersection=w*h,union=a.width*a.height+b.width*b.height-intersection;
  return union>0?intersection/union:0;
}
const tag=(s,n)=>new RegExp("<"+n+"(?:\\s[^>]*)?>\\s*([^<>]+?)\\s*</"+n+">","i").exec(s)?.[1].trim()??null;
const tagged=(s,n)=>[...s.matchAll(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","gi"))].map(m=>m[1]);
function numericTag(s,n){
  const raw=tag(s,n);
  if(raw===null||raw==="")throw Error("Missing annotation "+n);
  const value=Number(raw);if(!finite(value))throw Error("Invalid annotation "+n);
  return value;
}
export function parseDetectionXml(xml){
  if(typeof xml!=="string"||xml.length>1_000_000)throw Error("Unexpected annotation");
  const size=tagged(xml,"size");
  if(size.length!==1)throw Error("Expected exactly one image size");
  const imageWidth=numericTag(size[0],"width"),imageHeight=numericTag(size[0],"height");
  if(imageWidth<=0||imageHeight<=0||imageWidth>20000||imageHeight>20000)
    throw Error("Invalid annotation dimensions");
  const objects=tagged(xml,"object");
  if(objects.length>30)throw Error("Unexpected number of published objects");
  const boxes=objects.filter(o=>tag(o,"name")?.toLowerCase()==="table").map(o=>{
    const parts=tagged(o,"bndbox");
    if(parts.length!==1)throw Error("Annotation object needs one bounding box");
    const xmin=numericTag(parts[0],"xmin"),xmax=numericTag(parts[0],"xmax");
    const ymin=numericTag(parts[0],"ymin"),ymax=numericTag(parts[0],"ymax");
    if(!(xmin>=0&&ymin>=0&&xmax<=imageWidth&&ymax<=imageHeight&&xmin<xmax&&ymin<ymax))
      throw Error("Out-of-range published table box");
    return {xmin,xmax,ymin,ymax};
  });
  if(!boxes.length)throw Error("Expected a published table annotation");
  return {imageWidth,imageHeight,boxes};
}
export function annotationToPdfBox(box,annotation,page){
  if(!finite(page?.width)||!finite(page?.height)||page.width<=0||page.height<=0)
    throw Error("Invalid PDF viewport");
  const w=annotation.imageWidth,h=annotation.imageHeight;
  if(!(w>0&&h>0))throw Error("Invalid annotation viewport");
  return {x:box.xmin/w*page.width,y:(1-box.ymax/h)*page.height,
    width:(box.xmax-box.xmin)/w*page.width,height:(box.ymax-box.ymin)/h*page.height};
}
export function scoreDetectionPage(reference,predicted,threshold=0.5){
  if(!Array.isArray(reference)||!Array.isArray(predicted)||
    !finite(threshold)||threshold<=0||threshold>1)throw Error("Invalid scoring input");
  if(reference.length>30||predicted.length>100)throw Error("Unbounded scoring input");
  const pairs=[];
  for(let i=0;i<reference.length;i++)
    for(let j=0;j<predicted.length;j++)
      pairs.push({ref:i,pred:j,iou:rectangleIoU(reference[i],predicted[j])});
  // R146: a greedy highest-IoU pair can consume the ONLY prediction
  // eligible for a second table, falsely reporting a source-box miss.
  // Maximum-cardinality bipartite matching counts each valid prediction
  // and independent published reference no more than once. Threshold and
  // table coordinates are unchanged; reference boxes are evaluation only.
  const edges=reference.map((_,ref)=>pairs.filter(p=>
    p.ref===ref&&p.iou>=threshold).sort((a,b)=>b.iou-a.iou||a.pred-b.pred));
  const predictionToRef=Array(predicted.length).fill(-1);
  function augment(ref,seenPred){
    for(const edge of edges[ref]){
      if(seenPred.has(edge.pred))continue;
      seenPred.add(edge.pred);
      const previous=predictionToRef[edge.pred];
      if(previous===-1||augment(previous,seenPred)){
        predictionToRef[edge.pred]=ref;
        return true;
      }
    }
    return false;
  }
  let matchedCount=0;
  for(let ref=0;ref<reference.length;ref++)
    if(augment(ref,new Set()))matchedCount++;
  const best=reference.map((_,i)=>Math.max(0,...pairs.filter(p=>p.ref===i).map(p=>p.iou)));
  return {referenceCount:reference.length,predictionCount:predicted.length,
    matchedCount,missedCount:reference.length-matchedCount,
    unmatchedPredictionCount:predicted.length-matchedCount,
    referenceBestIoU:best.map(n=>Number(n.toFixed(4)))};
}
