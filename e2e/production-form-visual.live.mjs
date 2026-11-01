import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts,degrees} from "pdf-lib";
import {execFileSync} from "node:child_process";

test("live two-page rotated CropBox form shows complete typed values and independent visible ink",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const first=pdf.addPage([600,780]);
  first.setCropBox(20,30,520,700);
  first.setRotation(degrees(270));
  first.drawText("SYNTHETIC ROTATED PAGE 1",{x:40,y:715,size:13,font});
  const second=pdf.addPage([612,792]);
  second.drawText("SYNTHETIC PAGE 2",{x:50,y:740,size:13,font});
  const input=Buffer.from(await pdf.save());
  await page.goto("/create-fillable-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK194_TWO_PAGE.pdf",mimeType:"application/pdf",buffer:input,
  });

  async function place(name,number,left,top,width,height){
    await expect(page.getByAltText("PDF page "+String(number))).toBeVisible();
    await page.getByLabel("Unique field name").fill(name);
    const group=page.getByRole("group",{name:"New form field area on page "+String(number)});
    await group.getByLabel("Left %").fill(String(left));
    await group.getByLabel("Top %").fill(String(top));
    await group.getByLabel("Width %").fill(String(width));
    await group.getByLabel("Height %").fill(String(height));
    await page.getByRole("button",{name:"Use this field area"}).click();
    await page.getByRole("button",{name:"Add field to page"}).click();
    await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
  }

  await place("qa_page1",1,15,25,48,5);
  await page.getByRole("combobox",{name:"PDF page"}).selectOption("2");
  await place("qa_page2",2,15,28,45,4);

  const formPending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Create Fillable PDF"}).click();
  const created=await formPending;
  expect(created.suggestedFilename()).toBe("SYNTHETIC_TASK194_TWO_PAGE-fillable.pdf");
  const createdPath=await created.path();
  expect(createdPath).toBeTruthy();

  await page.goto("/pdf-form-filler",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:created.suggestedFilename(),mimeType:"application/pdf",
    buffer:await (await import("node:fs/promises")).readFile(createdPath),
  });
  await page.getByLabel("qa_page1",{exact:true}).fill("Kukureku Test User");
  await page.getByLabel("qa_page2",{exact:true}).fill("Junior Engineer");
  const completedPending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Fill and Download PDF"}).click();
  const filled=await completedPending;
  expect(filled.suggestedFilename()).toBe("SYNTHETIC_TASK194_TWO_PAGE-fillable-filled.pdf");
  const filledPath=await filled.path();
  expect(filledPath).toBeTruthy();

  const reviewed=JSON.parse(execFileSync("python",[
    "scripts/verifySyntheticRotatedFormVisual.py",createdPath,filledPath,
  ],{encoding:"utf8",timeout:30000}));
  expect(reviewed.result).toBe("PASS");
  expect(reviewed.pageCount).toBe(2);
  expect(reviewed.renderedAppearanceChecked).toBe(true);
  console.log(JSON.stringify({check:"LIVE_V1_ROTATED_CROP_FORM_VISUAL",result:"PASS",
    source:"SYNTHETIC_ONLY",pageCount:2,fullValuesPreserved:true,
    independentPdfRenderer:"PyMuPDF",croppedAndRotatedFieldAppearanceVerified:true,
    sourceBytesLogged:false,
    limitation:"Two controlled synthetic fields, not Chrome native viewer or arbitrary real PDFs"}));
});
