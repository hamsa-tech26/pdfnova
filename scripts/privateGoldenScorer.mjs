/**
 * Release 52: private, independently annotated real-document scoring.
 * Pure functions: no access to PDF contents, storage, network or telemetry.
 * Never emit expected/actual text from this module.
 */
export const REALWORLD_SCHEMA="kukureku-private-golden-v1";
export const REALWORLD_POLICY=Object.freeze({
  version:"release52-internal-real-world-v1",
  requiredPerCategory:{"ocr-text":2,"table":2,"form":2,"layout":2},
  maxCharacterErrorPct:5,
  minExactCellPct:95,
  minExactRowPct:75,
  maxTextCharacters:12000,
  maxTableCells:5000,
  maxPdfBytes:25*1024*1024
});
export const CATEGORIES=Object.freeze(["ocr-text","table","form","layout"]);
const ID=/^[a-z][a-z0-9-]{2,39}$/;
const HASH=/^[0-9a-f]{64}$/i;
const safeText=v=>typeof v==="string"&&v.length>0&&v.length<=REALWORLD_POLICY.maxTextCharacters;
const err=()=>{throw new Error("Invalid or incomplete private Golden Document annotation (no source data printed).");};
export function normalizeText(value){
  return String(value??"").normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase();
}
export function characterErrorPct(expected,actual){
  const a=normalizeText(expected),b=normalizeText(actual);
  if(a.length>REALWORLD_POLICY.maxTextCharacters||b.length>REALWORLD_POLICY.maxTextCharacters)err();
  if(!a.length)err();
  let previous=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){
    const current=[i];
    for(let j=1;j<=b.length;j++){
      current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    previous=current;
  }
  return Math.round(10000*previous[b.length]/a.length)/100;
}
export function validatePrivateManifest(manifest){
  if(!manifest||manifest.schema!==REALWORLD_SCHEMA||manifest.provenance!=="REAL_WORLD_HUMAN_REVIEWED"||
     !Array.isArray(manifest.cases)||!manifest.cases.length||manifest.cases.length>80)err();
  const ids=new Set(),files=new Set(),sourceHashes=new Set();
  for(const entry of manifest.cases){
    if(!entry||!ID.test(entry.id)||!CATEGORIES.includes(entry.category)||
      typeof entry.file!=="string"||!/^case-[a-z0-9-]+\.pdf$/.test(entry.file)||
      files.has(entry.file)||ids.has(entry.id)||!HASH.test(entry.sha256)||
      sourceHashes.has(entry.sha256.toLowerCase())||
      !["owner-consent","public-domain","licensed-test"].includes(entry.rights)||
      !entry.annotation||!ID.test(entry.annotation.annotatorId)||
      !ID.test(entry.annotation.reviewerId)||
      entry.annotation.annotatorId===entry.annotation.reviewerId||
      entry.annotation.reviewerApproved!==true||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.annotation.reviewDate)||!entry.expected)err();
    ids.add(entry.id);files.add(entry.file);sourceHashes.add(entry.sha256.toLowerCase());
    const reviewDate=new Date(entry.annotation.reviewDate+"T00:00:00.000Z");
    if(!Number.isFinite(reviewDate.getTime())||reviewDate.toISOString().slice(0,10)!==entry.annotation.reviewDate)err();
    const e=entry.expected;
    if(entry.category==="ocr-text" && !safeText(e.text))err();
    if(entry.category==="table"){
      if(!Number.isInteger(e.tableIndex)||e.tableIndex<0||e.tableIndex>30||
        !Array.isArray(e.rows)||e.rows.length<2||e.rows.length>1000)err();
      const widths=e.rows.map(row=>Array.isArray(row)?row.length:0);
      if(widths.some(w=>w<2||w>30)||new Set(widths).size!==1||
        widths.reduce((s,n)=>s+n,0)>REALWORLD_POLICY.maxTableCells||
        e.rows.some(row=>row.some(c=>typeof c!=="string"||c.length>3000)))err();
    }
    if(entry.category==="form" &&
      (!Array.isArray(e.visiblePhrases)||!e.visiblePhrases.length||
        e.visiblePhrases.length>100||e.visiblePhrases.some(v=>!safeText(v))))err();
    if(entry.category==="layout" &&
      (!Number.isInteger(e.pageCount)||e.pageCount<1||e.pageCount>150||
        !Array.isArray(e.pages)||e.pages.length!==e.pageCount||
        e.pages.some(p=>!p||!Number.isFinite(p.width)||!Number.isFinite(p.height)||
          p.width<1||p.height<1||![0,90,180,270].includes(p.rotation)||
          !Array.isArray(p.requiredText)||!p.requiredText.length||
          p.requiredText.some(v=>!safeText(v)))))err();
  }
  return manifest.cases;
}
const pct=(n,total)=>total?Math.round(10000*n/total)/100:0;
export function scorePrivateCase(spec,actual){
  const result={id:spec.id,category:spec.category,status:"FAIL",metrics:{},reasonCode:"EVIDENCE_MISSING"};
  if(!actual||actual.measured!==true)return result;
  if(spec.category==="ocr-text"){
    if(typeof actual.text!=="string"){result.reasonCode="NO_OCR_TEXT";return result;}
    const cer=characterErrorPct(spec.expected.text,actual.text);
    result.metrics={characterErrorPct:cer,characterAccuracyPct:Math.max(0,Math.round((100-cer)*100)/100)};
    result.status=cer<=REALWORLD_POLICY.maxCharacterErrorPct?"PASS":"FAIL";
    result.reasonCode=result.status==="PASS"?"THRESHOLD_MET":"TEXT_ACCURACY";
  }else if(spec.category==="table"){
    if(!Array.isArray(actual.rows)){result.reasonCode="NO_CONFIRMED_TABLE";return result;}
    const gold=spec.expected.rows,rows=actual.rows;
    const total=gold.reduce((n,row)=>n+row.length,0);
    const cells=gold.reduce((n,row,i)=>n+row.filter((v,j)=>rows[i]?.[j]!==undefined&&normalizeText(v)===normalizeText(rows[i]?.[j])).length,0);
    const complete=gold.filter((row,i)=>Array.isArray(rows[i])&&row.length===rows[i].length&&row.every((v,j)=>normalizeText(v)===normalizeText(rows[i][j]))).length;
    const cellAccuracy=pct(cells,total),rowAccuracy=pct(complete,gold.length),rowCountMatch=rows.length===gold.length;
    result.metrics={exactCellPct:cellAccuracy,exactRowPct:rowAccuracy,expectedRows:gold.length,extractedRows:rows.length,rowCountMatch};
    result.status=cellAccuracy>=REALWORLD_POLICY.minExactCellPct&&rowAccuracy>=REALWORLD_POLICY.minExactRowPct&&rowCountMatch?"PASS":"FAIL";
    result.reasonCode=result.status==="PASS"?"THRESHOLD_MET":"TABLE_ACCURACY";
  }else if(spec.category==="form"){
    if(typeof actual.flattenedText!=="string"||!Number.isInteger(actual.remainingFieldCount)){
      result.reasonCode="FORM_EXPORT_NOT_MEASURED";return result;
    }
    const text=normalizeText(actual.flattenedText);
    const matches=spec.expected.visiblePhrases.filter(phrase=>text.includes(normalizeText(phrase))).length;
    result.metrics={visiblePhraseRecallPct:pct(matches,spec.expected.visiblePhrases.length),
      remainingFieldCount:actual.remainingFieldCount};
    result.status=matches===spec.expected.visiblePhrases.length&&actual.remainingFieldCount===0?"PASS":"FAIL";
    result.reasonCode=result.status==="PASS"?"THRESHOLD_MET":"FORM_APPEARANCE_OR_FIELDS";
  }else if(spec.category==="layout"){
    if(!Array.isArray(actual.pages)){result.reasonCode="LAYOUT_NOT_MEASURED";return result;}
    const expected=spec.expected.pages;
    const pages=actual.pages;
    const passed=pages.length===spec.expected.pageCount&&expected.every((p,i)=>{
      const out=pages[i];
      return out&&Math.abs(p.width-out.width)<0.2&&Math.abs(p.height-out.height)<0.2&&
        p.rotation===out.rotation&&p.requiredText.every(v=>normalizeText(out.text).includes(normalizeText(v)));
    });
    result.metrics={pageCountMatch:pages.length===spec.expected.pageCount,verifiedPages:expected.filter((p,i)=>{
      const out=pages[i];return out&&p.rotation===out.rotation&&Math.abs(p.width-out.width)<0.2&&Math.abs(p.height-out.height)<0.2&&p.requiredText.every(v=>normalizeText(out.text).includes(normalizeText(v)));
    }).length,expectedPages:expected.length};
    result.status=passed?"PASS":"FAIL";
    result.reasonCode=passed?"THRESHOLD_MET":"LAYOUT_OR_TEXT";
  }else err();
  return result;
}
export function assessRealWorldCoverage(manifest,results=[]){
  const cases=validatePrivateManifest(manifest);
  if(!Array.isArray(results))err();
  const map=new Map();
  for(const r of results){
    if(!r||!ID.test(r.id)||map.has(r.id)||!["PASS","FAIL","NOT_RUN"].includes(r.status))err();
    map.set(r.id,r);
  }
  if([...map.keys()].some(id=>!cases.some(c=>c.id===id)))err();
  const perCategory=Object.fromEntries(CATEGORIES.map(category=>{
    const wanted=cases.filter(c=>c.category===category);
    const passed=wanted.filter(c=>map.get(c.id)?.status==="PASS").length;
    return [category,{required:REALWORLD_POLICY.requiredPerCategory[category],annotated:wanted.length,
      measured:wanted.filter(c=>["PASS","FAIL"].includes(map.get(c.id)?.status)).length,passed}];
  }));
  const total=cases.length;
  const passed=cases.filter(c=>map.get(c.id)?.status==="PASS").length;
  const failed=cases.filter(c=>map.get(c.id)?.status==="FAIL").length;
  const complete=Object.values(perCategory).every(v=>v.passed>=v.required)&&failed===0&&passed===total;
  return {schema:"kukureku-private-golden-coverage-v1",
    status:complete?"PASS_SCOPED_REAL_WORLD":"BLOCKED_INCOMPLETE_OR_FAILED",
    realWorldCases:total,passed,failed,notRun:total-passed-failed,perCategory,
    limitations:"Private human-reviewed corpus only; no external certification, independent security audit or arbitrary PDF guarantee."};
}
