import type {
  PdfV4OcrWord,
} from "./ocrRecognizer";

function calculateWordArea(
  word: PdfV4OcrWord,
): number {
  return Math.max(
    0,
    word.bounds.x1 -
      word.bounds.x0,
  ) *
    Math.max(
      0,
      word.bounds.y1 -
        word.bounds.y0,
    );
}

function calculateOverlapRatio(
  first: PdfV4OcrWord,
  second: PdfV4OcrWord,
): number {
  const intersectionLeft =
    Math.max(
      first.bounds.x0,
      second.bounds.x0,
    );

  const intersectionTop =
    Math.max(
      first.bounds.y0,
      second.bounds.y0,
    );

  const intersectionRight =
    Math.min(
      first.bounds.x1,
      second.bounds.x1,
    );

  const intersectionBottom =
    Math.min(
      first.bounds.y1,
      second.bounds.y1,
    );

  const intersectionWidth =
    Math.max(
      0,
      intersectionRight -
        intersectionLeft,
    );

  const intersectionHeight =
    Math.max(
      0,
      intersectionBottom -
        intersectionTop,
    );

  const intersectionArea =
    intersectionWidth *
    intersectionHeight;

  if (intersectionArea <= 0) {
    return 0;
  }

  const smallerArea =
    Math.min(
      calculateWordArea(first),
      calculateWordArea(second),
    );

  if (smallerArea <= 0) {
    return 0;
  }

  return (
    intersectionArea /
    smallerArea
  );
}

export function mergePdfV4OcrRetryWords(
  primaryWords: PdfV4OcrWord[],
  retryWords: PdfV4OcrWord[],
  duplicateOverlapThreshold = 0.6,
): PdfV4OcrWord[] {
  const merged =
    [...primaryWords];

  for (const retryWord of retryWords) {
    // The retry is recognized from an independently enhanced image crop.
    // On the same source coordinates, an overlapping *weak* primary OCR
    // word must not automatically veto a substantially better retry.
    const duplicateIndex =
      merged.findIndex(
        (existingWord) =>
          calculateOverlapRatio(
            existingWord,
            retryWord,
          ) >= duplicateOverlapThreshold,
      );

    if (duplicateIndex === -1) {
      merged.push(retryWord);
      continue;
    }

    const existingWord = merged[duplicateIndex];
    const materiallyBetter =
      Number.isFinite(existingWord.confidence) &&
      Number.isFinite(retryWord.confidence) &&
      existingWord.confidence < 70 &&
      retryWord.confidence >= 80 &&
      retryWord.confidence - existingWord.confidence >= 15 &&
      retryWord.text.trim().length > 0;

    if (materiallyBetter) {
      // Preserve the primary reading order but retain the actual retry
      // candidate and its provenance; never hallucinate a corrected token.
      merged[duplicateIndex] = retryWord;
    }
  }

  return merged;
}