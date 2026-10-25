import {test, expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {verifyRasterDownload} from "./helpers/redactionRaster.mjs";

test("actual USGS PDF redaction removes selected raster and preserves all remaining rendered pixels", async ({page}) => {
  const root = "benchmarks/release37/private/usgs-ofr20241025";
  const metadata = JSON.parse(await readFile(root + "-metadata.json", "utf8"));
  const bytes = await readFile(root + "-pilot.pdf");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(metadata.subsetSha256);
  expect(metadata.selectedPageNumbers).toEqual([14, 17, 18, 19, 20]);
  expect(metadata.realDocumentCountCredit).toBe(0);
  await page.goto("/redact-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "publisher-pilot.pdf", mimeType: "application/pdf", buffer: bytes,
  });
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls = page.getByRole("group", {name: "Redaction area on page 1"});
  for (const [label, value] of [["Left %", "0"], ["Top %", "0"], ["Width %", "100"], ["Height %", "100"]]) {
    await controls.getByLabel(label, {exact: true}).fill(value);
  }
  await page.getByRole("button", {name: "Add redaction area", exact: true}).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {name: "Redact and Download PDF"}).click(),
  ]);
  await verifyRasterDownload({page, bytes, masks: [[[0, 0, 1, 1]], [], [], [], []],
    download, testInfo: test.info()});
  console.log("PUBLIC_REDACTION_SOURCE " + JSON.stringify({
    sourceSha256: metadata.sourceSha256, subsetSha256: metadata.subsetSha256,
    pages: 5, independentlyAcceptedDocuments: 0,
  }));
});
