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


test("live Delete PDF Pages removes selected pages while retaining every other source page",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/delete-pdf-pages",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK239_DELETE_SOURCE.pdf",mimeType:"application/pdf",
    buffer:await sourcePdf("DELETE",6),
  });
  const input=page.locator("#pages");
  await expect(input).toBeVisible({timeout:15000});
  await input.fill("2,4");
  const action=page.getByRole("button",{name:"Delete Pages and Download"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK239_DELETE_SOURCE-pages-removed.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  verifyDownloadedPdf(path,[
    "TASK239_DELETE_PAGE_1","TASK239_DELETE_PAGE_3",
    "TASK239_DELETE_PAGE_5","TASK239_DELETE_PAGE_6",
  ]);
  console.log(JSON.stringify({check:"TASK239_LIVE_DELETE_PDF",
    status:"PASS",removed:"2,4",retainedPages:4,
    source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF"}));
});

test("live Rotate PDF persists 90 degree rotation for every source page",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/rotate-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK239_ROTATE_SOURCE.pdf",mimeType:"application/pdf",
    buffer:await sourcePdf("ROTATE",3),
  });
  const choose=page.getByRole("button",{name:"90° clockwise",exact:true});
  await expect(choose).toBeVisible({timeout:15000});
  await choose.click();
  const action=page.getByRole("button",{name:"Rotate and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK239_ROTATE_SOURCE-rotated.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  const py=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "expected=['TASK239_ROTATE_PAGE_'+str(i) for i in range(1,4)]",
    "assert len(doc)==3",
    "assert [p.get_text('text').strip() for p in doc]==expected",
    "assert all(p.rotation==90 for p in doc),'Rotation not saved'",
    "assert all(abs(p.rect.width-842)<1 and abs(p.rect.height-595)<1 for p in doc),'Rotated visible geometry wrong'",
    "print('TASK239_ROTATION_INDEPENDENT_OK')",
  ].join("\n");
  const report=execFileSync("python",["-c",py,path],{
    encoding:"utf8",timeout:30000,maxBuffer:128*1024,
  });
  expect(report).toContain("TASK239_ROTATION_INDEPENDENT_OK");
  console.log(JSON.stringify({check:"TASK239_LIVE_ROTATE_PDF",
    status:"PASS",pages:3,persistedRotation:90,
    source:"SYNTHETIC_ONLY",independentReader:"PyMuPDF"}));
});


test("live Organize PDF combines reorder, single-page rotation and deletion",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/organize-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK239_ORGANIZE_SOURCE.pdf",mimeType:"application/pdf",
    buffer:await sourcePdf("ORGANIZE",4),
  });
  await expect(page.getByRole("heading",{name:"PDF Pages (4)"})).toBeVisible({timeout:45000});
  const cards=page.locator("article").filter({
    has:page.locator('img[alt^="PDF page"]'),
  });
  await expect(cards).toHaveCount(4);
  // Starting source sequence [1,2,3,4]: swap first two -> [2,1,3,4].
  await cards.nth(0).getByRole("button",{name:"Move Down"}).click();
  // Rotate only the new first page (original source page 2).
  await cards.nth(0).getByRole("button",{name:"Rotate",exact:true}).click();
  // Delete the third page (original source page 3).
  await cards.nth(2).getByRole("button",{name:"Delete",exact:true}).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole("heading",{name:"PDF Pages (3)"})).toBeVisible();
  const pending=page.waitForEvent("download",{timeout:90000});
  await page.getByRole("button",{name:"Save PDF",exact:true}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK239_ORGANIZE_SOURCE-organized.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  const py=[
    "import sys,fitz",
    "pdf=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(pdf)==3,'Page deletion incorrect'",
    "expected=['TASK239_ORGANIZE_PAGE_2','TASK239_ORGANIZE_PAGE_1','TASK239_ORGANIZE_PAGE_4']",
    "actual=[p.get_text('text').strip() for p in pdf]",
    "assert actual==expected,'Page reordering or deletion incorrect'",
    "assert [p.rotation for p in pdf]==[90,0,0],'Single-page rotation incorrect'",
    "assert abs(pdf[0].rect.width-842)<1 and abs(pdf[0].rect.height-595)<1",
    "assert all(abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1 for p in list(pdf)[1:])",
    "print('TASK239_ORGANIZE_INDEPENDENT_INTEGRITY_OK')",
  ].join("\n");
  const result=execFileSync("python",["-c",py,path],{
    encoding:"utf8",timeout:30000,maxBuffer:128*1024,
  });
  expect(result).toContain("TASK239_ORGANIZE_INDEPENDENT_INTEGRITY_OK");
  console.log(JSON.stringify({check:"TASK239_LIVE_ORGANIZE_PDF",
    status:"PASS",source:"SYNTHETIC_ONLY",finalPages:3,
    reordered:true,singlePageRotation:true,sourcePageDeleted:3,
    independentReader:"PyMuPDF"}));
});
