import type {
  PdfV4OcrWord,
} from "./ocrRecognizer";

import type {
  PdfV4PreparedOcrRetryImage,
} from "./ocrRetryImagePreparer";

export function remapPdfV4OcrRetryWord(
  word: PdfV4OcrWord,
  retryImage: PdfV4PreparedOcrRetryImage,
): PdfV4OcrWord {
  const {
    sourceRectangle,
    retryScale,
  } = retryImage;

  return {
    ...word,
    bounds: {
      x0:
        sourceRectangle.left +
        word.bounds.x0 /
          retryScale,

      y0:
        sourceRectangle.top +
        word.bounds.y0 /
          retryScale,

      x1:
        sourceRectangle.left +
        word.bounds.x1 /
          retryScale,

      y1:
        sourceRectangle.top +
        word.bounds.y1 /
          retryScale,
    },
  };
}

export function remapPdfV4OcrRetryWords(
  words: PdfV4OcrWord[],
  retryImage: PdfV4PreparedOcrRetryImage,
): PdfV4OcrWord[] {
  return words.map(
    (word) =>
      remapPdfV4OcrRetryWord(
        word,
        retryImage,
      ),
  );
}