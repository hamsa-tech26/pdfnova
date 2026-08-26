import type {
  PdfBoundingBox,
  PdfPageModel,
  PdfWord,
} from "../model/types";

import type {
  PdfV4OcrPageResult,
  PdfV4OcrWord,
} from "./ocrRecognizer";

export function convertPdfV4OcrWordBounds(
  word: PdfV4OcrWord,
  renderedWidth: number,
  renderedHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): PdfBoundingBox {
  if (
    renderedWidth <= 0 ||
    renderedHeight <= 0 ||
    pdfWidth <= 0 ||
    pdfHeight <= 0
  ) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  const scaleX =
    pdfWidth / renderedWidth;

  const scaleY =
    pdfHeight / renderedHeight;

  return {
    x: word.bounds.x0 * scaleX,
    y:
      pdfHeight -
      word.bounds.y1 * scaleY,
    width:
      (word.bounds.x1 -
        word.bounds.x0) *
      scaleX,
    height:
      (word.bounds.y1 -
        word.bounds.y0) *
      scaleY,
  };
}

export function adaptPdfV4OcrWordToPdfWord(
  word: PdfV4OcrWord,
  pageNumber: number,
  wordIndex: number,
  renderedWidth: number,
  renderedHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): PdfWord {
  const bounds =
    convertPdfV4OcrWordBounds(
      word,
      renderedWidth,
      renderedHeight,
      pdfWidth,
      pdfHeight,
    );

  return {
    id: `ocr-word-${pageNumber}-${wordIndex}`,
    text: word.text,
    pageNumber,
    bounds,
    font: {
      name: "ocr-tesseract",
      size: bounds.height,
    },
    rotation: 0,
    extractionProvenance: {
      source: "ocr-tesseract",
      confidence: word.confidence,
    },
  };
}

export function adaptPdfV4OcrWordsToPdfWords(
  words: PdfV4OcrWord[],
  pageNumber: number,
  renderedWidth: number,
  renderedHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): PdfWord[] {
  return words.map(
    (word, wordIndex) =>
      adaptPdfV4OcrWordToPdfWord(
        word,
        pageNumber,
        wordIndex,
        renderedWidth,
        renderedHeight,
        pdfWidth,
        pdfHeight,
      ),
  );
}

export function adaptPdfV4OcrPageToPdfWords(
  ocrPage: PdfV4OcrPageResult,
  pdfPage: PdfPageModel,
): PdfWord[] {
  return adaptPdfV4OcrWordsToPdfWords(
    ocrPage.words,
    ocrPage.pageNumber,
    ocrPage.renderedWidth,
    ocrPage.renderedHeight,
    pdfPage.width,
    pdfPage.height,
  );
}
