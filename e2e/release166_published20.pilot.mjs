import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage}
  from "../benchmarks/release112/scoreTableRegions.mjs";
import {proposeNativeGridRegions} from "../benchmarks/release166/nativeGridShadow.mjs";
const root=resolve("benchmarks/release166");
const privateRoot=join(root,"private");
const manifest=JSON.parse(await readFile(join(privateRoot,"manifest.json"),"utf8"));
if(manifest.acceptedFormalV4DocumentCredit!==0||
   manifest.documents?.length!==20||
   manifest.rightsAndIndependentCellReferenceStatus!=="NOT_REVIEWED")
  throw Error("Published20 diagnostic cannot grant formal certification");
const totals={sourceCount:0,sourcePageCount:0,independentPublishedBoxCount:0,
  matchedBoxCount:0,missedBoxCount:0,unmatchedPredictionCount:0,
  boxesWithNoNativeWords:0,boxesWithTenPlusNativeWords:0,
  boxesOverlappingPaints:0,boxesWithNeitherNativeWordsNorPaints:0,
  shadowCandidateCount:0,shadowMatchedBoxes:0,
  augmentedMatchedBoxes:0,augmentedUnmatchedPredictions:0,
  sourceHashes:new Set()};
for(const source of manifest.documents){
  test("Published20 held-out original PDF: "+source.id,async({page})=>{
    test.setTimeout(210000);
    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first()
      .setInputFiles(join(privateRoot,source.id+".pdf"));
    const button=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(button).toBeVisible({timeout:200000});
    const download=page.waitForEvent("download");
    await button.click();
    const file=await (await download).path();
    if(!file)throw Error("Missing inspector result");
    const result=JSON.parse(await readFile(file,"utf8"));
    expect(result.document?.pages?.length).toBe(source.pageCount);
    expect(Array.isArray(result.tables)).toBe(true);
    let boxes=0,matched=0,missed=0,unmatched=0;
    let shadowCount=0,shadowMatched=0,augmentedMatched=0,augmentedUnmatched=0;
    let noNative=0,tenPlusNative=0,paintOverlap=0,noNativeOrPaint=0;
    for(const ref of source.referencePages){
      const annotation=parseDetectionXml(await readFile(
        join(privateRoot,ref.annotation),"utf8"));
      const pageModel=result.document.pages[ref.page-1];
      expect(pageModel.pageNumber).toBe(ref.page);
      const expected=annotation.boxes.map(x=>annotationToPdfBox(x,annotation,pageModel));
      const predictions=result.tables.filter(t=>t.pageNumber===ref.page)
        .map(t=>t.bounds);
      const score=scoreDetectionPage(expected,predictions,0.5);
      // Shadow R167 operates only on source word geometry; published labels
      // are used for scoring AFTER proposing candidates.
      const shadow=proposeNativeGridRegions(pageModel);
      const shadowScore=scoreDetectionPage(expected,shadow.map(x=>x.bounds),0.5);
      const combined=scoreDetectionPage(expected,
        [...predictions,...shadow.map(x=>x.bounds)],0.5);
      shadowCount+=shadow.length;
      shadowMatched+=shadowScore.matchedCount;
      augmentedMatched+=combined.matchedCount;
      augmentedUnmatched+=combined.unmatchedPredictionCount;
      boxes+=score.referenceCount;
      matched+=score.matchedCount;
      missed+=score.missedCount;
      unmatched+=score.unmatchedPredictionCount;
      // R166 source-mapping investigation: use the EXTERNAL published box
      // only after V4 has emitted its predictions. Never feed it into the
      // engine or claim that words/paint alone prove a true cell.
      for(const [sourceBoxIndex,box] of expected.entries()){
        const inside=(w)=>{
          const x=w.bounds.x+w.bounds.width/2,y=w.bounds.y+w.bounds.height/2;
          return x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
        };
        const bands=(pageModel.lines??[]).map(line=>(
          line.words??[]).filter(w=>inside(w)&&
          w.extractionProvenance?.source!=="ocr-tesseract"))
          .filter(words=>words.length>0);
        const numeric=/^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|[a-zA-Z]{1,2})?$/u;
        const selected=(pageModel.words??[]).filter(w=>inside(w)&&
          w.extractionProvenance?.source!=="ocr-tesseract");
        const sourceRows={originalPublisherPage:ref.page,
          originalPublishedBoxIndex:sourceBoxIndex,
          baselineIoU:score.referenceBestIoU[sourceBoxIndex],
          nativeWords:selected.length,linesWithAnyNativeWords:bands.length,
          linesWithTwoOrMoreWords:bands.filter(b=>b.length>=2).length,
          linesWithThreeOrMoreWords:bands.filter(b=>b.length>=3).length,
          linesWithTwoOrMoreNumbers:bands.filter(b=>
            b.filter(w=>numeric.test(w.text.trim())).length>=2).length,
          totalNumericWords:selected.filter(w=>numeric.test(w.text.trim())).length,
          linesWithEightOrMoreWords:bands.filter(b=>b.length>=8).length,
          largestLineWordCount:Math.max(0,...bands.map(b=>b.length))};
        console.log(JSON.stringify({type:"R168_PUBLISHED_SOURCE_LAYOUT_DIAG",
          sourceId:source.id,...sourceRows}));
        const native=(pageModel.words??[]).filter(w=>{
          const x=w.bounds.x+w.bounds.width/2,y=w.bounds.y+w.bounds.height/2;
          return w.extractionProvenance?.source!=="ocr-tesseract"&&
            x>=box.x&&x<=box.x+box.width&&
            y>=box.y&&y<=box.y+box.height;
        }).length;
        const painted=(pageModel.imagePaintRegions??[]).some(r=>{
          const z=r.bounds;
          const xx=Math.max(0,Math.min(box.x+box.width,z.x+z.width)-
            Math.max(box.x,z.x));
          const yy=Math.max(0,Math.min(box.y+box.height,z.y+z.height)-
            Math.max(box.y,z.y));
          return xx*yy/(box.width*box.height)>=.1;
        });
        if(native===0)noNative++;
        if(native>=10)tenPlusNative++;
        if(painted)paintOverlap++;
        if(native===0&&!painted)noNativeOrPaint++;
      }
    }
    totals.sourceCount++;
    totals.sourcePageCount+=source.pageCount;
    totals.independentPublishedBoxCount+=boxes;
    totals.matchedBoxCount+=matched;
    totals.missedBoxCount+=missed;
    totals.unmatchedPredictionCount+=unmatched;
    totals.shadowCandidateCount+=shadowCount;
    totals.shadowMatchedBoxes+=shadowMatched;
    totals.augmentedMatchedBoxes+=augmentedMatched;
    totals.augmentedUnmatchedPredictions+=augmentedUnmatched;
    totals.boxesWithNoNativeWords+=noNative;
    totals.boxesWithTenPlusNativeWords+=tenPlusNative;
    totals.boxesOverlappingPaints+=paintOverlap;
    totals.boxesWithNeitherNativeWordsNorPaints+=noNativeOrPaint;
    totals.sourceHashes.add(source.sha256);
    const report={sourceId:source.id,sourceSha256:source.sha256,
      sourcePages:source.pageCount,referenceBoxCount:boxes,matchedBoxCount:matched,
      missedBoxCount:missed,unmatchedPredictionCount:unmatched,
      shadowCandidates:shadowCount,shadowMatchedBoxes:shadowMatched,
      augmentedMatchedBoxes:augmentedMatched,
      augmentedUnmatchedPredictions:augmentedUnmatched,
      publishedBoxesWithNoNativeWords:noNative,
      publishedBoxesWithTenPlusNativeWords:tenPlusNative,
      publishedBoxesOverlappingImagePaints:paintOverlap,
      publishedBoxesWithNeitherNativeWordsNorPaints:noNativeOrPaint,
      matchingIoU:0.50,referenceType:"PUBLISHED_DETECTION_BOXES_ONLY",
      cellGroundTruthVerified:false,rightsIndependentlyReviewed:false,
      acceptedFormalV4Credit:0};
    await mkdir(join(root,"reports"),{recursive:true});
    await writeFile(join(root,"reports",source.id+"-box-scores.json"),
      JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({type:"PUBLISHED20_DOCUMENT",...report}));
  });
}
test.afterAll(async()=>{
  const summary={type:"PUBLISHED20_HELDOUT_SOURCE_BOX_BENCHMARK",
    documents:totals.sourceCount,distinctOriginalPdfHashes:totals.sourceHashes.size,
    documentPages:totals.sourcePageCount,
    publishedBoxes:totals.independentPublishedBoxCount,
    matchedBoxes:totals.matchedBoxCount,missedBoxes:totals.missedBoxCount,
    unmatchedPredictions:totals.unmatchedPredictionCount,thresholdIoU:0.5,
    shadowNativeCandidateCount:totals.shadowCandidateCount,
    shadowNativeMatchedBoxes:totals.shadowMatchedBoxes,
    augmentedMatchedBoxes:totals.augmentedMatchedBoxes,
    augmentedUnmatchedPredictions:totals.augmentedUnmatchedPredictions,
    boxesWithNoNativeWords:totals.boxesWithNoNativeWords,
    boxesWithTenPlusNativeWords:totals.boxesWithTenPlusNativeWords,
    boxesOverlappingPaints:totals.boxesOverlappingPaints,
    boxesWithNeitherNativeWordsNorPaints:
      totals.boxesWithNeitherNativeWordsNorPaints,
    certifiedDocuments:0,certifiedCellStructures:0,formalV4Stable:"BLOCKED",
    note:"Independent published DETECTION boxes only. No independently human-verified cell accuracy or rights approval."};
  await mkdir(join(root,"reports"),{recursive:true});
  await writeFile(join(root,"reports","summary.json"),
    JSON.stringify(summary,null,2)+"\n");
  console.log(JSON.stringify(summary));
  expect(summary.documents).toBe(20);
  expect(summary.distinctOriginalPdfHashes).toBe(20);
  expect(summary.publishedBoxes).toBeGreaterThanOrEqual(20);
});
