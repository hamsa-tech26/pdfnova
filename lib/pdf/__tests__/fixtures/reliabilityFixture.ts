import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";

export const RELIABILITY_FIXTURE_PAGE_COUNT = 4;

export async function createReliabilityPdfBytes() {
  const pdf =
    await PDFDocument.create();

  pdf.setTitle(
    "Kukureku Reliability Fixture",
  );
  pdf.setAuthor(
    "Kukureku QA",
  );
  pdf.setSubject(
    "Mixed page geometry, metadata, and AcroForm test document",
  );
  pdf.setKeywords([
    "kukureku",
    "reliability",
    "fixture",
  ]);
  pdf.setCreator(
    "Kukureku Test Suite",
  );
  pdf.setProducer(
    "Kukureku Test Suite",
  );

  const font =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const pages = [
    pdf.addPage([600, 800]),
    pdf.addPage([800, 600]),
    pdf.addPage([620, 840]),
    pdf.addPage([595.28, 841.89]),
  ];

  pages[1].setRotation(
    degrees(90),
  );

  pages[2].setRotation(
    degrees(270),
  );

  pages[2].setCropBox(
    20,
    30,
    560,
    740,
  );

  pages[3].setCropBox(
    12,
    18,
    560,
    790,
  );

  pages.forEach(
    (page, index) => {
      page.drawText(
        `KUKUREKU_FIXTURE_PAGE_${index + 1}`,
        {
          x: 48,
          y:
            page.getHeight() -
            72,
          size: 18,
          font,
          color: rgb(
            0.1,
            0.1,
            0.1,
          ),
        },
      );

      page.drawRectangle({
        x: 45,
        y: 45,
        width: 150,
        height: 60,
        borderWidth: 1,
        borderColor: rgb(
          0.3,
          0.3,
          0.3,
        ),
      });
    },
  );

  const form =
    pdf.getForm();

  const name =
    form.createTextField(
      "fixture.full_name",
    );

  name.setText(
    "Original Name",
  );

  name.addToPage(
    pages[0],
    {
      x: 80,
      y: 600,
      width: 220,
      height: 32,
      font,
    },
  );

  const accepted =
    form.createCheckBox(
      "fixture.accepted",
    );

  accepted.addToPage(
    pages[0],
    {
      x: 80,
      y: 540,
      width: 22,
      height: 22,
    },
  );

  const country =
    form.createDropdown(
      "fixture.country",
    );

  country.setOptions([
    "India",
    "USA",
    "UK",
  ]);

  country.select("India");

  country.addToPage(
    pages[0],
    {
      x: 80,
      y: 480,
      width: 180,
      height: 30,
      font,
    },
  );

  return pdf.save({
    updateFieldAppearances:
      false,
  });
}
