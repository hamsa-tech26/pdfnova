import { PDFDocument } from "pdf-lib";
import { forEachRenderedPdfPage } from "./render";
import {normalizeRedactionRect, isUsefulRedactionRect, redactionPixelBounds, validateRedactionPlan, type RedactionRect} from "./redactionGeometry";
export {normalizeRedactionRect, isUsefulRedactionRect, redactionPixelBounds, validateRedactionPlan, type RedactionRect} from "./redactionGeometry";

export type RedactionsByPage = Record<number, RedactionRect[]>;

function dataUrlToBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("Unable to encode the redacted page.");
  const binary = window.atob(dataUrl.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode a PDF page preview."));
    image.src = dataUrl;
  });
}

export async function createRasterRedactedPdf(
  file: File,
  redactionsByPage: RedactionsByPage,
): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error("PDF redaction is only available in the browser.");
  }

  const source = await PDFDocument.load(await file.arrayBuffer());
  const pageCount = source.getPageCount();

  // Never report a successful download if even one marked area would be
  // omitted (for example because its selected page no longer exists).
  validateRedactionPlan(redactionsByPage, pageCount);

  const output = await PDFDocument.create();

  let renderedCount = 0;

  await forEachRenderedPdfPage(
    file,
    {
      scale: 1.75,
      // Lossy source encoding can spread sensitive edge colors outside the
      // selected interval before the mask is painted. Keep both stages lossless.
      format: "png",
      maxDimension: 3200,
    },
    async (renderedPage) => {
      const image =
        await loadImage(
          renderedPage.dataUrl,
        );

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        renderedPage.width;

      canvas.height =
        renderedPage.height;

      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Canvas is not supported in this browser.",
        );
      }

      try {
        // Flatten transparency before masking so the rebuilt PDF contains a
        // single opaque raster, without a separate source alpha image.
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const rects =
          redactionsByPage[
            renderedPage.pageNumber
          ] ?? [];

        context.fillStyle =
          "#000000";

        for (
          const rawRect of
          rects
        ) {
          const rect =
            normalizeRedactionRect(
              rawRect,
            );

          if (
            !isUsefulRedactionRect(
              rect,
            )
          ) {
            continue;
          }

          const pixels = redactionPixelBounds(rect, canvas.width, canvas.height);
          context.fillRect(pixels.x, pixels.y, pixels.width, pixels.height);
        }

        const pngDataUrl =
          canvas.toDataURL(
            "image/png",
          );

        const embedded =
          await output.embedPng(
            dataUrlToBytes(
              pngDataUrl,
            ),
          );

        // Flush this page now: PDFImage.embed releases the decoded RGB buffer.
        // Deferring every image until output.save retains all page buffers and
        // compresses them in one long main-thread task at the end of export.
        await embedded.embed();

        // PDF.js clips CropBox to MediaBox and applies UserUnit as well as
        // rotation. Use that same physical viewport to avoid stretching pages.
        const visibleWidth = renderedPage.pageWidth;
        const visibleHeight = renderedPage.pageHeight;

        const outputPage =
          output.addPage([
            visibleWidth,
            visibleHeight,
          ]);

        outputPage.drawImage(
          embedded,
          {
            x: 0,
            y: 0,
            width:
              visibleWidth,
            height:
              visibleHeight,
          },
        );

        renderedCount += 1;
        // Give browser input and paint a turn between lossless page exports.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
  );

  if (
    renderedCount !==
    pageCount
  ) {
    throw new Error(
      "Not every PDF page could be rendered for secure redaction.",
    );
  }

  return output.save();
}
