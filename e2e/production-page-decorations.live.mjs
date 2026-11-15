import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

async function source(){
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  for(let n=1;n<=3;n++){
    const p=doc.addPage([595,842]);
    p.drawText("TASK251_SOURCE_PAGE_"+n,{x:85,y:630,size:16,font});
  }
  return Buffer.from(await doc.save());
}
function independent(path,mode){
  const py=[
    "import sys,fitz",
    "pdf=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(pdf)==3,'Page count changed'",
    "mode=sys.argv[2]",
    "for i,p in enumerate(pdf,1):",
    "  text=p.get_text('text')",
    "  assert 'TASK251_SOURCE_PAGE_'+str(i) in text,'Original content lost'",
    "  assert abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1",
    "  words=p.get_text('words')",
    "  if mode=='numbers':",
    "    matches=[w for w in words if w[4]==str(i) and w[1]>p.rect.height*.75]",
    "    assert len(matches)==1,'Wrong/missing bottom-page number'",
    "  else:",
    "    assert 'QA HEADER 251' in text,'Header missing'",
    "    assert 'Page '+str(i)+' of 3' in text,'Footer token not rendered'",
    "    head=[w for w in words if w[4]=='QA' and w[1]<p.rect.height*.30]",
    "    foot=[w for w in words if w[4]=='Page' and w[1]>p.rect.height*.70]",
    "    assert head and foot,'Header/footer geometry misplaced'",
    "print('TASK251_INDEPENDENT_'+mode.upper()+'_OK')",
  ].join("\n");
  const output=execFileSync("python",["-c",py,path,mode],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024,
  });
  expect(output).toContain("TASK251_INDEPENDENT_"+mode.toUpperCase()+"_OK");
}
test("live Add Page Numbers renders page-specific bottom numbers while retaining source",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/add-page-numbers",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK251_NUMBERS.pdf",mimeType:"application/pdf",buffer:await source(),
  });
  const action=page.getByRole("button",{name:"Add Page Numbers and Download"});
  await expect(action).toBeVisible({timeout:15000});
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK251_NUMBERS-numbered.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  independent(path,"numbers");
  console.log(JSON.stringify({check:"TASK251_LIVE_PAGE_NUMBERS",result:"PASS",
    pages:3,exactNumberPerPage:true,sourceTextPreserved:true,
    source:"SYNTHETIC_ONLY",reader:"PyMuPDF"}));
});
test("live Header/Footer PDF replaces page tokens and positions content correctly",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/header-footer-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK251_HEADERS.pdf",mimeType:"application/pdf",buffer:await source(),
  });
  const header=page.getByPlaceholder("Example: Confidential");
  await expect(header).toBeVisible({timeout:15000});
  await header.fill("QA HEADER 251");
  await page.getByPlaceholder("Page {page} of {total}").fill("Page {page} of {total}");
  const action=page.getByRole("button",{name:"Add Header & Footer and Download"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK251_HEADERS-header-footer.pdf");
  const path=await download.path();expect(path).toBeTruthy();
  independent(path,"header");
  console.log(JSON.stringify({check:"TASK251_LIVE_HEADER_FOOTER",result:"PASS",
    pages:3,headerOnEveryPage:true,pageNumberTokensCorrect:true,
    sourceTextPreserved:true,source:"SYNTHETIC_ONLY",reader:"PyMuPDF"}));
});
