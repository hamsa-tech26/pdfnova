import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import JSZip from "jszip";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";

async function nativeTablePdf(){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([900,760]);
  const xs=[45,120,285,450,605];
  const rows=[["Sl No","Code","Name","Amount","Remarks"],
    ...Array.from({length:12},(_,i)=>[
      String(i+1),String(i+71).padStart(5,"0"),"Station "+(i+1),
      String(1000+i*11),"Reviewed "+(i+1)])];
  rows.forEach((row,i)=>row.forEach((value,j)=>{
    page.drawText(value,{x:xs[j],y:690-i*36,size:12,font});
  }));
  return Buffer.from(await pdf.save());
}
test("live Kukureku accepts a synthetic PDF and exports a real XLSX with source values",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/pdf-to-excel",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:/Convert to Excel/i})).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_RELEASE142_TABLE.pdf",mimeType:"application/pdf",
    buffer:await nativeTablePdf(),
  });
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  const download=await pending,path=await download.path();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(path).toBeTruthy();
  const zip=await JSZip.loadAsync(await readFile(path));
  const cells=await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  const review=await zip.file("xl/worksheets/sheet2.xml")?.async("string");
  expect(cells).toContain("00071");
  expect(cells).toContain("Station 12");
  expect(cells).not.toContain("<f>");
  expect(review).toContain("EXTRACTION NOT VERIFIED");
  const opened=execFileSync("python",["-c",
    "import sys,io; from openpyxl import load_workbook; "+
    "w=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=True); "+
    "s=w['Table 1']; r=list(s.values); "+
    "assert any(len(x)>=5 and x[1]=='00071' and x[2]=='Station 1' for x in r); "+
    "assert any(len(x)>=5 and x[2]=='Station 12' for x in r); "+
    "assert 'Review Notes' in w.sheetnames; print('LIVE_XLSX_OK')",
    path],{encoding:"utf8"});
  expect(opened).toContain("LIVE_XLSX_OK");
  await expect(page.getByRole("heading",{name:"Excel workbook created"})).toBeVisible();
  // A user-supplied real PDF is never used for this live smoke.
  console.log(JSON.stringify({test:"LIVE_RELEASE142_NATIVE_XLSX",
    result:"PASS",source:"SYNTHETIC_ONLY",sourceUpload:false,
    sourceContainsPersonalData:false,sourceCellsVerified:2,independentReader:true}));
});
test("live converter safely refuses scanned-only or text-free input",async({page})=>{
  test.setTimeout(120000);
  const pdf=await PDFDocument.create(),sheet=pdf.addPage([600,400]);
  sheet.drawRectangle({x:50,y:50,width:300,height:120});
  await page.goto("/pdf-to-excel",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_RELEASE142_NO_TEXT.pdf",mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  let downloaded=false;
  page.on("download",()=>{downloaded=true});
  await page.getByRole("button",{name:/Convert to Excel/i}).click();
  await expect(page.getByText(/image-only or low-text pages/i)).toBeVisible();
  expect(downloaded).toBe(false);
  console.log(JSON.stringify({test:"LIVE_RELEASE142_SAFE_REFUSAL",result:"PASS",
    source:"SYNTHETIC_ONLY",sourceUpload:false}));
});
