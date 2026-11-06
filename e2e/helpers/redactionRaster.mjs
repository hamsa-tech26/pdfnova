import {expect} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

export async function verifyRasterDownload({page, bytes, masks, download, testInfo}) {
  // Test-only local routes expose the unmodified PDF.js renderer, never an app API.
  await page.route("**/__raster_reference.mjs", route => route.fulfill({
    path: "node_modules/pdfjs-dist/legacy/build/pdf.mjs", contentType: "text/javascript",
  }));
  await page.route("**/__raster_worker.mjs", route => route.fulfill({
    path: "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", contentType: "text/javascript",
  }));
  const references = await page.evaluate(async sourceBytes => {
    const pdfjs = await import("/__raster_reference.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/__raster_worker.mjs";
    const task = pdfjs.getDocument({data: new Uint8Array(sourceBytes)});
    try {
      const pdf = await task.promise;
      const result = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        const base = p.getViewport({scale: 1});
        const viewport = p.getViewport({scale: Math.min(1.75, 3200 / Math.max(base.width, base.height))});
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await p.render({canvas, canvasContext: canvas.getContext("2d"), viewport}).promise;
        const opaque = document.createElement("canvas");
        opaque.width = canvas.width; opaque.height = canvas.height;
        const context = opaque.getContext("2d");
        context.fillStyle = "white"; context.fillRect(0, 0, opaque.width, opaque.height);
        context.drawImage(canvas, 0, 0);
        result.push({png: opaque.toDataURL("image/png").split(",")[1], pageRect: [0, 0, base.width, base.height]});
        p.cleanup(); canvas.width = opaque.width = 0; canvas.height = opaque.height = 0;
      }
      return result;
    } finally { await task.destroy(); }
  }, Array.from(bytes));
  const manifest = [];
  for (const [index, reference] of references.entries()) {
    const path = testInfo.outputPath(`reference-${index + 1}.png`);
    await writeFile(path, Buffer.from(reference.png, "base64"));
    manifest.push({reference: path, pageRect: reference.pageRect, masks: masks[index]});
  }
  const manifestPath = testInfo.outputPath("raster-manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  const outputPath = testInfo.outputPath("redacted.pdf");
  await download.saveAs(outputPath);
  const verification = spawnSync("python", [
    "scripts/checkRedactionRasterFidelity.py", manifestPath, outputPath,
  ], {encoding: "utf8", timeout: 60000});
  console.log("REDACTION_RASTER_READER " + verification.stdout.trim());
  expect(verification.error).toBeUndefined();
  expect(verification.status).toBe(0);
  const result = JSON.parse(verification.stdout);
  expect(result).toMatchObject({status: "PASS", pages: masks.length, mismatchedPixels: 0});
  expect(result.selectedPixels).toBeGreaterThan(0);
  console.log("REDACTION_RASTER_FIDELITY " + JSON.stringify(result));
  return result;
}
