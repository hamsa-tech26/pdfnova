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
  organizePdfPagesInPlace,
  removePdfPagesInPlace,
  reorderPdfPagesInPlace,
  reversePdfPagesInPlace,
  validatePdfPageOrder,
} from "../pageOrder";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "../safeDocument";

describe("pageOrder", () => {
  it("rejects missing, duplicate, and out-of-range page indices", () => {
    expect(() =>
      validatePdfPageOrder(
        [0, 1],
        3,
      ),
    ).toThrow(
      "all 3 pages",
    );

    expect(() =>
      validatePdfPageOrder(
        [0, 1, 1],
        3,
      ),
    ).toThrow(
      "exactly once",
    );

    expect(() =>
      validatePdfPageOrder(
        [0, 1, 3],
        3,
      ),
    ).toThrow(
      "exactly once",
    );
  });

  it("reorders pages in the same PDF so metadata and AcroForm fields survive", async () => {
    const pdf =
      await PDFDocument.create();

    const first =
      pdf.addPage([400, 500]);
    const second =
      pdf.addPage([500, 600]);
    const third =
      pdf.addPage([600, 700]);

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    const field =
      pdf
        .getForm()
        .createTextField(
          "person.name",
        );

    field.setText("Alice");
    field.addToPage(
      second,
      {
        x: 30,
        y: 40,
        width: 180,
        height: 24,
        font,
      },
    );

    pdf.setTitle(
      "Keep this title",
    );
    pdf.setAuthor(
      "Keep this author",
    );

    expect(
      first.getWidth(),
    ).toBe(400);
    expect(
      third.getWidth(),
    ).toBe(600);

    reorderPdfPagesInPlace(
      pdf,
      [2, 0, 1],
    );

    const bytes =
      await savePdfWithoutFormAppearanceMutation(
        pdf,
      );

    const reloaded =
      await loadPdfWithoutMetadataMutation(
        bytes,
      );

    expect(
      reloaded
        .getPages()
        .map((page) =>
          page.getWidth(),
        ),
    ).toEqual([
      600,
      400,
      500,
    ]);

    expect(
      reloaded.getTitle(),
    ).toBe(
      "Keep this title",
    );

    expect(
      reloaded.getAuthor(),
    ).toBe(
      "Keep this author",
    );

    expect(
      reloaded
        .getForm()
        .getTextField(
          "person.name",
        )
        .getText(),
    ).toBe("Alice");

    expect(
      reloaded
        .getForm()
        .getTextField(
          "person.name",
        )
        .acroField
        .getWidgets(),
    ).toHaveLength(1);
  });

  it("reverses the page tree in place", async () => {
    const pdf =
      await PDFDocument.create();

    pdf.addPage([300, 400]);
    pdf.addPage([400, 500]);
    pdf.addPage([500, 600]);

    reversePdfPagesInPlace(
      pdf,
    );

    expect(
      pdf
        .getPages()
        .map((page) =>
          page.getWidth(),
        ),
    ).toEqual([
      500,
      400,
      300,
    ]);
  });

  it("deletes pages in place and removes fields that exist only on deleted pages", async () => {
    const pdf =
      await PDFDocument.create();

    const first =
      pdf.addPage([400, 500]);

    const second =
      pdf.addPage([500, 600]);

    pdf.addPage([600, 700]);

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    pdf
      .getForm()
      .createTextField(
        "keep.me",
      )
      .addToPage(
        first,
        {
          x: 20,
          y: 20,
          width: 120,
          height: 24,
          font,
        },
      );

    pdf
      .getForm()
      .createTextField(
        "delete.me",
      )
      .addToPage(
        second,
        {
          x: 20,
          y: 20,
          width: 120,
          height: 24,
          font,
        },
      );

    removePdfPagesInPlace(
      pdf,
      [1],
    );

    const bytes =
      await savePdfWithoutFormAppearanceMutation(
        pdf,
      );

    const reloaded =
      await loadPdfWithoutMetadataMutation(
        bytes,
      );

    expect(
      reloaded.getPageCount(),
    ).toBe(2);

    expect(
      reloaded
        .getForm()
        .getFieldMaybe(
          "keep.me",
        ),
    ).toBeDefined();

    expect(
      reloaded
        .getForm()
        .getFieldMaybe(
          "delete.me",
        ),
    ).toBeUndefined();
  });

  it("organizes a subset in place while preserving retained form fields and applying rotation", async () => {
    const pdf =
      await PDFDocument.create();

    const first =
      pdf.addPage([400, 500]);

    const second =
      pdf.addPage([500, 600]);

    const third =
      pdf.addPage([600, 700]);

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    pdf
      .getForm()
      .createTextField(
        "keep.third",
      )
      .addToPage(
        third,
        {
          x: 20,
          y: 20,
          width: 120,
          height: 24,
          font,
        },
      );

    pdf
      .getForm()
      .createTextField(
        "delete.second",
      )
      .addToPage(
        second,
        {
          x: 20,
          y: 20,
          width: 120,
          height: 24,
          font,
        },
      );

    expect(
      first.getWidth(),
    ).toBe(400);

    organizePdfPagesInPlace(
      pdf,
      [
        {
          originalPageIndex:
            2,
          rotationDelta: 90,
        },
        {
          originalPageIndex:
            0,
          rotationDelta: 0,
        },
      ],
    );

    const bytes =
      await savePdfWithoutFormAppearanceMutation(
        pdf,
      );

    const reloaded =
      await loadPdfWithoutMetadataMutation(
        bytes,
      );

    expect(
      reloaded
        .getPages()
        .map((page) =>
          page.getWidth(),
        ),
    ).toEqual([
      600,
      400,
    ]);

    expect(
      reloaded
        .getPage(0)
        .getRotation()
        .angle,
    ).toBe(90);

    expect(
      reloaded
        .getForm()
        .getFieldMaybe(
          "keep.third",
        ),
    ).toBeDefined();

    expect(
      reloaded
        .getForm()
        .getFieldMaybe(
          "delete.second",
        ),
    ).toBeUndefined();
  });

});
