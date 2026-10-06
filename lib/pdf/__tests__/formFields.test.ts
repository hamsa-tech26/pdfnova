import {
  PDFDocument,
  StandardFonts,
} from "pdf-lib";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyPdfFormValues,
  describePdfFormFields,
  getPdfFormProcessingError,
} from "../formFields";

describe("formFields", () => {
  it("turns WinAnsi encoding failures into a clear compatibility message", () => {
    const message =
      getPdfFormProcessingError(
        new Error(
          'WinAnsi cannot encode "Ω" (0x03a9)',
        ),
        "fallback",
      );

    expect(message).toContain(
      "WinAnsi/Latin",
    );
  });

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

  it("persists filled values after save and reload", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    const form = pdf.getForm();

    const text = form.createTextField("name");
    text.addToPage(page);

    const check = form.createCheckBox("accepted");
    check.addToPage(page);

    applyPdfFormValues(
      pdf,
      {
        name: "Prasenjit",
        accepted: true,
      },
      false,
    );

    const saved = await pdf.save();
    const reloaded = await PDFDocument.load(saved);
    const described = describePdfFormFields(reloaded);

    expect(
      described.fields.find((field) => field.name === "name")?.value,
    ).toBe("Prasenjit");

    expect(
      described.fields.find((field) => field.name === "accepted")?.value,
    ).toBe(true);
  });

  it("supports multi-select option lists", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    const form = pdf.getForm();

    const list = form.createOptionList("fruits");
    list.addOptions(["Apple", "Orange", "Mango"]);
    list.enableMultiselect();
    list.addToPage(page);

    applyPdfFormValues(
      pdf,
      {
        fruits: ["Apple", "Mango"],
      },
      false,
    );

    const described = describePdfFormFields(pdf);

    expect(
      described.fields.find((field) => field.name === "fruits")?.value,
    ).toEqual(["Apple", "Mango"]);
  });

  it("preserves unsupported fields when saving an editable copy", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage([600, 800]);

    const form =
      pdf.getForm();

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    const text =
      form.createTextField(
        "name",
      );

    text.addToPage(page, {
      font,
    });

    const button =
      form.createButton(
        "action",
      );

    button.addToPage(
      "Run",
      page,
      {
        x: 20,
        y: 20,
        width: 80,
        height: 30,
        font,
      },
    );

    applyPdfFormValues(
      pdf,
      {
        name: "Updated",
      },
      false,
    );

    const saved =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await PDFDocument.load(
        saved,
      );

    expect(
      reloaded
        .getForm()
        .getTextField(
          "name",
        )
        .getText(),
    ).toBe("Updated");

    expect(
      reloaded
        .getForm()
        .getButton(
          "action",
        )
        .getName(),
    ).toBe("action");
  });

  it("refuses flattening when unsupported field types are present", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage([600, 800]);

    const form =
      pdf.getForm();

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    form
      .createTextField(
        "name",
      )
      .addToPage(page, {
        font,
      });

    form
      .createButton(
        "action",
      )
      .addToPage(
        "Run",
        page,
        {
          font,
        },
      );

    expect(() =>
      applyPdfFormValues(
        pdf,
        {
          name: "Updated",
        },
        true,
      ),
    ).toThrow(
      "Flattening is unavailable",
    );
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

    const saved = await pdf.save();
    const reloaded = await PDFDocument.load(saved);

    expect(
      reloaded
        .getForm()
        .getFields(),
    ).toHaveLength(0);
  });
});
