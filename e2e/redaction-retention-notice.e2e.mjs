import {test, expect} from "@playwright/test";
import {PDFDocument} from "pdf-lib";

test("mobile redaction explains persistent local workspace and downloaded files", async ({page}) => {
  await page.setViewportSize({width: 390,height: 680});
  const source = await PDFDocument.create();
  source.addPage([320, 420]).drawText("SYNTHETIC_RETENTION_NOTICE", {
    x: 25,y: 330,size: 10,
  });
  await page.goto("/redact-pdf", {waitUntil: "networkidle"});
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "synthetic-retention-notice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await source.save()),
  });
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  await expect(page.getByText(/The generated copy may also be saved in this browser/)).toBeVisible();
  await expect(page.getByText(/Downloaded files and backups must be deleted separately/)).toBeVisible();
  await expect(page.getByRole("link",{name:"Workspace Health"})).toHaveAttribute("href","/workspace-health");
  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(2);
});
