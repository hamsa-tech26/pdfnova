const PDF_V4_MAX_SUSPICIOUS_LEADING_PUNCTUATION_CONFIDENCE =
  60;

export function normalizePdfV4OcrWord<
  T extends {
    text: string;
    confidence: number;
  },
>(
  word: T,
): T {
  if (
    !Number.isFinite(
      word.confidence,
    ) ||
    word.confidence >=
      PDF_V4_MAX_SUSPICIOUS_LEADING_PUNCTUATION_CONFIDENCE
  ) {
    return word;
  }

  const normalizedText =
    word.text.replace(
      /^['’](?=[A-Za-z0-9])/,
      "",
    );

  if (
    normalizedText ===
      word.text ||
    normalizedText.length === 0
  ) {
    return word;
  }

  return {
    ...word,
    text: normalizedText,
  };
}

export function normalizePdfV4OcrWords<
  T extends {
    text: string;
    confidence: number;
  },
>(
  words: readonly T[],
): T[] {
  return words.map(
    (word) =>
      normalizePdfV4OcrWord(
        word,
      ),
  );
}