import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";

test.use({ channel: "chrome" });

test("OCR TXT includes separate digital-source two-column preview, without discarding OCR", async ({ page }) => {
  test.setTimeout(180000);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sheet = doc.addPage([595, 842]);

  const left = [
    "QUARTERLY SERVICE REVIEW",
    "Report code: QSR-26-Q3",
    "Prepared: 05 October 2026",
    "Executive summary",
    "The sample service unit completed 184 requests.",
    "171 requests were closed within the internal target.",
    "Performance by month",
    "Month Received Closed",
    "July 58 54",
    "August 61 57",
    "September 65 60",
    "Key observations",
    "Follow-up cases should be reviewed weekly.",
  ];
  const right = [
    "AT A GLANCE",
    "184",
    "Requests received",
    "171",
    "Closed within target",
    "13",
    "Need follow-up",
    "Follow-up owners",
    "Operations: 5",
    "Field team: 4",
    "Records team: 4",
    "DATA NOTE",
    "Fictional figures for layout tests.",
  ];
  for (let i = 0; i < left.length; i++) {
    sheet.drawText(left[i], {
      x: 68, y: 770 - i * 27, size: 10,
      font: i === 0 || i === 3 ? bold : font, color: rgb(0.1, 0.1, 0.1),
    });
    sheet.drawText(right[i], {
      x: 386, y: 770 - i * 27, size: 10,
      font: i === 0 || i === 11 ? bold : font, color: rgb(0.1, 0.1, 0.1),
    });
  }
  await page.goto("/ocr-pdf");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "two-column-selectable-source.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  });
  const pending = page.waitForEvent("download", { timeout: 150000 });
  await page.getByRole("button", { name: "Run OCR and Download TXT" }).click();
  const download = await pending;
  const output = await readFile(await download.path(), "utf8");

  expect(output).toContain("[OPTIONAL PDF EMBEDDED TEXT - NOT OCR; VERIFY AGAINST PAGE]");
  expect(output).toContain("[EMBEDDED TEXT - LEFT CONTENT COLUMN]");
  expect(output).toContain("[EMBEDDED TEXT - RIGHT SIDEBAR]");
  const digitalSection = output.split("[OPTIONAL PDF EMBEDDED TEXT - NOT OCR; VERIFY AGAINST PAGE]")[1];
  const leftText = digitalSection.split("[EMBEDDED TEXT - RIGHT SIDEBAR]")[0];
  const rightText = digitalSection.split("[EMBEDDED TEXT - RIGHT SIDEBAR]")[1];

  expect(leftText).toContain("Executive summary");
  expect(leftText).toContain("July 58 54");
  expect(leftText).not.toContain("Requests received");
  expect(rightText).toContain("AT A GLANCE");
  expect(rightText).toContain("Field team: 4");
  expect(rightText).toContain("171");
});
