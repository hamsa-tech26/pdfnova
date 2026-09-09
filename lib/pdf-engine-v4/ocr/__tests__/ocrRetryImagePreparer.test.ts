import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isPdfV4OcrRetryRegionMeaningful,
} from "../ocrRetryImagePreparer";

describe(
  "isPdfV4OcrRetryRegionMeaningful",
  () => {
    it(
      "rejects a negligible retry crop",
      () => {
        expect(
          isPdfV4OcrRetryRegionMeaningful(
            13,
            1628,
          ),
        ).toBe(false);
      },
    );

    it(
      "keeps a substantial retry crop",
      () => {
        expect(
          isPdfV4OcrRetryRegionMeaningful(
            519,
            1628,
          ),
        ).toBe(true);
      },
    );

    it(
      "rejects invalid dimensions",
      () => {
        expect(
          isPdfV4OcrRetryRegionMeaningful(
            0,
            1628,
          ),
        ).toBe(false);

        expect(
          isPdfV4OcrRetryRegionMeaningful(
            100,
            0,
          ),
        ).toBe(false);
      },
    );
  },
);