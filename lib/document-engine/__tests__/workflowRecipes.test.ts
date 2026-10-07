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
  createWorkflowRecipePlans,
} from "../workflows/createWorkflowRecipes";
import {
  buildWorkflowToolHref,
  getWorkflowContinuationHref,
} from "../workflows/links";
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
        id: "recipe-fixture",
        name:
          "recipe-fixture.pdf",
        source: "test",
      },
    );

  return inspectPdfArtifact(
    artifact,
  );
}

describe("Workflow Recipes V1", () => {
  it("keeps sharing steps deterministic and user-approved", async () => {
    const report =
      await fixtureReport();
    const recipes =
      createWorkflowRecipePlans(
        report,
      );
    const recipe =
      recipes.find(
        (item) =>
          item.id ===
          "prepare-for-sharing",
      );

    expect(recipe).toMatchObject({
      availability:
        "AVAILABLE",
    });
    expect(
      recipe?.steps.map(
        (step) => [
          step.operationId,
          step.kind,
        ],
      ),
    ).toEqual([
      [
        "remove-metadata",
        "REQUIRED",
      ],
      [
        "compress-pdf",
        "OPTIONAL",
      ],
      [
        "protect-pdf",
        "USER_DECISION",
      ],
    ]);
  });

  it("marks metadata removal not needed when inspected common metadata is empty", async () => {
    const report =
      await fixtureReport();

    report.facts.commonMetadataFieldsPresent =
      [];

    const recipe =
      createWorkflowRecipePlans(
        report,
      ).find(
        (item) =>
          item.id ===
          "prepare-for-sharing",
      );

    expect(
      recipe?.steps[0],
    ).toMatchObject({
      operationId:
        "remove-metadata",
      kind: "NOT_NEEDED",
    });
  });

  it("blocks standard-form finalization when XFA is present", async () => {
    const report =
      await fixtureReport();
    report.facts.form.hasXfa =
      true;

    const recipe =
      createWorkflowRecipePlans(
        report,
      ).find(
        (item) =>
          item.id ===
          "finalize-standard-form",
      );

    expect(recipe).toMatchObject({
      availability:
        "BLOCKED",
    });
    expect(
      recipe?.steps[0],
    ).toMatchObject({
      operationId:
        "flatten-form",
      kind: "BLOCKED",
    });
  });

  it("does not claim a standard-form recipe applies when no form fields exist", async () => {
    const report =
      await fixtureReport();
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

    const recipe =
      createWorkflowRecipePlans(
        report,
      ).find(
        (item) =>
          item.id ===
          "finalize-standard-form",
      );

    expect(recipe).toMatchObject({
      availability:
        "UNAVAILABLE",
    });
  });

  it("carries recipe context into a tool and advances only after a derived result", () => {
    const toolHref =
      buildWorkflowToolHref(
        "/remove-pdf-metadata",
        "version-1",
        "prepare-for-sharing",
        0,
      );

    expect(toolHref).toBe(
      "/remove-pdf-metadata?workspaceFile=version-1&recipe=prepare-for-sharing&recipeStep=0",
    );

    expect(
      getWorkflowContinuationHref(
        "?workspaceFile=version-1&recipe=prepare-for-sharing&recipeStep=0",
        "version-2",
      ),
    ).toBe(
      "/workflow-recipes?workspaceFile=version-2&recipe=prepare-for-sharing&recipeStep=1",
    );
  });
});
