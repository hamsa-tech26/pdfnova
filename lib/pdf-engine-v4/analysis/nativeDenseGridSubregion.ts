import type {PdfVisualBlock,PdfLine,PdfParagraphBlock} from "../model/types";

/**
 * R112 narrow native-grid subregion recovery.
 * Segment a visibly repeated numeric grid out of a giant native paragraph
 * without changing source words, OCR routing or global detection thresholds.
 * Do not treat two long side-by-side prose columns as a scientific table.
 */
export type NativeGridSegment={
  sourceBlock:PdfParagraphBlock;
  firstLineIndex:number;
  lastLineIndex:number;
  block:PdfParagraphBlock;
};
const centerY=(l:PdfLine)=>l.bounds.y+l.bounds.height/2;
const native=(l:PdfLine)=>l.words.length>0&&l.words.every(w=>
  w.extractionProvenance?.source!=="ocr-tesseract");
function rowEvidence(l:PdfLine){
  if(!native(l)||l.words.length<4||l.words.length>16)return false;
  const sorted=[...l.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  if(sorted.some(w=>w.text.trim().length>38))return false;
  if(sorted[sorted.length-1].bounds.x-sorted[0].bounds.x<110)return false;
  return sorted.filter(w=>/\d/u.test(w.text)).length>=2;
}
function columnsInRun(rows:PdfLine[]):number[]{
  const candidates=rows.flatMap(r=>r.words.map(w=>w.bounds.x)).sort((a,b)=>a-b);
  const anchors:{x:number;count:number}[]=[];
  for(const x of candidates){
    const found=anchors.find(a=>Math.abs(a.x-x)<=7);
    if(found){found.x=(found.x*found.count+x)/(found.count+1);found.count++;}
    else anchors.push({x,count:1});
  }
  return anchors.filter(a=>a.count>=rows.length*.7).map(a=>a.x);
}
function boundedParagraph(source:PdfParagraphBlock,lines:PdfLine[],start:number):PdfParagraphBlock{
  const words=lines.flatMap(l=>l.words);
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  const maxX=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  const maxY=Math.max(...words.map(w=>w.bounds.y+w.bounds.height));
  return {...source,id:"native-dense-grid-"+source.pageNumber+"-"+source.id+"-"+start,
    lines,bounds:{x,y,width:maxX-x,height:maxY-y},
    text:lines.map(l=>l.text).join(" ")};
}
export function findNativeDenseGridSubregions(blocks:PdfVisualBlock[]):NativeGridSegment[]{
  const result:NativeGridSegment[]=[];
  for(const source of blocks){
    if(source.type!=="paragraph"||source.lines.length<22||source.lines.length>160)continue;
    if(source.lines.some(l=>!native(l)))continue;
    const lines=source.lines;
    // Dense numeric row runs may have a single continuation-line interruption.
    const eligible=lines.map(rowEvidence);
    let best:{start:number;end:number;count:number}|null=null;
    for(let start=0;start<lines.length;start++){
      if(!eligible[start])continue;
      let count=1,end=start;
      for(let i=start+1;i<lines.length&&i<start+20;i++){
        const distance=Math.abs(centerY(lines[i-1])-centerY(lines[i]));
        if(distance>29||distance<1)break;
        if(!eligible[i]&&(!eligible[i+1]||!eligible[i-1]))break;
        if(eligible[i])count++;
        end=i;
      }
      if(count<4||end-start+1>17)continue;
      const rows=lines.slice(start,end+1).filter(rowEvidence);
      const anchors=columnsInRun(rows);
      // Two recurrent, distant source x positions and real numeric content
      // are mandatory; no publisher text, document IDs or fixture keys.
      if(!anchors.some(x=>anchors.some(y=>y-x>=85)))continue;
      const matches=rows.filter(row=>
        anchors.filter(anchor=>row.words.some(w=>Math.abs(w.bounds.x-anchor)<=9)).length>=2);
      if(matches.length<4)continue;
      if(!best||count>best.count)best={start,end,count};
    }
    if(!best)continue;
    // Include up to four immediately preceding header/subheader lines only
    // when part of the same nearby visual group; no article prose swallowing.
    let from=best.start;
    for(let i=best.start-1;i>=Math.max(0,best.start-4);i--){
      const gap=Math.abs(centerY(lines[i])-centerY(lines[i+1]));
      if(gap>24||lines[i].words.some(w=>w.text.length>65))break;
      from=i;
    }
    const chosen=lines.slice(from,best.end+1);
    if(chosen.length>20||chosen.length<5)continue;
    result.push({sourceBlock:source,firstLineIndex:from,lastLineIndex:best.end,
      block:boundedParagraph(source,chosen,from)});
  }
  return result;
}
