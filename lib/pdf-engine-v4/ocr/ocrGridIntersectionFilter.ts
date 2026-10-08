/**
 * Rejects OCR tokens caused by intersections of ruled table borders.
 * A literal "|" in document content stays intact unless >=4 isolated
 * pipe symbols form a wide, nearly-horizontal row across the page.
 *
 * This is deterministic image-evidence cleanup, NOT inferred text.
 */
export function removeOcrGridIntersectionTokens<
  T extends { text:string; bounds:{x0:number;y0:number;x1:number;y1:number}; sourceBounds?:{x0:number;y0:number;x1:number;y1:number} }
>(words:readonly T[], pageWidth:number):T[] {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return [...words];
  const bounds=(word:T)=>word.sourceBounds ?? word.bounds;
  const midY=(word:T)=>{const b=bounds(word);return (b.y0+b.y1)/2;};
  const pipes=words.filter(w=>w.text.trim()==="|" || w.text.trim()==="│");
  if(pipes.length<4)return [...words];

  const bands:{y:number;pipes:T[]}[]=[];
  for(const pipe of [...pipes].sort((a,b)=>midY(a)-midY(b))) {
    const y=midY(pipe);
    const band=bands.find(b=>Math.abs(b.y-y)<=14);
    if(band){band.pipes.push(pipe);band.y=band.pipes.reduce((sum,w)=>sum+midY(w),0)/band.pipes.length;}
    else bands.push({y,pipes:[pipe]});
  }
  const gridbands=bands.filter(b=>{
    if(b.pipes.length<4)return false;
    const xs=b.pipes.map(w=>bounds(w).x0);
    return Math.max(...xs)-Math.min(...xs)>=pageWidth*0.32;
  });
  if(!gridbands.length)return [...words];
  const isInGridBand=(word:T)=>gridbands.some(b=>Math.abs(midY(word)-b.y)<=16);
  return words.filter(word=>{
    if(!isInGridBand(word))return true;
    const t=word.text.trim();
    if(t==="|"||t==="│")return false;
    // Very short glyphs can be OCR interpretations of rule crossings:
    // conservatively reject only if the glyph is near the leftmost rule
    // and the row contains at least four independent vertical rules.
    if(t!=="E")return true;
    const b=bounds(word);
    return !gridbands.some(band=>{
      if(Math.abs(midY(word)-band.y)>16)return false;
      const left=Math.min(...band.pipes.map(w=>bounds(w).x0));
      return b.x0<left && left-b.x0 < pageWidth*0.075 &&
        b.x1-b.x0<pageWidth*0.03;
    });
  });
}
