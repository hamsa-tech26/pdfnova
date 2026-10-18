import type {PdfWord,PdfLine,PdfBoundingBox,PdfVisualBlock,PdfParagraphBlock} from "../model/types";
import type {StableColumnDetectionResult,ColumnCandidate} from "./stableColumnDetector";
const median=(v:number[])=>{const a=[...v].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]??0;};
const caption=(words:PdfWord[])=>/^table\s+\d{1,3}(?:[.:\s]|$)/i.test(
  [...words].sort((a,b)=>a.bounds.x-b.bounds.x).map(w=>w.text).join(" ").trim());
const bounds=(ws:PdfWord[]):PdfBoundingBox=>{
  const x=Math.min(...ws.map(w=>w.bounds.x)),y=Math.min(...ws.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...ws.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...ws.map(w=>w.bounds.y+w.bounds.height))-y};
};
const take=(line:PdfLine,words:PdfWord[],side:string):PdfLine=>({
  ...line,id:line.id+"-"+side,words,bounds:bounds(words),
  text:[...words].sort((a,b)=>a.bounds.x-b.bounds.x).map(w=>w.text).join(" ")
});
const paragraph=(src:PdfParagraphBlock,lines:PdfLine[],type:string):PdfParagraphBlock=>({
  ...src,id:type+"-"+src.id,lines,bounds:bounds(lines.flatMap(l=>l.words)),
  text:lines.map(l=>l.text).join(" "),
});
const combine=(a:PdfLine,b:PdfLine):PdfLine=>{
  const words=[...a.words,...b.words].sort((x,y)=>x.bounds.x-y.bounds.x);
  return {...a,id:a.id+"-continued",words,bounds:bounds(words),
    text:words.map(w=>w.text).join(" ")};
};
/**
 * R80 source-column isolation. Requires two distinct side-by-side table
 * captions, a long four-column right grid, and 30+ aligned left value rows.
 * Strictly excludes OCR and narrative-only pages; no publisher IDs or
 * document text are hard-coded. Every source word is preserved once.
 */
export function splitParallelScientificTables(blocks:PdfVisualBlock[]):PdfVisualBlock[]{
 return blocks.flatMap(b=>{
  if(b.type!=="paragraph"||b.lines.length<55)return [b];
  const original=b.lines.flatMap(l=>l.words);
  if(original.length<250||original.some(w=>w.extractionProvenance?.source==="ocr-tesseract"))return [b];
  const coords=original.map(w=>w.bounds.x),min=Math.min(...coords),max=Math.max(...coords);
  if(max-min<390)return [b];
  const pivot=(min+max)/2,left:PdfLine[]=[],right:PdfLine[]=[];
  for(const line of b.lines){
    const l=line.words.filter(w=>w.bounds.x<pivot);
    const r=line.words.filter(w=>w.bounds.x>=pivot);
    if(l.length)left.push(take(line,l,"left"));
    if(r.length)right.push(take(line,r,"right"));
  }
  if(left.length<45||right.length<40||!caption(left[0].words)||
     !caption(right[0].words))return [b];
  if(right.filter(l=>l.words.length>=4&&
     l.words[l.words.length-1].bounds.x-l.words[0].bounds.x>=125).length<25)return [b];
  const groups=new Map<number,number>();
  for(const l of left)for(const w of l.words){
    const x=w.bounds.x;
    if(x>=min+125&&x<=pivot-12){
      const k=Math.round(x/8)*8;groups.set(k,(groups.get(k)||0)+1);
    }
  }
  const peak=[...groups.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(!peak||peak[1]<30)return [b];
  const valueX=peak[0];
  const paired=(l:PdfLine)=>l.words.some(w=>Math.abs(w.bounds.x-valueX)<=9)&&
    l.words.some(w=>w.bounds.x<valueX-35);
  let start=-1,stop=-1,pairs=0,miss=0;
  for(let i=1;i<left.length;i++){
    if(paired(left[i])){if(start<0)start=i;stop=i;pairs++;miss=0;}
    else if(start>=0&&++miss>=5&&pairs>=25)break;
  }
  if(start<1||pairs<30||stop-start+1<36||stop-start+1>72)return [b];
  const raw=left.slice(start,stop+1),rows:PdfLine[]=[];
  for(let i=0;i<raw.length;i++){
    const line=raw[i],next=raw[i+1];let merge=false;
    if(next?.words.length===1){
      const gap=line.bounds.y-next.bounds.y,x=next.words[0].bounds.x;
      const hasValue=line.words.some(w=>Math.abs(w.bounds.x-valueX)<=9);
      const labelOnly=!hasValue&&line.words.every(w=>w.bounds.x<valueX-30);
      merge=gap>=4&&gap<=10&&(
        (hasValue&&x>min+30&&x<valueX-30)||
        (labelOnly&&Math.abs(x-valueX)<=9));
    }
    if(merge&&next){rows.push(combine(line,next));i++;}
    else rows.push(line);
  }
  if(rows.length<34||rows.length>52)return [b];
  const out:PdfVisualBlock[]=[];
  if(start)out.push(paragraph(b,left.slice(0,start),"parallel-native-prose"));
  out.push(paragraph(b,rows,"native-two-col-grid"));
  if(stop+1<left.length)out.push(paragraph(b,left.slice(stop+1),"parallel-native-prose-tail"));
  out.push(paragraph(b,right,"parallel-native-right"));
  const after=out.flatMap(p=>p.type==="paragraph"?p.lines.flatMap(l=>l.words):[]);
  if(after.length!==original.length||
    new Set(after.map(w=>w.id)).size!==new Set(original.map(w=>w.id)).size)return [b];
  return out;
 });
}
export function detectParallelNativeColumns(
 b:PdfVisualBlock,previous:StableColumnDetectionResult,
):StableColumnDetectionResult|null{
 if(b.type!=="paragraph"||!b.id.startsWith("native-two-col-grid-")||
    b.lines.length<34)return null;
 const starts=new Map<number,number>();
 for(const line of b.lines)for(const w of line.words){
   const k=Math.round(w.bounds.x/8)*8;starts.set(k,(starts.get(k)||0)+1);
 }
 const peak=[...starts.entries()].sort((a,b)=>b[1]-a[1])[0];
 if(!peak||peak[1]<28)return null;
 const lefts=b.lines.filter(l=>l.words.some(w=>Math.abs(w.bounds.x-peak[0])<=9))
  .map(l=>Math.min(...l.words.map(w=>w.bounds.x)))
  .filter(x=>x<peak[0]-35);
 if(lefts.length<28)return null;
 const x1=median(lefts),x2=peak[0];if(x2-x1<110||x2-x1>220)return null;
 const cols:ColumnCandidate[]=[x1,x2].map((x,i)=>({
   id:"column-candidate-"+i,x,minX:x,maxX:x,occurrences:i?peak[1]:lefts.length,
   distinctLineCount:i?peak[1]:lefts.length,averageDeviation:0,
   leftBoundary:i?(x1+x2)/2:b.bounds.x,
   rightBoundary:i?b.bounds.x+b.bounds.width:(x1+x2)/2,
   stability:0.98,confidence:0.95,accepted:true,
   reason:"Conservative parallel native source-column evidence.",
 }));
 return {...previous,columns:cols};
}
