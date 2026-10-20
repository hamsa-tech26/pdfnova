import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage,rectangleIoU}
  from "../benchmarks/release112/scoreTableRegions.mjs";

const root=resolve("benchmarks/release112");
const manifest=JSON.parse(await readFile(join(root,"sources.json"),"utf8"));
const runs=[];
function summarizeReferenceGeometry(viewport,box){
  const inside=(pointX,pointY)=>pointX>=box.x&&pointX<=box.x+box.width&&
    pointY>=box.y&&pointY<=box.y+box.height;
  const lines=(viewport.lines??[]).filter(line=>line.words?.some(word=>
    inside(word.bounds.x+word.bounds.width/2,
      word.bounds.y+word.bounds.height/2)));
  const wordCounts=lines.map(line=>line.words.filter(word=>
    inside(word.bounds.x+word.bounds.width/2,
      word.bounds.y+word.bounds.height/2)).length);
  // R135 investigation-only: numeric and boolean source signals, never text.
  // Caption evidence must be measured before trying an ambiguous two-column
  // prose-vs-table detector, not imagined from a publisher box.
  const near=(line)=>{
    const center=line.bounds.y+line.bounds.height/2;
    return center>=box.y-55&&center<=box.y+box.height+55;
  };
  const nearbyCaptions=(viewport.lines??[]).filter(line=>near(line)&&
    /\b(?:table|tab\.?)\s*(?:s?\d{1,3})\b/i.test(line.text.trim()));
  const captionClosestGap=nearbyCaptions.length?Math.min(...nearbyCaptions.map(line=>{
    const cy=line.bounds.y+line.bounds.height/2;
    return Number(Math.max(0,box.y-cy,cy-(box.y+box.height)).toFixed(1));
  })):null;
  const exactlyTwoNativeColumns=lines.filter(line=>{
    const insideWords=line.words.filter(word=>inside(word.bounds.x+word.bounds.width/2,
      word.bounds.y+word.bounds.height/2));
    return insideWords.length===2 &&
      insideWords.every(w=>w.extractionProvenance?.source!=="ocr-tesseract")&&
      insideWords[1].bounds.x-insideWords[0].bounds.x>=120;
  }).length;
  const uniqueX=new Set(lines.flatMap(line=>line.words.filter(word=>
    inside(word.bounds.x+word.bounds.width/2,
      word.bounds.y+word.bounds.height/2))
    .map(word=>Math.round(word.bounds.x/10)*10)));
  return {lineCount:lines.length,wordCount:wordCounts.reduce((a,b)=>a+b,0),
    nearbyTableCaptionCount:nearbyCaptions.length,captionClosestGap,
    exactlyTwoNativeColumns,
    medianWordsPerLine:wordCounts.length?
      [...wordCounts].sort((a,b)=>a-b)[Math.floor(wordCounts.length/2)]:0,
    linesAtLeast3Words:wordCounts.filter(n=>n>=3).length,
    distinct10ptWordX:uniqueX.size,
    nativeLineSignatures:lines.slice(0,40).map(line=>({
      y:Number(line.bounds.y.toFixed(1)),
      xPositions:line.words.filter(word=>inside(word.bounds.x+word.bounds.width/2,
        word.bounds.y+word.bounds.height/2)).map(w=>Math.round(w.bounds.x)),
      charLengths:line.words.filter(word=>inside(word.bounds.x+word.bounds.width/2,
        word.bounds.y+word.bounds.height/2)).map(w=>w.text.length),
      hasNumerals:line.words.filter(word=>inside(word.bounds.x+word.bounds.width/2,
        word.bounds.y+word.bounds.height/2)).map(w=>/\d/.test(w.text))
    }))};
}
for(const source of manifest.documents){
  test("R112 original-publisher detection-box audit: "+source.id,async({page})=>{
    test.setTimeout(300000);
    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first()
      .setInputFiles(join(root,"private",source.id+".pdf"));
    const button=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(button).toBeVisible({timeout:270000});
    const pending=page.waitForEvent("download");
    await button.click();
    const file=await (await pending).path();
    if(!file)throw Error("Inspector did not produce output");
    const result=JSON.parse(await readFile(file,"utf8"));
    expect(result.document?.pages?.length).toBe(source.sourcePages);
    expect(Array.isArray(result.tables)).toBe(true);
    // R117: Inspector must expose evidence-only image review for ALL pages.
    // It is NOT a source-table detector or permission to run extra OCR.
    expect(Array.isArray(result.imageContentReview)).toBe(true);
    expect(result.imageContentReview).toHaveLength(source.sourcePages);
    expect(result.imageContentReview.every(item=>
      item.imageReviewRecommended===(
        item.nativeTextStatus==="sufficient"&&item.imagePaintCount>0
      ))).toBe(true);
    const allTables=result.tables;
    const pageResults=[];
    for(const ref of source.referencePages){
      const xml=await readFile(join(root,"private",ref.annotation),"utf8");
      const annot=parseDetectionXml(xml);
      expect(annot.boxes.length).toBe(ref.boxes);
      const viewport=result.document.pages[ref.page-1];
      const expected=annot.boxes.map(box=>annotationToPdfBox(box,annot,viewport));
      // Score actual logical tables only: no paragraph-block proxies.
      const detected=allTables.filter(table=>table.pageNumber===ref.page)
        .map(table=>table.bounds);
      const metrics=scoreDetectionPage(expected,detected,0.5);
      // R122 numeric-only image-paint geometry diagnostic: never call raw
      // image-paint bounds a logical table, OCR hit, or verified table box.
      const nativeImageRects=(viewport.imagePaintRegions??[]).map(x=>x.bounds);
      const publishedImageBestIoU=expected.map(box=>
        Number(Math.max(0,...nativeImageRects.map(rect=>rectangleIoU(rect,box))).toFixed(4)));
      const imageReview=result.imageContentReview.find(x=>x.pageNumber===ref.page);
      expect(imageReview).toBeTruthy();
      pageResults.push({originalPage:ref.page,...metrics,
        imagePaintCount:imageReview.imagePaintCount,
        imageRegionsDetected:nativeImageRects.length,
        publishedImageBestIoU,
        imagePaintRects:nativeImageRects.slice(0,20).map(box=>Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Number(v.toFixed(1))]))),
        imageReviewRecommended:imageReview.imageReviewRecommended,
        overlappingSourceBlocks:expected.map(box=>(viewport.blocks??[])
          .filter(b=>b.type==="paragraph"||b.type==="heading")
          .map(b=>{
            const bounded=rectangleIoU(b.bounds,box);
            const lines=b.lines??[];
            const cy=(b.bounds.y+b.bounds.height/2);
            const within=cy>=box.y-75&&cy<=box.y+box.height+75;
            const captionLines=lines.filter(line=>
              /\b(?:table|tab\.?)\s*(?:s?\d{1,3})\b/i.test(line.text.trim())).length;
            return {type:b.type,within,intersectionOverUnion:Number(bounded.toFixed(4)),
              lineCount:lines.length,captionLines,
              nativeTwoColumnSignatures:lines.length<=40?lines.map((line,index)=>{
                const words=[...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
                const gaps=words.slice(1).map((w,i)=>w.bounds.x-words[i].bounds.x);
                const biggest=gaps.length?Math.max(...gaps):0;
                const pivot=gaps.indexOf(biggest)+1;
                return {index,y:Number(line.bounds.y.toFixed(1)),count:words.length,
                  left:words[0]?Number(words[0].bounds.x.toFixed(1)):null,
                  right:biggest>=120?Number(words[pivot].bounds.x.toFixed(1)):null,
                  gap:Number(biggest.toFixed(1)),ocr:words.some(w=>
                    w.extractionProvenance?.source==="ocr-tesseract"),
                  caption:/\b(?:table|tab\.?)\s*(?:s?\d{1,3})\b/i.test(line.text.trim())};
              }):[],
              bounds:Object.fromEntries(Object.entries(b.bounds).map(([k,v])=>[k,Number(v.toFixed(1))]))};
          }).filter(b=>b.intersectionOverUnion>0.02||
            b.within&&b.captionLines>0).slice(0,12)),
        newTextGridRegionDiagnostics:(result.candidateRegionDiagnostics??[])
          .filter(d=>d.pageNumber===ref.page&&d.blockId.startsWith("native-captioned-text-grid-"))
          .map(d=>({blockId:d.blockId,outcome:d.outcome,acceptedColumnCount:d.acceptedColumnCount,
            score:Number(d.analysis.totalScore.toFixed(2))})),
        newTextGridTableAnalyses:(result.tableAnalyses??[])
          .filter(d=>d.pageNumber===ref.page&&d.blockId.startsWith("native-captioned-text-grid-"))
          .map(d=>({blockId:d.blockId,hasTable:!!d.table,columns:d.columnDetection?.columns?.length??0,
            rows:d.rowDetection?.rows?.length??0})),
        actualReferenceRects:expected.map(box=>Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Number(v.toFixed(1))]))),
        predictedRects:detected.map(box=>Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Number(v.toFixed(1))]))),
        publishedBoxGeometry:expected.map(box=>summarizeReferenceGeometry(viewport,box))});
    }
    if(source.id==="PMC1064098"){
      // R122 physical browser test of the new opt-in OCR path on an actual
      // full publisher PDF. Only numeric status is asserted/logged.
      test.setTimeout(420000);
      await page.getByLabel("Embedded image page").selectOption("6");
      const runReview=page.getByRole("button",{
        name:"Run optional embedded-image OCR review",
      });
      await expect(runReview).toBeVisible();
      await runReview.click();
      await expect(page.getByText(/image regions reviewed/)).toBeVisible({
        timeout:240000,
      });
      await expect(page.getByText(/OCR is unverified text for human review only/))
        .toBeVisible();
      // The source V4 table result must stay byte-for-byte identical after
      // an optional review. Never replace native words or inferred XLSX.
      const secondDownload=page.waitForEvent("download");
      await button.click();
      const secondPath=await (await secondDownload).path();
      if(!secondPath)throw Error("Inspector second export not available");
      const unchanged=JSON.parse(await readFile(secondPath,"utf8"));
      expect(unchanged.tables).toEqual(result.tables);
      console.log(JSON.stringify({type:"R122_EMBEDDED_IMAGE_OPT_IN_BROWSER_REVIEW",
        publisherId:source.id,selectedOriginalPage:6,
        localReviewCompleted:true,sourceTablesUnchanged:true,
        formalV4Credit:0}));
    }
    runs.push({id:source.id,sourceSha256:source.sha256,annotatedPages:pageResults,
      totalTableCandidates:allTables.length});
    // Only aggregate counts and IoUs are persisted; no article text/PDF bytes.
    await mkdir(join(root,"reports"),{recursive:true});
    await writeFile(join(root,"reports",source.id+"-detections.json"),
      JSON.stringify({sourceId:source.id,sourceSha256:source.sha256,
        referenceType:"PUBLISHED_DETECTION_BOXES_ONLY",independentCellReview:false,
        realDocumentCertificationCredit:0,pageResults},null,2)+"\n");
    console.log(JSON.stringify({id:source.id,pages:pageResults.map(p=>({
      page:p.originalPage,reference:p.referenceCount,detected:p.predictionCount,
      matchedIoU50:p.matchedCount,unmatched:p.unmatchedPredictionCount,
      bestIoU:p.referenceBestIoU,imagePaintCount:p.imagePaintCount,
      imageReviewRecommended:p.imageReviewRecommended,
      imageRegionsDetected:p.imageRegionsDetected,publishedImageBestIoU:p.publishedImageBestIoU,
      referenceBoxes:p.actualReferenceRects,
      detectedBoxes:p.predictedRects,imagePaintRects:p.imagePaintRects,
      overlappingSourceBlocks:p.overlappingSourceBlocks,
      newTextGridRegionDiagnostics:p.newTextGridRegionDiagnostics,
      newTextGridTableAnalyses:p.newTextGridTableAnalyses,
      geometry:p.publishedBoxGeometry
    })),formalV4Credit:0}));
  });
}
test.afterAll(async()=>{
  const expected=manifest.documents.length;
  if(runs.length!==expected)return;
  const pages=runs.flatMap(r=>r.annotatedPages);
  const summary={type:"PUBLISHED_TABLE_BOX_DIAGNOSTIC_NOT_CERTIFICATION",
    sourceCount:runs.length,annotatedPages:pages.length,
    publishedBoxCount:pages.reduce((n,p)=>n+p.referenceCount,0),
    matchedBoxCount:pages.reduce((n,p)=>n+p.matchedCount,0),
    missedBoxCount:pages.reduce((n,p)=>n+p.missedCount,0),
    unmatchedPredictionCount:pages.reduce((n,p)=>n+p.unmatchedPredictionCount,0),
    thresholdIoU:0.5,acceptedFormalV4Documents:0};
  await mkdir(join(root,"reports"),{recursive:true});
  await writeFile(join(root,"reports/aggregate.json"),
    JSON.stringify(summary,null,2)+"\n");
  console.log(JSON.stringify(summary));
  // R112 scoped acceptance: demonstrable independent spatial improvement
  // over the observed 0/6 baseline, without more unmatched regions (3).
  // This DOES NOT certify remaining missing image/irregular tables.
  expect(summary.publishedBoxCount).toBe(6);
  expect(summary.matchedBoxCount).toBeGreaterThanOrEqual(1);
  expect(summary.unmatchedPredictionCount).toBeLessThanOrEqual(2);
  // R117 per-document regression: preserve the independently annotated
  // high-quality match that Release 112 obtained on original PMC page 7.
  const scientific=runs.find(run=>run.id==="PMC1064098");
  const region=scientific?.annotatedPages.find(record=>record.originalPage===7);
  expect(region?.matchedCount).toBe(1);
  expect(region?.referenceBestIoU[0]).toBeGreaterThanOrEqual(0.95);
});
