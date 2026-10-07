import {
  createWorkspaceCopilotAnswers,
  selectWorkspaceCopilotComparisonTarget,
  type WorkspaceIntelligenceNode,
  type WorkspaceIntelligenceReport,
  type WorkspaceRelationshipVerificationReport,
} from "..";
import {
  describe,
  expect,
  it,
} from "vitest";

function node(
  overrides: Partial<WorkspaceIntelligenceNode> & {
    id: string;
  },
): WorkspaceIntelligenceNode {
  return {
    id: overrides.id,
    name:
      overrides.name ??
      `${overrides.id}.pdf`,
    type:
      "application/pdf",
    size: 100,
    lastModified: 1,
    documentId:
      overrides.documentId ??
      overrides.id,
    parentIds:
      overrides.parentIds ?? [],
    rootIds:
      overrides.rootIds ?? [
        overrides.id,
      ],
    relationKind:
      overrides.relationKind ??
      "source",
    version:
      overrides.version ?? 1,
    generation:
      overrides.generation ?? 0,
  };
}

function report(
  activeNodeId: string,
): WorkspaceIntelligenceReport {
  return {
    schemaVersion: 1,
    activeNodeId,
    activeDocumentId:
      "doc",
    summary: {
      nodeCount: 2,
      documentCount: 1,
      rootCount: 1,
      compositionCount: 0,
      branchCount: 0,
    },
    findings: [],
    coverage: {
      mode:
        "graph-metadata-only",
      readsDocumentContent:
        false,
      usesCryptographicHash:
        false,
      notes: [],
    },
  };
}

const verification: WorkspaceRelationshipVerificationReport =
  {
    status: "PASS",
    checks: [],
    verifiedNodeCount: 2,
    verifiedAt: 1,
  };

describe(
  "Workspace Copilot V1",
  () => {
    it("recommends the newest saved version", () => {
      const nodes = [
        node({
          id: "v1",
          documentId: "doc",
          version: 1,
        }),
        node({
          id: "v2",
          documentId: "doc",
          version: 2,
          relationKind:
            "revision",
          parentIds: [
            "v1",
          ],
          rootIds: [
            "v1",
          ],
          generation: 1,
        }),
      ];

      const answers =
        createWorkspaceCopilotAnswers(
          {
            nodes,
            report:
              report("v1"),
            verification,
            activeNodeId:
              "v1",
          },
        );
      const version =
        answers.find(
          (answer) =>
            answer.question ===
            "which-version",
        );

      expect(
        version?.status,
      ).toBe("attention");
      expect(
        version?.action,
      ).toMatchObject({
        kind:
          "make-current",
        targetNodeId: "v2",
      });
    });

    it("selects a stored parent as the first comparison target", () => {
      const nodes = [
        node({
          id: "parent",
          documentId:
            "parent-doc",
        }),
        node({
          id: "child",
          documentId:
            "child-doc",
          relationKind:
            "branch",
          parentIds: [
            "parent",
          ],
          rootIds: [
            "parent",
          ],
          generation: 1,
        }),
      ];

      const target =
        selectWorkspaceCopilotComparisonTarget(
          nodes,
          {
            ...report(
              "child",
            ),
            activeDocumentId:
              "child-doc",
          },
          "child",
        );

      expect(target).toEqual({
        targetNodeId:
          "parent",
        reason:
          "parent",
      });
    });

    it("explains a probable revision from deterministic comparison evidence", () => {
      const nodes = [
        node({
          id: "v1",
          documentId: "doc",
        }),
        node({
          id: "v2",
          documentId: "doc",
          version: 2,
          relationKind:
            "revision",
          parentIds: [
            "v1",
          ],
          rootIds: [
            "v1",
          ],
          generation: 1,
        }),
      ];

      const answers =
        createWorkspaceCopilotAnswers(
          {
            nodes,
            report:
              report("v2"),
            verification,
            activeNodeId:
              "v2",
            comparison: {
              targetNodeId:
                "v1",
              targetName:
                "v1.pdf",
              reason:
                "parent",
              comparison: {
                relationship:
                  "probable-revision",
                exactDuplicate:
                  false,
                textComparable:
                  true,
                textSimilarity:
                  0.91,
                pageCountDelta:
                  -1,
                commonLineCount:
                  10,
                leftOnlyLineCount:
                  2,
                rightOnlyLineCount:
                  1,
              },
            },
          },
        );

      const changed =
        answers.find(
          (answer) =>
            answer.question ===
            "what-changed",
        );

      expect(
        changed?.title,
      ).toContain(
        "revision",
      );
      expect(
        changed?.evidence,
      ).toEqual(
        expect.arrayContaining([
          {
            label:
              "Text similarity",
            value: "91%",
          },
        ]),
      );
    });

    it("prioritizes Safe Share review when sharing findings require attention", () => {
      const nodes = [
        node({
          id: "v1",
          documentId: "doc",
        }),
      ];

      const answers =
        createWorkspaceCopilotAnswers(
          {
            nodes,
            report:
              report("v1"),
            verification: {
              ...verification,
              verifiedNodeCount:
                1,
            },
            activeNodeId:
              "v1",
            safeShare: {
              status:
                "REVIEW_REQUIRED",
              statement:
                "Review before sharing.",
              issues: [
                {
                  kind:
                    "common-metadata",
                  title:
                    "Metadata present",
                  detail:
                    "Metadata needs review.",
                },
              ],
            },
          },
        );

      const next =
        answers.find(
          (answer) =>
            answer.question ===
            "next-step",
        );

      expect(
        next?.action?.kind,
      ).toBe(
        "safe-share",
      );
      expect(
        next?.status,
      ).toBe(
        "attention",
      );
    });

    it("does not invent change evidence when no related document is available", () => {
      const nodes = [
        node({
          id: "only",
          documentId: "doc",
        }),
      ];

      const answers =
        createWorkspaceCopilotAnswers(
          {
            nodes,
            report:
              report("only"),
            verification: {
              ...verification,
              verifiedNodeCount:
                1,
            },
            activeNodeId:
              "only",
          },
        );

      const changed =
        answers.find(
          (answer) =>
            answer.question ===
            "what-changed",
        );

      expect(
        changed?.status,
      ).toBe(
        "not-verified",
      );
    });
  },
);
