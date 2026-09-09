export type PdfV4OcrReliabilityLevel =
  | "high"
  | "review"
  | "low";

export type PdfV4OcrPageReliability = {
  pageNumber: number;
  score: number;
  level: PdfV4OcrReliabilityLevel;

  primaryConfidence: number;
  primaryWordCount: number;

  retryAttempted: boolean;
  retryApproved: boolean;
  retryConfidence?: number;
  retryWordCount?: number;
  retryAddedWordCount?: number;

  coverageRatio: number;

  reasons: string[];
};

export type PdfV4OcrReliabilityInput = {
  pageNumber: number;

  primaryConfidence: number;
  primaryWordCount: number;

  retryAttempted: boolean;
  retryApproved: boolean;
  retryConfidence?: number;
  retryWordCount?: number;
  retryAddedWordCount?: number;

  coverageRatio: number;
};

export function classifyPdfV4OcrReliabilityLevel(
  score: number,
): PdfV4OcrReliabilityLevel {
  if (score >= 85) {
    return "high";
  }

  if (score >= 60) {
    return "review";
  }

  return "low";
}

function calculateConfidenceScore(
  confidence: number,
): number {
  return Math.max(
    0,
    Math.min(confidence, 100),
  );
}

function calculateWordCountScore(
  wordCount: number,
): number {
  if (wordCount <= 0) {
    return 0;
  }

  return (
    Math.min(
      wordCount / 20,
      1,
    ) * 100
  );
}

function calculateRetryRecoveryScore(
  input: PdfV4OcrReliabilityInput,
): number {
  if (!input.retryAttempted) {
    return 100;
  }

  if (!input.retryApproved) {
    return 50;
  }

  const addedWordCount =
    input.retryAddedWordCount ?? 0;

  if (addedWordCount <= 0) {
    return 50;
  }

  return Math.min(
    50 +
      (addedWordCount / 10) * 50,
    100,
  );
}

function calculatePdfV4OcrReliabilityScore(
  input: PdfV4OcrReliabilityInput,
): number {
  const confidenceScore =
    calculateConfidenceScore(
      input.primaryConfidence,
    );

  const wordCountScore =
    calculateWordCountScore(
      input.primaryWordCount,
    );

  const retryRecoveryScore =
    calculateRetryRecoveryScore(
      input,
    );

  const score =
    confidenceScore * 0.55 +
    wordCountScore * 0.25 +
    retryRecoveryScore * 0.2;

  return Math.round(score);
}

function createPdfV4OcrReliabilityReasons(
  input: PdfV4OcrReliabilityInput,
): string[] {
  const reasons: string[] = [];

  if (input.primaryConfidence >= 90) {
    reasons.push(
      "Primary OCR confidence is strong.",
    );
  } else if (
    input.primaryConfidence < 60
  ) {
    reasons.push(
      "Primary OCR confidence is low.",
    );
  }

  if (input.primaryWordCount >= 20) {
    reasons.push(
      "OCR recovered a strong amount of text.",
    );
  } else if (
    input.primaryWordCount < 5
  ) {
    reasons.push(
      "OCR recovered very little text.",
    );
  }

  if (input.coverageRatio >= 0.75) {
    reasons.push(
      "OCR text spans a large portion of the page vertically.",
    );
  } else if (
    input.coverageRatio < 0.4
  ) {
    reasons.push(
      "OCR text occupies a limited vertical area of the page.",
    );
  }

  if (
    input.retryAttempted &&
    input.retryApproved &&
    (input.retryAddedWordCount ?? 0) > 0
  ) {
    reasons.push(
      "Approved OCR retry recovered additional text.",
    );
  } else if (
    input.retryAttempted &&
    !input.retryApproved
  ) {
    reasons.push(
      "OCR retry did not provide reliable additional text.",
    );
  }

  return reasons;
}

export function analyzePdfV4OcrReliability(
  input: PdfV4OcrReliabilityInput,
): PdfV4OcrPageReliability {
  const score =
    calculatePdfV4OcrReliabilityScore(
      input,
    );

  return {
    pageNumber: input.pageNumber,
    score,
    level:
      classifyPdfV4OcrReliabilityLevel(
        score,
      ),

    primaryConfidence:
      input.primaryConfidence,
    primaryWordCount:
      input.primaryWordCount,

    retryAttempted:
      input.retryAttempted,
    retryApproved:
      input.retryApproved,
    retryConfidence:
      input.retryConfidence,
    retryWordCount:
      input.retryWordCount,
    retryAddedWordCount:
      input.retryAddedWordCount,

    coverageRatio:
      input.coverageRatio,

    reasons:
      createPdfV4OcrReliabilityReasons(
        input,
      ),
  };
}