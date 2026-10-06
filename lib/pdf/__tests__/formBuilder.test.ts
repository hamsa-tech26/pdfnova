import {
  degrees,
  PDFDocument,
  PDFName,
  PDFString,
} from "pdf-lib";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  addFillableFields,
} from "../formBuilder";

describe("formBuilder", () => {
  it("creates common fillable fields that survive save and reload", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage([600, 800]);

    page.setCropBox(
      20,
      30,
      560,
      740,
    );

    page.setRotation(
      degrees(90),
    );

    await addFillableFields(
      pdf,
      [
        {
          id: 1,
          name: "full_name",
          type: "text",
          page: 1,
          rect: {
            x: 0.1,
            y: 0.15,
            width: 0.45,
            height: 0.08,
          },
          options: [],
        },
        {
          id: 2,
          name: "accepted",
          type: "checkbox",
          page: 1,
          rect: {
            x: 0.1,
            y: 0.3,
            width: 0.08,
            height: 0.08,
          },
          options: [],
        },
        {
          id: 3,
          name: "country",
          type: "dropdown",
          page: 1,
          rect: {
            x: 0.1,
            y: 0.45,
            width: 0.35,
            height: 0.08,
          },
          options: [
            "India",
            "USA",
          ],
        },
      ],
    );

    const saved =
      await pdf.save();

    const reloaded =
      await PDFDocument.load(
        saved,
      );

    const form =
      reloaded.getForm();

    expect(
      form
        .getFields()
        .map((field) =>
          field.getName(),
        )
        .sort(),
    ).toEqual([
      "accepted",
      "country",
      "full_name",
    ]);

    expect(
      form
        .getDropdown(
          "country",
        )
        .getOptions(),
    ).toEqual([
      "India",
      "USA",
    ]);

    const widgetRect =
      form
        .getTextField(
          "full_name",
        )
        .acroField
        .getWidgets()[0]
        .getRectangle();

    expect(
      widgetRect.width,
    ).toBeGreaterThan(0);
    expect(
      widgetRect.height,
    ).toBeGreaterThan(0);

    expect(
      widgetRect.x,
    ).toBeGreaterThanOrEqual(
      19,
    );
    expect(
      widgetRect.y,
    ).toBeGreaterThanOrEqual(
      29,
    );
    expect(
      widgetRect.x +
        widgetRect.width,
    ).toBeLessThanOrEqual(
      581,
    );
    expect(
      widgetRect.y +
        widgetRect.height,
    ).toBeLessThanOrEqual(
      771,
    );

    expect(
      form
        .getTextField(
          "full_name",
        )
        .acroField
        .getWidgets()[0]
        .getAppearanceCharacteristics()
        ?.getRotation(),
    ).toBe(90);
  });

  it("rejects duplicate field names already present in the PDF", async () => {
    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage();

    const form =
      pdf.getForm();

    form
      .createTextField(
        "existing",
      )
      .addToPage(page);

    await expect(
      addFillableFields(
        pdf,
        [
          {
            id: 1,
            name: "existing",
            type: "text",
            page: 1,
            rect: {
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.1,
            },
            options: [],
          },
        ],
      ),
    ).rejects.toThrow(
      "already contains a form field",
    );
  });

  it("refuses XFA documents before modifying form data", async () => {
    const pdf =
      await PDFDocument.create();

    pdf.addPage();

    pdf.getForm();

    pdf.catalog
      .AcroForm()
      ?.set(
        PDFName.of("XFA"),
        PDFString.of(
          "unsupported-xfa",
        ),
      );

    await expect(
      addFillableFields(
        pdf,
        [
          {
            id: 1,
            name: "name",
            type: "text",
            page: 1,
            rect: {
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.1,
            },
            options: [],
          },
        ],
      ),
    ).rejects.toThrow(
      "XFA form data",
    );

    expect(
      pdf.catalog
        .AcroForm()
        ?.has(
          PDFName.of("XFA"),
        ),
    ).toBe(true);
  });
});
