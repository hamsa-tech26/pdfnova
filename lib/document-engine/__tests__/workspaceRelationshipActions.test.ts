import {
  createWorkspaceIntelligenceReport,
} from "../workspace-intelligence/analyzeWorkspace";
import {
  createWorkspaceRelationshipActions,
} from "../workspace-intelligence/actions";
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

function actionsFor(
  nodes: WorkspaceIntelligenceNode[],
  activeNodeId: string,
) {
  const report =
    createWorkspaceIntelligenceReport(
      nodes,
      activeNodeId,
    );

  return createWorkspaceRelationshipActions(
    nodes,
    report,
    activeNodeId,
  );
}

describe("workspace relationship actions", () => {
  it("offers the known parent for a child branch", () => {
    const parent = node({
      id: "parent",
    });
    const child = node({
      id: "child",
      parentIds: [
        parent.id,
      ],
      rootIds: [
        parent.id,
      ],
      relationKind: "branch",
      generation: 1,
    });

    const actions = actionsFor(
      [parent, child],
      child.id,
    );

    expect(actions).toContainEqual(
      expect.objectContaining({
        kind: "make-current",
        label:
          "Review parent document",
        targetNodeId:
          parent.id,
      }),
    );
  });

  it("offers the newest saved version when an older revision is active", () => {
    const first = node({
      id: "v1",
      documentId: "doc",
    });
    const second = node({
      id: "v2",
      documentId: "doc",
      parentIds: [
        first.id,
      ],
      rootIds: [
        first.id,
      ],
      relationKind:
        "revision",
      version: 2,
      generation: 1,
    });

    const actions = actionsFor(
      [first, second],
      first.id,
    );

    expect(actions).toContainEqual(
      expect.objectContaining({
        kind: "make-current",
        label:
          "Use latest version",
        targetNodeId:
          second.id,
      }),
    );
  });

  it("offers inspection for a possible duplicate instead of making a destructive decision", () => {
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

    const actions = actionsFor(
      [first, second],
      first.id,
    );

    expect(actions).toContainEqual(
      expect.objectContaining({
        kind:
          "inspect-document",
        label:
          "Inspect possible duplicate",
        targetNodeId:
          second.id,
      }),
    );
  });

  it("offers inspection of composition parents without changing them", () => {
    const left = node({
      id: "left",
    });
    const right = node({
      id: "right",
    });
    const merged = node({
      id: "merged",
      parentIds: [
        left.id,
        right.id,
      ],
      rootIds: [
        left.id,
        right.id,
      ],
      relationKind:
        "composition",
      generation: 1,
    });

    const actions = actionsFor(
      [left, right, merged],
      merged.id,
    );

    expect(
      actions.filter(
        (action) =>
          action.kind ===
          "inspect-document",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetNodeId: left.id,
        }),
        expect.objectContaining({
          targetNodeId:
            right.id,
        }),
      ]),
    );
  });

  it("offers another branch for review when sibling branches diverge", () => {
    const parent = node({
      id: "parent",
    });
    const first = node({
      id: "branch-a",
      parentIds: [
        parent.id,
      ],
      rootIds: [
        parent.id,
      ],
      relationKind: "branch",
      generation: 1,
    });
    const second = node({
      id: "branch-b",
      parentIds: [
        parent.id,
      ],
      rootIds: [
        parent.id,
      ],
      relationKind: "branch",
      generation: 1,
    });

    const actions = actionsFor(
      [parent, first, second],
      first.id,
    );

    expect(actions).toContainEqual(
      expect.objectContaining({
        kind:
          "inspect-document",
        label:
          "Inspect sibling branch",
        targetNodeId:
          second.id,
      }),
    );
  });

  it("does not invent an action for a missing parent that is not stored locally", () => {
    const orphan = node({
      id: "orphan",
      parentIds: [
        "missing",
      ],
      rootIds: [
        "missing",
      ],
      relationKind: "branch",
      generation: 1,
    });

    const actions = actionsFor(
      [orphan],
      orphan.id,
    );

    expect(actions).toEqual([]);
  });
});
