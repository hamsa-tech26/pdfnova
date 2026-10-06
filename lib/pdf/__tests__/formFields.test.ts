import {
  PDFDocument,
} from "pdf-lib";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyPdfFormValues,
  describePdfFormFields,
} from "../formFields";

describe("formFields", () => {
  it("describes and fills common AcroForm fields", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage([600, 800]);

    const form =
      pdf.getForm();

    const text =
      form.createTextField(
        "full_name",
      );

    text.setText("Old Name");
    text.addToPage(page);

    const check =
      form.createCheckBox(
        "accepted",
      );

    check.addToPage(page);

    const dropdown =
      form.createDropdown(
        "country",
      );

    dropdown.setOptions([
      "India",
      "USA",
    ]);

    dropdown.select(
      "India",
    );

    dropdown.addToPage(page);

    const radio =
      form.createRadioGroup(
        "plan",
      );

    radio.addOptionToPage(
      "Basic",
      page,
      {
        x: 10,
        y: 10,
      },
    );

    radio.addOptionToPage(
      "Pro",
      page,
      {
        x: 40,
        y: 10,
      },
    );

    radio.select("Basic");

    const before =
      describePdfFormFields(pdf);

    expect(
      before.fields.find(
        (field) =>
          field.name ===
          "full_name",
      )?.value,
    ).toBe("Old Name");

    applyPdfFormValues(
      pdf,
      {
        full_name:
          "New Name",
        accepted: true,
        country: "USA",
        plan: "Pro",
      },
      false,
    );

    const after =
      describePdfFormFields(pdf);

    expect(
      after.fields.find(
        (field) =>
          field.name ===
          "full_name",
      )?.value,
    ).toBe("New Name");

    expect(
      after.fields.find(
        (field) =>
          field.name ===
          "accepted",
      )?.value,
    ).toBe(true);

    expect(
      after.fields.find(
        (field) =>
          field.name ===
          "country",
      )?.value,
    ).toBe("USA");

    expect(
      after.fields.find(
        (field) =>
          field.name ===
          "plan",
      )?.value,
    ).toBe("Pro");
  });

  it("can flatten filled fields", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage();

    const form =
      pdf.getForm();

    const field =
      form.createTextField(
        "message",
      );

    field.addToPage(page);

    applyPdfFormValues(
      pdf,
      {
        message:
          "Final text",
      },
      true,
    );

    expect(
      pdf
        .getForm()
        .getFields(),
    ).toHaveLength(0);
  });
});
