import {
  DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY,
  answerWorkspaceQuestion,
  buildWorkspaceEvidenceIndex,
  createPageLevelDiff,
  createWorkspaceActionPlan,
  createWorkspaceBrief,
  createWorkspaceIntelligenceReport,
  detectWorkspaceFactContradictions,
  extractWorkspaceFacts,
  searchWorkspaceEvidence,
  verifyWorkspaceRelationships,
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
  documentId = id,
): WorkspaceIntelligenceNode {
  return {
    id,
    name,
    type: "application/pdf",
    size: 1000,
    lastModified: 1,
    documentId,
    parentIds: [],
    rootIds: [id],
    relationKind: "source",
    version: 1,
    generation: 0,
  };
}

function signal(
  fileName: string,
  pages: string[],
): PdfContentSignal {
  const normalizedPages =
    pages.map(
      (text, index) => ({
        pageNumber:
          index + 1,
        text,
        normalizedText:
          text
            .toLowerCase()
            .replace(
              /[^a-z0-9₹]+/g,
              " ",
            )
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
        selectableTextChars:
          text.length,
      }),
    );

  return {
    fileName,
    fileSize: 1000,
    sha256:
      fileName
        .padEnd(64, "0")
        .slice(0, 64),
    pageCount:
      pages.length,
    selectableTextChars:
      pages.join(" ")
        .length,
    rawText:
      pages.join("\n"),
    pages:
      normalizedPages,
    normalizedText:
      normalizedPages
        .map(
          (page) =>
            page.normalizedText,
        )
        .join(" "),
    normalizedLines:
      normalizedPages.map(
        (page) =>
          page.normalizedText,
      ),
  };
}

const tenderNode =
  node(
    "tender",
    "tender.pdf",
  );
const contractNode =
  node(
    "contract",
    "contract.pdf",
  );
const minutesNode =
  node(
    "minutes",
    "minutes.pdf",
  );

const index =
  buildWorkspaceEvidenceIndex([
    {
      node: tenderNode,
      signal: signal(
        "tender.pdf",
        [
          "Tender summary. Total Amount: ₹5,00,000. Due Date: 12/10/2026. Department: Water Resources Department.",
          "Technical eligibility requires three completed projects and a valid registration certificate.",
        ],
      ),
    },
    {
      node:
        contractNode,
      signal: signal(
        "contract.pdf",
        [
          "Contract award. Total Amount: ₹5,50,000. Due Date: 18/10/2026. Contract No: CTR-2026-44.",
          "Payment terms provide 30 percent mobilization advance after signing.",
        ],
      ),
    },
    {
      node:
        minutesNode,
      signal: signal(
        "minutes.pdf",
        [
          "Meeting minutes confirm that payment terms and the revised completion deadline were discussed.",
          "The committee requested verification of the final contract value before issue of the work order.",
        ],
      ),
    },
  ]);

describe(
  "Semantic Workspace Intelligence benchmark",
  () => {
    it("meets the local retrieval benchmark", () => {
      const cases = [
        [
          "tender technical eligibility",
          "tender.pdf",
        ],
        [
          "mobilization advance payment terms",
          "contract.pdf",
        ],
        [
          "meeting committee work order",
          "minutes.pdf",
        ],
        [
          "valid registration certificate",
          "tender.pdf",
        ],
        [
          "30 percent payment",
          "contract.pdf",
        ],
        [
          "revised completion deadline discussed",
          "minutes.pdf",
        ],
        [
          "contract award amount",
          "contract.pdf",
        ],
        [
          "three completed projects",
          "tender.pdf",
        ],
      ] as const;

      let correct = 0;

      for (
        const [
          query,
          expectedFile,
        ] of cases
      ) {
        const result =
          searchWorkspaceEvidence(
            index,
            query,
            1,
          )[0];

        if (
          result?.citation
            .fileName ===
          expectedFile
        ) {
          correct += 1;
        }
      }

      expect(
        correct / cases.length,
      ).toBeGreaterThanOrEqual(
        0.875,
      );
    });

    it("extracts structured facts and flags labeled cross-document conflicts", () => {
      const facts =
        extractWorkspaceFacts(
          index,
        );
      const contradictions =
        detectWorkspaceFactContradictions(
          facts,
        );

      expect(
        facts.some(
          (fact) =>
            fact.kind ===
              "amount" &&
            fact.value.includes(
              "5,50,000",
            ),
        ),
      ).toBe(true);
      expect(
        contradictions.some(
          (conflict) =>
            conflict.kind ===
            "amount",
        ),
      ).toBe(true);
      expect(
        contradictions.some(
          (conflict) =>
            conflict.kind ===
            "date",
        ),
      ).toBe(true);
    });

    it("returns citations instead of unsupported free-form conclusions", () => {
      const facts =
        extractWorkspaceFacts(
          index,
        );
      const contradictions =
        detectWorkspaceFactContradictions(
          facts,
        );
      const answer =
        answerWorkspaceQuestion(
          "What is the contract amount?",
          {
            index,
            facts,
            contradictions,
          },
        );

      expect(
        answer.status,
      ).toBe("answered");
      expect(
        answer.evidence[0]
          ?.citation
          .pageNumber,
      ).toBeGreaterThan(0);
      expect(
        answer.evidence[0]
          ?.citation
          .fileName,
      ).toBe(
        "contract.pdf",
      );
    });

    it("produces page-level added and changed evidence", () => {
      const before =
        signal(
          "before.pdf",
          [
            "Total Amount: ₹5,00,000. Completion date 12/10/2026.",
          ],
        );
      const after =
        signal(
          "after.pdf",
          [
            "Total Amount: ₹5,50,000. Completion date 18/10/2026.",
            "A new warranty clause applies for twelve months.",
          ],
        );
      const diff =
        createPageLevelDiff(
          before,
          after,
        );

      expect(
        diff.summary.changed,
      ).toBe(1);
      expect(
        diff.summary.added,
      ).toBe(1);
      expect(
        diff.pages[0]
          .numericChanges.length,
      ).toBeGreaterThan(0);
    });

    it("keeps the action planner approval-only and prioritizes conflicts", () => {
      const facts =
        extractWorkspaceFacts(
          index,
        );
      const contradictions =
        detectWorkspaceFactContradictions(
          facts,
        );
      const nodes = [
        tenderNode,
        contractNode,
        minutesNode,
      ];
      const report =
        createWorkspaceIntelligenceReport(
          nodes,
          tenderNode.id,
        );
      const verification =
        verifyWorkspaceRelationships(
          nodes,
        );
      const plan =
        createWorkspaceActionPlan(
          {
            nodes,
            activeNodeId:
              tenderNode.id,
            verification,
            contradictions,
          },
        );

      expect(
        plan.autoExecutionAllowed,
      ).toBe(false);
      expect(
        plan.steps.some(
          (step) =>
            step.id ===
            "review-conflicts",
        ),
      ).toBe(true);

      const brief =
        createWorkspaceBrief(
          {
            nodes,
            report,
            verification,
            contradictions,
            evidenceIndex:
              index,
            actionPlan:
              plan,
          },
        );

      expect(
        brief.attention.length,
      ).toBeGreaterThan(0);
    });

    it("keeps cloud AI disabled by default", () => {
      expect(
        DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY.cloudAiEnabled,
      ).toBe(false);
      expect(
        DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY.explicitOptInRequiredForCloudAi,
      ).toBe(true);
    });
  },
);
