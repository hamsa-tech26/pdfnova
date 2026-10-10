import {test,expect} from "@playwright/test";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {scorePrivateCase} from "../scripts/privateGoldenScorer.mjs";

// Synthetic control for scoring-wire integrity only; NEVER counted as real-world evidence.
test("Release 52 scorer measures an actual browser OCR TXT download without invented success",async({page})=>{
  test.setTimeout(180000);
  const bytes=await readFile(path.resolve("test-fixtures/golden/golden-scan.pdf"));
  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"golden-scan.pdf",mimeType:"application/pdf",buffer:bytes
  });
  const pending=page.waitForEvent("download",{timeout:150000});
  await page.getByRole("button",{name:"Run OCR and Download TXT"}).click();
  const file=await pending;
  const actual=await readFile(await file.path(),"utf8");
  const specimen={
    id:"synthetic-control",category:"ocr-text",
    expected:{text:"GOLDEN SCAN 123"}
  };
  const evidence=scorePrivateCase(specimen,{measured:true,text:actual});
  expect(["PASS","FAIL"]).toContain(evidence.status);
  expect(Number.isFinite(evidence.metrics.characterErrorPct)).toBe(true);
  expect(evidence.metrics.characterErrorPct).toBeGreaterThanOrEqual(0);
  const report={schema:"kukureku-release52-synthetic-scoring-control-v1",
    provenance:"SYNTHETIC_ONLY",realWorldDocumentsEvaluated:0,
    status:"DIAGNOSTIC_ONLY_NOT_REAL_WORLD",score:evidence};
  await mkdir("benchmarks/golden/reports",{recursive:true});
  await writeFile("benchmarks/golden/reports/release52-control.json",JSON.stringify(report,null,2)+"\n");
  expect(JSON.stringify(report)).not.toContain("GOLDEN SCAN 123");
});
