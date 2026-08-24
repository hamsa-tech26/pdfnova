import {
  describe,
  expect,
  it,
} from "vitest";

import {
  classifyPdfV4AnalysisOutcome,
  countConfirmedTableRegions,
  createPdfV4OcrDecision,
  createPdfV4TextExtractionProfile,
  getPdfV4OutcomeConfidenceMultiplier,
} from "../analyzePdfV4";

import type {
  LogicalTable,
} from "../../model/logicalTable";

import type {
  PdfPageModel,
  PdfPageTextExtractionStatus,
} from "../../model/types";

function createTestPage(
  pageNumber: number,
  status: PdfPageTextExtractionStatus,
): PdfPageModel {
  const hasText =
    status !== "none";

  return {
    pageNumber,
    width: 595,
    height: 842,
    words: [],
    lines: [],
    blocks: [],
    textExtraction: {
  wordCount:
    hasText ? 10 : 0,
  lineCount:
    hasText ? 2 : 0,
  characterCount:
    hasText ? 50 : 0,
  status,
  qualityScore:
    status === "none"
      ? 0
      : status === "low"
        ? 0.5
        : 1,
},
  };
}

describe(
  "PDF V4 pipeline statistics",
  () => {
    it(
      "counts only regions that produced a final table",
      () => {
        const confirmedTable =
          {} as LogicalTable;

        const count =
          countConfirmedTableRegions([
            {
              table:
                confirmedTable,
            },
            {
              table: null,
            },
            {
              table:
                confirmedTable,
            },
          ]);

        expect(count).toBe(2);
      },
    );

    it(
      "returns zero when no analyzed region produced a table",
      () => {
        const count =
          countConfirmedTableRegions([
            {
              table: null,
            },
            {
              table: null,
            },
          ]);

        expect(count).toBe(0);
      },
    );
        it(
      "classifies a document with no table candidates",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome([
            {
              outcome:
                "below-threshold",
            },
            {
              outcome:
                "below-threshold",
            },
          ]);

        expect(outcome).toBe(
          "no-table-candidates",
        );
      },
    );
        it(
      "classifies cleanly rejected regions as resolved no table",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome([
            {
              outcome:
                "rejected-insufficient-columns",
            },
            {
              outcome:
                "below-threshold",
            },
          ]);

        expect(outcome).toBe(
          "resolved-no-table",
        );
      },
    );
        it(
      "classifies a successful table region as confirmed table",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome([
            {
              outcome:
                "confirmed",
            },
            {
              outcome:
                "below-threshold",
            },
          ]);

        expect(outcome).toBe(
          "confirmed-table",
        );
      },
    );
        it(
      "classifies a pending region as incomplete analysis",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome([
            {
              outcome:
                "pending",
            },
            {
              outcome:
                "below-threshold",
            },
          ]);

        expect(outcome).toBe(
          "incomplete-analysis",
        );
      },
    );
        it(
      "classifies a table build failure separately",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome([
            {
              outcome:
                "rejected-table-build",
            },
            {
              outcome:
                "below-threshold",
            },
          ]);

        expect(outcome).toBe(
          "table-build-failure",
        );
      },
    );
       it(
      "uses the expected confidence multipliers for non-confirmed outcomes",
      () => {
        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "no-extractable-text",
         ),
       ).toBe(0);

        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "no-table-candidates",
          ),
        ).toBe(0.85);

        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "resolved-no-table",
          ),
        ).toBe(0.9);

        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "incomplete-analysis",
          ),
        ).toBe(0.5);

        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "table-build-failure",
          ),
        ).toBe(0.35);

        expect(
          getPdfV4OutcomeConfidenceMultiplier(
            "confirmed-table",
          ),
        ).toBeNull();
      },
    ); 
        it(
      "classifies a document with no extractable text",
      () => {
        const outcome =
          classifyPdfV4AnalysisOutcome(
            [],
            false,
          );

        expect(outcome).toBe(
          "no-extractable-text",
        );
      },
    );
        it(
      "classifies an all-no-text document as empty",
      () => {
        const profile =
          createPdfV4TextExtractionProfile(
            {
              pages: [
                createTestPage(
                  1,
                  "none",
                ),
                createTestPage(
                  2,
                  "none",
                ),
              ],
            },
          );

        expect(profile.status).toBe(
          "empty",
        );

        expect(
          profile.noTextPageCount,
        ).toBe(2);

        expect(
          profile.sufficientTextPageCount,
        ).toBe(0);
      },
    );
        it(
      "classifies an all-sufficient document as sufficient",
      () => {
        const profile =
          createPdfV4TextExtractionProfile(
            {
              pages: [
                createTestPage(
                  1,
                  "sufficient",
                ),
                createTestPage(
                  2,
                  "sufficient",
                ),
              ],
            },
          );

        expect(profile.status).toBe(
          "sufficient",
        );

        expect(
          profile.sufficientTextPageCount,
        ).toBe(2);

        expect(
          profile.noTextPageCount,
        ).toBe(0);
      },
    );
        it(
      "classifies a document with sufficient and weak pages as mixed",
      () => {
        const profile =
          createPdfV4TextExtractionProfile(
            {
              pages: [
                createTestPage(
                  1,
                  "sufficient",
                ),
                createTestPage(
                  2,
                  "low",
                ),
                createTestPage(
                  3,
                  "none",
                ),
              ],
            },
          );

        expect(profile.status).toBe(
          "mixed",
        );

        expect(
          profile.sufficientTextPageCount,
        ).toBe(1);

        expect(
          profile.lowTextPageCount,
        ).toBe(1);

        expect(
          profile.noTextPageCount,
        ).toBe(1);
      },
    );
        it(
      "classifies a document with only low and no-text pages as low-text",
      () => {
        const profile =
          createPdfV4TextExtractionProfile(
            {
              pages: [
                createTestPage(
                  1,
                  "low",
                ),
                createTestPage(
                  2,
                  "low",
                ),
                createTestPage(
                  3,
                  "none",
                ),
              ],
            },
          );

        expect(profile.status).toBe(
          "low-text",
        );

        expect(
          profile.lowTextPageCount,
        ).toBe(2);

        expect(
          profile.noTextPageCount,
        ).toBe(1);

        expect(
          profile.sufficientTextPageCount,
        ).toBe(0);
      },
    );
        it(
      "does not require OCR when all pages have sufficient native text",
      () => {
        const decision =
          createPdfV4OcrDecision({
            pages: [
              createTestPage(
                1,
                "sufficient",
              ),
              createTestPage(
                2,
                "sufficient",
              ),
            ],
          });

        expect(decision.status).toBe(
          "not-required",
        );

        expect(
          decision.requiredPageNumbers,
        ).toEqual([]);

        expect(
          decision.nativeTextPageNumbers,
        ).toEqual([1, 2]);
      },
    );
        it(
      "selects only no-text pages for OCR in a mixed document",
      () => {
        const decision =
          createPdfV4OcrDecision({
            pages: [
              createTestPage(
                1,
                "sufficient",
              ),
              createTestPage(
                2,
                "none",
              ),
              createTestPage(
                3,
                "sufficient",
              ),
            ],
          });

        expect(decision.status).toBe(
          "page-selective",
        );

        expect(
          decision.requiredPageNumbers,
        ).toEqual([2]);

        expect(
          decision.nativeTextPageNumbers,
        ).toEqual([1, 3]);
      },
    );
        it(
      "requires OCR when all pages have no extractable text",
      () => {
        const decision =
          createPdfV4OcrDecision({
            pages: [
              createTestPage(
                1,
                "none",
              ),
              createTestPage(
                2,
                "none",
              ),
            ],
          });

        expect(decision.status).toBe(
          "required",
        );

        expect(
          decision.requiredPageNumbers,
        ).toEqual([1, 2]);

        expect(
          decision.nativeTextPageNumbers,
        ).toEqual([]);
      },
    );
        it(
      "marks low-text pages for review without automatically requiring OCR",
      () => {
        const decision =
          createPdfV4OcrDecision({
            pages: [
              createTestPage(
                1,
                "sufficient",
              ),
              createTestPage(
                2,
                "low",
              ),
            ],
          });

        expect(decision.status).toBe(
          "review",
        );

        expect(
          decision.requiredPageNumbers,
        ).toEqual([]);

        expect(
          decision.reviewPageNumbers,
        ).toEqual([2]);

        expect(
          decision.nativeTextPageNumbers,
        ).toEqual([1]);
      },
    );
  },
);