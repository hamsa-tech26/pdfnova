import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage,rectangleIoU}
  from "../benchmarks/release112/scoreTableRegions.mjs";
import {assessUncaptionedPairedNativeStream}
  from "../benchmarks/release112/assessUncaptionedNativePairs.mjs";

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
      // R165: verify the original-publisher image-only missed region cannot
      // be silently classified as a native source-table from OCR guesswork.
      // The independently published box is used for post-hoc evaluation,
      // never as a runtime detector input or OCR crop coordinate.
      if(source.id==="PMC1064098"&&ref.page===6){
        const pub=expected[0];
        const sourceNativeWords=viewport.words.filter(word=>{
          const x=word.bounds.x+word.bounds.width/2;
          const y=word.bounds.y+word.bounds.height/2;
          return x>=pub.x&&x<=pub.x+pub.width&&
            y>=pub.y&&y<=pub.y+pub.height&&
            word.extractionProvenance?.source==="native-pdf";
        });
        expect(sourceNativeWords).toHaveLength(0);
        expect(imageReview.imagePaintCount).toBeGreaterThan(0);
        console.log(JSON.stringify({type:"R165_REAL_IMAGE_ONLY_TABLE_SOURCE_EVIDENCE",
          sourceId:source.id,originalPage:6,
          nativeWordsInsideOriginalPublishedBox:sourceNativeWords.length,
          imagePaintsPresent:true,sourceBoxNeverDetectorInput:true,
          sourceOcrAutomaticallyApproved:false,formalV4Credit:0}));
      }
      if(source.id==="PMC1064098"&&ref.page===8){
        // R147 original-source evidence: a native scientific header grid is
        // followed by adjacent painted images. This is an OMITTED-CONTENT
        // possibility only, not proof that painted images contain table rows.
        const native=result.tableAnalyses?.find(a=>a.pageNumber===ref.page&&
          a.blockId.startsWith("native-caption-header-grid-")&&a.table);
        expect(native).toBeTruthy();
        // R150 acceptance uses the independent publisher box only AFTER
        // source-first processing; box data never enters native detection.
        // A genuine source footnote can extend physical table geometry
        // without becoming an Excel data row or synthetic recovered cell.
        expect(metrics.referenceBestIoU[0]).toBeGreaterThanOrEqual(0.5);
        expect(native.table.rows.length).toBe(12);
        const tableRect=native.table.bounds;
        const sourceFootnote=(viewport.lines??[]).find(line=>
          Math.abs(line.bounds.y-tableRect.y)<=1.5);
        expect(sourceFootnote).toBeTruthy();
        expect(sourceFootnote.words.every(word=>
          word.extractionProvenance?.source==="native-pdf")).toBe(true);
        const exportedWordIds=new Set(native.table.rows.flatMap(row=>
          row.cells.flatMap(cell=>cell.words.map(word=>word.id))));
        expect(sourceFootnote.words.every(word=>
          !exportedWordIds.has(word.id))).toBe(true);
        const adjacent=nativeImageRects.filter(rect=>{
          if(rect.width<32||rect.height<32)return false;
          const horizontal=Math.max(0,Math.min(tableRect.x+tableRect.width,
            rect.x+rect.width)-Math.max(tableRect.x,rect.x));
          const gap=tableRect.y-(rect.y+rect.height);
          return horizontal/Math.min(tableRect.width,rect.width)>=0.45&&
            gap>=0&&gap<=75;
        });
        expect(adjacent.length).toBeGreaterThanOrEqual(1);
        // Source-first diagnostic. Does an immediately trailing native text
        // line have an explicit footnote/abbreviation marker? The next
        // paragraph may be normal narrative and must NOT be swallowed just
        // to increase a published benchmark IoU. Never log source text.
        const nearTail=(viewport.lines??[]).filter(l=>
          l.bounds.y<tableRect.y&&l.bounds.y>=tableRect.y-42&&
          l.bounds.x>=tableRect.x-12&&
          l.bounds.x<tableRect.x+tableRect.width)
          .sort((a,b)=>b.bounds.y-a.bounds.y);
        console.log(JSON.stringify({type:"R150_NATIVE_SOURCE_TRAILING_BOUNDARY_DIAGNOSTIC",
          sourceLinesPresent:nearTail.length>0,
          followingLines:nearTail.map(line=>({
            gapPoints:Number((tableRect.y-line.bounds.y).toFixed(1)),
            words:line.words.length,
            characterCount:line.text.trim().length,
            nativeOnly:line.words.every(w=>
              w.extractionProvenance?.source!=="ocr-tesseract"),
            footnoteCue:/^(?:\*|†|‡|#|note(?:s)?\b|abbrev(?:iation)?s?\b|source\s*:|p\s*[<>=])/i.test(line.text.trim()),
            startsAsNarrative:/^(?:in\s+|the\s+|these\s+|figure\s+|as\s+|we\s+|our\s+|however\b)/i.test(line.text.trim()),
          })),
          publishedBoxUsedForSelection:false,exportCellsUnchanged:true}));
        console.log(JSON.stringify({type:"R147_NATIVE_RASTER_ADJACENCY_EVIDENCE",
          sourceId:source.id,originalPage:8,
          reviewNativePhysicalRowCount:native.table.rows.length,
          adjacentPaintCount:adjacent.length,contentNotInspected:true,
          imageIsVerifiedTable:false,automaticImageCellRecovery:false,
          acceptedFormalV4Credit:0}));
      }
      if(source.id==="PMC1064082"&&ref.page===1){
        // Published reference rectangles are EVALUATION ONLY. The five
        // paired word rows share both x anchors and source-line continuity
        // with adjacent scientific article prose. Never auto-promote them.
        const check=assessUncaptionedPairedNativeStream(viewport.blocks,expected[0]);
        console.log("R144_UNCAPTIONED_NATIVE_SOURCE_CONTINUITY "+JSON.stringify({
          sourceId:source.id,originalPage:ref.page,referenceOnlyEvaluation:true,
          ...check,acceptedFormalV4Credit:0,
        }));
        expect(check.pairedInside).toBe(5);
        // Actual original PDF proves continuity from the top; a bottom
        // edge continuation is not independently established and must NOT
        // be asserted from the publisher reference box alone.
        expect(check.topContinues).toBe(true);
        expect(check.status).toBe("CONTIGUOUS_NATIVE_ARTICLE_COLUMNS_POSSIBLE");
        expect(check.sourcePromotable).toBe(false);
      }
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
        candidateTableAnalyses:(result.tableAnalyses??[])
          .filter(a=>a.pageNumber===ref.page&&a.table)
          .map(a=>({id:a.blockId,rows:a.table?.rows.length??0,
            cols:a.columnDetection?.columns?.length??0,
            bounds:Object.fromEntries(Object.entries(a.table.bounds).map(
              ([k,v])=>[k,Number(v.toFixed(1))]))})),
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
      // R135: verify that source-rendered image regions can be visually
      // compared on the real publisher document, without network uploads,
      // altered native tables, or logged document/image data.
      const localSourceCrop=page.getByRole("img",{
        name:/Original source image crop for PDF page 6/,
      });
      await expect(localSourceCrop.first()).toBeVisible();
      const cropSrc=await localSourceCrop.first().getAttribute("src");
      expect(cropSrc?.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(cropSrc?.length).toBeLessThanOrEqual(1_500_000);
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
      // R136: re-open the same original PDF in the consumer tool; explicit
      // source-paint selection must run OCR on exactly ONE bounded region,
      // without converting or accepting a guessed image table.
      await page.goto("/pdf-to-excel");
      await page.locator('input[type="file"]').first()
        .setInputFiles(join(root,"private",source.id+".pdf"));
      await page.getByRole("button",{name:"Inspect embedded images for optional OCR"})
        .click();
      await page.getByLabel("Page to review").selectOption("6");
      const regionChoice=page.getByLabel("Image region to review");
      await expect(regionChoice).toBeVisible();
      const paintOptions=regionChoice.locator("option");
      expect(await paintOptions.count()).toBeGreaterThanOrEqual(2);
      const firstPaint=await paintOptions.nth(1).getAttribute("value");
      expect(firstPaint).not.toBeNull();
      await regionChoice.selectOption(firstPaint);
      await page.getByRole("button",{name:"Run image OCR on selected page"}).click();
      await expect(page.getByText(/Image 1, page 6/)).toBeVisible({
        timeout:240000,
      });
      expect(await page.locator("#public-image-region option").count())
        .toBeLessThanOrEqual(1);
      await expect(page.getByText(/You explicitly selected an image paint region/))
        .toBeVisible();
      console.log(JSON.stringify({type:"R136_EXPLICIT_IMAGE_REGION_BROWSER_REVIEW",
        originalPublisherPage:6,selectedPaintIndex:Number(firstPaint),
        reviewedRegionCount:1,sourceContentNotLogged:true,
        autoImageCellAcceptance:false,certifiedCells:0}));
      // R150 real-source consumer acceptance: use published page 8's
      // already detected native scientific table to preselect matching
      // original PDF image paints. This is UI navigation ONLY; no OCR call,
      // source-cell invention, automatic export or changed table bounds.
      const originalScientificChoice=page.getByRole("radio",{
        name:/Table \d+ — Page 8 — 12 rows/,
      });
      await expect(originalScientificChoice).toBeVisible();
      await originalScientificChoice.check();
      // R154: review-only scientific tables must never be downloaded
      // without a per-selection acknowledgement, regardless of export format.
      const xlsx=page.getByRole("button",{name:"Export selected table (.xlsx)"});
      const csv=page.getByRole("button",{name:"Export selected table (.csv)"});
      await expect(xlsx).toBeDisabled();
      await expect(csv).toBeDisabled();
      const sourceReview=page.getByRole("checkbox",{
        name:"Acknowledge scientific table source review",
      });
      await expect(sourceReview).not.toBeChecked();
      await sourceReview.check();
      await expect(xlsx).toBeEnabled();
      await expect(csv).toBeEnabled();
      await sourceReview.uncheck();
      await expect(xlsx).toBeDisabled();
      await expect(csv).toBeDisabled();
      console.log(JSON.stringify({type:"R154_SCIENTIFIC_DOWNLOAD_CONSENT",
        sourceId:source.id,originalPage:8,
        requiresSelectionSpecificConsent:true,controlsBothFormats:true,
        automaticXlsxAttempt:false,automaticCsvAttempt:false}));
      const related=page.getByRole("region",{
        name:"Related native scientific table source images",
      });
      await expect(related).toBeVisible();
      const sourceButtons=related.getByRole("button",{
        name:/Select original image .* PDF page 8 for optional review/,
      });
      expect(await sourceButtons.count()).toBeGreaterThanOrEqual(2);
      await sourceButtons.first().click();
      await expect(page.getByLabel("Page to review")).toHaveValue("8");
      await expect(page.getByLabel("Image region to review")).toHaveValue("0");
      await expect(page.getByText(/No OCR has run/)).toBeVisible();
      console.log(JSON.stringify({type:"R150_REVIEW_ONLY_SOURCE_TARGET_BROWSER",
        sourceId:source.id,pageNumber:8,
        candidatePaintControls:await sourceButtons.count(),
        originalNativeTableUnmodified:true,ocrAutomaticallyRun:false,
        acceptedCells:0,formalV4Credit:0}));
    }
    // R159: source-backed consumer navigation to the real, unrecognized
    // original publisher page 4 painted image. Original page 1 has native
    // article prose but no table; do not offer phantom image OCR there.
    if(source.id==="PMC1064082"){
      await page.goto("/pdf-to-excel");
      await page.locator('input[type="file"]').first()
        .setInputFiles(join(root,"private",source.id+".pdf"));
      await page.getByRole("button",{name:"Inspect embedded images for optional OCR"})
        .click();
      const sourceAudit=page.getByRole("region",{
        name:"Source page completeness review",
      });
      await expect(sourceAudit).toBeVisible();
      await expect(sourceAudit.getByText(/PDF page 1.*0 detected/)).toBeVisible();
      const p4=sourceAudit.getByRole("button",{
        name:/Select image .* on PDF page 4 for manual OCR review/,
      });
      expect(await p4.count()).toBeGreaterThan(0);
      await p4.first().click();
      await expect(page.getByLabel("Page to review")).toHaveValue("4");
      await expect(page.getByLabel("Image region to review")).not.toHaveValue("");
      await expect(page.getByText(/No OCR has run/)).toBeVisible();
      console.log(JSON.stringify({type:"R159_PUBLISHER_UNRECOGNIZED_IMAGE_REVIEW",
        originalPage:4,sourceId:source.id,unpromotedProsePage:1,
        sourceImageSelectionOnly:true,autoOcr:false,
        autoAddedCells:0,acceptedFormalV4Credit:0}));
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
      candidateTableAnalyses:p.candidateTableAnalyses,
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
  // R130–134 scoped acceptance: improvement over the R112 1/6 source-box
  // baseline without increasing its two unmatched predictions.
  // These are spatial source-box checks, NOT cell/row certification.
  expect(summary.publishedBoxCount).toBe(6);
  // R150 independent original-publisher target: the upper original
  // scientific table now includes explicit source-footnote geometry only.
  // Previous accepted tables remain intact, and false positives cannot grow.
  expect(summary.matchedBoxCount).toBeGreaterThanOrEqual(3);
  expect(summary.unmatchedPredictionCount).toBeLessThanOrEqual(2);
  // R117 per-document regression: preserve the independently annotated
  // high-quality match that Release 112 obtained on original PMC page 7.
  const scientific=runs.find(run=>run.id==="PMC1064098");
  const region=scientific?.annotatedPages.find(record=>record.originalPage===7);
  expect(region?.matchedCount).toBe(1);
  expect(region?.referenceBestIoU[0]).toBeGreaterThanOrEqual(0.95);
  const page8=scientific?.annotatedPages.find(record=>record.originalPage===8);
  const reviewedText=page8?.newTextGridTableAnalyses?.filter(entry=>entry.hasTable)??[];
  expect(reviewedText.length).toBeGreaterThanOrEqual(1);
  expect(reviewedText.every(entry=>entry.columns===2&&entry.rows>=8))
    .toBe(true);
});
