import { test, expect } from "@playwright/test";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

test.use({
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 900 },
});

async function buildPdf(withMarker) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 780]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("KUKUREKU SYNTHETIC VIEWER PROBE", {
    x: 75, y: 710, size: 13, font,
  });
  if (withMarker) {
    page.drawRectangle({
      x: 165, y: 390, width: 270, height: 170,
      color: rgb(0.05, 0.18, 0.96),
    });
  }
  return Buffer.from(await pdf.save());
}

test("Chrome Stable native PDF viewer visibly renders actual PDF content", async ({ page }) => {
  test.setTimeout(90000);
  const blank = await buildPdf(false);
  const marked = await buildPdf(true);
  const server = createServer((req, res) => {
    const selected = req.url === "/marked.pdf" ? marked : req.url === "/blank.pdf" ? blank : null;
    if (!selected) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Content-Length": String(selected.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(selected);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Local test server did not bind");
  const url = (filename) => "http://127.0.0.1:" + address.port + "/" + filename;
  const folder = "test-results/chrome-native-probe";
  mkdirSync(folder, { recursive: true });
  try {
    const observed = [];
    for (const filename of ["blank.pdf", "marked.pdf"]) {
      let navigationError = "";
      try {
        await page.goto(url(filename), { waitUntil: "load", timeout: 30000 });
      } catch (error) {
        // Some Chrome builds emit ERR_ABORTED while passing PDF handling
        // to the native viewer. Judge the actual screenshot, not this event.
        navigationError = error instanceof Error ? error.name : "navigation";
      }
      await page.waitForTimeout(2500);
      const path = folder + "/" + filename.replace(".pdf", ".png");
      await page.screenshot({ path, animations: "disabled" });
      observed.push({ filename, navigationError: navigationError || undefined, path });
    }
    const check = JSON.parse(execFileSync("python", [
      "scripts/checkChromeNativePdfPixels.py",
      observed[0].path, observed[1].path,
    ], { encoding: "utf8", timeout: 15000 }));
    // The sole assertion is viewer feasibility: distinctive blue content
    // appears in Chrome's PDF screenshot. It is NOT a clipping certification.
    expect(check.nativePdfContentVisible).toBe(true);
    console.log(JSON.stringify({
      check: "TASK195_NATIVE_CHROME_PDF_VIEWER_FEASIBILITY",
      result: "PASS", syntheticOnly: true,
      browserChannel: "chrome", headless: true,
      bluePixelsBlank: check.blankBluePixels,
      bluePixelsMarked: check.markedBluePixels,
      pngOnly: true,
      navigation: observed.map(v => ({
        doc: v.filename, navigationError: v.navigationError || null,
      })),
      limitation: "Proves renderer access only; does not verify AcroForm clipping, edit-save, page 2 or Chrome plugin controls",
    }));
  } finally {
    // The native PDF component can keep the local server connection alive.
    // Close this synthetic test's active connections before awaiting shutdown.
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
