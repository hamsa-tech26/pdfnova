import type { PdfV4OcrWord } from "./ocrRecognizer";

/**
 * Remove only spatially corroborated ruled-grid OCR debris.
 * Never change words based on ground truth or file name. Raw tokens are
 * returned as diagnostics so the review UI can inspect every rejected item.
 */
export function cleanPdfV4RuledGridArtifacts(
  words: readonly PdfV4OcrWord[], pageWidth: number,
): { words: PdfV4OcrWord[]; removed: PdfV4OcrWord[]; corrected: {before:PdfV4OcrWord;after:PdfV4OcrWord}[] } {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
    return {words:[...words],removed:[],corrected:[]};
  }
  const box=(w:PdfV4OcrWord)=>w.sourceBounds ?? w.bounds;
  const centerY=(w:PdfV4OcrWord)=>{const b=box(w);return (b.y0+b.y1)/2;};
  const pipes=words.filter(w => /^[|│]$/u.test(w.text.trim()));
  const clearGrid=pipes.length>=14 && new Set(pipes.map(w=>Math.round(centerY(w)/40))).size>=4;
  if(!clearGrid) return {words:[...words],removed:[],corrected:[]};

  const horizontalDebris=words.filter(w=>{
    const t=w.text.trim();
    return w.confidence<=35 && (/[—―─]{2,}/u.test(t) || /^[_–=.]{5,}$/u.test(t)) &&
       box(w).x1-box(w).x0>=pageWidth*0.04;
  });
  const nearBorder=(w:PdfV4OcrWord,maxX=45,maxY=125)=>{
    const b=box(w);
    return pipes.some(p=>{
      const pb=box(p);
      return Math.abs(pb.x0-b.x0)<=maxX && Math.abs(centerY(p)-centerY(w))<=maxY;
    });
  };
  const nextToRuleEnd=(w:PdfV4OcrWord)=>{
    const b=box(w);
    return pipes.some(p=>Math.abs(box(p).x0-b.x1)<=14 && Math.abs(centerY(p)-centerY(w))<=145);
  };
  const closeToHorizontalDebris=(w:PdfV4OcrWord)=>{
    const b=box(w);
    return horizontalDebris.some(p=>{
      const pb=box(p);
      return Math.abs(centerY(w)-centerY(p))<=22 && b.x1>=pb.x0-40 && b.x0<=pb.x1+40;
    });
  };

  // Serial-only contextual check: removing an OCR border stroke must reveal
  // digits already present in the token, corroborated by neighbors 7 -> 8 -> 9.
  const pureSerials=words.filter(w=>/^\d{1,3}$/u.test(w.text.trim()) && w.confidence>=70);
  function correctBorderPrefixedSerial(w:PdfV4OcrWord):PdfV4OcrWord | null {
    const text=w.text.trim();
    if(w.confidence>55 || !/^1\d{1,3}$/u.test(text) || !nearBorder(w,15,125)) return null;
    const remaining=Number(text.slice(1));
    const y=centerY(w),x=box(w).x0;
    const near=pureSerials.filter(p=>Math.abs(box(p).x0-x)<=110);
    const previous=near.filter(p=>centerY(p)<y&&y-centerY(p)<180).sort((a,b)=>centerY(b)-centerY(a))[0];
    const following=near.filter(p=>centerY(p)>y&&centerY(p)-y<180).sort((a,b)=>centerY(a)-centerY(b))[0];
    if(!previous||!following) return null;
    if(Number(previous.text)+1!==remaining || remaining+1!==Number(following.text))return null;
    return {...w,text:String(remaining)};
  }
  const removed:PdfV4OcrWord[]=[];
  const corrected:{before:PdfV4OcrWord;after:PdfV4OcrWord}[]=[];
  const output:PdfV4OcrWord[]=[];
  for(const w of words){
    const t=w.text.trim();
    const b=box(w);
    const removePipe=/^[|│]$/u.test(t);
    const removeRule=horizontalDebris.includes(w);
    const removeIsolatedPunctuation=(t==="!" || t==="I" || t==="a" || t==="E") &&
      w.confidence<=65 && b.x1-b.x0<pageWidth*0.025 && nearBorder(w,50,125);
    const removeShortGarbage=/^(?:ES|EE)$/u.test(t) && w.confidence<=30 &&
      (nearBorder(w,50,125)||closeToHorizontalDebris(w));
    if(removePipe||removeRule||removeIsolatedPunctuation||removeShortGarbage){
      removed.push(w);continue;
    }
    const serial=correctBorderPrefixedSerial(w);
    if(serial){corrected.push({before:w,after:serial});output.push(serial);continue;}
    if(w.confidence<=65 && /[a-z]{4,}!$/iu.test(t) &&
       b.x0>pageWidth*0.75 && nextToRuleEnd(w)) {
      const after={...w,text:w.text.replace(/!$/u,"")};
      corrected.push({before:w,after});output.push(after);continue;
    }
    output.push(w);
  }
  return {words:output,removed,corrected};
}
