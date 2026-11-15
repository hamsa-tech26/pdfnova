import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

function runReader(executable,args) {
  // Never log PDF bytes, extracted document text or source attachments.
  return execFileSync(executable,args,{
    encoding:"utf8",timeout:30000,maxBuffer:2*1024*1024,
  });
}

test("live redaction removes source text and attachments under two independent PDF readers",async({page})=>{
  test.setTimeout(180000);
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("SYNTHETIC_TASK225_REDACTION_SOURCE");
  const first=doc.addPage([600,800]);
  first.drawText("SYNTHETIC_REDACTION_SECRET_225",{x:80,y:650,size:22,font});
  first.drawText("PUBLIC_CONTROL_PAGE_1",{x:80,y:420,size:20,font});
  const second=doc.addPage([600,800]);
  second.drawText("PUBLIC_CONTROL_PAGE_2",{x:80,y:450,size:22,font});
  await doc.attach(Buffer.from("SYNTHETIC_ATTACHMENT_225"),"source-fixture.txt",{
    mimeType:"text/plain",description:"Fictional QA fixture, never customer data",
  });
  const original=Buffer.from(await doc.save());
  await page.goto("/redact-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK225_REDACTION.pdf",
    mimeType:"application/pdf",buffer:original,
  });
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls=page.getByRole("group",{name:"Redaction area on page 1"});
  await controls.getByLabel("Left %").fill("10");
  await controls.getByLabel("Top %").fill("10");
  await controls.getByLabel("Width %").fill("75");
  await controls.getByLabel("Height %").fill("22");
  await page.getByRole("button",{name:"Add redaction area"}).click();
  await expect(page.getByText("Page 1: 1 redaction area marked.")).toBeVisible();
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Redact and Download PDF"}).click();
  const download=await pending, path=await download.path();
  expect(path).toBeTruthy();
  const output=await readFile(path);
  expect(output.subarray(0,5).toString("ascii")).toBe("%PDF-");
  // String markers are not sufficient, but can catch source-text copies.
  for(const sourceMarker of ["SYNTHETIC_REDACTION_SECRET_225",
    "SYNTHETIC_ATTACHMENT_225","SYNTHETIC_TASK225_REDACTION_SOURCE"]){
    expect(output.includes(Buffer.from(sourceMarker))).toBe(false);
  }
  // Poppler is independent from the site's PDF.js/pdf-lib render path.
  const info=runReader("pdfinfo",[path]);
  expect(info).toMatch(/^Pages:\s*2\s*$/m);
  const text=runReader("pdftotext",["-enc","UTF-8",path,"-"]);
  expect(text.trim(),"No original selectable text may remain").toBe("");
  const attachmentInfo=runReader("pdfdetach",["-list",path]);
  expect(attachmentInfo.trim()).toMatch(/^0 embedded files?$/i);
  const imageLines=runReader("pdfimages",["-list",path])
    .split(/\r?\n/).slice(2).map(s=>s.trim()).filter(Boolean);
  expect(imageLines).toHaveLength(2);
  expect(imageLines.map(line=>Number(line.split(/\s+/)[0]))).toEqual([1,2]);
  // PyMuPDF checks raster, mask and visible second-page source control.
  const reader=[
    "import sys,json,fitz",
    "doc=fitz.open(sys.argv[1])",
    "assert len(doc)==2, 'Output pages missing'",
    "for i in (0,1):",
    "    assert not doc[i].get_text().strip(), 'Source text extractable'",
    "    assert len(doc[i].get_images(full=True))==1, 'Unexpected images'",
    "p=doc[0].get_pixmap(alpha=False)",
    "def sample(x,y):return p.pixel(int(p.width*x),int(p.height*y))[:3]",
    "assert max(sample(.55,.20))<60, 'Redaction not opaque'",
    "assert min(sample(.85,.82))>190, 'Outside background damaged'",
    "q=doc[1].get_pixmap(alpha=False)",
    "dark=0",
    "for y in range(int(q.height*.40),int(q.height*.48),3):",
    "    for x in range(int(q.width*.12),int(q.width*.75),3):",
    "        if max(q.pixel(x,y)[:3])<160:dark+=1",
    "assert dark>=20, 'Unredacted second page content lost'",
    "print(json.dumps({'pages':2,'images':2,'darkPixelsObserved':dark,'sourceTextExtractable':False}))",
  ].join("\n");
  const verification=JSON.parse(runReader("python",["-c",reader,path]));
  expect(verification.pages).toBe(2);
  expect(verification.darkPixelsObserved).toBeGreaterThanOrEqual(20);
  console.log(JSON.stringify({check:"TASK225_LIVE_REDACTION_SECOND_READER",
    result:"PASS",source:"SYNTHETIC_ONLY",outputPages:2,
    maskedRasterOpaque:true,unmarkedPageContentPreserved:true,
    popplerTextExtractable:false,popplerAttachments:0,
    independentReaders:["Poppler","PyMuPDF"],
    physicalMobileVerified:false,externalForensicCertified:false}));
});
