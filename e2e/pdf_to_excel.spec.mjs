import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { execFileSync } from "node:child_process";

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

  // Separate OOXML implementation reads actual downloaded file;
  // ZIP string inspection alone does not establish Excel interoperability.
  const independentlyParsed = execFileSync("python", [
    "-c",
    "import sys; from openpyxl import load_workbook; " +
      "w=load_workbook(sys.argv[1], read_only=True, data_only=False); " +
      "s=w['Table 1']; r=list(s.values); " +
      "assert any(len(x)>=5 and x[1]=='00071' and x[2]=='Station 1' and x[3]=='1000' for x in r), 'row/column mismatch'; " +
      "assert any(len(x)>=5 and x[2]=='Station 12' for x in r), 'missing final row'; " +
      "assert w['Review Notes']['A1'].value.startswith('EXTRACTION NOT VERIFIED'); print('OPENPYXL_OK')",
    path,
  ], {encoding:"utf8"}).trim();
  expect(independentlyParsed).toContain("OPENPYXL_OK");
});


test("scanned-only or empty PDF is explicitly rejected without an XLSX download", async ({page}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 400]).drawRectangle({x:50,y:50,width:450,height:200});
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name:"R57_scanned_only.pdf", mimeType:"application/pdf",
    buffer:Buffer.from(await pdf.save()),
  });
  let wasDownloaded = false;
  page.on("download", () => { wasDownloaded = true; });
  await page.getByRole("button", {name:/Convert to Excel/i}).click();
  await expect(page.getByText(/image-only or low-text pages/)).toBeVisible();
  expect(wasDownloaded).toBe(false);
});
