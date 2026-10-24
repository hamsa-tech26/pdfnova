import {rectangleIoU, scoreDetectionPage} from "../benchmarks/release112/scoreTableRegions.mjs";

// Offline evaluation only. Never import this module into the detector. Reference
// coordinates must not influence production candidate formation or scoring.
const valid=b=>b&&["x","y","width","height"].every(k=>Number.isFinite(b[k]))&&b.width>0&&b.height>0;
const rounded=n=>Number.isFinite(n)?Math.round(n*10000)/10000:null;
const bounds=b=>valid(b)?Object.fromEntries(["x","y","width","height"].map(k=>[k,rounded(b[k])])):null;
function areaOverlap(a,b){
  if(!valid(a)||!valid(b))return 0;
  return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
    Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
}
const outcomes=new Set(["below-threshold","pending","rejected-insufficient-columns","rejected-no-rows","rejected-table-build","confirmed"]);
const count=n=>Number.isInteger(n)&&n>=0?n:null;

/** Allowlisted numeric summaries only: no text, IDs, filenames or raw objects. */
export function regionEvidence(result, sample){
  const pages=result.document?.pages;
  if(!Array.isArray(pages)||!Array.isArray(sample.regions)||sample.regions.length>30||
    sample.regions.some(r=>!Number.isInteger(r.page)||r.page<1||r.page>pages.length||!valid(r.bounds)))
    throw Error("Invalid region evidence input");
  return [...new Set(sample.regions.map(r=>r.page))].map(pageNumber=>{
    const page=pages[pageNumber-1];
    const references=sample.regions.filter(r=>r.page===pageNumber);
    const tables=(result.tables??[]).filter(t=>t.pageNumber===pageNumber);
    if(tables.length>100)throw Error("Unbounded region evidence input");
    const words=page.words??[];
    const candidates=(result.candidateRegionDiagnostics??[]).filter(d=>d.pageNumber===pageNumber);
    if(words.length>100000||candidates.length>1000)throw Error("Unbounded region evidence input");
    return {
      pageNumber,
      references:references.map((ref,referenceIndex)=>{
        const inside=words.filter(w=>areaOverlap(w.bounds,ref.bounds)>0);
        const native=inside.filter(w=>w.extractionProvenance?.source==="native-pdf");
        return {referenceIndex,bounds:bounds(ref.bounds),overlappingWords:inside.length,
          nativeWords:native.length,ocrWords:inside.filter(w=>w.extractionProvenance?.source==="ocr-tesseract").length,
          unknownProvenanceWords:inside.filter(w=>!["native-pdf","ocr-tesseract"].includes(w.extractionProvenance?.source)).length,
          nativeNumericItems:native.filter(w=>/\d/u.test(w.text??"")).length,
          overlappingLines:(page.lines??[]).filter(l=>areaOverlap(l.bounds,ref.bounds)>0).length,
          imageOverlaps:(page.imagePaintRegions??[]).filter(i=>areaOverlap(i.bounds,ref.bounds)>0).slice(0,64)
            .map(i=>({bounds:bounds(i.bounds),referenceAreaFraction:rounded(areaOverlap(i.bounds,ref.bounds)/(ref.bounds.width*ref.bounds.height))})),
          imagePaintCount:count(page.imagePaintCount),
          imageGeometryAvailable:Array.isArray(page.imagePaintRegions),
          bestPredictionIoU:rounded(Math.max(0,...tables.map(t=>rectangleIoU(ref.bounds,t.bounds))))};
      }),
      predictions:tables.map((t,predictionIndex)=>({predictionIndex,bounds:bounds(t.bounds),
        rows:count(t.rows?.length),columns:count(t.columnCount),
        referenceIoUs:references.map(r=>rounded(rectangleIoU(r.bounds,t.bounds))),
        // Removal test handles duplicate competing predictions without claiming
        // that every individually overlapping prediction was one-to-one matched.
        removalReducesMatchCount:scoreDetectionPage(references.map(r=>r.bounds),tables.filter(other=>other!==t).map(other=>other.bounds)).matchedCount<
          scoreDetectionPage(references.map(r=>r.bounds),tables.map(other=>other.bounds)).matchedCount})),
      candidates:candidates.slice(0,100).map(d=>({
        outcome:outcomes.has(d.outcome)?d.outcome:"unknown",lineCount:count(d.lineCount),
        acceptedColumnCount:count(d.acceptedColumnCount),
        score:rounded(d.analysis?.totalScore),
        components:Object.fromEntries(["alignment","spacing","density","header","numericColumn"]
          .map(k=>[k,rounded(d.analysis?.breakdown?.[k]?.score)]))})),
      candidatesTruncated:candidates.length>100,
      sourceImageIdentityVerified:false,rightsIndependentlyVerified:false,
      formalV4StableDocumentCredit:0,
    };
  });
}
