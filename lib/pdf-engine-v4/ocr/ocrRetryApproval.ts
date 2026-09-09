export type PdfV4OcrRetryApprovalInput = {
  confidence: number;
  wordCount: number;
};

export function shouldApprovePdfV4OcrRetry(
  input: PdfV4OcrRetryApprovalInput,
  minimumConfidence = 80,
  minimumWordCount = 3,
): boolean {
  return (
    input.confidence >=
      minimumConfidence &&
    input.wordCount >=
      minimumWordCount
  );
}