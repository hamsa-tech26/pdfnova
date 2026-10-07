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
  it("registers the first five representative Kukureku operations with unique ids", () => {
    const operations =
      listKukurekuOperations();

    expect(operations).toHaveLength(
      5,
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

  it("does not claim shared encryption verification before it exists", () => {
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
      "does not yet claim encryption verification",
    );
  });
});
