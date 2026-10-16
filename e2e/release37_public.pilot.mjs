import JSZip from "jszip";
import {test,expect} from "@playwright/test";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const root=path.resolve("benchmarks/release37");
const config=JSON.parse(await readFile(path.join(root,"pilot-sources.json"),"utf8"));

for(const entry of config.sources){
  test("Real publisher V4 diagnostic (not accepted evidence): "+entry.id,async({page})=>{
    test.setTimeout(300_000);
    const privateDir=path.join(root,"private");
    const metadata=JSON.parse(await readFile(path.join(privateDir,entry.id+"-metadata.json"),"utf8"));
    expect(metadata.id).toBe(entry.id);
    expect(metadata.realDocumentCountCredit).toBe(0);
    expect(metadata.isRelease37AcceptanceEvidence).toBe(false);
    expect(metadata.referenceStatus).toBe("NOT_ANNOTATED");
    expect(metadata.rightsStatus).toMatch(/^REVIEW_REQUIRED/);

    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(privateDir,entry.id+"-pilot.pdf"));
    const button=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(button).toBeVisible({timeout:270_000});
    const downloadPromise=page.waitForEvent("download");
    await button.click();
    const download=await downloadPromise;
    const filename=await download.path();
    if(!filename)throw new Error("No downloadable V4 Inspector result");
    // Raw Inspector JSON is read transiently, never written to CI artifacts.
    const inspector=JSON.parse(await readFile(filename,"utf8"));
    expect(inspector.document?.pages?.length).toBe(metadata.selectedPageNumbers.length);
    expect(Array.isArray(inspector.tables)).toBe(true);
    expect(inspector.ocrDecision).toBeTruthy();
    expect(inspector.processingTimes).toBeTruthy();
    if(entry.id==="usgs-ofr20241025"){
      // Publisher pages 14, 19, 20 each contain a labelled table.
      // This is a table-presence smoke check, NOT an independently
      // scored per-cell, per-row or V4 Stable accuracy qualification.
      expect(inspector.tables.length).toBe(3);
    }
    // Public debug payload is numeric/enum only, never PDF text or coordinates.
    const scores=Array.isArray(inspector.candidateRegionDiagnostics)
      ? inspector.candidateRegionDiagnostics.map(candidate=>({
        pageIndex:candidate.pageNumber,
        originalPage:metadata.selectedPageNumbers[candidate.pageNumber-1]??null,
        kind:candidate.blockType,
        lines:candidate.lineCount,
        outcome:candidate.outcome,
        total:Number((candidate.analysis?.totalScore??0).toFixed(2)),
        alignment:Number((candidate.analysis?.breakdown?.alignment?.score??0).toFixed(2)),
        spacing:Number((candidate.analysis?.breakdown?.spacing?.score??0).toFixed(2)),
        density:Number((candidate.analysis?.breakdown?.density?.score??0).toFixed(2)),
        header:Number((candidate.analysis?.breakdown?.header?.score??0).toFixed(2)),
        numericColumn:Number((candidate.analysis?.breakdown?.numericColumn?.score??0).toFixed(2))
      })) : [];
    const stats=inspector.statistics??{};
    const evidence={
      sourceId:metadata.id,
      sourceSha256:metadata.sourceSha256,
      subsetSha256:metadata.subsetSha256,
      sourceUrl:metadata.sourceUrl,
      sourcePages:metadata.sourcePages,
      selectedPageNumbers:metadata.selectedPageNumbers,
      pageCount:inspector.statistics?.pageCount??inspector.document.pages.length,
      tableCount:inspector.tables.length,
      analysisOutcome:inspector.analysisOutcome,
      candidateRegionCount:scores.length,
      regionScores:scores,
      tableStatistics:Object.fromEntries([
        "wordCount","lineCount","blockCount","candidateTableRegionCount",
        "analyzedTableRegionCount","confirmedTableRegionCount",
        "rejectedForInsufficientColumns","rejectedForNoRows",
        "rejectedForTableBuildFailure"
      ].map(key=>[key,Number.isFinite(stats[key])?stats[key]:null])),
      // Only numeric/enum metadata. Do not export snippets, word objects,
      // PDF URLs embedded in page text, raw OCR decisions, or raw Inspector data.
      nativeExtraction:(inspector.nativePageTextExtraction??[]).map(x=>({
        pageNumber:x.pageNumber,
        status:x.textExtraction?.status,
        wordCount:x.textExtraction?.wordCount,
        characterCount:x.textExtraction?.characterCount,
      })),
      ocrDecisionPresent:Boolean(inspector.ocrDecision),
      controlledOcrAttempted:inspector.controlledOcrResult?.attempted===true,
      actualOcrPages:inspector.controlledOcrResult?.processedPageNumbers??[],
      timingMs:inspector.processingTimes?.totalMs??null,
      referenceStatus:"NOT_ANNOTATED",
      rightsStatus:"REVIEW_REQUIRED",
      realDocumentCountCredit:0,
      acceptanceState:"NOT_VERIFIED"
    };
    await mkdir(path.join(root,"reports"),{recursive:true});
    await writeFile(path.join(root,"reports",entry.id+"-diagnostic.json"),JSON.stringify(evidence,null,2)+"\n");
  });
}


// Non-qualifying publisher regression. Source original pages 14/19/20
// fetched ephemerally; this is NOT independent reference certification.
test("USGS OFR 2024-1025: actual XLSX preserves all 99 source table cells",async({page})=>{
  test.setTimeout(300_000);
  const input=path.join(root,"private/usgs-ofr20241025-pilot.pdf");
  const sourceMetadata=JSON.parse(await readFile(
    path.join(root,"private/usgs-ofr20241025-metadata.json"),"utf8"));
  expect(sourceMetadata.selectedPageNumbers).toEqual([14,19,20]);
  expect(sourceMetadata.referenceStatus).toBe("NOT_ANNOTATED");
  expect(sourceMetadata.realDocumentCountCredit).toBe(0);
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').first().setInputFiles(input);
  const downloadPromise=page.waitForEvent("download",{timeout:160000});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const file=await download.path();
  if(!file)throw Error("No real USGS XLSX file");
  const zip=await JSZip.loadAsync(await readFile(file));

  const expected=[
    [
      ["Site","rkm","12-04-20","10-19-21","03-01-22","11-10-22"],
      ["Sacramento Weir","103","4","4","6","6"],
      ["Tule Canal","101","na","2","2","2"],
      ["Sacramento Trawl","90","2","2","2","2"],
      ["Freeport","76","na","na","na","2"],
      ["Rio Vista","21","2","2","2","2"]
    ],
    [
      ["Migration direction","Water year of release","Sacramento Weir (n)","Tule Canal (n)","Sacramento Trawl (n)","Freeport (n)","Rio Vista (n)"],
      ["Downstream","2021","19 (100)","0 (0)","19 (100)","0 (0)","15 (79)"],
      ["","2022","16 (100)","0 (0)","16 (100)","0 (0)","16 (100)"],
      ["","2023","20 (100)","0 (0)","19 (95)","16 (80)","20 (100)"]
    ],
    [
      ["Reach","WY 2021 (minutes)","WY 2022 (minutes)","WY 2023 (minutes)","WY 2021 (hours)","WY 2022 (hours)","WY 2023 (hours)"],
      ["Sacramento Weir to Sacramento Trawl","321","185","215","5.4","3.1","3.6"],
      ["Sacramento Trawl to Freeport","na","na","303","na","na","5.1"],
      ["Freeport to Rio Vista","na","na","1,779","na","na","29.7"],
      ["Sacramento Weir to Rio Vista","3,546","1,554","2,508","59.1","25.9","41.8"]
    ]
  ];
  const unescape=value=>value.replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  let count=0;
  for(let i=0;i<expected.length;i++){
    const xml=await zip.file("xl/worksheets/sheet"+(i+1)+".xml")?.async("string");
    expect(xml).toBeTruthy();
    expect(xml).not.toContain("<f>");
    const rows=[...xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
      .map(match=>{
        const values=[];
        for(const cell of match[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)){
          const index=[...cell[1]].reduce((n,letter)=>n*26+letter.charCodeAt(0)-64,0)-1;
          const v=cell[2].match(/<(?:t|v)(?:\s[^>]*)?>([\s\S]*?)<\/(?:t|v)>/);
          values[index]=unescape(v?.[1]??"");
        }
        return Array.from({length:expected[i][0].length},(_,index)=>values[index]??"");
      });
    expect(rows).toEqual(expected[i]);
    count+=rows.reduce((sum,row)=>sum+row.length,0);
  }
  expect(count).toBe(99);
  const review=await zip.file("xl/worksheets/sheet4.xml")?.async("string");
  expect(review).toContain("EXTRACTION NOT VERIFIED");
});
