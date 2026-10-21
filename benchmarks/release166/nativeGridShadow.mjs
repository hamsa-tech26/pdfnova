/**
 * R167 source-PDF native numeric-row shadow detector.
 * Reference labels, publisher names and gold boxes MUST NOT enter this
 * function; proposal geometry uses only page-native word coordinates.
 * It does not construct/export cells or approve OCR/image pixels.
 */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const NUMERIC=/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|[a-zA-Z]{1,2})?$/u;
function row(line){
  if(!Array.isArray(line?.words)||line.words.length<3||
    line.words.length>16)return null;
  const words=[...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  if(words.some(w=>w.extractionProvenance?.source==="ocr-tesseract"||
    !w.text?.trim()||w.text.length>45||
    ![w.bounds?.x,w.bounds?.y,w.bounds?.width,w.bounds?.height]
    .every(finite)||w.bounds.width<=0||w.bounds.height<=0))return null;
  if(words.filter(w=>NUMERIC.test(w.text.trim())).length<2)return null;
  const xs=words.map(w=>w.bounds.x);
  if(xs.at(-1)-xs[0]<150)return null;
  const nums=words.filter(w=>NUMERIC.test(w.text.trim())).map(w=>w.bounds.x);
  return {line,cy:line.bounds.y+line.bounds.height/2,xs,nums};
}
function overlap(a,b){
  const matches=a.nums.map(x=>b.nums.some(y=>Math.abs(y-x)<=11));
  return matches.filter(Boolean).length>=2;
}
function rectangle(rows){
  const words=rows.flatMap(r=>r.line.words);
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  const maxX=Math.max(...words.map(w=>w.bounds.x+w.bounds.width));
  const maxY=Math.max(...words.map(w=>w.bounds.y+w.bounds.height));
  return {x,y,width:maxX-x,height:maxY-y};
}
export function proposeNativeGridRegions(page){
  if(!Array.isArray(page?.lines)||page.lines.length>2500||
    !Number.isFinite(page?.width)||!Number.isFinite(page?.height))return [];
  const lines=page.lines.filter(l=>
    l.pageNumber===page.pageNumber&&
    l.bounds&&[l.bounds.x,l.bounds.y,l.bounds.width,l.bounds.height]
      .every(finite)&&l.bounds.height>0)
    .sort((a,b)=>(b.bounds.y+b.bounds.height/2)-
      (a.bounds.y+a.bounds.height/2));
  const observations=lines.map(row);
  const results=[];
  for(let start=0;start<lines.length&&results.length<8;start++){
    if(!observations[start])continue;
    const run=[observations[start]];
    let end=start;
    for(let i=start+1;i<observations.length&&i<start+50;i++){
      const prev=run.at(-1),candidate=observations[i];
      if(!candidate)break;
      const gap=prev.cy-candidate.cy;
      if(gap<5||gap>34||!overlap(run[0],candidate))break;
      run.push(candidate);end=i;
    }
    if(run.length<4)continue;
    const region=rectangle(run);
    if(region.width<150||region.height<40||region.height>850)continue;
    if(results.some(r=>{
      const b=r.bounds;
      const ix=Math.max(0,Math.min(region.x+region.width,b.x+b.width)-
        Math.max(region.x,b.x));
      const iy=Math.max(0,Math.min(region.y+region.height,b.y+b.height)-
        Math.max(region.y,b.y));
      return ix*iy/(region.width*region.height)>.6;
    }))continue;
    results.push({bounds:region,rowCount:run.length,
      nativeWordCount:run.reduce((n,v)=>n+v.line.words.length,0)});
    start=end;
  }
  return results;
}
