import {
  alignPdfPages,
  compareWorkspaceSections,
  detectMissingInformation,
  detectWorkspaceConceptContradictionsV2,
  expandLocalSemanticQuery,
  extractWorkspaceSections,
  normalizeWorkspaceFactsV2,
  scoreDocumentCompleteness,
  type PdfContentSignal,
  type WorkspaceFact,
} from "..";
import {
  describe,
  expect,
  it,
} from "vitest";

function signal(
  pages: string[],
): PdfContentSignal {
  return {
    fileName:
      "test.pdf",
    fileSize: 100,
    sha256:
      "a".repeat(64),
    pageCount:
      pages.length,
    selectableTextChars:
      pages.join(" ")
        .length,
    rawText:
      pages.join("\n"),
    pages:
      pages.map(
        (text, index) => ({
          pageNumber:
            index + 1,
          text,
          normalizedText:
            text
              .toLowerCase()
              .replace(
                /[^a-z0-9]+/g,
                " ",
              )
              .trim(),
          selectableTextChars:
            text.length,
          source:
            "native",
        }),
      ),
    normalizedText:
      pages
        .join(" ")
        .toLowerCase(),
    normalizedLines:
      pages.map(
        (page) =>
          page.toLowerCase(),
      ),
  };
}

describe(
  "Private Workspace Intelligence V2",
  () => {
    it("aligns reordered pages instead of comparing only page numbers", () => {
      const left =
        signal([
          "Scope of work pipeline rehabilitation and testing",
          "Payment terms thirty percent advance after signing",
        ]);
      const right =
        signal([
          "Payment terms thirty percent advance after signing",
          "Scope of work pipeline rehabilitation and testing",
        ]);
      const report =
        alignPdfPages(
          left,
          right,
        );

      expect(
        report.summary.moved,
      ).toBe(2);
    });

    it("normalizes equivalent amount field labels before contradiction checks", () => {
      const base = {
        confidence:
          "strong-pattern" as const,
        snippet: "amount",
      };
      const facts:
        WorkspaceFact[] =
        [
          {
            ...base,
            id: "a",
            kind: "amount",
            label:
              "Contract Value",
            fieldKey:
              "contract value",
            value:
              "₹5,00,000",
            normalizedValue:
              "₹500000",
            citation: {
              nodeId: "a",
              documentId:
                "doc-a",
              fileName:
                "a.pdf",
              version: 1,
              pageNumber: 1,
            },
          },
          {
            ...base,
            id: "b",
            kind: "amount",
            label:
              "Final Amount",
            fieldKey:
              "final amount",
            value:
              "Rs. 550000",
            normalizedValue:
              "₹550000",
            citation: {
              nodeId: "b",
              documentId:
                "doc-b",
              fileName:
                "b.pdf",
              version: 1,
              pageNumber: 1,
            },
          },
        ];

      const normalized =
        normalizeWorkspaceFactsV2(
          facts,
        );

      expect(
        normalized[0]
          .canonicalField,
      ).toBe(
        "contract-amount",
      );
      expect(
        normalized[1]
          .canonicalField,
      ).toBe(
        "contract-amount",
      );
      expect(
        detectWorkspaceConceptContradictionsV2(
          facts,
        ),
      ).toHaveLength(1);
    });

    it("detects a removed named section", () => {
      const previous =
        signal([
          "SCOPE OF WORK\nInstall pipeline.\nWARRANTY\nTwelve month warranty applies.",
        ]);
      const current =
        signal([
          "SCOPE OF WORK\nInstall pipeline.",
        ]);

      expect(
        detectMissingInformation(
          previous,
          current,
        ).some(
          (finding) =>
            finding.title.includes(
              "WARRANTY",
            ),
        ),
      ).toBe(true);
    });

    it("compares changed sections and scores readable structure without claiming certainty", () => {
      const left =
        signal([
          "PAYMENT TERMS\nThirty percent advance.",
        ]);
      const right =
        signal([
          "PAYMENT TERMS\nTwenty percent advance.",
        ]);
      const comparison =
        compareWorkspaceSections(
          extractWorkspaceSections(
            left,
          ),
          extractWorkspaceSections(
            right,
          ),
        );

      expect(
        comparison.some(
          (finding) =>
            finding.status ===
            "changed",
        ),
      ).toBe(true);
      expect(
        scoreDocumentCompleteness(
          right,
        ).explanation,
      ).toContain(
        "heuristic",
      );
    });

    it("expands local semantic concepts without a cloud model", () => {
      const expanded =
        expandLocalSemanticQuery(
          "When is payment due?",
        );

      expect(expanded).toContain(
        "invoice",
      );
      expect(expanded).toContain(
        "payable",
      );
    });
  },
);
