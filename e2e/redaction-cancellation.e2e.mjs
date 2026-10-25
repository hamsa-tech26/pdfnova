import {test, expect} from "@playwright/test";
import {PDFDocument, PDFName} from "pdf-lib";

test("Cancel redaction withholds a pending source, retains masks, and permits a complete retry", async ({page}) => {
  const source = await PDFDocument.create();
  for (let i = 0; i < 4; i++) source.addPage([480, 640]).drawText("CANCELLATION CONTROL " + i);
  const buffer = Buffer.from(await source.save());
  await page.addInitScript(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (window.__delayRedactionRead) await new Promise(resolve => setTimeout(resolve, 700));
      return read.call(this);
    };
  });
  await page.goto("/redact-pdf");
  await page.locator('input[type="file"]').setInputFiles({name: "cancel.pdf", mimeType: "application/pdf", buffer});
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls = page.getByRole("group", {name: "Redaction area on page 1"});
  for (const [label, value] of [["Left %", "10"], ["Top %", "10"], ["Width %", "20"], ["Height %", "20"]]) {
    await controls.getByLabel(label, {exact: true}).fill(value);
  }
  await page.getByRole("button", {name: "Add redaction area", exact: true}).click();
  const downloads = [];
  page.on("download", d => downloads.push(d.suggestedFilename()));
  await page.evaluate(() => { window.__delayRedactionRead = true; });
  await page.getByRole("button", {name: "Redact and Download PDF"}).click();
  await page.getByRole("button", {name: "Cancel redaction", exact: true}).click();
  await expect(page.getByRole("status").filter({hasText: "Redaction cancelled."})).toBeVisible();
  expect(downloads).toEqual([]);
  await page.evaluate(() => { window.__delayRedactionRead = false; });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {name: "Redact and Download PDF"}).click(),
  ]);
  const {readFile} = await import("node:fs/promises");
  expect((await PDFDocument.load(await readFile(await download.path()))).getPageCount()).toBe(4);
  expect(downloads).toHaveLength(1);
});

test("oversized declared source image is refused before preview decoding or export", async ({page}) => {
  const source = await PDFDocument.create();
  const image = source.context.register(source.context.stream(new Uint8Array([0]), {
    Type: "XObject", Subtype: "Image", Width: 8400, Height: 5100,
    ColorSpace: "DeviceRGB", BitsPerComponent: 8,
  }));
  const p = source.addPage([1008, 612]);
  p.node.setXObject(PDFName.of("Oversized"), image);
  const downloads = [];
  page.on("download", d => downloads.push(d.suggestedFilename()));
  await page.goto("/redact-pdf");
  await page.locator('input[type="file"]').setInputFiles({name: "large-image.pdf", mimeType: "application/pdf", buffer: Buffer.from(await source.save())});
  await expect(page.getByText(/source-image memory budget/)).toBeVisible();
  await expect(page.getByAltText("PDF page 1 preview")).toHaveCount(0);
  expect(downloads).toEqual([]);
});
