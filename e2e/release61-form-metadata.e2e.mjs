import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";

// Use installed Google Chrome Stable for the download and appearance-metric
// acceptance tests, not only Playwright's default Chromium build.
test.use({ channel: "chrome" });

// Both cases use generated test PDFs and inspect actual downloaded bytes.
async function twoPageFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) {
    const p = pdf.addPage([595, 842]);
    p.drawText("RELEASE61 SOURCE PAGE " + i, { x: 55, y: 770, size: 16, font });
  }
  return Buffer.from(await pdf.save());
}

test("Release 61 browser form creation exports fields whose default text fits their geometry", async ({ page }) => {
  test.setTimeout(180000);
  const source = await twoPageFixture();
  await page.goto("/create-fillable-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "release61-form.pdf",
    mimeType: "application/pdf",
    buffer: source,
  });
  await expect(page.getByRole("button", { name: "Use this field area" })).toBeEnabled({ timeout: 45000 });

  await page.getByLabel("Unique field name").fill("Test_Name");
  await page.getByRole("button", { name: "Use this field area" }).click();
  await page.getByRole("button", { name: "Add field to page" }).click();

  await page.getByLabel("PDF page").selectOption("2");
  await expect(page.getByRole("button", { name: "Use this field area" })).toBeEnabled({ timeout: 45000 });
  await page.getByLabel("Unique field name").fill("Test_Designation");
  await page.getByRole("button", { name: "Use this field area" }).click();
  await page.getByRole("button", { name: "Add field to page" }).click();

  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create Fillable PDF" }).click();
  const downloaded = await pending;
  const result = await PDFDocument.load(await readFile(await downloaded.path()));
  expect(result.getPageCount()).toBe(2);
  const form = result.getForm();
  const name = form.getTextField("Test_Name");
  const designation = form.getTextField("Test_Designation");
  expect(name.acroField.getDefaultAppearance()).toContain("12 Tf");
  expect(designation.acroField.getDefaultAppearance()).toContain("12 Tf");
  const font = await result.embedFont(StandardFonts.Helvetica);
  const widget = name.acroField.getWidgets()[0].getRectangle();
  expect(font.widthOfTextAtSize("Kukureku Test User", 12)).toBeLessThan(widget.width - 4);
  name.setText("Kukureku Test User");
  designation.setText("Junior Engineer");
  const saved = await PDFDocument.load(await result.save());
  expect(saved.getForm().getTextField("Test_Name").getText()).toBe("Kukureku Test User");
  expect(saved.getForm().getTextField("Test_Designation").getText()).toBe("Junior Engineer");
});

test("Release 61 metadata editor downloaded PDF preserves visible comma boundaries", async ({ page }) => {
  const source = await twoPageFixture();
  await page.goto("/edit-pdf-metadata");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "release61-metadata.pdf",
    mimeType: "application/pdf",
    buffer: source,
  });
  await page.getByLabel("Keywords").fill("water, report, 2026");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Metadata and Download" }).click();
  const download = await pending;
  const result = await PDFDocument.load(await readFile(await download.path()), { updateMetadata: false });
  expect(result.getPageCount()).toBe(2);
  expect(result.getKeywords()).toBe("water, report, 2026");
  expect(result.getPage(0).getWidth()).toBe(595);
  expect(result.getPage(1).getWidth()).toBe(595);
});
