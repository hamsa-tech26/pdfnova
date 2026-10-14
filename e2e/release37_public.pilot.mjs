import {test,expect} from "@playwright/test";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

test("Read real USGS PDF pages through the V4 browser Inspector without claiming accuracy",async({page})=>{
  test.setTimeout(300_000);
  const base=path.join(process.cwd(),"benchmarks/release37/private");
  const metadata=JSON.parse(await readFile(path.join(base,"usgs-public-pilot-metadata.json"),"utf8"));
  await page.goto("/engine-inspector");
  await page.locator('input[type="file"]').first().setInputFiles(path.join(base,"usgs-public-pilot.pdf"));
  const button=page.getByRole("button",{name:"Download complete result JSON"});
  await expect(button).toBeVisible({timeout:270_000});
  const downloadPromise=page.waitForEvent("download");
  await button.click();
  const download=await downloadPromise;
  const source=await download.path();
  if(!source)throw new Error("No downloadable inspector result");
  const inspector=JSON.parse(await readFile(source,"utf8"));
  expect(inspector.document?.pages?.length).toBe(metadata.selectedPageNumbers.length);
  expect(Array.isArray(inspector.tables)).toBe(true);
  expect(inspector.ocrDecision).toBeTruthy();
  expect(inspector.processingTimes).toBeTruthy();
  expect(metadata.isRelease37AcceptanceEvidence).toBe(false);
  expect(metadata.realDocumentCountCredit).toBe(0);
  const evidence={
    sourceId:metadata.id,sourceSha256:metadata.sourceSha256,subsetSha256:metadata.subsetSha256,
    selectedPageNumbers:metadata.selectedPageNumbers,sourcePages:metadata.sourcePages,
    sourceUrl:metadata.originalSourceUrl,sourceType:metadata.sourceType,realDocumentCountCredit:0,
    nativeExtraction:inspector.nativePageTextExtraction?.map(p=>({pageNumber:p.pageNumber,status:p.textExtraction?.status,
      wordCount:p.textExtraction?.wordCount,characterCount:p.textExtraction?.characterCount})),
    // Aggregate metadata only. Raw decisions may contain source words or
    // selected text; NEVER write the raw Inspector/OCR payload to CI artifacts.
    ocrDecisionPresent:Boolean(inspector.ocrDecision),
    controlledOcrAttempted:inspector.controlledOcrResult?.attempted===true,
    actualOcrPages:inspector.controlledOcrResult?.processedPageNumbers??[],
    pageCount:inspector.statistics?.pageCount,
    tableCount:inspector.tables?.length,
    timingMs:inspector.processingTimes?.totalMs,
    acceptanceState:"NOT_VERIFIED",reason:"No independently annotated ground truth; third-party rights review incomplete.",
  };
  const reports=path.join(process.cwd(),"benchmarks/release37/reports");
  await mkdir(reports,{recursive:true});
  await writeFile(path.join(reports,"public-usgs-pilot.json"),JSON.stringify(evidence,null,2)+"\n");
});
