import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const referenceDirectory = process.env.KUKUREKU_TABLE_REFERENCE_DIR;
const expectedRows = [
  ["Cycle Name", "KI (1/km)", "Distance (mi)",
    "Percent Fuel Savings / Improved Speed",
    "Percent Fuel Savings / Decreased Accel",
    "Percent Fuel Savings / Eliminate Stops",
    "Percent Fuel Savings / Decreased Idle"],
  ["2012_2", "3.30", "1.3", "5.9%", "9.5%", "29.2%", "17.4%"],
  ["2145_1", "0.68", "11.2", "2.4%", "0.1%", "9.5%", "2.7%"],
  ["4234_1", "0.59", "58.7", "8.5%", "1.3%", "8.5%", "3.3%"],
  ["2032_2", "0.17", "57.8", "21.7%", "0.3%", "2.7%", "1.2%"],
  ["4171_1", "0.07", "173.9", "58.1%", "1.6%", "2.1%", "0.5%"],
];

test("Task 135 public NREL grouped header stays review-only and downloads source-aligned XLSX", async ({ page }) => {
  test.skip(!referenceDirectory, "Requires locally cached SHA-pinned public reference PDF");
  const pdf = await readFile(join(referenceDirectory, "nrel.pdf"));
  expect(createHash("sha256").update(pdf).digest("hex")).toBe(
    "7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82",
  );
  await page.goto("/pdf-to-excel");
  await page.locator('input[type="file"]').setInputFiles({
    name: "nrel.pdf", mimeType: "application/pdf", buffer: pdf,
  });
  await page.getByRole("button", { name: "Inspect & choose a table" }).click();
  const option = page.locator('input[name="pdf-table-selection"][value="0"]');
  await expect(option).toBeEnabled({timeout: 60000});
  await option.check();
  const firstHeading = page.getByRole("button", { name: "Inspect exact cell D1" });
  await expect(firstHeading).toHaveText("Percent Fuel Savings / Improved Speed");
  await expect(page.getByRole("button", { name: "Inspect exact cell G1" }))
    .toHaveText("Percent Fuel Savings / Decreased Idle");
  const exportButton = page.getByRole("button", { name: "Export selected table (.xlsx)" });
  await expect(exportButton).toBeDisabled();
  await page.getByRole("checkbox", { name: "Acknowledge scientific table source review" }).check();
  await expect(exportButton).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 120000 }),
    exportButton.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-table-1\.xlsx$/);
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const independent = execFileSync("python", ["-c", [
    "import sys,io,json",
    "from openpyxl import load_workbook",
    "expected=json.loads(sys.argv[2])",
    "wb=load_workbook(io.BytesIO(open(sys.argv[1],'rb').read()),read_only=True,data_only=False)",
    "sheet=wb['Selected Table 1']",
    "actual=[list(row) for row in sheet.values]",
    "assert actual==expected, '42 source-positioned XLSX cells mismatch'",
    "assert all(cell.data_type!='f' for row in sheet for cell in row), 'formula execution'",
    "assert wb['Review Notes']['A1'].value.startswith('EXTRACTION NOT VERIFIED')",
    "assert any('four geometrically aligned child labels' in str(cell.value) for row in wb['Review Notes'] for cell in row)",
    "print('NREL_REVIEWED_XLSX_42_OF_42_OK')",
  ].join(";"), downloadedPath, JSON.stringify(expectedRows)], {
    encoding: "utf8", timeout: 20000,
  });
  expect(independent.trim()).toBe("NREL_REVIEWED_XLSX_42_OF_42_OK");
});
