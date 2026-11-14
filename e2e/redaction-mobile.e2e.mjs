import {test, expect} from "@playwright/test";
import {PDFDocument} from "pdf-lib";
import {readFile} from "node:fs/promises";

for (const width of [320, 390]) {
  test(`redaction remains operable on a ${width}px mobile viewport`, async ({page}) => {
    test.setTimeout(180_000);
    await page.setViewportSize({width, height: 680});
    const source = await PDFDocument.create();
    source.addPage([360, 480]).drawText("SYNTHETIC_REDACTION_MOBILE", {
      x: 32, y: 390, size: 14,
    });

    await page.goto("/redact-pdf", {waitUntil: "networkidle"});
    await page.locator('input[type="file"]').setInputFiles({
      name: "synthetic-mobile.pdf", mimeType: "application/pdf",
      buffer: Buffer.from(await source.save()),
    });
    await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();

    const controls = page.getByRole("group", {name: "Redaction area on page 1"});
    await controls.scrollIntoViewIfNeeded();
    for (const [label, value] of [
      ["Left %", "10"], ["Top %", "10"], ["Width %", "40"], ["Height %", "30"],
    ]) {
      const input = controls.getByLabel(label, {exact: true});
      await expect(input).toBeVisible();
      await input.fill(value);
    }
    await page.getByRole("button", {name: "Add redaction area", exact: true}).click();
    await expect(page.getByText(/1 redaction area marked/)).toBeVisible();
    await expect(page.getByText(/The generated copy may also be saved in this browser/)).toBeVisible();
    await expect(page.getByRole("link", {name: "Workspace Health"})).toHaveAttribute("href", "/workspace-health");

    // Check the actual narrow viewport, then follow the visible mobile export path.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `Unexpected horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);

    const [download] = await Promise.all([
      page.waitForEvent("download", {timeout: 90000}),
      page.getByRole("button", {name: "Redact and Download PDF"}).click(),
    ]);
    const saved = await readFile(await download.path());
    expect((await PDFDocument.load(saved)).getPageCount()).toBe(1);
    await expect(page.getByText("Your redacted PDF is ready")).toBeVisible();
  });
}
