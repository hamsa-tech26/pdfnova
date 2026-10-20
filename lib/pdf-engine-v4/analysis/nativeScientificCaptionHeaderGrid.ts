import type {PdfLine,PdfParagraphBlock,PdfVisualBlock,PdfBoundingBox} from "../model/types";

/**
 * R145: isolate a caption-backed multi-column native scientific header + data
 * when its whole source paragraph would otherwise be a falsely broad table.
 * No publisher IDs, annotation-box coordinates, OCR acceptance, or global
 * threshold relaxation. The excluded caption/prose stays in source order.
 */
export type CaptionHeaderNativeSegment={
  sourceBlock:PdfParagraphBlock;
  firstLineIndex:number;
  lastLineIndex:number;
  block:PdfParagraphBlock;
};
const isNative=(l:PdfLine)=>l.words.length>0&&l.words.every(w=>
  w.extractionProvenance?.source!=="ocr-tesseract"&&
  Number.isFinite(w.bounds.x)&&Number.isFinite(w.bounds.y));
const caption=(t:string)=>/^table\s+(?:s?\d{1,3})(?:\s*[.:\u2013\u2014]\s*|\s*$)/i
  .test(t.trim());
const xSorted=(l:PdfLine)=>[...l.words].sort((a,b)=>a.bounds.x-b.bounds.x);
const spread=(l:PdfLine)=>{
  const w=xSorted(l);return w[w.length-1].bounds.x-w[0].bounds.x;
};
const numeric=(l:PdfLine)=>l.words.filter(w=>/\d/u.test(w.text)).length;
const header=(l:PdfLine)=>{
  if(!isNative(l)||l.words.length<3||l.words.length>7||spread(l)<220)return false;
  // A multi-column source header may have a long final label.
  const w=xSorted(l);
  return w.filter(word=>word.text.trim().length<=32).length>=2&&
    w.slice(1).filter((word,i)=>word.bounds.x-w[i].bounds.x>=35).length>=2;
};
const row=(l:PdfLine)=>{
  if(!isNative(l)||l.words.length<4||l.words.length>14)return false;
  if(spread(l)<118||numeric(l)<2)return false;
  const w=xSorted(l);
  return w.some(t=>Math.abs(t.bounds.x-w[0].bounds.x)>100)&&
    w.filter(x=>x.text.trim().length<=26).length>=3;
};
const center=(l:PdfLine)=>l.bounds.y+l.bounds.height/2;
function bounded(source:PdfParagraphBlock,lines:PdfLine[],start:number){
  const words=lines.flatMap(l=>l.words);
  const minX=Math.min(...words.map(w=>w.bounds.x));
  const minY=Math.min(...words.map(w=>w.bounds.y));
  const maxX=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  const maxY=Math.max(...words.map(w=>w.bounds.y+w.bounds.height));
  return {...source,
    id:"native-caption-header-grid-"+source.pageNumber+"-"+source.id+"-"+start,
    lines,bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},
    text:lines.map(l=>l.text).join(" ")};
}
export function findNativeCaptionHeaderScientificGrids(
  blocks:PdfVisualBlock[],
):CaptionHeaderNativeSegment[]{
  const results:CaptionHeaderNativeSegment[]=[];
  for(const block of blocks){
    if(block.type!=="paragraph"||block.lines.length<13||block.lines.length>24)continue;
    const lines=block.lines;
    if(!isNative(lines[0])||!caption(lines[0].text))continue;
    // Require the source caption to precede two short introductory lines
    // before a true multi-column header; not general article prose columns.
    for(let start=2;start<=Math.min(5,lines.length-10);start++){
      if(!header(lines[start]))continue;
      if(lines.slice(1,start).some(l=>!isNative(l)||l.words.length>2||
        caption(l.text)))continue;
      // A compact header has 2-3 adjacent lines, followed by repeated
      // numeric rows. No source text or reference boxes enter selection.
      const following=lines.slice(start+1);
      const data=following.map((line,i)=>row(line)?i+start+1:-1)
        .filter(i=>i>=0);
      if(data.length<5)continue;
      // Independent recurring source x positions, not only repeated numeric
      // words, are required to avoid drifting or column-swapped prose.
      const leftAnchors=data.map(i=>xSorted(lines[i])[0].bounds.x);
      const recurring=leftAnchors.filter(x=>Math.abs(x-leftAnchors[0])<=9);
      if(recurring.length<5)continue;
      const final=data[data.length-1];
      if(final-start<7||final-start>16)continue;
      if(data.some((index,i)=>i>0&&index-data[i-1]>3))continue;
      const tail=lines.slice(final+1);
      // Do not silently absorb an unrelated bottom caption/paragraph.
      if(tail.length>3||tail.some(l=>caption(l.text)))continue;
      const chosen=lines.slice(start,final+1);
      if(chosen.length<9||chosen.some(l=>!isNative(l)))continue;
      const centers=chosen.map(center);
      if(centers.slice(1).some((c,i)=>{
        const d=centers[i]-c;return d<=0||d>33;
      }))continue;
      results.push({sourceBlock:block,firstLineIndex:start,
        lastLineIndex:final,block:bounded(block,chosen,start)});
      break;
    }
  }
  return results;
}

/**
 * Source-evidenced table-footnote geometry for detection localization.
 * Some publisher table detection regions include native footnotes beneath
 * the final data row. Keep these source words OUT of physical Excel rows,
 * and include their actual geometry only when consecutive lines explicitly
 * self-identify as table notes. Never use published reference boxes, page
 * numbers, arbitrary padding, OCR, or global threshold changes here.
 */
export function findNativeScientificTableFootnoteBounds(
  tableRegion:PdfVisualBlock,originalPageLines:readonly PdfLine[],
):PdfBoundingBox|null{
  if(tableRegion.type!=="paragraph"||
    !tableRegion.id.startsWith("native-caption-header-grid-")||
    tableRegion.lines.length<9||tableRegion.lines.length>20)return null;
  const original=tableRegion.bounds;
  const valid=(v:number)=>Number.isFinite(v);
  if(![original.x,original.y,original.width,original.height].every(valid)||
    original.width<=0||original.height<=0)return null;
  const candidates=originalPageLines.filter(line=>
    line.bounds.y<original.y&&
    line.bounds.y>=original.y-50&&
    line.bounds.x>=original.x-16&&
    line.bounds.x<=original.x+16)
    .sort((a,b)=>b.bounds.y-a.bounds.y);
  const accepted:PdfLine[]=[];
  let previousY=original.y;
  for(const line of candidates){
    if(accepted.length>=2||!isNative(line)||
      line.words.length>3||line.words.length<1||
      line.words.some(word=>!Number.isFinite(word.bounds.width)||
        !Number.isFinite(word.bounds.height)||
        word.bounds.width<=0||word.bounds.height<=0))break;
    const top=line.bounds.y+line.bounds.height;
    if(previousY-top<0||previousY-top>22)break;
    const text=line.text.trim();
    if(!/^(?:\*|†|‡|#|notes?(?:\s*[:.\-]|\s+(?:about|on|to)\b)|abbrev(?:iation)?s?\s*[:.\-]|source\s*:|p\s*[<>=])/i.test(text))
      break;
    accepted.push(line);
    previousY=line.bounds.y;
  }
  if(!accepted.length)return null;
  const words=accepted.flatMap(line=>line.words);
  const minX=Math.min(original.x,...words.map(word=>word.bounds.x));
  const minY=Math.min(original.y,...words.map(word=>word.bounds.y));
  const maxX=Math.max(original.x+original.width,
    ...words.map(word=>word.bounds.x+word.bounds.width));
  const maxY=Math.max(original.y+original.height,
    ...words.map(word=>word.bounds.y+word.bounds.height));
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}
