import type {PdfLine,PdfParagraphBlock,PdfVisualBlock} from "../model/types";

/**
 * R130–132: narrow rescue for 3/4-column numeric native-text grids embedded
 * in a larger paragraph. This is not a generic table detector or OCR route.
 *
 * A candidate must have a repeated, independently measured column signature,
 * numeric evidence in at least two columns, stable physical row spacing,
 * and six source rows. No inferred cells and no softened global thresholds.
 */
export type CompactScientificGrid = {
  sourceBlock: PdfParagraphBlock;
  firstLineIndex: number;
  lastLineIndex: number;
  block: PdfParagraphBlock;
};
const MIN_ROWS=6;
const MAX_ROWS=24;
const MAX_BLOCK_LINES=160;
const POSITION_TOLERANCE=6;
const MIN_COLUMN_GAP=28;
const MIN_HORIZONTAL_SPAN=140;
const MIN_ROW_STEP=8;
const MAX_ROW_STEP=26;
const MAX_PER_BLOCK=3;

type RowSignature={x:number[];y:number;columns:3|4};

const numeric=/^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|[a-zA-Z]{1,2})?$/u;
function signature(line:PdfLine):RowSignature|null{
  if(line.words.length!==3&&line.words.length!==4)return null;
  // Source-native scientific recovery requires positive attribution;
  // missing provenance is not evidence of native text (nor safe OCR input).
  if(line.words.some(w=>w.extractionProvenance?.source!=="native-pdf"||
      !Number.isFinite(w.bounds.x)||!Number.isFinite(w.bounds.y)||
      !Number.isFinite(w.bounds.width)||w.bounds.width<=0||
      w.text.trim().length===0||w.text.length>35))return null;
  const words=[...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  const xs=words.map(w=>w.bounds.x);
  const width=xs[xs.length-1]-xs[0];
  if(width<MIN_HORIZONTAL_SPAN||xs.some((x,i)=>i>0&&x-xs[i-1]<MIN_COLUMN_GAP))
    return null;
  // Independent numeric source words are required; paragraph numerals,
  // list numbers and page footers are not sufficient evidence.
  if(words.slice(1).filter(w=>numeric.test(w.text.trim())).length<2)
    return null;
  if(words[0].text.trim().length>28)return null;
  return {x:xs,y:line.bounds.y+line.bounds.height/2,columns:xs.length as 3|4};
}
function aligned(a:RowSignature,b:RowSignature):boolean{
  return a.columns===b.columns &&
    a.x.every((x,i)=>Math.abs(x-b.x[i])<=POSITION_TOLERANCE);
}
function spatiallyBounded(source:PdfParagraphBlock,lines:PdfLine[],start:number):PdfParagraphBlock{
  const words=lines.flatMap(l=>l.words);
  const minX=Math.min(...words.map(w=>w.bounds.x));
  const minY=Math.min(...words.map(w=>w.bounds.y));
  const maxX=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  const maxY=Math.max(...words.map(w=>w.bounds.y+w.bounds.height));
  return {...source,
    id:"native-compact-grid-"+source.pageNumber+"-"+source.id+"-"+start,
    lines,bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},
    text:lines.map(l=>l.text).join(" ")};
}
export function findNativeCompactScientificGrids(blocks:readonly PdfVisualBlock[]):CompactScientificGrid[]{
  const result:CompactScientificGrid[]=[];
  for(const source of blocks){
    if(source.type!=="paragraph"||source.lines.length<MIN_ROWS+3||
        source.lines.length>MAX_BLOCK_LINES)continue;
    const signatures=source.lines.map(signature);
    let index=0;
    let found=0;
    while(index<signatures.length&&found<MAX_PER_BLOCK){
      const first=signatures[index];
      if(!first){index++;continue;}
      let end=index+1;
      while(end<signatures.length&&end-index<MAX_ROWS){
        const current=signatures[end],previous=signatures[end-1];
        if(!current||!previous||!aligned(first,current))break;
        const step=previous.y-current.y;
        if(step<MIN_ROW_STEP||step>MAX_ROW_STEP)break;
        end++;
      }
      const count=end-index;
      if(count>=MIN_ROWS){
        // Check the entire run rather than accepting a coincidental first-row
        // match. At most six points of horizontal jitter per source column.
        const lines=source.lines.slice(index,end);
        const xs=signatures.slice(index,end) as RowSignature[];
        const allAligned=first.x.every((x,i)=>
          xs.every(row=>Math.abs(row.x[i]-x)<=POSITION_TOLERANCE));
        if(allAligned){
          result.push({sourceBlock:source,firstLineIndex:index,
            lastLineIndex:end-1,block:spatiallyBounded(source,lines,index)});
          found++;
        }
      }
      index=Math.max(end,index+1);
    }
  }
  return result;
}
