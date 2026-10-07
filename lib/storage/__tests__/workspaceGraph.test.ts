import {
  getWorkspaceChildren,
  getWorkspaceParents,
  groupWorkspaceDocuments,
} from "../workspaceGraph";
import type {
  WorkspaceFileSummary,
} from "../workspaceFiles";
import {
  describe,
  expect,
  it,
} from "vitest";

function summary(
  overrides: Partial<WorkspaceFileSummary> & {
    id: string;
  },
): WorkspaceFileSummary {
  return {
    id: overrides.id,
    name:
      overrides.name ??
      overrides.id + ".pdf",
    type: "application/pdf",
    size: 100,
    lastModified: 1,
    savedAt:
      overrides.savedAt ??
      "2026-10-07T00:00:00.000Z",
    role:
      overrides.role ??
      "source",
    parentId:
      overrides.parentId ??
      null,
    parentIds:
      overrides.parentIds ??
      [],
    rootId:
      overrides.rootId ??
      overrides.id,
    rootIds:
      overrides.rootIds ??
      [overrides.id],
    documentId:
      overrides.documentId ??
      overrides.id,
    relationKind:
      overrides.relationKind ??
      "source",
    operationId:
      overrides.operationId ??
      null,
    operationLabel:
      overrides.operationLabel ??
      null,
    version:
      overrides.version ??
      1,
    generation:
      overrides.generation ??
      0,
  };
}

describe("workspace document graph", () => {
  it("groups revisions by document identity and keeps branches separate", () => {
    const source =
      summary({
        id: "a1",
        documentId: "a1",
      });
    const revision =
      summary({
        id: "a2",
        role: "derived",
        parentId: "a1",
        parentIds: ["a1"],
        rootId: "a1",
        rootIds: ["a1"],
        documentId: "a1",
        relationKind:
          "revision",
        version: 2,
        savedAt:
          "2026-10-07T00:01:00.000Z",
      });
    const branch =
      summary({
        id: "b1",
        role: "derived",
        parentId: "a2",
        parentIds: ["a2"],
        rootId: "a1",
        rootIds: ["a1"],
        documentId: "b1",
        relationKind:
          "branch",
        savedAt:
          "2026-10-07T00:02:00.000Z",
      });

    const groups =
      groupWorkspaceDocuments(
        [
          source,
          revision,
          branch,
        ],
      );

    expect(groups).toHaveLength(
      2,
    );
    expect(
      groups.find(
        (group) =>
          group.documentId ===
          "a1",
      )?.versions.map(
        (item) => item.id,
      ),
    ).toEqual([
      "a1",
      "a2",
    ]);
    expect(
      groups.find(
        (group) =>
          group.documentId ===
          "b1",
      )?.head.id,
    ).toBe("b1");
  });

  it("resolves multi-parent composition edges", () => {
    const left =
      summary({
        id: "left",
      });
    const right =
      summary({
        id: "right",
      });
    const merged =
      summary({
        id: "merged",
        role: "derived",
        parentId: "left",
        parentIds: [
          "left",
          "right",
        ],
        rootId: "left",
        rootIds: [
          "left",
          "right",
        ],
        documentId:
          "merged",
        relationKind:
          "composition",
        operationId:
          "merge-pdf",
        operationLabel:
          "Merge PDF",
      });
    const all = [
      left,
      right,
      merged,
    ];

    expect(
      getWorkspaceParents(
        merged,
        all,
      ).map(
        (item) => item.id,
      ),
    ).toEqual([
      "left",
      "right",
    ]);
    expect(
      getWorkspaceChildren(
        left,
        all,
      ).map(
        (item) => item.id,
      ),
    ).toEqual([
      "merged",
    ]);
  });
});
