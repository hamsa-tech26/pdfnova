/**
 * R144 source-only boundary diagnostic for uncaptioned native paired columns.
 *
 * CRITICAL: This is NOT a table detector or a source of Excel rows. In the
 * absence of a caption/table rule/heading, a five-line paired source fragment
 * can be indistinguishable from ordinary two-column scientific article prose.
 * A published box provides reference EVALUATION coordinates only: never use
 * it as a hidden heuristic to select/approve user PDF tables.
 *
 * Output contains numbers and evidence flags, not PDF text.
 */
const ACCEPTED_X_JITTER=12;
const MAX_CONTINUATION_GAP_RATIO=1.55;
const median=values=>{
  if(!values.length)return null;
  const v=[...values].sort((a,b)=>a-b);
  return v[Math.floor(v.length/2)];
};
const finite=v=>Number.isFinite(v);
const native=(word)=>
  word?.extractionProvenance?.source!=="ocr-tesseract"&&
  finite(word.bounds?.x)&&finite(word.bounds?.y)&&finite(word.bounds?.width);
function haveAnchors(line,a,b){
  const words=line.words??[];
  return words.some(w=>native(w)&&Math.abs(w.bounds.x-a)<=ACCEPTED_X_JITTER)&&
    words.some(w=>native(w)&&Math.abs(w.bounds.x-b)<=ACCEPTED_X_JITTER);
}
function touchesAnchors(line,a,b){
  return (line.words??[]).some(w=>native(w)&&(
    Math.abs(w.bounds.x-a)<=ACCEPTED_X_JITTER||
    Math.abs(w.bounds.x-b)<=ACCEPTED_X_JITTER));
}
function yCenter(line){return line.bounds.y+line.bounds.height/2;}
export function assessUncaptionedPairedNativeStream(blocks,referenceBox){
  const all=blocks.filter(b=>b.type==="paragraph")
    .flatMap(b=>b.lines??[])
    .filter(line=>(line.words??[]).length&&finite(yCenter(line)))
    .sort((a,b)=>yCenter(b)-yCenter(a));
  const within=line=>{
    const cy=yCenter(line);
    return cy>=referenceBox.y&&cy<=referenceBox.y+referenceBox.height;
  };
  const paired=all.filter(within).flatMap(line=>{
    const words=[...(line.words??[])].filter(native).sort((a,b)=>a.bounds.x-b.bounds.x);
    // Long narrative text 2-column alignment, not presumed cell labels.
    if(words.length!==2)return [];
    const [left,right]=words;
    if(right.bounds.x-left.bounds.x<150)return [];
    return [{line,left:left.bounds.x,right:right.bounds.x,cy:yCenter(line)}];
  });
  const frequencies=new Map();
  for(const pair of paired){
    const key=[Math.round(pair.left/10),Math.round(pair.right/10)].join(":");
    frequencies.set(key,(frequencies.get(key)??0)+1);
  }
  const dominant=[...frequencies.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(!dominant||dominant[1]<4)return {
    status:"NO_STABLE_PAIRED_RUN",pairedInside:paired.length,
    topContinues:false,bottomContinues:false,sourcePromotable:false,
  };
  const members=paired.filter(p=>[Math.round(p.left/10),Math.round(p.right/10)].join(":")===dominant[0]);
  const a=median(members.map(x=>x.left)),b=median(members.map(x=>x.right));
  const first=members[0],last=members[members.length-1];
  const gap=median(members.slice(1).map((p,i)=>members[i].cy-p.cy).filter(x=>x>0));
  if(!gap)return {status:"NO_ROW_GAP",pairedInside:members.length,
    topContinues:false,bottomContinues:false,sourcePromotable:false};
  const before=all.filter(l=>yCenter(l)>first.cy)
    .sort((x,y)=>yCenter(x)-yCenter(y))[0];
  const after=all.filter(l=>yCenter(l)<last.cy)
    .sort((x,y)=>yCenter(x)-yCenter(y))[0];
  const topContinues=!!before&&yCenter(before)-first.cy<=gap*MAX_CONTINUATION_GAP_RATIO&&
    touchesAnchors(before,a,b);
  const bottomContinues=!!after&&last.cy-yCenter(after)<=gap*MAX_CONTINUATION_GAP_RATIO&&
    touchesAnchors(after,a,b);
  const possiblyIsolated=members.length>=5&&!topContinues&&!bottomContinues;
  return {status:possiblyIsolated?"ISOLATED_PAIRED_LAYOUT_NOT_CERTIFIED":
    "CONTIGUOUS_NATIVE_ARTICLE_COLUMNS_POSSIBLE",
    pairedInside:members.length,
    firstY:Number(first.cy.toFixed(1)),
    lastY:Number(last.cy.toFixed(1)),
    medianRowStep:Number(gap.toFixed(1)),
    leftAnchor:Number(a.toFixed(1)),rightAnchor:Number(b.toFixed(1)),
    topContinues,bottomContinues,
    // Always false. Isolation is not independent evidence of table semantics.
    sourcePromotable:false,
  };
}
