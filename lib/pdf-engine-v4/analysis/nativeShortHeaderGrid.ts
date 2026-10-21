import type {PdfLine,PdfParagraphBlock,PdfVisualBlock} from "../model/types";

/**
 * Source-first SHORT tabular text specialist: a genuinely labelled native
 * header, followed by >=4 rows with at least two distinct numeric columns
 * and 3–6 unambiguously aligned source-word anchors.
 *
 * No benchmark page, document ID, annotation or published box information.
 * Never reconstruct missing cells or promote ordinary two-column article prose.
 */
export type NativeShortHeaderGrid={
  sourceBlock:PdfParagraphBlock;
  firstLineIndex:number;
  lastLineIndex:number;
  block:PdfParagraphBlock;
};
const NUMBER=/^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[%a-zA-Z]{0,2})?$/u;
const ROWS_MIN=4,ROWS_MAX=12;
const SPACING=8,MAX_STEP=28,X_JITTER=7;
function signed(line:PdfLine){
  if(line.words.length<3||line.words.length>6||
    line.words.some(w=>
      w.extractionProvenance?.source==="ocr-tesseract"||
      !Number.isFinite(w.bounds.x)||!Number.isFinite(w.bounds.y)||
      !Number.isFinite(w.bounds.width)||w.bounds.width<=0||
      !w.text.trim()||w.text.trim().length>28))return null;
  const words=[...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  const xs=words.map(w=>w.bounds.x);
  if(xs.some((x,i)=>i>0&&x-xs[i-1]<25)||xs.at(-1)!-xs[0]<145)
    return null;
  const cy=line.bounds.y+line.bounds.height/2;
  if(!Number.isFinite(cy))return null;
  return {xs,words,cy};
}
function fits(a:NonNullable<ReturnType<typeof signed>>,
 b:NonNullable<ReturnType<typeof signed>>):boolean{
  return a.xs.length===b.xs.length&&
    a.xs.every((x,i)=>Math.abs(x-b.xs[i])<=X_JITTER);
}
const numericRow=(r:NonNullable<ReturnType<typeof signed>>)=>
  r.words.slice(1).filter(w=>NUMBER.test(w.text.trim())).length>=2&&
  r.words.slice(0,1).every(w=>w.text.length<=26);
function header(r:NonNullable<ReturnType<typeof signed>>):boolean{
  const labels=r.words.map(w=>w.text.trim());
  // Every column must have a short, non-numeric label; article sentences
  // and missing headers may not be treated as source column headings.
  return labels.every(t=>t.length<=20&&/[A-Za-z]/.test(t)&&!NUMBER.test(t))&&
    labels.filter(t=>/^[A-Za-z][A-Za-z/()\-]{0,19}$/.test(t)).length>=
      labels.length-1;
}
function fragment(source:PdfParagraphBlock,lines:PdfLine[],start:number):PdfParagraphBlock{
  const words=lines.flatMap(l=>l.words);
  const x=Math.min(...words.map(w=>w.bounds.x)),
    y=Math.min(...words.map(w=>w.bounds.y));
  const maxX=Math.max(...words.map(w=>w.bounds.x+w.bounds.width)),
    maxY=Math.max(...words.map(w=>w.bounds.y+w.bounds.height));
  return {...source,id:"native-short-header-grid-"+source.pageNumber+"-"+source.id+"-"+start,
    lines,bounds:{x,y,width:maxX-x,height:maxY-y},
    text:lines.map(l=>l.text).join(" ")};
}
export function findNativeShortHeaderGrids(
  blocks:readonly PdfVisualBlock[],
):NativeShortHeaderGrid[]{
  const found:NativeShortHeaderGrid[]=[];
  for(const source of blocks){
    if(source.type!=="paragraph"||source.lines.length<ROWS_MIN+1||
      source.lines.length>160)continue;
    const rows=source.lines.map(signed);
    let sectionCount=0;
    for(let start=0;start<rows.length-ROWS_MIN&&sectionCount<3;start++){
      const head=rows[start];
      if(!head||!header(head))continue;
      let prev=head,finish=start;
      for(let i=start+1;i<rows.length&&i<=start+ROWS_MAX;i++){
        const candidate=rows[i];
        if(!candidate||!numericRow(candidate)||!fits(head,candidate)||
          prev.cy-candidate.cy<SPACING||
          prev.cy-candidate.cy>MAX_STEP)break;
        prev=candidate;finish=i;
      }
      if(finish-start<ROWS_MIN)continue;
      const lines=source.lines.slice(start,finish+1);
      found.push({sourceBlock:source,firstLineIndex:start,
        lastLineIndex:finish,block:fragment(source,lines,start)});
      sectionCount++;
      start=finish;
    }
  }
  return found;
}
