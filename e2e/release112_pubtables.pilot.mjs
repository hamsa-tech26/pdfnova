import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage}
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
  const uniqueX=new Set(lines.flatMap(line=>line.words.filter(word=>
    inside(word.bounds.x+word.bounds.width/2,
      word.bounds.y+word.bounds.height/2))
    .map(word=>Math.round(word.bounds.x/10)*10)));
  return {lineCount:lines.length,wordCount:wordCounts.reduce((a,b)=>a+b,0),
    medianWordsPerLine:wordCounts.length?
      [...wordCounts].sort((a,b)=>a-b)[Math.floor(wordCounts.length/2)]:0,
    linesAtLeast3Words:wordCounts.filter(n=>n>=3).length,
    distinct10ptWordX:uniqueX.size};
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
      pageResults.push({originalPage:ref.page,...metrics,
        publishedBoxGeometry:expected.map(box=>summarizeReferenceGeometry(viewport,box))});
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
      bestIoU:p.referenceBestIoU,geometry:p.publishedBoxGeometry
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
});
