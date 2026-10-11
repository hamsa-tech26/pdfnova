import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

test("browser downloads real XLSX from an independent five-column PDF", async ({ page }) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sheet = pdf.addPage([900, 760]);
  const columns = [45, 120, 285, 450, 605];
  const rows = [
    ["Sl No", "Code", "Name", "Amount", "Remarks"],
    ...Array.from({length: 12}, (_, i) => [
      String(i+1), String(71+i).padStart(5,"0"),
      "Station " + (i+1), String(1000+i*11), "Reviewed " + (i+1),
    ]),
  ];
  rows.forEach((row, i) => row.forEach((cell,j) => {
    sheet.drawText(cell, {x:columns[j], y:690-i*36, size:12,font});
  }));
  const buffer = Buffer.from(await pdf.save());
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"R57_five_column_table.pdf", mimeType:"application/pdf", buffer,
  });
  const [download] = await Promise.all([
    page.waitForEvent("download", {timeout:120000}),
    page.getByRole("button", {name:/Convert to Excel/i}).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  expect(workbook).toContain('<sheet name="Table 1"');
  const worksheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  expect(worksheet).toContain("Station 12");
  expect(worksheet).toContain("00071");
  expect(worksheet).not.toContain("<f>");
  expect(worksheet).toMatch(/<dimension ref="A1:[A-Z]+1[0-9]"/);
  // The review sheet is intentionally separate from detected table sheets.
  expect(await zip.file("xl/worksheets/sheet2.xml")?.async("string"))
    .toContain("EXTRACTION NOT VERIFIED");
});
