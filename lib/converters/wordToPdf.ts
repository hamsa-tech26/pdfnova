import mammoth from "mammoth";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

const PAGE_MARGIN = 50;
const FONT_SIZE = 12;
const LINE_HEIGHT = 18;
const PARAGRAPH_GAP = 8;

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const wrappedLines: string[] = [];

  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    const testWidth = font.widthOfTextAtSize(
      testLine,
      fontSize,
    );

    if (testWidth <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      wrappedLines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines;
}

export async function convertWordToPdf(
  file: File,
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.extractRawText({
    arrayBuffer,
  });

  const documentText = result.value.trim();

  if (!documentText) {
    throw new Error(
      "The Word document does not contain readable text.",
    );
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(
    StandardFonts.Helvetica,
  );

  let page: PDFPage = pdf.addPage();
  let { width, height } = page.getSize();

  const maxTextWidth = width - PAGE_MARGIN * 2;
  let yPosition = height - PAGE_MARGIN;

  function createNewPage() {
    page = pdf.addPage();

    const pageSize = page.getSize();

    width = pageSize.width;
    height = pageSize.height;
    yPosition = height - PAGE_MARGIN;
  }

  function ensureSpace(requiredHeight: number) {
    if (yPosition - requiredHeight < PAGE_MARGIN) {
      createNewPage();
    }
  }

  const paragraphs = documentText
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim());

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      ensureSpace(LINE_HEIGHT);
      yPosition -= LINE_HEIGHT;
      continue;
    }

    const wrappedLines = wrapText(
      paragraph,
      font,
      FONT_SIZE,
      maxTextWidth,
    );

    for (const line of wrappedLines) {
      ensureSpace(LINE_HEIGHT);

      page.drawText(line, {
        x: PAGE_MARGIN,
        y: yPosition,
        size: FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });

      yPosition -= LINE_HEIGHT;
    }

    ensureSpace(PARAGRAPH_GAP);
    yPosition -= PARAGRAPH_GAP;
  }

  return pdf.save();
}