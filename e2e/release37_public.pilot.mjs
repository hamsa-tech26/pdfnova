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
  expect(inspector.release37Audit?.designation).toBe("DIAGNOSTIC_ONLY_NOT_V4_STABLE");
  const evidence={
    sourceId:metadata.id,sourceSha256:metadata.sourceSha256,subsetSha256:metadata.subsetSha256,
    selectedPageNumbers:metadata.selectedPageNumbers,sourcePages:metadata.sourcePages,
    sourceUrl:metadata.originalSourceUrl,sourceType:metadata.sourceType,
    nativeExtraction:inspector.nativePageTextExtraction?.map(p=>({pageNumber:p.pageNumber,status:p.textExtraction?.status,
      wordCount:p.textExtraction?.wordCount,characterCount:p.textExtraction?.characterCount})),
    ocrDecision:inspector.ocrDecision,
    actualOcrPages:inspector.controlledOcrResult?.processedPageNumbers??[],
    pageCount:inspector.statistics?.pageCount,
    tableCount:inspector.tables?.length,
    timingMs:inspector.processingTimes?.totalMs,
    acceptanceState:"NOT_VERIFIED",reason:"No independently annotated reference; publisher rights review pending.",
  };
  const reports=path.join(process.cwd(),"benchmarks/release37/reports");
  await mkdir(reports,{recursive:true});
  await writeFile(path.join(reports,"public-usgs-pilot.json"),JSON.stringify(evidence,null,2)+"\n");
});
