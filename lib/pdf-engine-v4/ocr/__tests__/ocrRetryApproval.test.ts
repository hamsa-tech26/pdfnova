import {
  describe,
  expect,
  it,
} from "vitest";

import {
  shouldApprovePdfV4OcrRetry,
} from "../ocrRetryApproval";

describe(
  "shouldApprovePdfV4OcrRetry",
  () => {
    it(
      "approves strong retry OCR",
      () => {
        expect(
          shouldApprovePdfV4OcrRetry(
            {
              confidence: 92,
              wordCount: 19,
            },
          ),
        ).toBe(true);
      },
    );

    it(
      "rejects low-confidence retry OCR",
      () => {
        expect(
          shouldApprovePdfV4OcrRetry(
            {
              confidence: 32,
              wordCount: 19,
            },
          ),
        ).toBe(false);
      },
    );

    it(
      "rejects retry OCR with too few words",
      () => {
        expect(
          shouldApprovePdfV4OcrRetry(
            {
              confidence: 92,
              wordCount: 2,
            },
          ),
        ).toBe(false);
      },
    );
  },
);