import {test, expect} from "@playwright/test";
import {createRequire} from "node:module";
import {PDFDocument, PDFString, StandardFonts, rgb} from "pdf-lib";
import {writeFile} from "node:fs/promises";
import {execFileSync, spawnSync} from "node:child_process";
const {normalizeRedactionRect, redactionPixelBounds} = createRequire(import.meta.url)("../lib/pdf/redaction.ts");

test("downloaded redacted PDF removes secret text, underlying objects and attachments", async ({page}) => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  source.setTitle("SECRET_META_171");
  const first = source.addPage([400, 400]);
  first.drawRectangle({x: 40, y: 176, width: 290, height: 145, color: rgb(1, 0, 0)});
  first.drawText("SECRET_REDACT_171", {x: 70, y: 270, size: 16, font});
  first.drawText("PUBLIC_KEEP_171", {x: 30, y: 30, size: 14, font});
  const field = source.getForm().createTextField("SECRET_FIELD_171");
  field.setText("SECRET_VALUE_171");
  field.addToPage(first, {x: 80, y: 210, width: 200, height: 20});
  const link = source.context.register(source.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [80, 245, 280, 265],
    A: {S: "URI", URI: PDFString.of("https://example.invalid/SECRET_LINK_171")},
  }));
  first.node.Annots().push(link);
  await source.attach(new TextEncoder().encode("SECRET_ATTACHMENT_171"), "SECRET_ATTACHMENT_171.txt", {mimeType: "text/plain"});
  const second = source.addPage([400, 400]);
  second.drawRectangle({x: 0, y: 0, width: 400, height: 400, color: rgb(0, 0, 1)});
  second.drawText("PUBLIC_SECOND_PAGE_171", {x: 30, y: 30, size: 14, font, color: rgb(1, 1, 1)});
  const sourceBytes = await source.save();
  const sourcePath = test.info().outputPath("synthetic-redaction-source.pdf");
  await writeFile(sourcePath, sourceBytes);

  // A painted black overlay retains source objects and must fail the reader.
  first.drawRectangle({x: 42, y: 176, width: 282, height: 142, color: rgb(0, 0, 0)});
  const overlayPath = test.info().outputPath("unsafe-overlay-negative.pdf");
  await writeFile(overlayPath, await source.save());
  const negative = spawnSync("python", ["scripts/checkSyntheticRedactionOutput.py", sourcePath, overlayPath], {encoding: "utf8", timeout: 15000});
  expect(negative.error).toBeUndefined();
  expect(negative.status).toBe(2);
  expect(negative.stdout).toContain("OUTPUT_HAS_SELECTABLE_TEXT");

  await page.goto("/redact-pdf");
  await page.locator('input[type="file"]').setInputFiles({name: "synthetic-redaction.pdf", mimeType: "application/pdf", buffer: Buffer.from(sourceBytes)});
  await expect(page.getByAltText("PDF page 1 preview")).toBeVisible();
  const controls = page.getByRole("group", {name: "Redaction area on page 1"});
  for (const [label, value] of [["Left %", "10.5"], ["Top %", "20.5"], ["Width %", "70.5"], ["Height %", "35.5"]]) {
    await controls.getByLabel(label, {exact: true}).fill(value);
  }
  await page.getByRole("button", {name: "Add redaction area", exact: true}).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", {name: "Redact and Download PDF", exact: true}).click();
  const downloaded = await pending;
  const outputPath = await downloaded.path();
  expect(outputPath).toBeTruthy();
  const result = execFileSync("python", ["scripts/checkSyntheticRedactionOutput.py", sourcePath, outputPath], {encoding: "utf8", timeout: 15000}).trim();
  const evidence = JSON.parse(result);
  expect(evidence).toMatchObject({status: "PASS", pages: 2, selectableCharacters: 0, embeddedFiles: 0, sourceMarkersInObjects: 0, maskInteriorVerified: true, underlyingImageRedacted: true, unselectedPagePreserved: true});
  console.log("TASK171_REDACTED_PDF " + result);
});

test("redaction raster masks every selected edge pixel and preserves surrounding pixels", async ({page}) => {
  const selections = [
    {x: 0.105, y: 0.205, width: 0.205, height: 0.305},
    {x: 0.7, y: 0.8, width: -0.4, height: -0.5},
    {x: -0.2, y: 0.9, width: 1.4, height: 0.4},
    {x: 0, y: 0, width: 1, height: 1},
  ];
  const cases = [[100, 100], [613, 797]].flatMap(([width, height]) =>
    selections.map(rect => ({
      width, height, selected: normalizeRedactionRect(rect),
      pixels: redactionPixelBounds(rect, width, height),
    })),
  );
  const results = await page.evaluate(cases => cases.map(({width, height, selected, pixels}) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(pixels.x, pixels.y, pixels.width, pixels.height);
    const data = context.getImageData(0, 0, width, height).data;
    const left = selected.x * width, top = selected.y * height;
    const right = (selected.x + selected.width) * width;
    const bottom = (selected.y + selected.height) * height;
    let exposed = 0, overwritten = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Independent interval/pixel intersection, not the rounding helper.
        const touched = x + 1 > left && x < right && y + 1 > top && y < bottom;
        const red = data[(y * width + x) * 4];
        if (touched && red !== 0) exposed++;
        if (!touched && red !== 255) overwritten++;
      }
    }
    return {exposed, overwritten};
  }), cases);
  expect(results).toEqual(cases.map(() => ({exposed: 0, overwritten: 0})));
});
