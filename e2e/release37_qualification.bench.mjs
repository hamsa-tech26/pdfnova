import {test,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";

const cases=[
  {name:"hybrid_native_scan_inset.pdf",pages:3,kind:"hybrid"},
  {name:"complex_nested_header.pdf",pages:1,kind:"complex"},
  {name:"two_page_continuation.pdf",pages:2,kind:"multipage"},
];
for(const fixture of cases){
  test("Release 37 real-browser scoped diagnostics: "+fixture.kind,async({page})=>{
    test.setTimeout(300_000);
    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first().setInputFiles(
      path.join(process.cwd(),"test-fixtures/release37",fixture.name));
    const button=page.getByRole("button",{name:"Download complete result JSON"});
    await expect(button).toBeVisible({timeout:270_000});
    const promise=page.waitForEvent("download");
    await button.click();
    const downloaded=await promise;
    const source=await downloaded.path();
    if(!source)throw new Error("Inspector JSON missing.");
    const result=JSON.parse(await readFile(source,"utf8"));
    expect(result.document.pages.length).toBe(fixture.pages);
    expect(result.release37Audit.designation).toBe("DIAGNOSTIC_ONLY_NOT_V4_STABLE");
    expect(result.release37Audit.checks.some(c=>c.id==="10.20-stable-freeze" && c.state==="NOT_VERIFIED")).toBe(true);
    if(fixture.kind==="hybrid"){
      expect(result.ocrDecision.requiredPageNumbers).toEqual([2]);
      expect(result.ocrDecision.nativeTextPageNumbers).toEqual([1,3]);
      expect(result.controlledOcrResult?.attempted).toBe(true);
      expect(result.controlledOcrResult?.processedPageNumbers).toEqual([2]);
      expect(result.release37Audit.checks.find(c=>c.id==="10.15-native-preservation")?.state).toBe("PASS_SCOPED");
      expect(result.release37Audit.checks.find(c=>c.id==="10.15-scanned-insets")?.state).toBe("NOT_VERIFIED");
    }
    const evidence={
      case:fixture.kind,filename:fixture.name,source:"actual Chromium PDF Engine V4 Inspector",
      synthetic:true,ocrDecision:result.ocrDecision,
      ocrPages:result.controlledOcrResult?.processedPageNumbers??[],
      confirmedTableCount:result.tables?.length??0,
      tableRowCounts:result.tables?.map(t=>t.rows?.length??0)??[],
      audit:result.release37Audit,processingTimes:result.processingTimes,
    };
    const out=path.join(process.cwd(),"benchmarks/release37/reports");
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,fixture.kind+"-browser.json"),JSON.stringify(evidence,null,2)+"\n");
  });
}
