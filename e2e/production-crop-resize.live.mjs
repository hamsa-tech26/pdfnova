import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

async function samplePdf(){
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  for(let i=1;i<=2;i++){
    const page=doc.addPage([595,842]);
    page.drawText("TASK250_VISIBLE_PAGE_"+i,{x:100,y:680,size:16,font});
    page.drawText("TASK250_SOURCE_CONTROL",{x:100,y:520,size:12,font});
  }
  return Buffer.from(await doc.save());
}

function checkDownload(path,mode){
  const py=[
    "import fitz,sys",
    "d=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(d)==2, 'Source page count changed'",
    "for i,p in enumerate(d,1):",
    "  t=p.get_text('text')",
    "  assert 'TASK250_VISIBLE_PAGE_'+str(i) in t, 'Source page content lost'",
    "  assert 'TASK250_SOURCE_CONTROL' in t, 'Visible control lost'",
    "  assert p.rotation==0, 'Unexpected rotation'",
    "  if sys.argv[2]=='crop':",
    "    assert abs(p.rect.width-(595-20*72/25.4))<1,'Wrong cropped width'",
    "    assert abs(p.rect.height-(842-20*72/25.4))<1,'Wrong cropped height'",
    "    assert abs(p.mediabox.width-595)<1 and abs(p.mediabox.height-842)<1,'Crop changed original MediaBox'",
    "    assert p.cropbox != p.mediabox,'CropBox was not applied'",
    "  else:",
    "    assert abs(p.rect.width-419.53)<1, 'Wrong A5 width'",
    "    assert abs(p.rect.height-595.28)<1, 'Wrong A5 height'",
    "print('TASK250_INDEPENDENT_PDF_'+sys.argv[2].upper()+'_OK')",
  ].join("\n");
  expect(execFileSync("python",["-c",py,path,mode],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024,
  })).toContain("TASK250_INDEPENDENT_PDF_"+mode.toUpperCase()+"_OK");
}

test("live Crop PDF applies 10mm margins to every page without deleting source content",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/crop-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK250_CROP.pdf",mimeType:"application/pdf",buffer:await samplePdf(),
  });
  const preset=page.getByRole("button",{name:"10 mm all sides"});
  await expect(preset).toBeVisible({timeout:15000});
  await preset.click();
  const action=page.getByRole("button",{name:"Crop and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const output=await pending;
  expect(output.suggestedFilename()).toBe("TASK250_CROP-cropped.pdf");
  const path=await output.path();expect(path).toBeTruthy();
  checkDownload(path,"crop");
  console.log(JSON.stringify({check:"TASK250_LIVE_CROP_PDF",result:"PASS",
    pages:2,marginsMm:10,geometryVerified:true,originalContentRetained:true,
    originalBytesRemoved:false,redactionCertified:false,reader:"PyMuPDF"}));
});

test("live Resize PDF produces A5 portrait pages with readable source markers",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/resize-pdf-pages",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK250_RESIZE.pdf",mimeType:"application/pdf",buffer:await samplePdf(),
  });
  const a5=page.getByRole("button",{name:/^A5\b/});
  await expect(a5).toBeVisible({timeout:15000});
  await a5.click();
  const portrait=page.getByRole("button",{name:/^Portrait\b/});
  await portrait.click();
  const action=page.getByRole("button",{name:"Resize and Download PDF"});
  await expect(action).toBeEnabled();
  const pending=page.waitForEvent("download",{timeout:90000});
  await action.click();
  const output=await pending;
  expect(output.suggestedFilename()).toBe("TASK250_RESIZE-a5-resized.pdf");
  const path=await output.path();expect(path).toBeTruthy();
  checkDownload(path,"resize");
  console.log(JSON.stringify({check:"TASK250_LIVE_RESIZE_PDF",result:"PASS",
    pages:2,preset:"A5",orientation:"portrait",sourceTextRetained:true,
    dimensionsVerified:true,reader:"PyMuPDF"}));
});
