import {execFileSync} from "node:child_process";
import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";

// Synthetic source only. This is a visible signature IMAGE, never a
// certificate-backed/identity-verified cryptographic digital signature.
test("live Sign PDF embeds typed signature image on selected page only",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=1;i<=2;i++){
    const sheet=pdf.addPage([595,842]);
    sheet.drawText("TASK247_ORIGINAL_PAGE_"+i,{x:60,y:700,size:18,font});
  }
  await page.goto("/sign-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"TASK247_SYNTHETIC_SIGN.pdf",
    mimeType:"application/pdf",buffer:Buffer.from(await pdf.save()),
  });
  await page.getByRole("button",{name:"Type",exact:true}).click();
  const typed=page.getByPlaceholder("Type your name");
  await expect(typed).toBeVisible({timeout:15000});
  await typed.fill("QA PERSON 247");
  await expect(page.getByAltText("Typed signature preview")).toBeVisible({
    timeout:30000,
  });
  const pageSelect=page.getByLabel("Sign page");
  await expect(pageSelect).toBeVisible({timeout:30000});
  await pageSelect.selectOption("2");
  await expect(page.getByAltText("PDF page 2 preview")).toBeVisible({
    timeout:30000,
  });
  const action=page.getByRole("button",{name:"Sign and Download PDF"});
  await expect(action).toBeEnabled({timeout:30000});
  const pending=page.waitForEvent("download",{timeout:120000});
  await action.click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe("TASK247_SYNTHETIC_SIGN-signed.pdf");
  const path=await download.path();expect(path).toBeTruthy();

  const verify=[
    "import sys,fitz",
    "doc=fitz.open(stream=open(sys.argv[1],'rb').read(),filetype='pdf')",
    "assert len(doc)==2",
    "for i,p in enumerate(doc,1):",
    "    assert 'TASK247_ORIGINAL_PAGE_'+str(i) in p.get_text('text'), 'Original page text missing'",
    "    assert abs(p.rect.width-595)<1 and abs(p.rect.height-842)<1",
    "assert len(doc[0].get_images(full=True))==0, 'Signature incorrectly added to unselected page'",
    "images=doc[1].get_images(full=True)",
    "assert len(images)>=1, 'Visible signature image missing on selected page'",
    "rects=[]",
    "for img in images:",
    "    rects.extend(doc[1].get_image_rects(img[0]))",
    "assert rects and any(r.width>=15 and r.height>=4 for r in rects),'Signature is zero-sized'",
    "assert all(r.intersects(doc[1].rect) for r in rects),'Signature outside visible page'",
    "assert not doc.is_repaired, 'Downloaded PDF was damaged'",
    "print('TASK247_INDEPENDENT_VISUAL_SIGNATURE_OK')",
  ].join("\n");
  const checked=execFileSync("python",["-c",verify,path],{
    timeout:30000,encoding:"utf8",maxBuffer:128*1024,
  });
  expect(checked).toContain("TASK247_INDEPENDENT_VISUAL_SIGNATURE_OK");
  console.log(JSON.stringify({check:"TASK247_LIVE_VISUAL_SIGNATURE",
    status:"PASS",source:"SYNTHETIC_ONLY",totalPages:2,
    onlyPageSigned:2,visibleRasterObjectVerified:true,
    sourceTextPreserved:true,independentReader:"PyMuPDF",
    certificateBasedDigitalSignature:false,realDocumentCertification:false}));
});
