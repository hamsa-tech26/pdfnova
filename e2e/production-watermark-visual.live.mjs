import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Task 246: source PDF is fictional and constructed inside the test runner.
test("live Watermark PDF embeds visible text once per original page",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=1;i<=2;i++){
    const sheet=pdf.addPage([595,842]);
    sheet.drawText("TASK246_ORIGINAL_PAGE_"+i,{x:72,y:710,size:15,font});
  }
  await page.goto("/watermark-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK246_SYNTHETIC_WATERMARK.pdf",
    mimeType:"application/pdf",buffer:Buffer.from(await pdf.save()),
  });
  const input=page.locator("#watermark-text");
  await expect(input).toBeVisible({timeout:15000});
  await input.fill("KUKU246");
  const action=page.getByRole("button",{name:"Add Watermark and Download"});
  await expect(action).toBeEnabled({timeout:15000});
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK246_SYNTHETIC_WATERMARK-watermarked.pdf");
  const path=await download.path();expect(path).toBeTruthy();

  // PyMuPDF independently inspects actual downloaded bytes, not a UI toast.
  const reader=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,p in enumerate(doc,1):",
    "    text=p.get_text('text')",
    "    assert 'TASK246_ORIGINAL_PAGE_'+str(i) in text, 'Source text lost'",
    "    assert text.count('KUKU246')==1, 'Watermark missing or duplicated'",
    "    words=[w for w in p.get_text('words') if 'KUKU246' in w[4]]",
    "    assert len(words)==1, 'Watermark cannot be located'",
    "    x0,y0,x1,y1=words[0][:4]",
    "    assert 0<=x0<x1<=p.rect.width and 0<=y0<y1<=p.rect.height, 'Watermark outside visible page'",
    "    assert abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1",
    "print('TASK246_WATERMARK_INDEPENDENT_OUTPUT_OK')",
  ].join("\n");
  const result=execFileSync("python",["-c",reader,path],{
    encoding:"utf8",timeout:30000,maxBuffer:128*1024,
  });
  expect(result).toContain("TASK246_WATERMARK_INDEPENDENT_OUTPUT_OK");
  console.log(JSON.stringify({check:"TASK246_LIVE_WATERMARK",
    result:"PASS",source:"SYNTHETIC_ONLY",pages:2,
    watermarkOccurrences:2,sourceTextPreserved:true,
    independentReader:"PyMuPDF",cryptographicSignatureClaim:false}));
});
