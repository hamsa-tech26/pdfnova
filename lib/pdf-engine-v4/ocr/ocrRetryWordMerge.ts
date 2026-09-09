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
    const isDuplicate =
      merged.some(
        (existingWord) =>
          calculateOverlapRatio(
            existingWord,
            retryWord,
          ) >=
          duplicateOverlapThreshold,
      );

    if (!isDuplicate) {
      merged.push(retryWord);
    }
  }

  return merged;
}