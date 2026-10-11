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
