import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage}
  from "../benchmarks/release112/scoreTableRegions.mjs";
const root=resolve("benchmarks/release166");
const privateRoot=join(root,"private");
const manifest=JSON.parse(await readFile(join(privateRoot,"manifest.json"),"utf8"));
if(manifest.acceptedFormalV4DocumentCredit!==0||
   manifest.documents?.length!==20||
   manifest.rightsAndIndependentCellReferenceStatus!=="NOT_REVIEWED")
  throw Error("Published20 diagnostic cannot grant formal certification");
const totals={sourceCount:0,sourcePageCount:0,independentPublishedBoxCount:0,
  matchedBoxCount:0,missedBoxCount:0,unmatchedPredictionCount:0,
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
    for(const ref of source.referencePages){
      const annotation=parseDetectionXml(await readFile(
        join(privateRoot,ref.annotation),"utf8"));
      const pageModel=result.document.pages[ref.page-1];
      expect(pageModel.pageNumber).toBe(ref.page);
      const expected=annotation.boxes.map(x=>annotationToPdfBox(x,annotation,pageModel));
      const predictions=result.tables.filter(t=>t.pageNumber===ref.page)
        .map(t=>t.bounds);
      const score=scoreDetectionPage(expected,predictions,0.5);
      boxes+=score.referenceCount;
      matched+=score.matchedCount;
      missed+=score.missedCount;
      unmatched+=score.unmatchedPredictionCount;
    }
    totals.sourceCount++;
    totals.sourcePageCount+=source.pageCount;
    totals.independentPublishedBoxCount+=boxes;
    totals.matchedBoxCount+=matched;
    totals.missedBoxCount+=missed;
    totals.unmatchedPredictionCount+=unmatched;
    totals.sourceHashes.add(source.sha256);
    const report={sourceId:source.id,sourceSha256:source.sha256,
      sourcePages:source.pageCount,referenceBoxCount:boxes,matchedBoxCount:matched,
      missedBoxCount:missed,unmatchedPredictionCount:unmatched,
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
