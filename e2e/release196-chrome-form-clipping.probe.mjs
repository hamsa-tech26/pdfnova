import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

test.use({ channel: "chrome", headless: true, viewport: { width: 1280, height: 900 } });

test("native Google Chrome visually displays Kukureku's saved first-page AcroForm text", async ({ page }) => {
  test.setTimeout(180000);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 2; index++) {
    const sheet = pdf.addPage([595, 842]);
    sheet.drawText("SYNTHETIC TASK 196 PAGE " + (index + 1), {
      x: 60, y: 760, size: 13, font,
    });
    if (index === 0) {
      // A vivid registration frame is embedded in the SOURCE page.
      // It allows independent screenshot alignment without using OCR.
      sheet.drawRectangle({
        x: 75, y: 510, width: 340, height: 65,
        borderWidth: 2, borderColor: rgb(0.96, 0.02, 0.02),
      });
    }
  }
  const source = Buffer.from(await pdf.save());

  await page.goto("https://kukureku.com/create-fillable-pdf", { waitUntil: "networkidle", timeout: 45000 });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "SYNTHETIC_TASK196_TWO_PAGES.pdf",
    mimeType: "application/pdf", buffer: source,
  });

  async function addTextField(name, pageNo) {
    await expect(page.getByAltText("PDF page " + pageNo)).toBeVisible();
    await page.getByLabel("Unique field name").fill(name);
    const box = page.getByRole("group", { name: "New form field area on page " + pageNo });
    await box.getByLabel("Left %").fill("15");
    await box.getByLabel("Top %").fill("33");
    await box.getByLabel("Width %").fill("52");
    await box.getByLabel("Height %").fill("6");
    await page.getByRole("button", { name: "Use this field area" }).click();
    await page.getByRole("button", { name: "Add field to page" }).click();
  }

  await addTextField("Test_Name", 1);
  await page.getByRole("combobox", { name: "PDF page" }).selectOption("2");
  await addTextField("Test_Designation", 2);

  const emptyPending = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: "Create Fillable PDF" }).click();
  const emptyDownload = await emptyPending;
  const emptyBytes = await readFile(await emptyDownload.path());

  await page.goto("https://kukureku.com/pdf-form-filler", { waitUntil: "networkidle", timeout: 45000 });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "SYNTHETIC_TASK196-fillable.pdf",
    mimeType: "application/pdf", buffer: emptyBytes,
  });
  await page.getByLabel("Test_Name", { exact: true }).fill("Kukureku Test User");
  await page.getByLabel("Test_Designation", { exact: true }).fill("Junior Engineer");
  const filledPending = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: "Fill and Download PDF" }).click();
  const filledDownload = await filledPending;
  const filledBytes = await readFile(await filledDownload.path());

  const decoded = await PDFDocument.load(filledBytes);
  expect(decoded.getPageCount()).toBe(2);
  expect(decoded.getForm().getTextField("Test_Name").getText()).toBe("Kukureku Test User");
  expect(decoded.getForm().getTextField("Test_Designation").getText()).toBe("Junior Engineer");

  // These exact PDF bytes come from Kukureku's live Create and Fill tools.
  // Chrome's *native PDF viewer* renders them, not pdf.js or PyMuPDF.
  const server = createServer((req, res) => {
    const selected = req.url?.includes("filled=1") ? filledBytes : emptyBytes;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=form.pdf",
      "Content-Length": String(selected.length),
      "Cache-Control": "no-store",
    });
    res.end(selected);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Local synthetic PDF server failed to bind");

  const folder = "test-results/chrome-native-probe";
  mkdirSync(folder, { recursive: true });
  const nativeViewer = await page.context().newPage();
  try {
    for (const [variant, suffix] of [["empty", "filled=0"], ["filled", "filled=1"]]) {
      await nativeViewer.goto("http://127.0.0.1:" + address.port + "/form.pdf?" + suffix, {
        waitUntil: "load", timeout: 30000,
      });
      await nativeViewer.waitForTimeout(2500);
      await nativeViewer.screenshot({ path: folder + "/form-" + variant + ".png" });
    }
    const result = JSON.parse(execFileSync("python", [
      "scripts/checkChromeFormInk.py",
      folder + "/form-empty.png",
      folder + "/form-filled.png",
    ], { encoding: "utf8", timeout: 15000 }));
    expect(result.visibleTextChange).toBe(true);
    console.log(JSON.stringify({
      check: "TASK196_LIVE_KUKUREKU_FORM_NATIVE_CHROME",
      result: "PASS",
      nativeChromePdfViewer: true,
      savedTwoPageValuesPreserved: true,
      visibleFirstPageInk: result.visibleTextChange,
      measuredInkSamples: result.newDarkSamples,
      measuredInkHorizontalSpan: result.newInkHorizontalSpan,
      syntheticOnly: true,
      limitation: "Not proof that every glyph is visible or that Chrome native edit/save works; no original T02 source",
    }));
  } finally {
    await nativeViewer.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
