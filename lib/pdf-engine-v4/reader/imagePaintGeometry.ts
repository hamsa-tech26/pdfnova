import type {PdfBoundingBox} from "../model/types";

/** PDF.js image-paint bounds in unrotated PDF user-space points (bottom origin).
 * Operands are read only: no embedded image bytes, text or PDF uploads.
 * Non-standard image-group operations are deliberately NOT inferred.
 */
export type ImageOperatorCodes={
  save:number;restore:number;transform:number;
  paintImageXObject:number;paintInlineImageXObject:number;
  paintImageMaskXObject:number;paintSolidColorImageMask:number;
};
export type PdfImagePaintRegion={
  bounds:PdfBoundingBox;
  areaFraction:number;
};
type Matrix=[number,number,number,number,number,number];
const identity:Matrix=[1,0,0,1,0,0];
function multiply(a:Matrix,b:Matrix):Matrix{
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
function validMatrix(args:unknown):args is Matrix{
  return Array.isArray(args)&&args.length===6&&args.every(x=>typeof x==="number"&&Number.isFinite(x));
}
function transformPoint(m:Matrix,x:number,y:number){
  return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};
}
function imageUnitBounds(m:Matrix,width:number,height:number):PdfBoundingBox|null{
  const corners=[transformPoint(m,0,0),transformPoint(m,1,0),
    transformPoint(m,0,1),transformPoint(m,1,1)];
  const minX=Math.max(0,Math.min(...corners.map(p=>p.x)));
  const maxX=Math.min(width,Math.max(...corners.map(p=>p.x)));
  const minY=Math.max(0,Math.min(...corners.map(p=>p.y)));
  const maxY=Math.min(height,Math.max(...corners.map(p=>p.y)));
  if(maxX-minX<1||maxY-minY<1)return null;
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}
/** Limit operator walk and cap resulting metadata. Still count all visible
 * image paints separately; don't mistake every XObject for a table. */
export function inspectPdfImagePaints(
  list:{fnArray:readonly number[];argsArray:readonly unknown[]},
  ops:ImageOperatorCodes,pageWidth:number,pageHeight:number,
):{imagePaintCount:number;imagePaintRegions:PdfImagePaintRegion[]}{
  const empty={imagePaintCount:0,imagePaintRegions:[] as PdfImagePaintRegion[]};
  if(!Number.isFinite(pageWidth)||!Number.isFinite(pageHeight)||
    pageWidth<=0||pageHeight<=0||list.fnArray.length>300000)return empty;
  let ctm:Matrix=[...identity],count=0;
  const stack:Matrix[]=[],regions:PdfImagePaintRegion[]=[];
  for(let i=0;i<list.fnArray.length;i++){
    const op=list.fnArray[i];
    if(op===ops.save){if(stack.length<100)stack.push([...ctm]);continue;}
    if(op===ops.restore){ctm=stack.pop()??identity;continue;}
    if(op===ops.transform){
      const matrix=list.argsArray[i];
      if(validMatrix(matrix))ctm=multiply(ctm,matrix);
      continue;
    }
    if(op!==ops.paintImageXObject&&op!==ops.paintInlineImageXObject&&
      op!==ops.paintImageMaskXObject&&op!==ops.paintSolidColorImageMask)continue;
    count++;
    const rect=imageUnitBounds(ctm,pageWidth,pageHeight);
    if(!rect||regions.length>=40)continue;
    regions.push({bounds:rect,areaFraction:rect.width*rect.height/(pageWidth*pageHeight)});
  }
  return {imagePaintCount:count,imagePaintRegions:regions};
}
