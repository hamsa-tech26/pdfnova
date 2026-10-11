import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";

// Explicit Chrome Stable acceptance for public OCR TXT workflow.
test.use({ channel: "chrome" });

// Generated synthetic fixture, not a privately sourced real-world PDF.
test("Release 61 OCR exports the visible title and critical body values", async ({ page }) => {
  test.setTimeout(180000);
  const pdf = await PDFDocument.create();
  const pageOne = pdf.addPage([595, 842]);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pageOne.drawText("SERVICE VISIT NOTE", { x: 55, y: 770, font: titleFont, size: 24, color: rgb(0.10, 0.20, 0.29) });
  pageOne.drawLine({ start: { x: 55, y: 738 }, end: { x: 545, y: 738 }, thickness: 0.8 });
  for (const [i, row] of [
    "Reference number: SV-2048",
    "Customer: Mira Sen",
    "Visit date: 14 August 2026",
    "EQUIPMENT DETAILS",
    "Device: AquaFlow Pump Model AF-12",
    "Serial number: AF12-88421",
    "INSPECTION",
    "Inlet pressure measured at 2.4 bar.",
    "Outlet pressure measured at 3.1 bar.",
    "RESULT",
    "Technician: R. Das",
  ].entries()) {
    pageOne.drawText(row, { x: 55, y: 700 - i * 34, font, size: 14 });
  }

  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "release61-synthetic-service-note.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  const pending = page.waitForEvent("download", { timeout: 150000 });
  await page.getByRole("button", { name: "Run OCR and Download TXT" }).click();
  const download = await pending;
  const text = await readFile(await download.path(), "utf8");
  expect(text).toMatch(/SERVICE\s+VISIT\s+NOTE/);
  expect(text).toContain("SV-2048");
  expect(text).toContain("AF12-88421");
  expect(text).toContain("2.4 bar");
  expect(text).toContain("3.1 bar");
  expect((text.match(/SERVICE\s+VISIT\s+NOTE/g) ?? [])).toHaveLength(1);
});


// Image-only raster fixture: unlike text-PDF tests, no native selectable
// PDF text is available. All visible words must come from optical recognition.
// Its geometry mirrors the original synthetic scan without committing that
// user-supplied PDF or its pixels to the repository.
test("Release 61 image-only scanned page preserves the title and identifier in downloaded TXT", async ({ page }) => {
  test.setTimeout(180000);
  const raster = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1190;
    canvas.height = 1684;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#141414";
    ctx.font = "bold 31px Arial";
    ctx.fillText("SERVICE VISIT NOTE", 75, 147);
    ctx.fillStyle = "#242424";
    ctx.fillRect(75, 193, 1040, 2);
    ctx.font = "21px Arial";
    const rows = [
      "Reference number: SV-2048",
      "Customer: Mira Sen",
      "Visit date: 14 August 2026",
      "EQUIPMENT DETAILS",
      "Device: AquaFlow Pump Model AF-12",
      "Serial number: AF12-88421",
      "Reported issue: Intermittent vibration during start-up.",
      "INSPECTION",
      "Inlet pressure measured at 2.4 bar.",
      "Outlet pressure measured at 3.1 bar.",
      "Filter condition: Clean",
      "Action taken: Tightened mounting bolts and tested twice.",
      "RESULT",
      "Status: Monitor for seven days.",
      "Next review: 21 August 2026",
      "Technician: R. Das",
    ];
    rows.forEach((row, i) => ctx.fillText(row, 75, 270 + i * 62));
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(raster, "base64"));
  const paper = pdf.addPage([595, 842]);
  paper.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });

  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "release61-raster-only-synthetic-scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  const pending = page.waitForEvent("download", { timeout: 150000 });
  await page.getByRole("button", { name: "Run OCR and Download TXT" }).click();
  const download = await pending;
  const text = await readFile(await download.path(), "utf8");
  expect(text).toMatch(/SERVICE\s+VISIT\s+NOTE/);
  expect(text).toContain("SV-2048");
  expect(text).toContain("Mira Sen");
  expect(text).toContain("AF12-88421");
  expect((text.match(/SERVICE\s+VISIT\s+NOTE/g) ?? [])).toHaveLength(1);
});
