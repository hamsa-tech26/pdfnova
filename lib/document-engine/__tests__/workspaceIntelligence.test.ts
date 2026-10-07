import {
  createWorkspaceIntelligenceReport,
} from "../workspace-intelligence/analyzeWorkspace";
import type {
  WorkspaceIntelligenceNode,
} from "../workspace-intelligence/types";
import {
  describe,
  expect,
  it,
} from "vitest";

function node(
  overrides: Partial<WorkspaceIntelligenceNode> & {
    id: string;
    documentId?: string;
  },
): WorkspaceIntelligenceNode {
  return {
    id: overrides.id,
    name:
      overrides.name ??
      `${overrides.id}.pdf`,
    type:
      overrides.type ??
      "application/pdf",
    size:
      overrides.size ?? 100,
    lastModified:
      overrides.lastModified ?? 1,
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

describe("workspace intelligence", () => {
  it("reports known composition, branch, and shared ancestry without reading document content", () => {
    const left = node({
      id: "left",
    });
    const right = node({
      id: "right",
    });
    const merged = node({
      id: "merged",
      parentIds: [
        "left",
        "right",
      ],
      rootIds: [
        "left",
        "right",
      ],
      relationKind:
        "composition",
      generation: 1,
    });
    const child = node({
      id: "child",
      parentIds: [
        "merged",
      ],
      rootIds: [
        "left",
        "right",
      ],
      relationKind: "branch",
      generation: 2,
    });

    const report =
      createWorkspaceIntelligenceReport(
        [
          left,
          right,
          merged,
          child,
        ],
        "child",
      );

    expect(
      report.summary,
    ).toMatchObject({
      nodeCount: 4,
      documentCount: 4,
      rootCount: 2,
      compositionCount: 1,
      branchCount: 1,
    });
    expect(
      report.findings.some(
        (finding) =>
          finding.kind ===
          "composition",
      ),
    ).toBe(true);
    expect(
      report.findings.some(
        (finding) =>
          finding.kind ===
          "branch-lineage",
      ),
    ).toBe(true);
    expect(
      report.findings.some(
        (finding) =>
          finding.kind ===
          "shared-ancestry",
      ),
    ).toBe(true);
    expect(
      report.coverage,
    ).toMatchObject({
      mode: "graph-metadata-only",
      readsDocumentContent: false,
      usesCryptographicHash: false,
    });
  });

  it("reports multiple versions under one stable document identity", () => {
    const source = node({
      id: "source-v1",
      documentId: "source",
      rootIds: [
        "source-v1",
      ],
    });
    const revision = node({
      id: "source-v2",
      documentId: "source",
      parentIds: [
        "source-v1",
      ],
      rootIds: [
        "source-v1",
      ],
      relationKind:
        "revision",
      version: 2,
      generation: 1,
    });

    const report =
      createWorkspaceIntelligenceReport(
        [source, revision],
        revision.id,
      );
    const finding =
      report.findings.find(
        (item) =>
          item.kind ===
          "version-chain",
      );

    expect(finding).toMatchObject({
      confidence: "certain",
      documentIds: [
        "source",
      ],
    });
    expect(finding?.detail).toContain(
      "2 workspace versions",
    );
  });

  it("flags incomplete parent references as an attention finding", () => {
    const orphan = node({
      id: "orphan",
      parentIds: [
        "missing-parent",
      ],
      rootIds: [
        "missing-parent",
      ],
      relationKind: "branch",
      generation: 1,
    });

    const report =
      createWorkspaceIntelligenceReport(
        [orphan],
        orphan.id,
      );
    const finding =
      report.findings.find(
        (item) =>
          item.kind ===
          "missing-parent-reference",
      );

    expect(finding).toMatchObject({
      confidence: "certain",
      severity: "attention",
    });
    expect(
      finding?.evidence[0],
    ).toContain(
      "missing-parent",
    );
  });

  it("uses a conservative metadata fingerprint for possible duplicates", () => {
    const first = node({
      id: "first",
      name: "report.pdf",
      size: 2048,
      lastModified: 42,
    });
    const second = node({
      id: "second",
      name: "REPORT.pdf",
      size: 2048,
      lastModified: 42,
    });

    const report =
      createWorkspaceIntelligenceReport(
        [first, second],
      );
    const duplicate =
      report.findings.find(
        (item) =>
          item.kind ===
          "possible-duplicate",
      );

    expect(duplicate).toMatchObject({
      confidence: "strong",
      severity: "info",
    });
    expect(
      duplicate?.nextStep,
    ).toContain(
      "has not compared their bytes",
    );
  });

  it("does not call same-name documents duplicates when browser timestamps differ", () => {
    const first = node({
      id: "first",
      name: "report.pdf",
      size: 2048,
      lastModified: 42,
    });
    const second = node({
      id: "second",
      name: "report.pdf",
      size: 2048,
      lastModified: 43,
    });

    const report =
      createWorkspaceIntelligenceReport(
        [first, second],
      );

    expect(
      report.findings.some(
        (item) =>
          item.kind ===
          "possible-duplicate",
      ),
    ).toBe(false);
  });
});
