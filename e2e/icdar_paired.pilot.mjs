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
    }
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
      detectorRejectionReasons:(result.candidateRegionDiagnostics??[]).reduce((counts,item)=>{
        const key=item.outcome||"unspecified";counts[key]=(counts[key]??0)+1;return counts;
      },{})
    }));
  });
}