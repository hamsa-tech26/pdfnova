import type {PdfBoundingBox,PdfLine,PdfVisualBlock,PdfWord} from "../model/types";
import type {ColumnCandidate,StableColumnDetectionResult} from "./stableColumnDetector";

/**
 * R88: recover a long, publisher-captioned three-column native table running
 * beside independent article prose in the opposite page column.
 *
 * Unlike splitting by whole PDF lines, each source line can contain both a
 * left table row and right-column prose. The caller MUST retain every word
 * that is not assigned to this grid. No OCR, literal source values, page IDs
 * or expected reference rows are used for classification.
 */
export type InterleavedNativeThreeColumnGrid = {
  sourceBlock: Extract<PdfVisualBlock,{type:"paragraph"}>;
  block: PdfVisualBlock;
  firstLineIndex: number;
  lastLineIndex: number;
  usedWordIds: Set<string>;
  anchors: number[];
};

const native = (word:PdfWord) =>
  !word.extractionProvenance || word.extractionProvenance.source === "native-pdf";

function bounds(words:PdfWord[]):PdfBoundingBox {
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}

function median(numbers:number[]):number {
  const sorted=[...numbers].sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length/2)]??0;
}

function clusters(lines:PdfLine[],maxX:number) {
  const groups:{xs:number[];lineIds:Set<string>}[]=[];
  for(const line of lines)for(const word of line.words){
    if(word.bounds.x>=maxX||!native(word))continue;
    const found=groups.find(g=>Math.abs(median(g.xs)-word.bounds.x)<=8);
    if(found){found.xs.push(word.bounds.x);found.lineIds.add(line.id);}
    else groups.push({xs:[word.bounds.x],lineIds:new Set([line.id])});
  }
  return groups.map(g=>({x:median(g.xs),support:g.lineIds.size}))
    .filter(g=>g.support>=14).sort((a,b)=>a.x-b.x);
}

const hasCaption=(line:PdfLine,maxX:number)=>
  /^table\s*\d{1,3}(?:[.:\s\u2013\u2014]|$)/i.test(
    line.words.filter(w=>w.bounds.x<maxX).map(w=>w.text.trim()).join(" ").trim()
  );

function nativeLine(line:PdfLine) {
  return line.words.length>0 && line.words.every(native);
}

export function findInterleavedNativeThreeColumnGrids(
  blocks:PdfVisualBlock[],
):InterleavedNativeThreeColumnGrid[] {
  const output:InterleavedNativeThreeColumnGrid[]=[];
  for(const source of blocks){
    if(source.type!=="paragraph"||source.lines.length<45||
       source.bounds.width<420||source.bounds.height<350)continue;
    const lines=source.lines;
    if(lines.some(l=>l.words.some(w=>!native(w))))continue;

    // The published left-half table ends BEFORE the independent right
    // narrative column; do not use any right-side words to build cells.
    const half=source.bounds.x+source.bounds.width*0.495;
    const strong=clusters(lines,half);
    if(strong.length!==3||strong[1].x-strong[0].x<45||
       strong[2].x-strong[1].x<35||strong[2].x>=half-8)continue;
    const anchors=strong.map(g=>g.x);
    const maxTableX=Math.min(half,anchors[2]+12);
    const rightProseLines=lines.filter(l=>l.words.some(w=>
      w.bounds.x>=anchors[2]+20 && w.bounds.x>=half)).length;
    if(rightProseLines<12)continue;

    for(let cap=0;cap<Math.min(22,lines.length-25);cap++){
      if(!nativeLine(lines[cap])||!hasCaption(lines[cap],maxTableX))continue;
      const rows:PdfLine[]=[];
      const usedWordIds=new Set<string>();
      let first=-1,last=-1,complete=0,numeric=0;
      for(let i=cap+1;i<Math.min(lines.length,cap+75);i++){
        const original=lines[i];
        const left=original.words.filter(w=>w.bounds.x<=maxTableX);
        const start=left.some(w=>Math.abs(w.bounds.x-anchors[0])<=11);
        if(!start)continue; // right-column prose between table rows
        if(rows.length===0&&i-cap>4)break;
        if(rows.length){
          const previous=rows[rows.length-1];
          const pitch=previous.bounds.y-original.bounds.y;
          if(pitch>20)break;
          if(pitch<8)continue;
        }
        if(!left.length||left.some(w=>!native(w)))break;
        const supports=anchors.map(x=>left.some(w=>Math.abs(w.bounds.x-x)<=11));
        if(supports.every(Boolean))complete++;
        if(left.some(w=>anchors.slice(1).some(x=>
          Math.abs(w.bounds.x-x)<=11 &&
          /^[-+\u2212]?(?:\d|\.\d)/u.test(w.text.trim()))))numeric++;
        const row:PdfLine={...original,words:left,bounds:bounds(left),
          text:left.map(w=>w.text).join(" ")};
        rows.push(row);
        left.forEach(w=>usedWordIds.add(w.id));
        if(first<0)first=i;
        last=i;
        if(rows.length>36)break;
      }
      if(rows.length<24||rows.length>34||
         complete<Math.ceil(rows.length*0.65)||
         numeric<5||first<0||last<first)continue;
      if(strong.some(a=>a.support<Math.ceil(rows.length*0.5)))continue;

      const seen=new Set(rows.flatMap(l=>l.words.map(w=>w.id)));
      if(seen.size!==usedWordIds.size||seen.size!==
         rows.reduce((sum,row)=>sum+row.words.length,0))continue;
      const all=rows.flatMap(l=>l.words);
      const grid:PdfVisualBlock={...source,
        id:"interleaved-native-three-grid-"+source.pageNumber+"-"+source.id+"-"+first,
        bounds:bounds(all),lines:rows,
        text:rows.map(l=>l.text).join(" ")};
      output.push({sourceBlock:source,block:grid,firstLineIndex:first,
        lastLineIndex:last,usedWordIds,anchors});
      cap=last;
    }
  }
  return output;
}

/** Only structurally admitted R88 grids may bypass generic column clustering. */
export function detectInterleavedNativeThreeColumns(
  block:PdfVisualBlock,previous:StableColumnDetectionResult,
):StableColumnDetectionResult|null {
  if(block.type!=="paragraph"||
     !block.id.startsWith("interleaved-native-three-grid-")||
     block.lines.length<24||block.lines.length>34)return null;
  if(block.lines.some(line=>line.words.some(w=>!native(w))))return null;
  const strong=clusters(block.lines,block.bounds.x+block.bounds.width+1);
  if(strong.length!==3||strong.some(g=>g.support<14))return null;
  const xs=strong.map(g=>g.x);
  if(xs[1]-xs[0]<45||xs[2]-xs[1]<35)return null;
  const columns:ColumnCandidate[]=xs.map((x,i)=>({
    id:"column-candidate-"+i,x,minX:x,maxX:x,
    leftBoundary:i===0?block.bounds.x:(xs[i-1]+x)/2,
    rightBoundary:i===2?block.bounds.x+block.bounds.width:(x+xs[i+1])/2,
    occurrences:strong[i].support,distinctLineCount:strong[i].support,
    averageDeviation:0,stability:0.98,confidence:0.94,accepted:true,
    reason:"Source-aligned three-column native table separate from right prose.",
  }));
  return {...previous,columns,confidence:0.94};
}

/**
 * Strip only actual recovered source word IDs. The caption, adjacent article
 * text on the SAME physical lines, other tables and footnotes remain prose.
 */
export function remainingInterleavedNativeProse(
  candidate:InterleavedNativeThreeColumnGrid,
):PdfVisualBlock|null {
  const source=candidate.sourceBlock;
  const lines=source.lines.flatMap(line=>{
    const words=line.words.filter(w=>!candidate.usedWordIds.has(w.id));
    return words.length?[{...line,words,bounds:bounds(words),
      text:words.map(w=>w.text).join(" ")}]:[];
  });
  if(!lines.length)return null;
  const all=lines.flatMap(l=>l.words);
  return {...source,
    id:"caption-prose-"+source.pageNumber+"-"+source.id+"-interleaved",
    lines,bounds:bounds(all),text:lines.map(l=>l.text).join(" ")};
}
