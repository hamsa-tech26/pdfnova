import {
  describe,
  expect,
  it,
} from "vitest";
import {
  getKukurekuOperation,
  listKukurekuOperations,
} from "../operations/registry";

describe("operation registry", () => {
  it("registers the recipe and continuity operations with unique ids", () => {
    const operations =
      listKukurekuOperations();

    expect(operations).toHaveLength(
      11,
    );

    expect(
      operations.map(
        (operation) =>
          operation.id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "remove-metadata",
        "flatten-form",
        "compress-pdf",
        "redact-pdf",
        "protect-pdf",
        "add-image-stamp-pdf",
        "crop-pdf",
        "edit-pdf-metadata",
        "reorder-pdf-pages",
        "resize-pdf-pages",
        "rotate-pdf",
      ]),
    );

    expect(
      new Set(
        operations.map(
          (operation) =>
            operation.id,
        ),
      ).size,
    ).toBe(operations.length);

    expect(
      operations.every(
        (operation) =>
          operation.localProcessing,
      ),
    ).toBe(true);
  });

  it("models conditional compression effects instead of pretending every compression path is structure-preserving", () => {
    const operation =
      getKukurekuOperation(
        "compress-pdf",
      );

    expect(
      operation?.effectProfiles.map(
        (profile) =>
          profile.mode,
      ),
    ).toEqual([
      "structure-preserving",
      "visual-raster",
    ]);

    const raster =
      operation?.effectProfiles.find(
        (profile) =>
          profile.mode ===
          "visual-raster",
      );

    expect(
      raster?.destroys,
    ).toEqual(
      expect.arrayContaining([
        "selectable-text",
        "interactive-forms",
        "links",
        "annotations",
        "digital-signatures",
      ]),
    );
  });

  it("makes destructive redaction effects explicit", () => {
    const operation =
      getKukurekuOperation(
        "redact-pdf",
      );

    expect(
      operation?.effectProfiles[0]
        .destroys,
    ).toEqual(
      expect.arrayContaining([
        "selectable-text",
        "interactive-forms",
        "vector-content",
      ]),
    );
  });

  it("registers encryption as a verifiable protected-output effect", () => {
    const operation =
      getKukurekuOperation(
        "protect-pdf",
      );

    expect(
      operation?.effectProfiles[0]
        .verifiableEffects,
    ).toContain(
      "encryption-applied",
    );

    expect(
      operation?.effectProfiles[0]
        .risks.join(" "),
    ).toContain(
      "Encryption is verified with the browser QPDF runtime",
    );
  });
});
