import { PDFDocument } from "pdf-lib";
import { renderPdfPages } from "./render";

export type RedactionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RedactionsByPage = Record<number, RedactionRect[]>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRedactionRect(rect: RedactionRect): RedactionRect {
  const x1 = clamp(Math.min(rect.x, rect.x + rect.width), 0, 1);
  const y1 = clamp(Math.min(rect.y, rect.y + rect.height), 0, 1);
  const x2 = clamp(Math.max(rect.x, rect.x + rect.width), 0, 1);
  const y2 = clamp(Math.max(rect.y, rect.y + rect.height), 0, 1);
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}

export function isUsefulRedactionRect(rect: RedactionRect) {
  const normalized = normalizeRedactionRect(rect);
  return normalized.width >= 0.005 && normalized.height >= 0.005;
}

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

  const redactionCount = Object.values(redactionsByPage)
    .flat()
    .filter(isUsefulRedactionRect)
    .length;

  if (redactionCount === 0) {
    throw new Error("Add at least one redaction area before creating the PDF.");
  }

  const source = await PDFDocument.load(await file.arrayBuffer());
  const pageCount = source.getPageCount();

  const output = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const rendered = await renderPdfPages(file, {
      scale: 1.75,
      quality: 0.92,
      pageNumbers: [index + 1],
      format: "jpeg",
    });

    const renderedPage = rendered[0];

    if (!renderedPage) {
      throw new Error(
        `Page ${index + 1} could not be rendered for secure redaction.`,
      );
    }

    const sourcePage = source.getPage(index);
    const image = await loadImage(renderedPage.dataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = renderedPage.width;
    canvas.height = renderedPage.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not supported in this browser.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const rects = redactionsByPage[index + 1] ?? [];
    context.fillStyle = "#000000";

    for (const rawRect of rects) {
      const rect = normalizeRedactionRect(rawRect);
      if (!isUsefulRedactionRect(rect)) continue;

      context.fillRect(
        Math.round(rect.x * canvas.width),
        Math.round(rect.y * canvas.height),
        Math.ceil(rect.width * canvas.width),
        Math.ceil(rect.height * canvas.height),
      );
    }

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.93);
    const embedded = await output.embedJpg(dataUrlToBytes(jpegDataUrl));

    const cropBox = sourcePage.getCropBox();
    const rotation = ((sourcePage.getRotation().angle % 360) + 360) % 360;
    const quarterTurn = rotation === 90 || rotation === 270;
    const visibleWidth = quarterTurn ? cropBox.height : cropBox.width;
    const visibleHeight = quarterTurn ? cropBox.width : cropBox.height;

    const outputPage = output.addPage([visibleWidth, visibleHeight]);
    outputPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: visibleWidth,
      height: visibleHeight,
    });

    canvas.width = 0;
    canvas.height = 0;
  }

  return output.save();
}
