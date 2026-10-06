import { test, expect } from "@playwright/test";
import {
  PDFDocument,
  PDFName,
  StandardFonts,
  degrees,
} from "pdf-lib";
import { readFile } from "node:fs/promises";

async function createTextPdf({
  text,
  pageCount = 1,
  rotation = 0,
  crop = false,
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([600, 800]);

    if (rotation) {
      page.setRotation(degrees(rotation));
    }

    if (crop) {
      page.setCropBox(20, 30, 520, 700);
    }

    page.drawText(text + " " + String(index + 1), {
      x: 72,
      y: 650,
      size: 44,
      font,
    });
  }

  return Buffer.from(
    await pdf.save({
      updateFieldAppearances: false,
    }),
  );
}

async function createFormPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();

  page.drawText("Kukureku browser form fixture", {
    x: 72,
    y: 720,
    size: 20,
    font,
  });

  const name = form.createTextField("browser.name");
  name.setText("Original");
  name.addToPage(page, {
    x: 72,
    y: 620,
    width: 240,
    height: 32,
    font,
  });

  const accepted = form.createCheckBox("browser.accepted");
  accepted.addToPage(page, {
    x: 72,
    y: 560,
    width: 24,
    height: 24,
  });

  const country = form.createDropdown("browser.country");
  country.setOptions(["India", "USA", "UK"]);
  country.select("India");
  country.addToPage(page, {
    x: 72,
    y: 500,
    width: 180,
    height: 32,
    font,
  });

  return Buffer.from(
    await pdf.save({
      updateFieldAppearances: false,
    }),
  );
}

async function uploadPdf(page, buffer, name) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer,
    });
}

async function clickAndDownload(page, buttonName) {
  const downloadPromise = page.waitForEvent("download");

  await page
    .getByRole("button", {
      name: buttonName,
    })
    .click();

  const download = await downloadPromise;
  const path = await download.path();

  if (!path) {
    throw new Error("Browser download did not expose a local path.");
  }

  return {
    bytes: await readFile(path),
    fileName: download.suggestedFilename(),
  };
}

async function expectOpenPdf(bytes, expectedPageCount) {
  const pdf = await PDFDocument.load(bytes, {
    updateMetadata: false,
  });

  expect(pdf.getPageCount()).toBe(expectedPageCount);

  return pdf;
}

test("QPDF protects, rejects a wrong password, and unlocks the same PDF", async ({
  page,
}) => {
  const source = await createTextPdf({
    text: "KUKUREKU QPDF BROWSER TEST",
    pageCount: 2,
  });

  await page.goto("/protect-pdf");
  await uploadPdf(page, source, "browser-qpdf.pdf");

  await page.locator("#protect-password").fill("Kukureku-123!");
  await page
    .locator("#protect-password-confirm")
    .fill("Kukureku-123!");

  const protectedResult = await clickAndDownload(
    page,
    "Protect and Download PDF",
  );

  expect(protectedResult.fileName).toBe(
    "browser-qpdf-protected.pdf",
  );
  expect(protectedResult.bytes.byteLength).toBeGreaterThan(0);

  await expect(
    page.getByText("Your protected PDF is ready"),
  ).toBeVisible();

  await page.goto("/unlock-pdf");
  await uploadPdf(
    page,
    protectedResult.bytes,
    protectedResult.fileName,
  );

  await page.locator("#pdf-password").fill("wrong-password");
  await page
    .getByRole("button", {
      name: "Unlock and Download PDF",
    })
    .click();

  await expect(
    page.getByText(
      /The PDF could not be unlocked\. Check the password/,
    ),
  ).toBeVisible();

  await page.locator("#pdf-password").fill("Kukureku-123!");

  const unlockedResult = await clickAndDownload(
    page,
    "Retry Unlock",
  );

  expect(unlockedResult.fileName).toBe(
    "browser-qpdf-protected-unlocked.pdf",
  );

  await expectOpenPdf(unlockedResult.bytes, 2);

  await expect(
    page.getByText("Your unlocked PDF is ready"),
  ).toBeVisible();
});

test("OCR runs through a real browser worker twice in the same tab", async ({
  page,
}) => {
  const firstSource = await createTextPdf({
    text: "HELLO OCR KUKUREKU",
  });

  await page.goto("/ocr-pdf");
  await uploadPdf(page, firstSource, "browser-ocr-a.pdf");

  const firstResult = await clickAndDownload(
    page,
    "Run OCR and Download TXT",
  );

  const firstText = firstResult.bytes
    .toString("utf8")
    .toUpperCase();

  expect(firstResult.fileName).toBe("browser-ocr-a-ocr.txt");
  expect(firstText).toContain("OCR");

  await expect(
    page.getByText("OCR text is ready"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "OCR Another PDF",
    })
    .click();

  const secondSource = await createTextPdf({
    text: "SECOND OCR RUN",
  });

  await uploadPdf(page, secondSource, "browser-ocr-b.pdf");

  const secondResult = await clickAndDownload(
    page,
    "Run OCR and Download TXT",
  );

  expect(secondResult.fileName).toBe("browser-ocr-b-ocr.txt");
  expect(
    secondResult.bytes.toString("utf8").toUpperCase(),
  ).toContain("OCR");
});

test("Redact PDF exports an image-only page and resets cleanly for a second file", async ({
  page,
}) => {
  const firstSource = await createTextPdf({
    text: "SECRET REDACTION TEST",
  });

  await page.goto("/redact-pdf");
  await uploadPdf(page, firstSource, "browser-redaction-a.pdf");

  await expect(
    page.getByAltText("PDF page 1 preview"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Add redaction area",
    })
    .click();

  const firstResult = await clickAndDownload(
    page,
    "Redact and Download PDF",
  );

  expect(firstResult.fileName).toBe(
    "browser-redaction-a-redacted.pdf",
  );

  const firstPdf = await expectOpenPdf(firstResult.bytes, 1);
  const resources = firstPdf.getPage(0).node.Resources();

  expect(resources.get(PDFName.of("Font"))).toBeUndefined();
  expect(resources.get(PDFName.of("XObject"))).toBeDefined();
  expect(firstPdf.getForm().getFields()).toHaveLength(0);

  await page
    .getByRole("button", {
      name: "Redact Another PDF",
    })
    .click();

  const secondSource = await createTextPdf({
    text: "SECOND REDACTION RUN",
  });

  await uploadPdf(page, secondSource, "browser-redaction-b.pdf");

  await expect(
    page.getByAltText("PDF page 1 preview"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Add redaction area",
    })
    .click();

  const secondResult = await clickAndDownload(
    page,
    "Redact and Download PDF",
  );

  expect(secondResult.fileName).toBe(
    "browser-redaction-b-redacted.pdf",
  );

  await expectOpenPdf(secondResult.bytes, 1);

  await expect(
    page.getByText("browser-redaction-b-redacted.pdf"),
  ).toBeVisible();
});

test("PDF Form Filler persists standard AcroForm values after download", async ({
  page,
}) => {
  const source = await createFormPdf();

  await page.goto("/pdf-form-filler");
  await uploadPdf(page, source, "browser-form.pdf");

  await page
    .getByLabel("browser.name", {
      exact: true,
    })
    .fill("Browser Test");

  await page
    .getByLabel("browser.accepted", {
      exact: true,
    })
    .check();

  await page
    .getByLabel("browser.country", {
      exact: true,
    })
    .selectOption("USA");

  const result = await clickAndDownload(
    page,
    "Fill and Download PDF",
  );

  expect(result.fileName).toBe("browser-form-filled.pdf");

  const output = await expectOpenPdf(result.bytes, 1);
  const form = output.getForm();

  expect(
    form.getTextField("browser.name").getText(),
  ).toBe("Browser Test");

  expect(
    form.getCheckBox("browser.accepted").isChecked(),
  ).toBe(true);

  expect(
    form.getDropdown("browser.country").getSelected(),
  ).toEqual(["USA"]);
});

test("Create Fillable PDF places a field on a rotated CropBox page and preserves page geometry", async ({
  page,
}) => {
  const source = await createTextPdf({
    text: "ROTATED CROPBOX FORM TEST",
    rotation: 270,
    crop: true,
  });

  await page.goto("/create-fillable-pdf");
  await uploadPdf(page, source, "browser-fillable.pdf");

  const previewImage = page.getByAltText("PDF page 1");
  await expect(previewImage).toBeVisible();

  await page
    .getByLabel("Unique field name")
    .fill("browser_created");

  const preview = previewImage.locator("..");
  const box = await preview.boundingBox();

  if (!box) {
    throw new Error("Fillable PDF preview did not expose a bounding box.");
  }

  await page.mouse.move(
    box.x + box.width * 0.15,
    box.y + box.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.55,
    box.y + box.height * 0.3,
  );
  await page.mouse.up();

  await expect(
    page.getByRole("button", {
      name: "Add field to page",
    }),
  ).toBeEnabled();

  await page
    .getByRole("button", {
      name: "Add field to page",
    })
    .click();

  const result = await clickAndDownload(
    page,
    "Create Fillable PDF",
  );

  expect(result.fileName).toBe(
    "browser-fillable-fillable.pdf",
  );

  const output = await expectOpenPdf(result.bytes, 1);
  const outputPage = output.getPage(0);

  expect(
    ((outputPage.getRotation().angle % 360) + 360) % 360,
  ).toBe(270);

  const cropBox = outputPage.getCropBox();
  expect(cropBox.x).toBeCloseTo(20, 4);
  expect(cropBox.y).toBeCloseTo(30, 4);
  expect(cropBox.width).toBeCloseTo(520, 4);
  expect(cropBox.height).toBeCloseTo(700, 4);

  const created = output
    .getForm()
    .getTextField("browser_created");

  const widgets = created.acroField.getWidgets();

  expect(widgets).toHaveLength(1);

  const rectangle = widgets[0].getRectangle();

  expect(rectangle.width).toBeGreaterThan(1);
  expect(rectangle.height).toBeGreaterThan(1);
});
