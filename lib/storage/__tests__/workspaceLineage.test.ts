import {
  createBranchLineage,
  createCompositionLineage,
  createDerivedLineage,
  createSourceLineage,
  isSameWorkspaceFileFingerprint,
  normalizeWorkspaceLineage,
} from "../workspaceLineage";
import {
  describe,
  expect,
  it,
} from "vitest";

describe("workspace lineage model", () => {
  it("creates a stable source document", () => {
    expect(
      createSourceLineage(
        "source-1",
      ),
    ).toEqual({
      role: "source",
      parentId: null,
      parentIds: [],
      rootId: "source-1",
      rootIds: [
        "source-1",
      ],
      documentId:
        "source-1",
      relationKind:
        "source",
      operationId: null,
      operationLabel: null,
      version: 1,
      generation: 0,
    });
  });

  it("creates revisions without changing document identity", () => {
    const source = {
      id: "source-1",
      ...createSourceLineage(
        "source-1",
      ),
    };
    const second =
      createDerivedLineage(
        source,
        2,
        {
          operationId:
            "remove-metadata",
          operationLabel:
            "Remove PDF Metadata",
        },
      );

    expect(second).toMatchObject({
      parentId: "source-1",
      parentIds: [
        "source-1",
      ],
      rootId: "source-1",
      rootIds: [
        "source-1",
      ],
      documentId:
        "source-1",
      relationKind:
        "revision",
      version: 2,
      generation: 1,
    });
  });

  it("creates a branch as a new document with source ancestry", () => {
    const source = {
      id: "source-1",
      ...createSourceLineage(
        "source-1",
      ),
    };
    const branch =
      createBranchLineage(
        source,
        "branch-1",
        {
          operationId:
            "extract-pdf-pages",
          operationLabel:
            "Extract PDF Pages",
        },
      );

    expect(branch).toMatchObject({
      role: "derived",
      parentId: "source-1",
      parentIds: [
        "source-1",
      ],
      rootIds: [
        "source-1",
      ],
      documentId:
        "branch-1",
      relationKind:
        "branch",
      version: 1,
      generation: 1,
    });
  });

  it("creates a multi-parent composition with all source roots", () => {
    const left = {
      id: "left-v2",
      ...createDerivedLineage(
        {
          id: "left",
          ...createSourceLineage(
            "left",
          ),
        },
        2,
        {
          operationId:
            "rotate-pdf",
          operationLabel:
            "Rotate PDF",
        },
      ),
    };
    const right = {
      id: "right",
      ...createSourceLineage(
        "right",
      ),
    };
    const merged =
      createCompositionLineage(
        [left, right],
        "merged",
        {
          operationId:
            "merge-pdf",
          operationLabel:
            "Merge PDF",
        },
      );

    expect(merged).toMatchObject({
      parentIds: [
        "left-v2",
        "right",
      ],
      rootIds: [
        "left",
        "right",
      ],
      documentId:
        "merged",
      relationKind:
        "composition",
      version: 1,
      generation: 2,
    });
  });

  it("migrates legacy V2 lineage into the graph model", () => {
    expect(
      normalizeWorkspaceLineage({
        id: "legacy-v2",
        role: "derived",
        parentId:
          "legacy-v1",
        rootId:
          "legacy-v1",
        operationId:
          "compress-pdf",
        operationLabel:
          "Compress PDF",
        version: 2,
        generation: 1,
      }),
    ).toEqual({
      role: "derived",
      parentId:
        "legacy-v1",
      parentIds: [
        "legacy-v1",
      ],
      rootId:
        "legacy-v1",
      rootIds: [
        "legacy-v1",
      ],
      documentId:
        "legacy-v1",
      relationKind:
        "revision",
      operationId:
        "compress-pdf",
      operationLabel:
        "Compress PDF",
      version: 2,
      generation: 1,
    });
  });

  it("normalizes a legacy V1 record as a source document", () => {
    expect(
      normalizeWorkspaceLineage({
        id: "legacy",
      }),
    ).toEqual({
      role: "source",
      parentId: null,
      parentIds: [],
      rootId: "legacy",
      rootIds: [
        "legacy",
      ],
      documentId:
        "legacy",
      relationKind:
        "source",
      operationId: null,
      operationLabel: null,
      version: 1,
      generation: 0,
    });
  });

  it("requires the complete browser file fingerprint to match", () => {
    const stored = {
      name: "source.pdf",
      type: "application/pdf",
      size: 1200,
      lastModified: 42,
    };

    expect(
      isSameWorkspaceFileFingerprint(
        stored,
        { ...stored },
      ),
    ).toBe(true);

    expect(
      isSameWorkspaceFileFingerprint(
        stored,
        {
          ...stored,
          size: 1201,
        },
      ),
    ).toBe(false);

    expect(
      isSameWorkspaceFileFingerprint(
        stored,
        {
          ...stored,
          lastModified: 43,
        },
      ),
    ).toBe(false);
  });
});
