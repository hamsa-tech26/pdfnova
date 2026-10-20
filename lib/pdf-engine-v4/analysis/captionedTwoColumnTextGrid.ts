import type {PdfLine,PdfParagraphBlock,PdfVisualBlock,PdfWord} from "../model/types";

/**
 * Evidence-limited recovery for native PDF two-column TEXT tables with a
 * genuine nearby source caption. Designed for long cell text rather than
 * numeric columns. Uncaptioned article columns and OCR never qualify.
 * Nothing is guessed or transcribed outside existing native PDF words.
 */
export type CaptionedTwoColumnTextGrid={
  sourceBlock:PdfParagraphBlock;
  firstLineIndex:number;
  lastLineIndex:number;
  block:PdfParagraphBlock;
};
const MIN_PAIRED_ROWS=8;
const MAX_REGION_LINES=25;
const COLUMN_MIN_SEPARATION=150;
const MAX_X_DRIFT=14;
const CAPTION_MAX_DISTANCE=48;
const MAX_CONSECUTIVE_INTERRUPTION=3;
const caption=/\b(?:table|tab\.?)\s*(?:(?:s?\d{1,3})|[ivx]{1,4})\b/i;
type Pair={left:number;right:number;y:number};

function nativeWords(line:PdfLine):PdfWord[]|null{
  if(line.words.length<2||line.words.length>9||
    line.words.some(w=>w.extractionProvenance?.source==="ocr-tesseract"||
      !Number.isFinite(w.bounds.x)||!Number.isFinite(w.bounds.y)||
      !Number.isFinite(w.bounds.width)||w.bounds.width<=0||!w.text.trim()))
    return null;
  return [...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
}
function twoColumnPair(line:PdfLine):Pair|null{
  const words=nativeWords(line);
  if(!words)return null;
  let bestGap=0,split=-1;
  for(let i=1;i<words.length;i++){
    const gap=words[i].bounds.x-words[i-1].bounds.x;
    if(gap>bestGap){bestGap=gap;split=i;}
  }
  if(split<1||bestGap<COLUMN_MIN_SEPARATION)return null;
  const left=words[0].bounds.x,right=words[split].bounds.x;
  if(right-left<COLUMN_MIN_SEPARATION)return null;
  // Distinguish source columns from multiple prose words on one baseline.
  if(words.slice(1,split).some(w=>w.bounds.x-left>110)||
    words.slice(split+1).some(w=>w.bounds.x-right>115))return null;
  return {left,right,y:line.bounds.y+line.bounds.height/2};
}
function boundsFor(lines:readonly PdfLine[]){
  const words=lines.flatMap(l=>l.words);
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}
function hasNearbyCaption(
  source:PdfParagraphBlock,firstY:number,lastY:number,
):boolean{
  const bottom=Math.min(firstY,lastY)-CAPTION_MAX_DISTANCE;
  const top=Math.max(firstY,lastY)+CAPTION_MAX_DISTANCE;
  return source.lines.some(line=>{
    if(!caption.test(line.text.trim()))return false;
    if(line.words.some(w=>w.extractionProvenance?.source==="ocr-tesseract"))return false;
    const cy=line.bounds.y+line.bounds.height/2;
    return cy>=bottom&&cy<=top;
  });
}
export function findCaptionedTwoColumnTextGrids(
  blocks:readonly PdfVisualBlock[],
):CaptionedTwoColumnTextGrid[]{
  const recovered:CaptionedTwoColumnTextGrid[]=[];
  for(const source of blocks){
    if(source.type!=="paragraph"||source.lines.length<MIN_PAIRED_ROWS||
      source.lines.length>130||!source.lines.some(line=>caption.test(line.text)))
      continue;
    const pairs=source.lines.map(twoColumnPair);
    let start=0;
    while(start<source.lines.length){
      const first=pairs[start];
      if(!first){start++;continue;}
      let count=1,end=start,last=first,interruptions=0;
      for(let i=start+1;i<source.lines.length&&i-start<MAX_REGION_LINES;i++){
        const next=pairs[i];
        if(next&&Math.abs(next.left-first.left)<=MAX_X_DRIFT&&
          Math.abs(next.right-first.right)<=MAX_X_DRIFT){
          const dy=last.y-next.y;
          if(dy<5||dy>75)break;
          count++;end=i;last=next;interruptions=0;
        }else{
          interruptions++;
          if(interruptions>MAX_CONSECUTIVE_INTERRUPTION)break;
        }
      }
      if(count>=MIN_PAIRED_ROWS&&
        hasNearbyCaption(source,first.y,last.y)){
        const lines=source.lines.slice(start,end+1);
        // An OCR insertion anywhere inside a recovered run is not a
        // trustworthy native cell. Refuse the whole candidate.
        if(lines.every(line=>line.words.every(w=>
          w.extractionProvenance?.source!=="ocr-tesseract"))){
          recovered.push({sourceBlock:source,firstLineIndex:start,
            lastLineIndex:end,block:{...source,
              id:"native-captioned-text-grid-"+source.pageNumber+"-"+source.id+"-"+start,
              lines,text:lines.map(line=>line.text).join(" "),
              bounds:boundsFor(lines)}});
          start=end+1;
          continue;
        }
      }
      start=Math.max(start+1,end+1);
    }
  }
  return recovered;
}
