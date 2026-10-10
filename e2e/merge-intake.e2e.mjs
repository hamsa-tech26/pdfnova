import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function createPdf(label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(label, { x: 32, y: 700, font, size: 14 });
  return Buffer.from(await doc.save());
}

test("Merge PDF disables intake and edits while validating a local PDF", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return original.call(this);
    };
  });
  const first = await createPdf("SOURCE ONE");
  const second = await createPdf("SOURCE TWO");
  await page.goto("/merge-pdf");
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: "source-one.pdf", mimeType: "application/pdf", buffer: first });

  await expect(page.getByRole("status").filter({ hasText: "Validating your selected PDFs locally" })).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByText("source-one.pdf").first()).toBeVisible();

  await input.setInputFiles({ name: "source-two.pdf", mimeType: "application/pdf", buffer: second });
  await expect(page.getByText("source-two.pdf").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge and Download PDF" })).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Merge and Download PDF" }).click();
  const result = await downloaded;
  expect(result.suggestedFilename()).toBe("kukureku-merged.pdf");
  const reader = await PDFDocument.load(await (await import("node:fs/promises")).readFile(await result.path()));
  expect(reader.getPageCount()).toBe(2);
  await expect(page.getByText("Saved as a new composed document in this browser workspace")).toBeVisible();
});
