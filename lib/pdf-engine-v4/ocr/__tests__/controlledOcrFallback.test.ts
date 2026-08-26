import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runPdfV4ControlledOcr,
} from "../controlledOcrFallback";

describe(
  "runPdfV4ControlledOcr",
  () => {
    it(
      "does not run OCR when native text is sufficient",
      async () => {
        const result =
          await runPdfV4ControlledOcr(
            {} as File,
            {
              status: "not-required",
              requiredPageNumbers: [],
              reviewPageNumbers: [],
              nativeTextPageNumbers: [1],
            },
          );

        expect(result.attempted).toBe(
          false,
        );

        expect(
          result.processedPageNumbers,
        ).toEqual([]);

        expect(result.pages).toEqual(
          [],
        );
      },
    );

    it(
      "does not automatically OCR low-text review pages",
      async () => {
        const result =
          await runPdfV4ControlledOcr(
            {} as File,
            {
              status: "review",
              requiredPageNumbers: [],
              reviewPageNumbers: [1],
              nativeTextPageNumbers: [],
            },
          );

        expect(result.attempted).toBe(
          false,
        );

        expect(
          result.processedPageNumbers,
        ).toEqual([]);

        expect(result.pages).toEqual(
          [],
        );
      },
    );
  },
);