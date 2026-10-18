import type {PdfLine,PdfVisualBlock} from "../model/types";

/**
 * A native two-column grid that immediately follows an explicit Table N
 * caption in a journal PDF. Unlike generic caption recovery, a left-side
 * interval label and right-side formatted value can be ONE native text item
 * each, with no individually numeric words or 5+ anchors.
 *
 * Strict evidence: 7+ consecutive, horizontally aligned physical lines,
 * consistent row pitch, 5+ numeric values in the right column and 3+
 * numeric/ranged labels in the left. Preserves the original PdfWord objects.
 * Never reads OCR, never recovers narrative, never relaxes global thresholds.
 */
export type PairedNativeCaptionGrid={
  sourceBlock:Extract<PdfVisualBlock,{type:"paragraph"}>;
  block:PdfVisualBlock;
  firstLineIndex:number;
  lastLineIndex:number;
};
const isCaption=(value:string)=>
  /^table\s+\d{1,3}(?:[.:\s–—]|$)/i.test(value.trim());
const isNative=(line:PdfLine)=>line.words.every(w=>
  !w.extractionProvenance||w.extractionProvenance.source==="native-pdf");
const startsWithNumber=(value:string)=>
  /^\s*[-+]?\d/u.test(value);
function box(lines:PdfLine[]){
  const x=Math.min(...lines.map(l=>l.bounds.x));
  const y=Math.min(...lines.map(l=>l.bounds.y));
  return {x,y,width:Math.max(...lines.map(l=>l.bounds.x+l.bounds.width))-x,
    height:Math.max(...lines.map(l=>l.bounds.y+l.bounds.height))-y};
}
export function findPairedNativeCaptionGrids(blocks:PdfVisualBlock[]):PairedNativeCaptionGrid[]{
  const result:PairedNativeCaptionGrid[]=[];
  for(const block of blocks){
    if(block.type!=="paragraph"||block.lines.length<9)continue;
    const all=block.lines;
    for(let cap=0;cap<all.length-7;cap++){
      if(!isCaption(all[cap].text)||!isNative(all[cap]))continue;
      const first=all[cap+1];
      if(first.words.length!==2||!isNative(first))continue;
      const anchors=first.words.map(w=>w.bounds.x);
      if(anchors[1]-anchors[0]<55||anchors[1]-anchors[0]>280)continue;
      const rows:PdfLine[]=[];
      let pitches:number[]=[];
      for(let i=cap+1;i<Math.min(all.length,cap+27);i++){
        const line=all[i];
        if(line.words.length!==2||!isNative(line))break;
        const [left,right]=line.words;
        if(Math.abs(left.bounds.x-anchors[0])>6||
           Math.abs(right.bounds.x-anchors[1])>6)break;
        if(rows.length>0){
          const pitch=rows[rows.length-1].bounds.y-line.bounds.y;
          if(pitch<10||pitch>23)break;
          pitches.push(pitch);
          if(pitches.length>=3&&Math.max(...pitches)-Math.min(...pitches)>3)break;
        }
        rows.push(line);
      }
      if(rows.length<7||rows.length>24)continue;
      const body=rows.slice(1);
      const numericRight=body.filter(l=>
        startsWithNumber(l.words[1].text)).length;
      const numericLeft=body.filter(l=>
        startsWithNumber(l.words[0].text)).length;
      if(numericRight<Math.max(5,Math.ceil(body.length*0.7))||
         numericLeft<3)continue;
      const start=cap+1,end=start+rows.length-1;
      result.push({
        sourceBlock:block,firstLineIndex:start,lastLineIndex:end,
        block:{...block,
          id:"paired-caption-grid-"+block.pageNumber+"-"+block.id+"-"+start,
          text:rows.map(l=>l.text).join(" "),
          bounds:box(rows),lines:rows,
        },
      });
      // The recovered grid is one contiguous sequence; subsequent captions
      // may still be independently identified outside this sequence.
      cap=end;
    }
  }
  return result;
}
