import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

test.use({ channel: "chrome" });

// Raster-only synthetic notice: no selectable PDF text. The heading wraps
// across two lines; the existing single-line recovery used to reject it.
test("OCR TXT retains white multi-line banner title on an image-only scan", async ({ page }) => {
  test.setTimeout(180000);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1190;
    canvas.height = 1684;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#192f45";
    ctx.fillRect(0, 0, canvas.width, 335);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Arial";
    ctx.fillText("COMMUNITY SERVICE", 88, 100);
    ctx.fillText("BULLETIN", 88, 180);
    ctx.font = "bold 27px Arial";
    ctx.fillText("OCTOBER MAINTENANCE UPDATE", 88, 265);
    ctx.fillStyle = "#263648";
    ctx.font = "28px Arial";
    [
      "Notice ID: HX-2026-005",
      "Issued: 09 October 2026",
      "Maintenance date: Friday, 16 October 2026",
      "Water interruption: 09:00 AM to 12:30 PM",
      "Service areas: Halam Para, Nabagram, Kaskau Para",
      "Residents should store sufficient clean drinking water.",
      "Please keep taps closed during maintenance work.",
    ].forEach((line, index) => ctx.fillText(line, 88, 440 + index * 86));
    return canvas.toDataURL("image/png").split(",")[1];
  });

  const document = await PDFDocument.create();
  const raster = await document.embedPng(Buffer.from(base64, "base64"));
  document.addPage([595, 842]).drawImage(raster, {
    x: 0, y: 0, width: 595, height: 842,
  });
  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "synthetic-community-service-banner.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  const pending = page.waitForEvent("download", { timeout: 150000 });
  await page.getByRole("button", { name: "Run OCR and Download TXT" }).click();
  const download = await pending;
  const output = await readFile(await download.path(), "utf8");
  expect(output).toMatch(/COMMUNITY\s+SERVICE\s+BULLETIN/);
  expect(output).toContain("OCTOBER MAINTENANCE UPDATE");
  expect(output).toContain("HX-2026-005");
  expect((output.match(/COMMUNITY\s+SERVICE\s+BULLETIN/g) ?? [])).toHaveLength(1);
});
