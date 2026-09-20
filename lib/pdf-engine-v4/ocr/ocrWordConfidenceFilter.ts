const PDF_V4_DEFAULT_MINIMUM_OCR_WORD_CONFIDENCE =
  25;

export function filterPdfV4LowConfidenceOcrWords<
  T extends {
    confidence: number;
  },
>(
  words: readonly T[],
  minimumConfidence =
    PDF_V4_DEFAULT_MINIMUM_OCR_WORD_CONFIDENCE,
): T[] {
  return words.filter(
    (word) =>
      Number.isFinite(
        word.confidence,
      ) &&
      word.confidence >=
        minimumConfidence,
  );
}