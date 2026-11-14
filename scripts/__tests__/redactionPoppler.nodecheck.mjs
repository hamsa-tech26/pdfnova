import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createCanvas} from "@napi-rs/canvas";
import {PDFDocument, StandardFonts} from "pdf-lib";
import {verifyRedactionWithPoppler} from "../checkRedactionOutputPoppler.mjs";

async function makeFixture(path, {pages = 2, retainedText = false, attachment = false, extraImage = false} = {}) {
  const document = await PDFDocument.create();
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffd200";
  context.fillRect(0, 0, 8, 8);
  const raster = await document.embedJpg(await canvas.encode("jpeg"));
  const font = retainedText ? await document.embedFont(StandardFonts.Helvetica) : null;
  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const page = document.addPage([90, 100]);
    page.drawImage(raster, {x: 0, y: 0, width: 90, height: 100});
    if (retainedText) page.drawText("RETAINED_SECRET", {x: 1, y: 50, font, size: 8});
    if (extraImage && pageIndex === 0) {
      const other = await document.embedJpg(await canvas.encode("jpeg"));
      page.drawImage(other, {x: 2, y: 2, width: 10, height: 10});
    }
  }
  if (attachment) {
    await document.attach(new Uint8Array([1, 2, 3]), "secret.txt", {mimeType: "text/plain"});
  }
  await writeFile(path, await document.save());
}

test("Poppler independently accepts raster-only output and rejects retained content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kukureku-poppler-"));
  try {
    const path = join(directory, "synthetic.pdf");
    await makeFixture(path);
    assert.deepEqual(verifyRedactionWithPoppler(path, 2), {
      status: "PASS", pages: 2, images: 2, retainedText: 0, attachments: 0,
    });
    assert.throws(() => verifyRedactionWithPoppler(path, 1), /POPLER_PAGE_COUNT_CHANGED/);

    await makeFixture(path, {retainedText: true});
    assert.throws(() => verifyRedactionWithPoppler(path, 2), /POPLER_RETAINED_TEXT/);

    await makeFixture(path, {attachment: true});
    assert.throws(() => verifyRedactionWithPoppler(path, 2), /POPLER_RETAINED_ATTACHMENT/);

    await makeFixture(path, {extraImage: true});
    assert.throws(() => verifyRedactionWithPoppler(path, 2), /POPLER_UNEXPECTED_IMAGE_COUNT/);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
