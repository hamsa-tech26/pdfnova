import type {
  PdfPageModel,
} from "../model/types";

import {
  calculatePageTextExtractionQualityScore,
  classifyPageTextExtractionStatus,
  groupWordsIntoLines,
} from "../reader/pageReader";

import type {
  PdfV4OcrPageResult,
} from "./ocrRecognizer";

import {
  adaptPdfV4OcrPageToPdfWords,
} from "./ocrWordAdapter";

export function reconstructPdfV4PageFromOcr(
  ocrPage: PdfV4OcrPageResult,
  pdfPage: PdfPageModel,
): PdfPageModel {
    if (
    ocrPage.pageNumber !==
    pdfPage.pageNumber
  ) {
    throw new Error(
      `OCR page ${ocrPage.pageNumber} does not match PDF page ${pdfPage.pageNumber}.`,
    );
  }
  const words =
    adaptPdfV4OcrPageToPdfWords(
      ocrPage,
      pdfPage,
    );

  const lines =
    groupWordsIntoLines(
      words,
      pdfPage.pageNumber,
    );

const characterCount =
  words.reduce(
    (sum, word) =>
      sum + word.text.length,
    0,
  );

  return {
  ...pdfPage,
  words,
  lines,
  blocks: [],
  textExtraction: {
    wordCount: words.length,
    lineCount: lines.length,
    characterCount,
    status:
      classifyPageTextExtractionStatus(
        words.length,
        lines.length,
        characterCount,
      ),
    qualityScore:
      calculatePageTextExtractionQualityScore(
        words.length,
        lines.length,
        characterCount,
      ),
  },
};
}