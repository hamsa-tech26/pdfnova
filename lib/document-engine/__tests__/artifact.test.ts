import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createDerivedArtifact,
  createDocumentArtifact,
} from "../artifact";

describe("document artifacts", () => {
  it("keeps Blob-backed artifacts without copying them into another byte representation", () => {
    const blob = new Blob(
      ["kukureku"],
      {
        type: "application/pdf",
      },
    );

    const artifact =
      createDocumentArtifact(
        blob,
        {
          id: "source",
          name: "source.pdf",
          source: "upload",
          createdAt: 123,
        },
      );

    expect(artifact.blob).toBe(
      blob,
    );
    expect(artifact.size).toBe(
      blob.size,
    );
    expect(
      artifact.mimeType,
    ).toBe("application/pdf");
    expect(artifact.source).toBe(
      "upload",
    );
  });

  it("links a derived artifact back to its parent", () => {
    const parent =
      createDocumentArtifact(
        new Blob(["source"]),
        {
          id: "source",
          name: "source.pdf",
        },
      );

    const derived =
      createDerivedArtifact(
        parent,
        new Blob(["output"]),
        {
          id: "output",
          name: "output.pdf",
          createdBy:
            "remove-metadata",
        },
      );

    expect(
      derived.parentArtifactId,
    ).toBe("source");
    expect(derived.source).toBe(
      "operation",
    );
  });
});
