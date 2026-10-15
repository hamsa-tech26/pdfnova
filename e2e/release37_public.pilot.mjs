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
    const evidence={
      sourceId:metadata.id,
      sourceSha256:metadata.sourceSha256,
      subsetSha256:metadata.subsetSha256,
      sourceUrl:metadata.sourceUrl,
      sourcePages:metadata.sourcePages,
      selectedPageNumbers:metadata.selectedPageNumbers,
      pageCount:inspector.statistics?.pageCount??inspector.document.pages.length,
      tableCount:inspector.tables.length,
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
