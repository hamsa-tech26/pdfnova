import {test,expect} from "@playwright/test";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {readFile} from "node:fs/promises";

const taskRoutes=[
  "/merge-pdf","/compress-pdf","/sign-pdf","/pdf-form-filler",
  "/organize-pdf","/ocr-pdf"
];

for(const width of [320,390,768,1440]){
  test(`Task 206: ${width}px homepage offers six usable task choices without overflow`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto("/");
    const chooser=page.locator("#choose-task");
    await expect(chooser.getByRole("heading",{name:"What do you need to do with your PDF?"})).toBeVisible();
    for(const href of taskRoutes)await expect(chooser.locator(`a[href="${href}"]`)).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole("navigation",{name:"Primary navigation"}).getByRole("link",{name:"AI PDF"})).toHaveCount(0);
  });
}

test("Task 206: skip link is the first keyboard stop and reaches main content",async({page})=>{
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip=page.getByRole("link",{name:"Skip to main content"});
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("main").first()).toBeFocused();
  await expect(page.locator("main").first()).toHaveAttribute("tabindex","-1");
});

test("Task 206: mobile navigation offers chooser and useful guide",async({page})=>{
  await page.setViewportSize({width:320,height:680});
  await page.goto("/");
  await page.getByRole("button",{name:"Open site menu"}).click();
  await page.getByRole("navigation",{name:"Mobile primary navigation"})
    .getByRole("link",{name:"Choose a tool"}).click();
  await expect(page).toHaveURL(/#choose-task$/);
  await page.locator('#choose-task a[href="/guides/choose-pdf-tool"]').click();
  await expect(page.getByRole("heading",{name:"Which PDF tool should I use?"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Open OCR PDF"})).toHaveAttribute("href","/ocr-pdf");
});

test("Task 206: homepage to merged output to next tool works with real synthetic PDF bytes",async({page})=>{
  test.setTimeout(120000);
  await page.goto("/");
  await page.locator('#choose-task a[href="/merge-pdf"]').click();
  await expect(page).toHaveURL(/\/merge-pdf$/);
  const uploads=[];
  for(const name of ["ALPHA","BETA"]){
    const document=await PDFDocument.create();
    const font=await document.embedFont(StandardFonts.Helvetica);
    document.addPage([400,600]).drawText(name,{x:40,y:510,font,size:18});
    uploads.push({name:`${name.toLowerCase()}.pdf`,mimeType:"application/pdf",buffer:Buffer.from(await document.save())});
  }
  await page.locator('input[type="file"]').first().setInputFiles(uploads);
  const button=page.getByRole("button",{name:"Merge and Download PDF"});
  await expect(button).toBeEnabled();
  const promise=page.waitForEvent("download",{timeout:60000});
  await button.click();
  const download=await promise;
  const bytes=await readFile(await download.path());
  const merged=await PDFDocument.load(bytes);
  expect(merged.getPageCount()).toBe(2);
  await expect(page.getByText("Before you share:",{exact:false})).toBeVisible();
  await expect(page.getByRole("link",{name:"Choose another PDF tool"})).toHaveAttribute("href","/dashboard#all-tools");
});

test("Task 206: tool picker has descriptive accessible input hints",async({page})=>{
  await page.goto("/compress-pdf");
  const input=page.locator('input[type="file"]').first();
  await expect(input).toHaveAttribute("aria-label","Select a file");
  const hintIds=await input.getAttribute("aria-describedby");
  expect(hintIds?.split(" ").length).toBe(2);
  for(const id of hintIds.split(" "))await expect(page.locator(`[id="${id}"]`)).toBeAttached();
});
