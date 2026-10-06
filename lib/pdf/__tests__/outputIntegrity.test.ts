import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateVisibleCropBox,
} from "../cropGeometry";
import {
  applyPdfFormValues,
  describePdfFormFields,
} from "../formFields";
import {
  calculateHeaderFooterPlacement,
} from "../headerFooterGeometry";
import {
  applyPdfMetadata,
  readPdfMetadata,
} from "../metadataEditor";
import {
  calculateProportionalFitScale,
  resolveResizeTarget,
} from "../resizePageGeometry";
import {
  RELIABILITY_FIXTURE_PAGE_COUNT,
  createReliabilityPdfBytes,
} from "./fixtures/reliabilityFixture";

async function reload(
  bytes: Uint8Array,
) {
  return PDFDocument.load(
    bytes,
    {
      updateMetadata: false,
    },
  );
}

describe("real PDF output integrity", () => {
  it("round-trips mixed pages, CropBoxes, rotations, forms, and metadata", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(bytes);

    expect(
      pdf.getPageCount(),
    ).toBe(
      RELIABILITY_FIXTURE_PAGE_COUNT,
    );

    const pages =
      pdf.getPages();

    expect(
      pages[0].getSize(),
    ).toEqual({
      width: 600,
      height: 800,
    });

    expect(
      pages[1]
        .getRotation()
        .angle,
    ).toBe(90);

    expect(
      pages[2]
        .getRotation()
        .angle,
    ).toBe(270);

    expect(
      pages[2].getCropBox(),
    ).toMatchObject({
      x: 20,
      y: 30,
      width: 560,
      height: 740,
    });

    const metadata =
      readPdfMetadata(pdf);

    expect(
      metadata.title,
    ).toBe(
      "Kukureku Reliability Fixture",
    );

    expect(
      metadata.author,
    ).toBe(
      "Kukureku QA",
    );

    const form =
      describePdfFormFields(
        pdf,
      );

    expect(
      form.hasXfa,
    ).toBe(false);

    expect(
      form.fields.map(
        (field) =>
          field.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "fixture.full_name",
        "fixture.accepted",
        "fixture.country",
      ]),
    );
  });

  it("fills the real AcroForm fixture and preserves values after save and reload", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(source);

    applyPdfFormValues(
      pdf,
      {
        "fixture.full_name":
          "Updated Name",
        "fixture.accepted":
          true,
        "fixture.country":
          "UK",
      },
      false,
    );

    const bytes =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await reload(bytes);

    const fields =
      describePdfFormFields(
        reloaded,
      ).fields;

    expect(
      fields.find(
        (field) =>
          field.name ===
          "fixture.full_name",
      )?.value,
    ).toBe(
      "Updated Name",
    );

    expect(
      fields.find(
        (field) =>
          field.name ===
          "fixture.accepted",
      )?.value,
    ).toBe(true);

    expect(
      fields.find(
        (field) =>
          field.name ===
          "fixture.country",
      )?.value,
    ).toBe("UK");
  });

  it("applies rotation-aware cropping to every fixture page and reloads cleanly", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(source);

    const originalRotations =
      pdf
        .getPages()
        .map(
          (page) =>
            page.getRotation()
              .angle,
        );

    for (
      const page of
      pdf.getPages()
    ) {
      const cropped =
        calculateVisibleCropBox(
          page.getCropBox(),
          page.getRotation()
            .angle,
          {
            top: 8,
            right: 10,
            bottom: 12,
            left: 14,
          },
        );

      page.setCropBox(
        cropped.x,
        cropped.y,
        cropped.width,
        cropped.height,
      );
    }

    const bytes =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await reload(bytes);

    expect(
      reloaded.getPageCount(),
    ).toBe(
      RELIABILITY_FIXTURE_PAGE_COUNT,
    );

    reloaded
      .getPages()
      .forEach(
        (page, index) => {
          expect(
            page.getCropBox()
              .width,
          ).toBeGreaterThan(
            36,
          );

          expect(
            page.getCropBox()
              .height,
          ).toBeGreaterThan(
            36,
          );

          expect(
            page.getRotation()
              .angle,
          ).toBe(
            originalRotations[
              index
            ],
          );
        },
      );
  });

  it("draws footer numbers inside rotated CropBoxes and produces a valid PDF", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(source);

    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica,
      );

    pdf
      .getPages()
      .forEach(
        (page, index) => {
          const text =
            `Page ${index + 1}`;

          const size = 10;

          const textWidth =
            font.widthOfTextAtSize(
              text,
              size,
            );

          const placement =
            calculateHeaderFooterPlacement(
              {
                box:
                  page.getCropBox(),
                rotationAngle:
                  page
                    .getRotation()
                    .angle,
                textWidth,
                fontSize:
                  size,
                margin: 18,
                alignment:
                  "center",
                slot:
                  "footer",
              },
            );

          page.drawText(
            text,
            {
              x: placement.x,
              y: placement.y,
              size,
              font,
              color: rgb(
                0.25,
                0.25,
                0.25,
              ),
              rotate: degrees(
                placement.rotation,
              ),
            },
          );
        },
      );

    const bytes =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await reload(bytes);

    expect(
      reloaded.getPageCount(),
    ).toBe(
      RELIABILITY_FIXTURE_PAGE_COUNT,
    );

    expect(
      reloaded
        .getPage(2)
        .getCropBox(),
    ).toMatchObject({
      x: 20,
      y: 30,
      width: 560,
      height: 740,
    });
  });

  it("resizes mixed pages proportionally and preserves page rotations", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(source);

    const rotations =
      pdf
        .getPages()
        .map(
          (page) =>
            page.getRotation()
              .angle,
        );

    const expectedSizes:
      Array<{
        width: number;
        height: number;
      }> = [];

    for (
      const page of
      pdf.getPages()
    ) {
      const sourceWidth =
        page.getWidth();

      const sourceHeight =
        page.getHeight();

      const rotation =
        page.getRotation()
          .angle;

      const target =
        resolveResizeTarget(
          "a4",
          "auto",
          sourceWidth,
          sourceHeight,
          rotation,
        );

      const scale =
        calculateProportionalFitScale(
          sourceWidth,
          sourceHeight,
          target.width,
          target.height,
        );

      expect(
        scale,
      ).toBeGreaterThan(0);

      page.scale(
        scale,
        scale,
      );

      page.setSize(
        target.width,
        target.height,
      );

      expectedSizes.push({
        width:
          target.width,
        height:
          target.height,
      });
    }

    const bytes =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await reload(bytes);

    reloaded
      .getPages()
      .forEach(
        (page, index) => {
          expect(
            page.getWidth(),
          ).toBeCloseTo(
            expectedSizes[index]
              .width,
            2,
          );

          expect(
            page.getHeight(),
          ).toBeCloseTo(
            expectedSizes[index]
              .height,
            2,
          );

          expect(
            page.getRotation()
              .angle,
          ).toBe(
            rotations[index],
          );
        },
      );
  });

  it("persists edited metadata without pdf-lib silently replacing producer values", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await reload(source);

    applyPdfMetadata(
      pdf,
      {
        title:
          "Updated Fixture",
        author:
          "QA Team",
        subject:
          "Output integrity",
        keywords:
          "one, two, three",
        creator:
          "Fixture Editor",
        producer:
          "Expected Producer",
      },
    );

    const bytes =
      await pdf.save({
        updateFieldAppearances:
          false,
      });

    const reloaded =
      await reload(bytes);

    const metadata =
      readPdfMetadata(
        reloaded,
      );

    expect(
      metadata.title,
    ).toBe(
      "Updated Fixture",
    );

    expect(
      metadata.producer,
    ).toBe(
      "Expected Producer",
    );

    expect(
      metadata.creator,
    ).toBe(
      "Fixture Editor",
    );
  });
});
