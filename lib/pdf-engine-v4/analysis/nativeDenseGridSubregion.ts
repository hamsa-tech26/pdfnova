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
// A native financial grid can have one long description item followed by
// four or more separately positioned numeric cells. The description length
// is not prose evidence when every other cell has this stronger signature.
// Keep the ordinary row count, spacing, alignment and OCR gates unchanged.
function hasNumericCellsAfterLongLabel(sorted:PdfLine["words"]):boolean{
  if(sorted.length<5||sorted[0].text.trim().length>180)return false;
  const cells=sorted.slice(1);
  const numeric=/^[+\-−]?(?:\(?[£$€¥]?\d[\d,]*(?:\.\d+)?\)?%?)$/u;
  return cells.every((word,index)=>word.text.trim().length<=24&&
    numeric.test(word.text.trim())&&
    (index===0||word.bounds.x-cells[index-1].bounds.x>=18))&&
    cells[cells.length-1].bounds.x-cells[0].bounds.x>=160;
}
function rowEvidence(l:PdfLine){
  if(!native(l)||l.words.length<4||l.words.length>16)return false;
  const sorted=[...l.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  if(sorted.some(w=>w.text.trim().length>38)&&
    !hasNumericCellsAfterLongLabel(sorted))return false;
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
    const potential:{start:number;end:number;count:number}[]=[];
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
      if(count<7||end-start+1>17)continue;
      const rows=lines.slice(start,end+1).filter(rowEvidence);
      const anchors=columnsInRun(rows);
      // Two recurrent, distant source x positions and real numeric content
      // are mandatory; no publisher text, document IDs or fixture keys.
      if(!anchors.some(x=>anchors.some(y=>y-x>=85)))continue;
      const matches=rows.filter(row=>
        anchors.filter(anchor=>row.words.some(w=>Math.abs(w.bounds.x-anchor)<=9)).length>=2);
      if(matches.length<7)continue;
      potential.push({start,end,count});
    }
    // R113: a single visual block can hold multiple separated numeric
    // tables. Prefer the longest supported runs and never duplicate lines.
    const accepted:{from:number;end:number;count:number}[]=[];
    for(const candidate of potential.sort((a,b)=>b.count-a.count||a.start-b.start)){
      let from=candidate.start;
      for(let i=candidate.start-1;i>=Math.max(0,candidate.start-4);i--){
        const gap=Math.abs(centerY(lines[i])-centerY(lines[i+1]));
        if(gap>24||lines[i].words.some(w=>w.text.length>65))break;
        from=i;
      }
      if(candidate.end-from+1>20)continue;
      if(accepted.some(previous=>from<=previous.end+1&&candidate.end>=previous.from-1))continue;
      accepted.push({from,end:candidate.end,count:candidate.count});
      if(accepted.length===3)break; // bound complexity per source block
    }
    for(const section of accepted.sort((a,b)=>a.from-b.from)){
      const chosen=lines.slice(section.from,section.end+1);
      if(chosen.length<5)continue;
      result.push({sourceBlock:source,firstLineIndex:section.from,
        lastLineIndex:section.end,block:boundedParagraph(source,chosen,section.from)});
    }
  }
  return result;
}
