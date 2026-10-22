import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {scoreDetectionPage} from "../benchmarks/release112/scoreTableRegions.mjs";

const root=resolve("benchmarks/icdar/private");
const manifest=JSON.parse(await readFile(join(root,"pilot.json"),"utf8"));
if(manifest.approvedV4StableCredit!==0||manifest.unseenHeldout!==false||
  manifest.rightsIndependentlyVerified!==false||manifest.samples.length!==3)
  throw Error("Invalid source-rights/qualification preflight");

for(const sample of manifest.samples){
  test("Real paired PDF/region benchmark #"+sample.sampleIndex,async({page})=>{
    test.setTimeout(185000);
    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first()
      .setInputFiles(join(root,"sample-"+sample.sampleIndex+".pdf"));
    const complete=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(complete).toBeVisible({timeout:175000});
    const download=page.waitForEvent("download");
    await complete.click();
    const file=await (await download).path();
    if(!file)throw Error("Inspector result unavailable");
    const result=JSON.parse(await readFile(file,"utf8"));
    expect(result.document?.pages?.length).toBe(sample.pageCount);
    expect(Array.isArray(result.tables)).toBe(true);
    let matched=0,referenceCount=0,predicted=0,unmatched=0;
    const indexed=new Set(sample.regions.map(x=>x.page));
    const perReferencePage=[];
    for(const pageNo of indexed){
      const pageModel=result.document.pages[pageNo-1];
      const refs=sample.regions.filter(x=>x.page===pageNo);
      // Source geometry is tested in Python. Require the inspected page to
      // have the same size; do not silently rescale to boost the match.
      expect(Math.abs(pageModel.width-refs[0].pageWidth)).toBeLessThan(3);
      expect(Math.abs(pageModel.height-refs[0].pageHeight)).toBeLessThan(3);
      const actual=result.tables.filter(t=>t.pageNumber===pageNo).map(t=>t.bounds);
      const s=scoreDetectionPage(refs.map(x=>x.bounds),actual,.5);
      matched+=s.matchedCount;
      referenceCount+=s.referenceCount;
      predicted+=s.predictionCount;
      unmatched+=s.unmatchedPredictionCount;
      // Keep rejection metadata scoped to its own source page. A document-wide
      // count alone cannot tell which independently annotated table was missed.
      // Missing page numbers remain unassigned, never silently attributed.
      const rejectedOnPage=(result.candidateRegionDiagnostics??[])
        .filter(d=>d.pageNumber===pageNo)
        .reduce((counts,item)=>{
          const key=item.outcome||"unspecified";
          counts[key]=(counts[key]??0)+1;
          return counts;
        },{});
      perReferencePage.push({pageNumber:pageNo,referenceRegions:s.referenceCount,matchedRegions:s.matchedCount,missedRegions:s.referenceCount-s.matchedCount,detectorPredictions:s.predictionCount,unmatchedPredictions:s.unmatchedPredictionCount,referenceBestIoU:s.referenceBestIoU,rejectedCandidateOutcomes:rejectedOnPage});
    }
    // The fixed, SHA-pinned three-document development baseline is 0/1,
    // 0/2 and 3/3 annotated regions. Previously this test logged accuracy
    // but returned PASS even if the one known-good document regressed to 0/3.
    // Gate only the demonstrated positive baseline, not a false claim of
    // overall recall or independently certified cell accuracy.
    if(sample.sampleIndex===3){
      expect(referenceCount).toBe(3);
      expect(matched).toBe(3);
      expect(unmatched).toBe(0);
    }
    // Unannotated pages lack ground truth; these predictions are NOT known false positives.
    const predictionsOnUnannotatedPages=result.tables.filter(t=>!indexed.has(t.pageNumber)).length;
    console.log(JSON.stringify({
      type:"ICDAR_PAIRED_PDF_V4_SOURCE_DIAGNOSTIC",
      sampleIndex:sample.sampleIndex,
      pdfSha256:sample.pdfSha256,
      referenceXmlSha256:sample.referenceSha256,
      sourcePdfPages:sample.pageCount,
      referenceRegions:referenceCount,
      matchedRegionsAtIoU0_5:matched,
      missedRegions:referenceCount-matched,
      candidateRegions:predicted,
      unmatchedPredictions:unmatched,
      referencePageResults:perReferencePage,
      unannotatedPagesNotScored:sample.pageCount-indexed.size,
      predictionsOnUnannotatedPages,
      unannotatedPagePredictionsAreNotCertifiedFalsePositives:true,
      independentlyRightsReviewed:false,
      acceptedV4StableCredit:0,
      genuineUnseenHeldout:false,
      originalPageSourceStats:(result.document.pages??[]).map(p=>({
        nativeWordCount:(p.words??[]).filter(w=>w.extractionProvenance?.source!=="ocr-tesseract").length,
        ocrWordCount:(p.words??[]).filter(w=>w.extractionProvenance?.source==="ocr-tesseract").length,
        lineCount:p.lines?.length??0,
        paragraphCount:(p.blocks??[]).filter(b=>b.type==="paragraph").length,
        nativeImagePaintCount:p.imagePaintCount??0,
        blockCount:p.blocks?.length??0,
        textExtractionStatus:p.textExtraction?.status??"unknown"
      })),
      // Aggregate native numeric row evidence only. No source text, word
      // geometry, individual values, or document bytes in CI output.
      nativeRowEvidenceByReferencePage:[...indexed].map(pageNo=>{
        const lines=result.document.pages[pageNo-1]?.lines??[];
        const eligible=lines.filter(line=>{
          const words=line.words??[];
          if(words.length<4||words.length>16)return false;
          if(words.some(word=>word.extractionProvenance?.source==="ocr-tesseract"))return false;
          if(words.some(word=>(word.text??"").trim().length>38))return false;
          const sorted=[...words].sort((a,b)=>a.bounds.x-b.bounds.x);
          if(sorted[sorted.length-1].bounds.x-sorted[0].bounds.x<110)return false;
          return words.filter(word=>/\d/u.test(word.text??"")).length>=2;
        });
        return {pageNumber:pageNo,sourceLineCount:lines.length,
          numericGridEligibleLineCount:eligible.length,
          nativeDenseGridMinimumRows:7,
          candidateMinimumRowsSatisfied:eligible.length>=7,
          candidateRequiresConsecutiveAlignedRows:true};
      }),
      detectorRejectionReasons:(result.candidateRegionDiagnostics??[]).reduce((counts,item)=>{
        const key=item.outcome||"unspecified";counts[key]=(counts[key]??0)+1;return counts;
      },{})
    }));
  });
}