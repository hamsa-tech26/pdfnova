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

async function createInspectorPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  pdf.setTitle("Inspector browser fixture");
  pdf.setAuthor("Kukureku QA");

  const firstPage = pdf.addPage([600, 800]);
  firstPage.drawText("Kukureku Inspector fixture", {
    x: 72,
    y: 720,
    size: 20,
    font,
  });

  const form = pdf.getForm();
  const field = form.createTextField("inspector.name");
  field.setText("Inspector Value");
  field.addToPage(firstPage, {
    x: 72,
    y: 620,
    width: 240,
    height: 32,
    font,
  });

  const secondPage = pdf.addPage([612, 792]);
  secondPage.setRotation(degrees(90));
  secondPage.setCropBox(20, 30, 520, 700);
  secondPage.drawText("Rotated cropped page", {
    x: 72,
    y: 650,
    size: 18,
    font,
  });

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

test("Unified Document Inspector reports facts, findings, and explicit coverage limits", async ({
  page,
}) => {
  const source = await createInspectorPdf();

  await page.goto("/document-inspector");
  await uploadPdf(page, source, "browser-inspector.pdf");

  await expect(
    page.getByText(
      "What Kukureku checked — and what it did not",
    ),
  ).toBeVisible();

  await expect(
    page.getByText("ISSUE FOUND").first(),
  ).toBeVisible();

  await expect(
    page.getByText("NOT CHECKED").first(),
  ).toBeVisible();

  await expect(
    page.getByText("NOT SUPPORTED").first(),
  ).toBeVisible();

  await expect(
    page.getByText("Inspector browser fixture"),
  ).toBeVisible();

  await expect(
    page.getByText(
      "1 standard form field detected; 1 currently contains a value.",
    ),
  ).toBeVisible();

  await expect(
    page.getByText("MediaBox, CropBox, size, and rotation"),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Unified Document Inspector V1 reads supported PDF facts locally in your browser and does not upload the file.",
    ),
  ).toBeVisible();
});


test("Magic Drop creates evidence-based recommendations without automatic edits", async ({
  page,
}) => {
  const source = await createInspectorPdf();

  await page.goto("/magic-drop");
  await uploadPdf(page, source, "browser-magic-drop.pdf");

  await expect(
    page.getByText(
      "2 fact-derived next steps found",
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Remove PDF Metadata",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Flatten PDF",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Some PDF structures were not checked",
    ),
  ).toBeVisible();

  const metadataLink =
    page.getByRole("link", {
      name: "Open Remove PDF Metadata",
    });

  await expect(
    metadataLink,
  ).toHaveAttribute(
    "href",
    /\/remove-pdf-metadata\?workspaceFile=/,
  );

  await expect(
    page.getByText(
      /This source PDF is saved locally in this browser/,
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "No file changes made",
    ),
  ).toBeVisible();

  const recipesLink =
    page.getByRole("link", {
      name: "Open Workflow Recipes",
    });

  await expect(
    recipesLink,
  ).toHaveAttribute(
    "href",
    /\/workflow-recipes\?workspaceFile=/,
  );

  await recipesLink.click();

  await expect(page).toHaveURL(
    /\/workflow-recipes\?workspaceFile=/,
  );

  await expect(
    page.getByRole("heading", {
      name: "Prepare for Sharing",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Finalize Standard Form",
    }),
  ).toBeVisible();

  const startSharing =
    page.getByRole("link", {
      name: "Start Prepare for Sharing",
    });

  await expect(
    startSharing,
  ).toHaveAttribute(
    "href",
    /recipe=prepare-for-sharing&recipeStep=0/,
  );

  await startSharing.click();

  await expect(page).toHaveURL(
    /\/workflow-recipes\?.*recipe=prepare-for-sharing.*recipeStep=0/,
  );

  await expect(
    page.getByRole("heading", {
      name: "Step 1 of 3",
    }),
  ).toBeVisible();

  await page.goto("/dashboard");

  const resumeRecipe =
    page.getByRole("link", {
      name: "Resume Recipe",
    });

  await expect(
    resumeRecipe,
  ).toHaveAttribute(
    "href",
    /\/workflow-recipes\?workspaceFile=.*recipe=prepare-for-sharing&recipeStep=0/,
  );

  await page.reload();

  await expect(
    page.getByRole("link", {
      name: "Resume Recipe",
    }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "Resume Recipe",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Step 1 of 3",
    }),
  ).toBeVisible();

  const recipeMetadataLink =
    page.getByRole("link", {
      name: "Open Remove PDF Metadata",
    });

  await expect(
    recipeMetadataLink,
  ).toHaveAttribute(
    "href",
    /\/remove-pdf-metadata\?workspaceFile=.*recipe=prepare-for-sharing&recipeStep=0/,
  );

  await recipeMetadataLink.click();

  await expect(page).toHaveURL(
    /\/remove-pdf-metadata\?.*workspaceFile=.*recipe=prepare-for-sharing&recipeStep=0/,
  );

  await expect(
    page
      .getByRole("main")
      .getByText(
        "browser-magic-drop.pdf",
      )
      .first(),
  ).toBeVisible();

  await page.reload();

  await expect(
    page
      .getByRole("main")
      .getByText(
        "browser-magic-drop.pdf",
      )
      .first(),
  ).toBeVisible();

  const metadataResult =
    await clickAndDownload(
      page,
      "Remove Metadata and Download",
    );

  expect(
    metadataResult.fileName,
  ).toBe(
    "browser-magic-drop-metadata-removed.pdf",
  );

  await expect(
    page.getByText(
      "Saved as Version 2 in this browser workspace",
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Verification PASS",
    ),
  ).toBeVisible();

  const continueRecipe =
    page.getByRole("link", {
      name: "Continue Recipe",
    });

  await expect(
    continueRecipe,
  ).toHaveAttribute(
    "href",
    /\/workflow-recipes\?workspaceFile=.*recipe=prepare-for-sharing&recipeStep=1/,
  );

  await continueRecipe.click();

  await expect(page).toHaveURL(
    /\/workflow-recipes\?.*recipe=prepare-for-sharing.*recipeStep=1/,
  );

  await expect(
    page.getByRole("heading", {
      name: "Step 2 of 3",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Compress PDF",
    }),
  ).toBeVisible();

  await page.goto("/dashboard");

  await expect(
    page.getByText(
      "Active workspace document",
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name:
        "browser-magic-drop-metadata-removed.pdf",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      /2 versions saved for this document/,
    ),
  ).toBeVisible();

  await expect(
    page
      .getByRole("main")
      .getByText(
        "browser-magic-drop.pdf",
      )
      .last(),
  ).toBeVisible();

  const resumeStepTwo =
    page.getByRole("link", {
      name: "Resume Recipe",
    });

  await expect(
    resumeStepTwo,
  ).toHaveAttribute(
    "href",
    /recipe=prepare-for-sharing&recipeStep=1/,
  );

  await page.reload();

  await expect(
    page.getByRole("link", {
      name: "Resume Recipe",
    }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "Resume Recipe",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Step 2 of 3",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name:
        "Record skip and continue",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Step 3 of 3",
    }),
  ).toBeVisible();

  const protectRecipeLink =
    page.getByRole("link", {
      name: "Open Protect PDF",
    });

  await expect(
    protectRecipeLink,
  ).toHaveAttribute(
    "href",
    /\/protect-pdf\?workspaceFile=.*recipe=prepare-for-sharing&recipeStep=2/,
  );

  await protectRecipeLink.click();

  await page
    .locator("#protect-password")
    .fill("Recipe-Protect-123!");
  await page
    .locator("#protect-password-confirm")
    .fill("Recipe-Protect-123!");

  const protectedRecipeResult =
    await clickAndDownload(
      page,
      "Protect and Download PDF",
    );

  expect(
    protectedRecipeResult.fileName,
  ).toBe(
    "browser-magic-drop-metadata-removed-protected.pdf",
  );

  await expect(
    page.getByText(
      "Saved as Version 3 in this browser workspace",
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Verification PASS",
    ),
  ).toBeVisible();

  await page.goto("/dashboard");

  await expect(
    page.getByText(
      /3 versions saved locally/,
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name:
        "View Recipe Summary",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name: "Reopen in Magic Drop",
    }),
  ).toHaveAttribute(
    "href",
    /\/magic-drop\?workspaceFile=/,
  );
});

test("Rotate PDF persists a derived workspace version from a Dashboard handoff", async ({
  page,
}) => {
  const source = await createTextPdf({
    text:
      "KUKUREKU CONTINUITY ROTATE TEST",
    pageCount: 2,
  });

  await page.goto("/magic-drop");
  await uploadPdf(
    page,
    source,
    "browser-rotate-continuity.pdf",
  );

  await page.goto("/dashboard");

  const rotateLink =
    page.getByRole("link", {
      name: "Rotate",
      exact: true,
    });

  await expect(
    rotateLink,
  ).toHaveAttribute(
    "href",
    /\/rotate-pdf\?workspaceFile=/,
  );

  await rotateLink.click();

  await expect(
    page.getByRole("heading", {
      name:
        "browser-rotate-continuity.pdf",
    }),
  ).toBeVisible();

  const rotatedResult =
    await clickAndDownload(
      page,
      "Rotate and Download PDF",
    );

  expect(
    rotatedResult.fileName,
  ).toBe(
    "browser-rotate-continuity-rotated.pdf",
  );

  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", {
      name:
        "browser-rotate-continuity-rotated.pdf",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      /2 versions saved for this document/,
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      /Rotate PDF · from Version 1/,
    ),
  ).toBeVisible();
});

test("Multi-document workspace records merge composition and split/extract child documents", async ({
  page,
}) => {
  const first =
    await createTextPdf({
      text:
        "MULTI DOCUMENT FIRST",
      pageCount: 2,
    });
  const second =
    await createTextPdf({
      text:
        "MULTI DOCUMENT SECOND",
      pageCount: 1,
    });

  await page.goto(
    "/merge-pdf",
  );

  await page
    .locator(
      'input[type="file"]',
    )
    .first()
    .setInputFiles([
      {
        name:
          "multi-first.pdf",
        mimeType:
          "application/pdf",
        buffer: first,
      },
      {
        name:
          "multi-second.pdf",
        mimeType:
          "application/pdf",
        buffer: second,
      },
    ]);

  const merged =
    await clickAndDownload(
      page,
      "Merge and Download PDF",
    );

  expect(
    merged.fileName,
  ).toBe(
    "kukureku-merged.pdf",
  );
  await expectOpenPdf(
    merged.bytes,
    3,
  );

  await expect(
    page.getByText(
      "Saved as a new composed document in this browser workspace",
    ),
  ).toBeVisible();

  await page.goto(
    "/dashboard",
  );

  await expect(
    page.getByRole("heading", {
      name:
        "kukureku-merged.pdf",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      /3 documents stored locally/,
    ),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Parent documents",
      {
        exact: true,
      },
    ),
  ).toBeVisible();

  await expect(
    page
      .getByText(
        "multi-first.pdf",
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "multi-second.pdf",
      )
      .first(),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "Split",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name:
        "kukureku-merged.pdf",
    }),
  ).toBeVisible();

  await page
    .locator(
      "#page-range",
    )
    .fill("1-2");

  const split =
    await clickAndDownload(
      page,
      "Extract and Download PDF",
    );

  expect(
    split.fileName,
  ).toBe(
    "kukureku-merged-extracted.pdf",
  );

  await expect(
    page.getByText(
      "Saved as a new child document in this browser workspace",
    ),
  ).toBeVisible();

  await page.goto(
    "/dashboard",
  );

  await expect(
    page.getByText(
      /4 documents stored locally/,
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name:
        "kukureku-merged-extracted.pdf",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      "kukureku-merged.pdf",
    ),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name:
        "Extract Pages",
      exact: true,
    })
    .click();

  await page
    .locator("#pages")
    .fill("1");

  const extracted =
    await clickAndDownload(
      page,
      "Extract and Download Pages",
    );

  expect(
    extracted.fileName,
  ).toBe(
    "kukureku-merged-extracted-extracted.pdf",
  );

  await expect(
    page.getByText(
      "Saved as a new child document in this browser workspace",
    ),
  ).toBeVisible();

  await page.goto(
    "/dashboard",
  );

  await expect(
    page.getByText(
      /5 documents stored locally/,
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name:
        "kukureku-merged-extracted-extracted.pdf",
    }),
  ).toBeVisible();
});

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
    page
      .getByRole("main")
      .getByText(
        /The PDF could not be unlocked\. Check the password/,
      )
      .first(),
  ).toBeVisible();

  await page.locator("#pdf-password").fill("Kukureku-123!");

  const unlockedResult = await clickAndDownload(
    page,
    "Unlock and Download PDF",
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

  const fontResources = resources.get(PDFName.of("Font"));
  const xObjects = resources.get(PDFName.of("XObject"));

  if (fontResources) {
    expect(fontResources.keys()).toHaveLength(0);
  }

  expect(xObjects).toBeDefined();
  expect(xObjects.keys().length).toBeGreaterThan(0);
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

  const areaControls = page.getByRole("group", {
    name: "New form field area on page 1",
  });

  await areaControls.getByLabel("Left %").fill("15");
  await areaControls.getByLabel("Top %").fill("20");
  await areaControls.getByLabel("Width %").fill("40");
  await areaControls.getByLabel("Height %").fill("10");

  await page
    .getByRole("button", {
      name: "Use this field area",
    })
    .click();

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


test("Sign PDF uses keyboard placement on a rotated CropBox page and exports an openable PDF", async ({
  page,
}) => {
  const source = await createTextPdf({
    text: "ROTATED SIGNATURE TEST",
    rotation: 90,
    crop: true,
  });

  await page.goto("/sign-pdf");
  await uploadPdf(page, source, "browser-sign.pdf");

  await expect(
    page.getByAltText("PDF page 1 preview"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Type",
    })
    .click();

  await page
    .getByLabel("Signature name")
    .fill("Kukureku QA");

  await expect(
    page.getByAltText("Typed signature preview"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Center signature",
    })
    .click();

  await page
    .getByRole("button", {
      name: "Move signature right",
    })
    .click();

  await page
    .getByRole("button", {
      name: "Move signature down",
    })
    .click();

  const result = await clickAndDownload(
    page,
    "Sign and Download PDF",
  );

  expect(result.fileName).toBe("browser-sign-signed.pdf");

  const output = await expectOpenPdf(result.bytes, 1);
  const outputPage = output.getPage(0);

  expect(
    ((outputPage.getRotation().angle % 360) + 360) % 360,
  ).toBe(90);

  const cropBox = outputPage.getCropBox();
  expect(cropBox.x).toBeCloseTo(20, 4);
  expect(cropBox.y).toBeCloseTo(30, 4);
  expect(cropBox.width).toBeCloseTo(520, 4);
  expect(cropBox.height).toBeCloseTo(700, 4);

  const resources = outputPage.node.Resources();
  const xObjects = resources.get(PDFName.of("XObject"));

  expect(xObjects).toBeDefined();
  expect(xObjects.keys().length).toBeGreaterThan(0);

  await expect(
    page.getByText("Your signed PDF is ready"),
  ).toBeVisible();
});
