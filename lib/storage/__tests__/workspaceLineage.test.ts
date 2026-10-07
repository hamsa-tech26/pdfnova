import {
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
  it("creates a stable source root", () => {
    expect(
      createSourceLineage(
        "source-1",
      ),
    ).toEqual({
      role: "source",
      parentId: null,
      rootId: "source-1",
      operationId: null,
      operationLabel: null,
      version: 1,
      generation: 0,
    });
  });

  it("creates derived versions without losing the root", () => {
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
    const third =
      createDerivedLineage(
        {
          id: "derived-2",
          ...second,
        },
        3,
        {
          operationId:
            "compress-pdf",
          operationLabel:
            "Compress PDF",
        },
      );

    expect(second).toMatchObject({
      parentId: "source-1",
      rootId: "source-1",
      version: 2,
      generation: 1,
    });
    expect(third).toMatchObject({
      parentId: "derived-2",
      rootId: "source-1",
      version: 3,
      generation: 2,
    });
  });

  it("normalizes a legacy V1 record as a source version", () => {
    expect(
      normalizeWorkspaceLineage({
        id: "legacy",
      }),
    ).toEqual({
      role: "source",
      parentId: null,
      rootId: "legacy",
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
