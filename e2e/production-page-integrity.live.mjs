import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Verify the ALREADY DEPLOYED public website; all PDF inputs are synthetic and
// generated inside this CI run. No customer source bytes are stored or logged.
async function sourcePdf(prefix,count){
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  for(let i=1;i<=count;i++){
    const sheet=doc.addPage([595,842]);
    sheet.drawText("TASK239_"+prefix+"_PAGE_"+i,{
      x:70,y:710,size:18,font,
    });
  }
  return Buffer.from(await doc.save());
}

function verifyDownloadedPdf(path,expected){
  // PyMuPDF is separate from the browser's pdf-lib output implementation.
  // Verify every page, exact isolated marker, page dimensions, and ordering.
  const script=[
    "import sys,json,io,fitz",
    "expected=json.loads(sys.argv[2])",
    "pdf=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(pdf)==len(expected),('Page count mismatch',len(pdf),len(expected))",
    "actual=[p.get_text('text').strip() for p in pdf]",
    "assert actual==expected,'Missing, reordered, added or duplicated source page'",
    "assert all(abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1 for p in pdf),'Page geometry changed'",
    "assert all(p.rotation==0 for p in pdf),'Unexpected page rotation'",
    "print('TASK239_INDEPENDENT_PDF_PAGE_SEQUENCE_OK')",
  ].join("\n");
  const result=execFileSync("python",["-c",script,path,JSON.stringify(expected)],{
    encoding:"utf8",timeout:30000,maxBuffer:128*1024,
  });
  expect(result).toContain("TASK239_INDEPENDENT_PDF_PAGE_SEQUENCE_OK");
}

test("live Merge PDF downloads the exact 3+2 source pages in file order",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/merge-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles([
    {name:"TASK239_SOURCE_A.pdf",mimeType:"application/pdf",buffer:await sourcePdf("A",3)},
    {name:"TASK239_SOURCE_B.pdf",mimeType:"application/pdf",buffer:await sourcePdf("B",2)},
  ]);
  const action=page.getByRole("button",{name:"Merge and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("kukureku-merged.pdf");
  const path=await download.path();
  expect(path).toBeTruthy();
  verifyDownloadedPdf(path,[
    "TASK239_A_PAGE_1","TASK239_A_PAGE_2","TASK239_A_PAGE_3",
    "TASK239_B_PAGE_1","TASK239_B_PAGE_2",
  ]);
  console.log(JSON.stringify({check:"TASK239_LIVE_MERGE_PDF",
    status:"PASS",source:"SYNTHETIC_ONLY",expectedPages:5,
    independentReader:"PyMuPDF",realDocumentCertification:false}));
});

test("live Split PDF downloads exactly discontiguous pages 2,4-5",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/split-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK239_SPLIT_SOURCE.pdf",
    mimeType:"application/pdf",buffer:await sourcePdf("SPLIT",6),
  });
  await expect(page.locator("#page-range")).toBeVisible({timeout:15000});
  await page.locator("#page-range").fill("2,4-5");
  const action=page.getByRole("button",{name:"Extract and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const path=await download.path();expect(path).toBeTruthy();
  verifyDownloadedPdf(path,[
    "TASK239_SPLIT_PAGE_2","TASK239_SPLIT_PAGE_4","TASK239_SPLIT_PAGE_5",
  ]);
  console.log(JSON.stringify({check:"TASK239_LIVE_SPLIT_PDF",
    status:"PASS",selected:"2,4-5",expectedPages:3,
    source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF"}));
});

test("live Extract PDF Pages preserves exactly selected pages 1,3,6",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/extract-pdf-pages",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK239_EXTRACT_SOURCE.pdf",
    mimeType:"application/pdf",buffer:await sourcePdf("EXTRACT",6),
  });
  const field=page.locator("#pages");
  await expect(field).toBeVisible({timeout:15000});
  await field.fill("1,3,6");
  const action=page.getByRole("button",{name:"Extract and Download Pages"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK239_EXTRACT_SOURCE-extracted.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  verifyDownloadedPdf(path,[
    "TASK239_EXTRACT_PAGE_1","TASK239_EXTRACT_PAGE_3","TASK239_EXTRACT_PAGE_6",
  ]);
  console.log(JSON.stringify({check:"TASK239_LIVE_EXTRACT_PDF",
    status:"PASS",selected:"1,3,6",expectedPages:3,
    source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF"}));
});
