import { test, expect } from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
const routes=[
  {href:"/rotate-pdf",prompt:"PDF could not be selected"},
  {href:"/reverse-pdf",prompt:"PDF could not be selected"},
  {href:"/remove-pdf-metadata",prompt:"PDF could not be selected"},
  {href:"/pdf-to-text",prompt:"PDF could not be selected"},
  {href:"/ocr-pdf",prompt:"PDF could not be selected"},
  {href:"/merge-pdf",prompt:"PDF files could not be selected"},
];
async function samplePdf(){
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([612,792]).drawText("KUKUREKU BROWSER LOCAL FIXTURE",{x:40,y:640,font,size:14});
  return Buffer.from(await pdf.save());
}
test("invalid selections are visible and users can recover without losing the upload control",async({page})=>{
  test.setTimeout(180_000);
  const bytes=await samplePdf();
  for(const {href,prompt} of routes){
    await page.goto(href);
    const field=page.locator('input[type="file"]').first();
    await expect(field,href+" file selector").toHaveCount(1);
    await field.setInputFiles({name:"not-a-pdf.txt",mimeType:"text/plain",buffer:Buffer.from("invalid")});
    const alert=page.getByRole("alert").filter({hasText:prompt});
    await expect(alert,href+" input error").toBeVisible();
    await expect(alert,href+" descriptive error").toContainText(href==="/merge-pdf" ? "not-a-pdf.txt is not a supported PDF file." : "Please select a valid PDF file.");
    await alert.getByRole("button",{name:/Choose Another PDF|Choose Other PDFs/}).click();
    await expect(alert).toHaveCount(0);
    await field.setInputFiles({name:"recovered.pdf",mimeType:"application/pdf",buffer:bytes});
    if(href==="/merge-pdf") await expect(page.getByText("recovered.pdf").first()).toBeVisible();
    else await expect(page.getByText("recovered.pdf").first()).toBeVisible();
  }
});

test("image converters keep file-rejection messages visible and allow a corrected selection",async({page})=>{
  test.setTimeout(120_000);
  const pdf=await samplePdf();
  await page.goto("/jpg-to-pdf");
  let input=page.locator('input[type="file"]').first();
  await input.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("not image")});
  let alert=page.getByRole("alert").filter({hasText:"Image processing needs attention"});
  await expect(alert).toBeVisible();
  await alert.getByRole("button",{name:"Dismiss Error"}).click();
  await expect(alert).toHaveCount(0);
  const oneByOnePng=Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3x8AAAAASUVORK5CYII=",
    "base64");
  await input.setInputFiles({name:"recovered.png",mimeType:"image/png",buffer:oneByOnePng});
  await expect(page.getByText("recovered.png").first()).toBeVisible();

  await page.goto("/pdf-to-jpg");
  input=page.locator('input[type="file"]').first();
  await input.setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("not pdf")});
  alert=page.getByRole("alert").filter({hasText:"PDF processing needs attention"});
  await expect(alert).toContainText("Please select a valid PDF file.");
  await alert.getByRole("button",{name:"Dismiss Error"}).click();
  await input.setInputFiles({name:"recovered.pdf",mimeType:"application/pdf",buffer:pdf});
  await expect(page.getByText("recovered.pdf").first()).toBeVisible();
});
