import {
  alignPdfPages,
  buildWorkspaceEvidenceIndex,
  compareWorkspaceSections,
  compareWorkspaceTableSignals,
  detectMissingInformation,
  detectWorkspaceConceptContradictionsV2,
  expandLocalSemanticQuery,
  extractWorkspaceFacts,
  extractWorkspaceSections,
  extractWorkspaceTableSignals,
  mergeEvidenceIndexes,
  normalizeWorkspaceFactsV2,
  scoreDocumentCompleteness,
  searchWorkspaceEvidence,
  type PdfContentSignal,
  type WorkspaceIntelligenceNode,
} from "..";
import {
  describe,
  expect,
  it,
} from "vitest";

function node(
  id: string,
  name: string,
): WorkspaceIntelligenceNode {
  return {
    id,
    name,
    type:
      "application/pdf",
    size: 100,
    lastModified: 1,
    documentId: id,
    parentIds: [],
    rootIds: [id],
    relationKind:
      "source",
    version: 1,
    generation: 0,
  };
}

function signal(
  name: string,
  pages: Array<{
    text: string;
    source?:
      | "native"
      | "ocr-tesseract";
  }>,
): PdfContentSignal {
  const pageSignals =
    pages.map(
      (page, index) => {
        const normalized =
          page.text
            .toLowerCase()
            .replace(
              /[^\p{L}\p{N}]+/gu,
              " ",
            )
            .replace(
              /\s+/g,
              " ",
            )
            .trim();

        return {
          pageNumber:
            index + 1,
          text:
            page.text,
          normalizedText:
            normalized,
          selectableTextChars:
            normalized.length,
          source:
            page.source ??
            "native",
          confidence:
            page.source ===
            "ocr-tesseract"
              ? 91
              : undefined,
        };
      },
    );
  const rawText =
    pageSignals
      .map(
        (page) =>
          page.text,
      )
      .join("\n");
  const normalizedText =
    pageSignals
      .map(
        (page) =>
          page.normalizedText,
      )
      .join(" ");

  return {
    fileName: name,
    fileSize: 100,
    sha256:
      name
        .padEnd(64, "0")
        .slice(0, 64),
    pageCount:
      pageSignals.length,
    selectableTextChars:
      normalizedText.length,
    rawText,
    pages:
      pageSignals,
    normalizedText,
    normalizedLines:
      rawText
        .split(/\n+/)
        .map(
          (line) =>
            line
              .toLowerCase()
              .trim(),
        )
        .filter(Boolean),
  };
}

describe(
  "Private Workspace Intelligence V2 benchmark",
  () => {
    it("retrieves multilingual native-text evidence and OCR-derived evidence locally", () => {
      const inputs = [
        {
          node:
            node(
              "english",
              "english.pdf",
            ),
          signal:
            signal(
              "english.pdf",
              [
                {
                  text:
                    "PAYMENT TERMS\nThirty percent mobilization advance.",
                },
              ],
            ),
        },
        {
          node:
            node(
              "bangla",
              "bangla.pdf",
            ),
          signal:
            signal(
              "bangla.pdf",
              [
                {
                  text:
                    "প্রকল্পের কাজের সময়সীমা ৩০ দিন।",
                },
              ],
            ),
        },
        {
          node:
            node(
              "scan",
              "scan.pdf",
            ),
          signal:
            signal(
              "scan.pdf",
              [
                {
                  text:
                    "WARRANTY\nTwelve month warranty period.",
                  source:
                    "ocr-tesseract",
                },
              ],
            ),
        },
      ];
      const partials =
        inputs.map(
          (input) =>
            buildWorkspaceEvidenceIndex(
              [input],
              {
                maxNodes: 1,
                maxPages: 10,
                maxChunks: 20,
              },
            ),
        );
      const index =
        mergeEvidenceIndexes(
          partials,
          {
            maxNodes: 10,
            maxPages: 30,
            maxChunks: 60,
          },
        );

      expect(
        searchWorkspaceEvidence(
          index,
          "mobilization payment",
          1,
        )[0]?.citation
          .fileName,
      ).toBe(
        "english.pdf",
      );
      expect(
        searchWorkspaceEvidence(
          index,
          "সময়সীমা",
          1,
        )[0]?.citation
          .fileName,
      ).toBe(
        "bangla.pdf",
      );
      expect(
        searchWorkspaceEvidence(
          index,
          "warranty period",
          1,
        )[0]?.citation
          .fileName,
      ).toBe(
        "scan.pdf",
      );
    });

    it("aligns reordered pages and distinguishes additions", () => {
      const before =
        signal(
          "before.pdf",
          [
            {
              text:
                "Scope pipeline rehabilitation testing commissioning",
            },
            {
              text:
                "Payment terms thirty percent advance after agreement signing",
            },
          ],
        );
      const after =
        signal(
          "after.pdf",
          [
            {
              text:
                "Payment terms thirty percent advance after agreement signing",
            },
            {
              text:
                "Scope pipeline rehabilitation testing commissioning",
            },
            {
              text:
                "New warranty clause twelve months",
            },
          ],
        );
      const report =
        alignPdfPages(
          before,
          after,
        );

      expect(
        report.summary.moved,
      ).toBe(2);
      expect(
        report.summary.added,
      ).toBe(1);
    });

    it("detects section removal, table changes, and relative completeness without claiming certainty", () => {
      const before =
        signal(
          "before.pdf",
          [
            {
              text:
                "SCOPE OF WORK\nPipeline installation\nPAYMENT TERMS\n30% advance\nItem  Qty  Amount\nPipe  10  1000\nValve  2  500\nWARRANTY\n12 months",
            },
          ],
        );
      const after =
        signal(
          "after.pdf",
          [
            {
              text:
                "SCOPE OF WORK\nPipeline installation and testing\nPAYMENT TERMS\n20% advance\nItem  Qty  Amount\nPipe  12  1200\nValve  2  500",
            },
          ],
        );
      const sectionDiff =
        compareWorkspaceSections(
          extractWorkspaceSections(
            before,
          ),
          extractWorkspaceSections(
            after,
          ),
        );
      const tableDiff =
        compareWorkspaceTableSignals(
          extractWorkspaceTableSignals(
            before,
          ),
          extractWorkspaceTableSignals(
            after,
          ),
        );

      expect(
        detectMissingInformation(
          before,
          after,
        ).some(
          (finding) =>
            finding.title.includes(
              "WARRANTY",
            ),
        ),
      ).toBe(true);
      expect(
        sectionDiff.some(
          (finding) =>
            finding.status ===
              "changed" ||
            finding.status ===
              "removed",
        ),
      ).toBe(true);
      expect(
        tableDiff.some(
          (finding) =>
            finding.status ===
            "changed",
        ),
      ).toBe(true);
      expect(
        scoreDocumentCompleteness(
          after,
        ).explanation,
      ).toContain(
        "heuristic",
      );
    });

    it("normalizes fact concepts before conflict detection", () => {
      const first =
        buildWorkspaceEvidenceIndex(
          [
            {
              node:
                node(
                  "a",
                  "a.pdf",
                ),
              signal:
                signal(
                  "a.pdf",
                  [
                    {
                      text:
                        "Contract Value: ₹5,00,000",
                    },
                  ],
                ),
            },
          ],
        );
      const second =
        buildWorkspaceEvidenceIndex(
          [
            {
              node:
                node(
                  "b",
                  "b.pdf",
                ),
              signal:
                signal(
                  "b.pdf",
                  [
                    {
                      text:
                        "Final Amount: Rs. 550000",
                    },
                  ],
                ),
            },
          ],
        );
      const index =
        mergeEvidenceIndexes(
          [
            first,
            second,
          ],
          {
            maxNodes: 5,
            maxPages: 20,
            maxChunks: 40,
          },
        );
      const facts =
        extractWorkspaceFacts(
          index,
        );
      const normalized =
        normalizeWorkspaceFactsV2(
          facts,
        );

      expect(
        normalized
          .filter(
            (fact) =>
              fact.kind ===
              "amount",
          )
          .every(
            (fact) =>
              fact.canonicalField ===
              "contract-amount",
          ),
      ).toBe(true);
      expect(
        detectWorkspaceConceptContradictionsV2(
          facts,
        ).some(
          (conflict) =>
            conflict.label ===
            "contract amount",
        ),
      ).toBe(true);
    });

    it("expands concept language locally without enabling cloud inference", () => {
      const expanded =
        expandLocalSemanticQuery(
          "When is the bill payable?",
        );

      expect(
        expanded,
      ).toContain(
        "payment",
      );
      expect(
        expanded,
      ).toContain(
        "invoice",
      );
    });
  },
);
