import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createDocumentArtifact,
} from "../artifact";
import {
  createDocumentFindings,
} from "../findings/createFindings";
import {
  inspectPdfArtifact,
} from "../inspection/inspectPdf";
import {
  createInspectorChecks,
} from "../inspection/createInspectorChecks";
import {
  createReliabilityPdfBytes,
  RELIABILITY_FIXTURE_PAGE_COUNT,
} from "../../pdf/__tests__/fixtures/reliabilityFixture";

describe("document inspection", () => {
  it("extracts reliable structural facts from the shared PDF fixture", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const artifact =
      createDocumentArtifact(
        new Blob([bytes], {
          type: "application/pdf",
        }),
        {
          id: "fixture",
          name: "fixture.pdf",
          source: "test",
        },
      );

    const report =
      await inspectPdfArtifact(
        artifact,
      );

    expect(
      report.facts.pageCount,
    ).toBe(
      RELIABILITY_FIXTURE_PAGE_COUNT,
    );

    expect(
      report.facts
        .rotatedPageCount,
    ).toBe(2);

    expect(
      report.facts
        .customCropBoxPageCount,
    ).toBe(2);

    expect(
      report.facts
        .hasMixedPageSizes,
    ).toBe(true);

    expect(
      report.facts.form,
    ).toMatchObject({
      hasAcroForm: true,
      hasXfa: false,
      fieldCount: 3,
      filledFieldCount: 2,
    });

    expect(
      report.facts.form
        .fieldKinds,
    ).toMatchObject({
      text: 1,
      checkbox: 1,
      dropdown: 1,
    });

    expect(
      report.facts
        .commonMetadataFieldsPresent,
    ).toEqual(
      expect.arrayContaining([
        "title",
        "author",
        "subject",
        "keywords",
        "creator",
        "producer",
      ]),
    );
  });

  it("turns facts into findings without mixing unsupported sanitization claims into inspection", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const artifact =
      createDocumentArtifact(
        new Blob([bytes], {
          type: "application/pdf",
        }),
        {
          id: "fixture",
          name: "fixture.pdf",
          source: "test",
        },
      );

    const report =
      await inspectPdfArtifact(
        artifact,
      );

    const findings =
      createDocumentFindings(
        report,
      );

    const codes =
      findings.map(
        (finding) =>
          finding.code,
      );

    expect(codes).toEqual(
      expect.arrayContaining([
        "common-metadata-present",
        "interactive-form",
        "filled-form-values",
        "mixed-page-sizes",
        "rotated-pages",
        "custom-crop-box",
      ]),
    );

    expect(codes).not.toContain(
      "xfa-form",
    );

    expect(
      report.capabilities.find(
        (capability) =>
          capability.id ===
          "common-metadata",
      )?.note,
    ).toContain(
      "does not claim forensic",
    );

    const checks =
      createInspectorChecks(
        report,
      );

    expect(
      checks.find(
        (check) =>
          check.id ===
          "page-geometry",
      )?.status,
    ).toBe("ISSUE_FOUND");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "common-metadata",
      )?.status,
    ).toBe("ISSUE_FOUND");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "acroform",
      )?.status,
    ).toBe("ISSUE_FOUND");

    expect(
      checks.find(
        (check) =>
          check.id === "xfa",
      )?.status,
    ).toBe("CHECKED");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "attachments",
      )?.status,
    ).toBe("NOT_CHECKED");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "digital-signatures",
      )?.status,
    ).toBe("NOT_CHECKED");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "javascript-actions",
      )?.status,
    ).toBe("NOT_CHECKED");

    expect(
      checks.find(
        (check) =>
          check.id ===
          "forensic-metadata",
      )?.status,
    ).toBe("NOT_SUPPORTED");
  });
});
