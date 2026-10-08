import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(root, "benchmarks/phase10_14/manifest.json"), "utf8"),
);
const rawDirectory = path.join(root, "benchmarks/phase10_14/reports/raw");

function tablesToRows(result) {
  if (!Array.isArray(result?.tables)) return [];
  // Largest confirmed V4 logical table; does not use reference values for selection.
  const candidates = result.tables.filter(table => Array.isArray(table?.rows));
  const table = [...candidates].sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!table) return [];
  return table.rows.map(row => {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    const width = Math.min(100, Math.max(table.columnCount ?? 0, ...cells.map(c => (c.columnIndex ?? -1) + 1), 0));
    const values = Array.from({ length: width }, () => "");
    for (const cell of cells) {
      if (Number.isInteger(cell.columnIndex) && cell.columnIndex >= 0 && cell.columnIndex < width) {
        values[cell.columnIndex] = String(cell.text ?? "");
      }
    }
    return values;
  });
}

for (const fixture of manifest.fixtures) {
  test("V4 real OCR baseline " + fixture.id, async ({ page }) => {
    test.setTimeout(300_000);
    const pdf = path.join(root, "test-fixtures/phase10_14", fixture.file);
    await page.goto("/engine-inspector");
    await page.locator('input[type="file"]').first().setInputFiles(pdf);
    const downloadButton = page.getByRole("button", {name:"Download complete result JSON"});
    await expect(downloadButton).toBeVisible({timeout:270_000});
    const downloadPromise = page.waitForEvent("download");
    await downloadButton.click();
    const download = await downloadPromise;
    const localPath = await download.path();
    if (!localPath) throw new Error("No V4 inspection JSON was downloaded");
    const analysis = JSON.parse(await readFile(localPath, "utf8"));
    // Exercise the actual user-facing CSV export on the same V4 extraction.
    if ((analysis.tables ?? []).length > 0) {
      const csvButton = page.getByRole("button", { name: /Export table 1 CSV/ });
      await expect(csvButton).toBeVisible();
      const csvDownloadPromise = page.waitForEvent("download");
      await csvButton.click();
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i);
      const csvPath = await csvDownload.path();
      if (!csvPath) throw new Error("V4 CSV download has no local file path");
      const csvText = await readFile(csvPath, "utf8");
      expect(csvText.length).toBeGreaterThan(20);
      expect(csvText).toContain("Rani Para Scheme");
    }
    const payload = {
      id: fixture.id,
      file: fixture.file,
      rows: tablesToRows(analysis),
      confirmedTableCount: analysis.tables?.length ?? 0,
      ocrAttempted: analysis.controlledOcrResult?.attempted ?? false,
      ocrProcessedPages: analysis.controlledOcrResult?.processedPageNumbers ?? [],
      timings: analysis.processingTimes ?? null,
      ocrWordDiagnostics: (analysis.controlledOcrResult?.pages ?? []).flatMap(
        page => (page.words ?? []).slice(0, 300).map(word => ({
          pageNumber:page.pageNumber,text:word.text,confidence:word.confidence,bounds:word.sourceBounds ?? word.bounds,
        })),
      ),
      source: "Browser V4 Inspector, controlled OCR enabled; largest detected logical table",
    };
    await mkdir(rawDirectory, { recursive: true });
    await writeFile(path.join(rawDirectory, fixture.id + ".json"), JSON.stringify(payload, null, 2) + "\n");
    // Baseline measures poor outcomes without hiding them.
    expect(Array.isArray(payload.rows)).toBe(true);
  });
}
