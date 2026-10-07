import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createDocumentArtifact,
} from "../artifact";
import {
  inspectPdfArtifact,
} from "../inspection/inspectPdf";
import {
  createMagicDropPlan,
} from "../planning/createMagicDropPlan";
import {
  createReliabilityPdfBytes,
} from "../../pdf/__tests__/fixtures/reliabilityFixture";

async function fixtureReport() {
  const bytes =
    await createReliabilityPdfBytes();

  const artifact =
    createDocumentArtifact(
      new Blob([bytes], {
        type: "application/pdf",
      }),
      {
        id: "magic-drop-fixture",
        name: "magic-drop-fixture.pdf",
        source: "test",
      },
    );

  return inspectPdfArtifact(artifact);
}

describe("Magic Drop planning", () => {
  it("recommends only actions supported by inspected facts", async () => {
    const report =
      await fixtureReport();
    const plan =
      createMagicDropPlan(report);

    expect(
      plan.recommendations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId:
            "remove-metadata",
          kind: "RECOMMENDED",
          route:
            "/remove-pdf-metadata",
        }),
        expect.objectContaining({
          operationId:
            "flatten-form",
          kind: "RECOMMENDED",
          route: "/flatten-pdf",
        }),
      ]),
    );

    expect(
      plan.recommendations.some(
        (item) =>
          item.operationId ===
          "redact-pdf",
      ),
    ).toBe(false);

    expect(
      plan.recommendations.some(
        (item) =>
          item.operationId ===
          "protect-pdf",
      ),
    ).toBe(false);

    expect(
      plan.cautions.some(
        (item) =>
          item.id ===
          "not-checked-capabilities",
      ),
    ).toBe(true);
  });

  it("blocks the standard flatten recommendation when XFA is present", async () => {
    const report =
      await fixtureReport();

    report.facts.form.hasXfa = true;

    const plan =
      createMagicDropPlan(report);

    const flatten =
      plan.recommendations.find(
        (item) =>
          item.operationId ===
          "flatten-form",
      );

    expect(flatten).toMatchObject({
      kind: "BLOCKED",
      route: undefined,
    });
  });

  it("treats large-file compression as optional rather than required", async () => {
    const report =
      await fixtureReport();

    report.facts.size =
      12 * 1024 * 1024;

    const plan =
      createMagicDropPlan(report);

    expect(
      plan.recommendations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId:
            "compress-pdf",
          kind: "OPTIONAL",
          route: "/compress-pdf",
        }),
      ]),
    );
  });

  it("does not invent an action for a clean supported fact set", async () => {
    const report =
      await fixtureReport();

    report.facts.commonMetadataFieldsPresent =
      [];
    report.facts.metadata = {
      title: "",
      author: "",
      subject: "",
      keywords: "",
      creator: "",
      producer: "",
    };
    report.facts.form = {
      hasAcroForm: false,
      hasXfa: false,
      fieldCount: 0,
      filledFieldCount: 0,
      fieldKinds: {
        text: 0,
        checkbox: 0,
        dropdown: 0,
        "option-list": 0,
        radio: 0,
        unsupported: 0,
      },
    };
    report.facts.size = 1024;

    const plan =
      createMagicDropPlan(report);

    expect(
      plan.recommendations,
    ).toHaveLength(0);
    expect(plan.headline).toContain(
      "No fact-derived cleanup step",
    );
  });
});
