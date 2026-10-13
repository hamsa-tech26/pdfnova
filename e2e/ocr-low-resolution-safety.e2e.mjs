import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

test.use({ channel: "chrome" });

// Raster-only low-resolution synthetic document built inside the browser.
// The private/user-supplied original PDF or its pixels are NOT checked in.
// This is a safety regression, NOT a claim that low-res OCR is accurate.
test("image-only low-res OCR does not export a misleading full-page enhanced transcript", async ({ page }) => {
  test.setTimeout(180000);
  const raster = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 499;
    canvas.height = 707;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.fillStyle = "#faf9f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1d2836";
    ctx.font = "bold 20px Arial";
    ctx.fillText("DELIVERY CONFIRMATION", 36, 54);
    ctx.font = "13px Arial";
    const rows = [
      "Record ID: DC-7316",
      "Delivery date: 03 September 2026",
      "Destination: Northfield Learning Centre",
      "PACKAGE SUMMARY",
      "Package code: BX-09",
      "Items expected: 24",
      "Items received: 23",
      "Damaged items: 2",
      "FOLLOW-UP",
      "One item is missing and two items have damaged corners.",
      "Photographs were recorded under case PH-118.",
      "Prepared by: A. Roy",
    ];
    rows.forEach((text, i) => ctx.fillText(text, 38, 104 + i * 27));
    return canvas.toDataURL("image/png").split(",")[1];
  });

  const doc = await PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(raster, "base64"));
  const sheet = doc.addPage([595, 842]);
  sheet.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });

  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "synthetic-lowres-image-only.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  });
  const pending = page.waitForEvent("download", { timeout: 150000 });
  await page.getByRole("button", { name: "Run OCR and Download TXT" }).click();
  const download = await pending;
  const output = await readFile(await download.path(), "utf8");
  expect(output).toContain("--- Page 1 ---");
  expect(output).toMatch(/DELIVERY\s+CONFIRMATION/);
  expect(output).not.toContain("[OPTIONAL IMAGE-ENHANCED LOW-RES OCR");
  expect(output).not.toContain("Image-enhanced OCR offers a different");
  if (output.includes("[OPTIONAL TARGETED IDENTIFIER OCR")) {
    expect(output).toContain("NOT VERIFIED");
    expect(output).toContain("Original OCR above is unchanged");
  }
});
