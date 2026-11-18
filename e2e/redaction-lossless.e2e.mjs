import {test, expect} from "@playwright/test";
import {PDFDocument, PDFName, PDFNumber, StandardFonts, degrees, rgb} from "pdf-lib";
import {verifyRasterDownload} from "./helpers/redactionRaster.mjs";

test("download preserves every unselected raster pixel and masks fractional edges on cropped rotated pages", async ({page}) => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  for (const rotation of [0, 90, 180, 270, 0]) {
    const p = source.addPage([240, 200]);
    p.setCropBox(13, 17, 211, 163);
    p.setRotation(degrees(rotation));
    p.drawRectangle({x: 0, y: 0, width: 240, height: 200, color: rgb(1, 1, 1)});
    // High-frequency color and glyph edges expose lossy JPEG changes.
    for (let x = 13; x < 224; x += 5) {
      p.drawRectangle({x, y: 17, width: 2, height: 163, color: rgb(1, 0, 0.5)});
    }
    p.drawText("SOURCE_SECRET_PUBLIC", {x: 21, y: 94, size: 11, font});
  }
  const clipped = source.addPage([240, 200]);
  clipped.setCropBox(-20, -10, 300, 230);
  clipped.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
  clipped.setRotation(degrees(90));
  clipped.drawText("CLIPPED_SCALED_SOURCE", {x: 15, y: 100, size: 11, font});
  const bytes = await source.save();
  await page.goto("/redact-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "cropped-rotated.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes),
  });
  const masks = [
    [[0.105, 0.205, 0.205, 0.305]],
    [[0, 0, 0.17, 0.23]],
    [[0.825, 0.775, 0.175, 0.225]],
    [[0.105, 0.205, 0.205, 0.305], [0.2, 0.3, 0.4, 0.2]],
    [],
    [],
  ];
  for (let index = 0; index < masks.length; index++) {
    if (!masks[index].length) continue;
    if (index) await page.getByRole("combobox", {name: "Page", exact: true}).selectOption(String(index + 1));
    await expect(page.getByAltText(`PDF page ${index + 1} preview`)).toBeVisible();
    const controls = page.getByRole("group", {name: `Redaction area on page ${index + 1}`});
    for (const rect of masks[index]) {
      for (const [i, label] of ["Left %", "Top %", "Width %", "Height %"].entries()) {
        await controls.getByLabel(label, {exact: true}).fill(String(rect[i] * 100));
      }
      await page.getByRole("button", {name: "Add redaction area", exact: true}).click();
    }
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {name: "Redact and Download PDF"}).click(),
  ]);

  await verifyRasterDownload({page, bytes, masks, download, testInfo: test.info()});
});
