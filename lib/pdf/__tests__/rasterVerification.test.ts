import {
  describe,
  expect,
  it,
} from "vitest";
import {
  PDFDocument,
  StandardFonts,
} from "pdf-lib";
import {
  inspectRasterizedPages,
} from "../rasterVerification";

const ONE_PIXEL_JPEG =
  Uint8Array.from(
    Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=",
      "base64",
    ),
  );

describe(
  "inspectRasterizedPages",
  () => {
    it("passes a page rebuilt from one image", async () => {
      const pdf =
        await PDFDocument.create();
      const image =
        await pdf.embedJpg(
          ONE_PIXEL_JPEG,
        );
      const page =
        pdf.addPage([
          200,
          100,
        ]);

      page.drawImage(image, {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
      });

      const bytes =
        await pdf.save();
      const result =
        await inspectRasterizedPages(
          new Blob([
            bytes,
          ]),
        );

      expect(result).toMatchObject({
        pageCount: 1,
        imageOnlyPageCount: 1,
        reason: null,
      });
    });

    it("rejects selectable text content", async () => {
      const pdf =
        await PDFDocument.create();
      const font =
        await pdf.embedFont(
          StandardFonts.Helvetica,
        );
      const page =
        pdf.addPage([
          200,
          100,
        ]);

      page.drawText(
        "not raster only",
        {
          font,
          size: 12,
        },
      );

      const bytes =
        await pdf.save();
      const result =
        await inspectRasterizedPages(
          new Blob([
            bytes,
          ]),
        );

      expect(
        result.imageOnlyPageCount,
      ).toBe(0);
      expect(
        result.reason,
      ).toBeTruthy();
    });
  },
);
