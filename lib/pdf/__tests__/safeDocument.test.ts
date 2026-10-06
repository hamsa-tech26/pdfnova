import {
  PDFDocument,
} from "pdf-lib";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "../safeDocument";

describe("safeDocument", () => {
  it("does not replace producer or creator metadata while loading a PDF for an unrelated edit", async () => {
    const source =
      await PDFDocument.create();

    source.addPage();
    source.setProducer(
      "Original Producer",
    );
    source.setCreator(
      "Original Creator",
    );

    const bytes =
      await source.save({
        updateFieldAppearances:
          false,
      });

    const loaded =
      await loadPdfWithoutMetadataMutation(
        bytes,
      );

    expect(
      loaded.getProducer(),
    ).toBe(
      "Original Producer",
    );

    expect(
      loaded.getCreator(),
    ).toBe(
      "Original Creator",
    );
  });

  it("saves ordinary transforms without forcing unrelated AcroForm appearance updates", async () => {
    const source =
      await PDFDocument.create();

    const page =
      source.addPage([
        600,
        800,
      ]);

    const form =
      source.getForm();

    form
      .createTextField(
        "name",
      )
      .addToPage(page);

    const bytes =
      await source.save({
        updateFieldAppearances:
          false,
      });

    const loaded =
      await loadPdfWithoutMetadataMutation(
        bytes,
      );

    loaded
      .getPage(0)
      .setRotation({
        type: "degrees",
        angle: 90,
      });

    const saved =
      await savePdfWithoutFormAppearanceMutation(
        loaded,
      );

    const reloaded =
      await PDFDocument.load(
        saved,
        {
          updateMetadata:
            false,
        },
      );

    expect(
      reloaded
        .getForm()
        .getTextField(
          "name",
        )
        .getName(),
    ).toBe("name");

    expect(
      reloaded
        .getPage(0)
        .getRotation()
        .angle,
    ).toBe(90);
  });
});
