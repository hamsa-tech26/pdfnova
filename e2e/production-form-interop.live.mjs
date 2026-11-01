import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {execFileSync} from "node:child_process";

function checkIndependent(mode,path){
  const result=execFileSync("python",[
    "scripts/verifySyntheticAcroform.py",mode,path,
  ],{encoding:"utf8",timeout:30000});
  return JSON.parse(result);
}

test("live PDF Form Filler saves independently readable text, checkbox and dropdown appearances",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const sheet=pdf.addPage([612,792]);
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  sheet.drawText("SYNTHETIC FORM INTEROPERABILITY 2026",{x:70,y:735,size:16,font});
  const form=pdf.getForm();
  const textField=form.createTextField("qa_name");
  textField.addToPage(sheet,{x:80,y:570,width:250,height:46,font});
  const checkbox=form.createCheckBox("qa_consent");
  checkbox.addToPage(sheet,{x:80,y:510,width:26,height:26});
  const select=form.createDropdown("qa_region");
  select.setOptions(["India","USA","UK"]);
  select.select("India");
  select.addToPage(sheet,{x:80,y:440,width:230,height:43,font});
  const input=Buffer.from(await pdf.save({updateFieldAppearances:false}));

  await page.goto("/pdf-form-filler",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK193_FORM.pdf",mimeType:"application/pdf",buffer:input,
  });
  await page.getByLabel("qa_name",{exact:true}).fill("Independent Form Proof 2026");
  await page.getByLabel("qa_consent",{exact:true}).check();
  await page.getByLabel("qa_region",{exact:true}).selectOption("USA");
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Fill and Download PDF"}).click();
  const downloaded=await pending;
  expect(downloaded.suggestedFilename()).toBe("SYNTHETIC_TASK193_FORM-filled.pdf");
  const path=await downloaded.path();
  expect(path).toBeTruthy();
  const verified=checkIndependent("filled",path);
  expect(verified.widgetCount).toBe(3);
  expect(verified.appearancePresent).toBe(true);
  expect(verified.visibleTextInk).toBe(true);
  console.log(JSON.stringify({check:"LIVE_V1_FORM_FILL_INDEPENDENT",result:"PASS",
    syntheticOnly:true,widgetCount:verified.widgetCount,
    independentReader:"PyMuPDF",valuesAndAppearanceVerified:true,
    privateFormDataLogged:false,limitation:"One standard WinAnsi AcroForm fixture; not all PDF readers or fonts"}));
});

test("live Create Fillable PDF yields an editable widget that an independent PDF reader can reopen",async({page})=>{
  test.setTimeout(180000);
  const pdf=await PDFDocument.create();
  const sheet=pdf.addPage([612,792]);
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  sheet.drawText("SYNTHETIC FILLABLE BUILDER QA",{x:70,y:715,size:16,font});
  const input=Buffer.from(await pdf.save());

  await page.goto("/create-fillable-pdf",{waitUntil:"networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name:"SYNTHETIC_TASK193_BLANK.pdf",mimeType:"application/pdf",buffer:input,
  });
  await expect(page.getByAltText("PDF page 1")).toBeVisible();
  await page.getByLabel("Unique field name").fill("qa_name");
  const group=page.getByRole("group",{name:"New form field area on page 1"});
  await group.getByLabel("Left %").fill("14");
  await group.getByLabel("Top %").fill("20");
  await group.getByLabel("Width %").fill("56");
  await group.getByLabel("Height %").fill("9");
  await page.getByRole("button",{name:"Use this field area"}).click();
  await page.getByRole("button",{name:"Add field to page"}).click();
  const pending=page.waitForEvent("download",{timeout:120000});
  await page.getByRole("button",{name:"Create Fillable PDF"}).click();
  const downloaded=await pending;
  expect(downloaded.suggestedFilename()).toBe("SYNTHETIC_TASK193_BLANK-fillable.pdf");
  const path=await downloaded.path();
  expect(path).toBeTruthy();
  const verified=checkIndependent("created",path);
  expect(verified.widgetCount).toBe(1);
  expect(verified.externalEditorReopen).toBe(true);
  expect(verified.visibleTextInk).toBe(true);
  console.log(JSON.stringify({check:"LIVE_V1_FILLABLE_CREATE_INDEPENDENT",result:"PASS",
    syntheticOnly:true,widgetCount:1,independentReader:"PyMuPDF",
    createdWidgetCanBeEditedAndReopened:true,visibleAppearance:true,
    privateFormDataLogged:false,limitation:"One simple text widget without rotation; not external Adobe/Chrome certification"}));
});
