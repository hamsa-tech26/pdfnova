import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Fictional source files are generated in the runner and never committed.
async function sourcePdf(){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle("TASK242_PRIVATE_TITLE");
  pdf.setAuthor("TASK242_PRIVATE_AUTHOR");
  pdf.setSubject("TASK242_PRIVATE_SUBJECT");
  pdf.setKeywords(["TASK242_PRIVATE_KEYWORD"]);
  pdf.setCreator("TASK242_PRIVATE_CREATOR");
  pdf.setProducer("TASK242_PRIVATE_PRODUCER");
  for(let i=1;i<=2;i++){
    const page=pdf.addPage([595,842]);
    page.drawText("TASK242_VISIBLE_PAGE_"+i,{
      x:72,y:705,size:17,font,
    });
    page.drawText("Visible content must not be silently destroyed.",{
      x:72,y:650,size:12,font,
    });
  }
  return Buffer.from(await pdf.save());
}

function independentPdf(path,kind){
  const verify=[
    "import fitz,sys",
    "pdf=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "kind=sys.argv[2]",
    "assert len(pdf)==2,'Lost pages'",
    "assert all(abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1 for p in pdf),'Geometry changed'",
    "for i,p in enumerate(pdf,1):",
    "    content=p.get_text('text')",
    "    assert 'TASK242_VISIBLE_PAGE_'+str(i) in content,'Visible source text lost'",
    "    assert 'Visible content must not be silently destroyed.' in content,'Visible detail lost'",
    "m=pdf.metadata",
    "if kind=='removed':",
    "    for k in ('title','author','subject','keywords','creator','producer'):",
    "        assert not (m.get(k) or '').strip(), 'Common metadata remains: '+k",
    "elif kind=='edited':",
    "    assert m.get('title')=='TASK242_PUBLIC_TITLE',m",
    "    assert m.get('author')=='TASK242_PUBLIC_AUTHOR',m",
    "    assert m.get('subject')=='TASK242_PUBLIC_SUBJECT',m",
    "    assert 'TASK242_PUBLIC_KEYWORD' in (m.get('keywords') or ''),m",
    "    assert m.get('creator')=='TASK242_PUBLIC_CREATOR',m",
    "    assert m.get('producer')=='TASK242_PUBLIC_PRODUCER',m",
    "print('TASK242_INDEPENDENT_PDF_'+kind.upper()+'_OK')",
  ].join("\n");
  const stdout=execFileSync("python",["-c",verify,path,kind],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024,
  });
  expect(stdout).toContain("TASK242_INDEPENDENT_PDF_"+kind.toUpperCase()+"_OK");
}

test("live Compress PDF downloaded low-level copy preserves original readable pages",async({page})=>{
  test.setTimeout(180000);
  const input=await sourcePdf();
  await page.goto("/compress-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK242_COMPRESS.pdf",mimeType:"application/pdf",buffer:input,
  });
  const low=page.getByRole("button",{name:/^Low\b/i});
  await expect(low).toBeVisible({timeout:15000});
  await low.click();
  const action=page.getByRole("button",{name:"Compress and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK242_COMPRESS-compressed.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  const bytes=await readFile(path);
  expect(bytes.subarray(0,5).toString("ascii")).toBe("%PDF-");
  // The tool explicitly keeps the original when no smaller valid result is made.
  expect(bytes.length).toBeLessThanOrEqual(input.length);
  independentPdf(path,"compressed");
  console.log(JSON.stringify({check:"TASK242_LIVE_COMPRESS",
    status:"PASS",level:"low",pagesVerified:2,
    outputNoLargerThanInput:true,independentReader:"PyMuPDF",
    noGuaranteeOfReduction:true,realWorldCertified:false}));
});

test("live Remove PDF Metadata clears six common metadata fields without losing pages",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/remove-pdf-metadata",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK242_METADATA.pdf",mimeType:"application/pdf",buffer:await sourcePdf(),
  });
  const action=page.getByRole("button",{name:"Remove Metadata and Download"});
  await expect(action).toBeVisible({timeout:15000});
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK242_METADATA-metadata-removed.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  independentPdf(path,"removed");
  console.log(JSON.stringify({check:"TASK242_LIVE_REMOVE_METADATA",
    status:"PASS",commonFieldsVerified:6,pagesVerified:2,
    independentReader:"PyMuPDF",forensicSanitizationCertified:false}));
});

test("live Edit PDF Metadata saves requested fields and preserves document pages",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/edit-pdf-metadata",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK242_METADATA.pdf",mimeType:"application/pdf",buffer:await sourcePdf(),
  });
  // Stable placeholder selectors also cover wrapped textarea labels;
  // getByLabel("Subject") is not reliably exposed by the current live page.
  const edits=[
    ['input[placeholder="Document title"]',"TASK242_PUBLIC_TITLE"],
    ['input[placeholder="Author or organization"]',"TASK242_PUBLIC_AUTHOR"],
    ['textarea[placeholder="Document subject"]',"TASK242_PUBLIC_SUBJECT"],
    ['textarea[placeholder="Comma-separated keywords"]',"TASK242_PUBLIC_KEYWORD"],
    ['input[placeholder="Creating application or person"]',"TASK242_PUBLIC_CREATOR"],
    ['input[placeholder="PDF producer"]',"TASK242_PUBLIC_PRODUCER"],
  ];
  for(const [selector,value] of edits){
    const field=page.locator(selector);
    await expect(field).toBeVisible({timeout:15000});
    await field.fill(value);
  }
  const action=page.getByRole("button",{name:"Save Metadata and Download"});
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK242_METADATA-metadata-edited.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  independentPdf(path,"edited");
  console.log(JSON.stringify({check:"TASK242_LIVE_EDIT_METADATA",
    status:"PASS",commonFieldsVerified:6,pagesVerified:2,
    independentReader:"PyMuPDF",forensicSanitizationCertified:false}));
});
