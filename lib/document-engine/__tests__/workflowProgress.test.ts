import {
  describe,
  expect,
  it,
} from "vitest";
import {
  applyWorkflowStepDecision,
  applyWorkflowStepVerification,
  createWorkflowRecipeProgress,
} from "../workflows/progress";
import type {
  WorkflowRecipePlan,
} from "../workflows/types";
import {
  createWorkflowVerificationRequests,
} from "../../storage/workflowRecipeContinuity";
import type {
  VerificationReport,
} from "../verification/types";

const recipe: WorkflowRecipePlan = {
  id: "prepare-for-sharing",
  title: "Prepare for Sharing",
  description: "Test recipe",
  availability: "AVAILABLE",
  availabilityReason: "test",
  evidence: [],
  cautions: [],
  steps: [
    {
      index: 0,
      operationId:
        "remove-metadata",
      title:
        "Remove PDF Metadata",
      route:
        "/remove-pdf-metadata",
      kind: "REQUIRED",
      reason: "test",
      evidence: [],
    },
    {
      index: 1,
      operationId:
        "compress-pdf",
      title: "Compress PDF",
      route:
        "/compress-pdf",
      kind: "OPTIONAL",
      reason: "test",
      evidence: [],
    },
    {
      index: 2,
      operationId:
        "protect-pdf",
      title: "Protect PDF",
      route:
        "/protect-pdf",
      kind:
        "USER_DECISION",
      reason: "test",
      evidence: [],
    },
  ],
};

function verification(
  status:
    | "PASS"
    | "PASS_WITH_WARNING"
    | "FAILED"
    | "NOT_VERIFIED",
): VerificationReport {
  return {
    artifactId: "output",
    status,
    checks: [],
    verifiedAt: 100,
  };
}

describe("workflow recipe progress", () => {
  it("starts at the first step and persists the current workspace version", () => {
    const progress =
      createWorkflowRecipeProgress(
        recipe,
        {
          rootId: "root",
          workspaceFileId:
            "version-1",
          now: 10,
        },
      );

    expect(progress).toMatchObject({
      currentStep: 0,
      status: "IN_PROGRESS",
      currentWorkspaceFileId:
        "version-1",
    });

    expect(
      progress.steps.map(
        (step) => step.state,
      ),
    ).toEqual([
      "PENDING",
      "PENDING",
      "PENDING",
    ]);
  });

  it("records an explicit skip and advances without inventing verification", () => {
    const progress =
      createWorkflowRecipeProgress(
        recipe,
        {
          rootId: "root",
          workspaceFileId:
            "version-1",
          now: 10,
        },
      );

    const next =
      applyWorkflowStepDecision(
        progress,
        {
          stepIndex: 0,
          state: "SKIPPED",
          workspaceFileId:
            "version-1",
          now: 20,
        },
      );

    expect(next).toMatchObject({
      currentStep: 1,
      status: "IN_PROGRESS",
    });
    expect(
      next.steps[0],
    ).toMatchObject({
      state: "SKIPPED",
      verification: null,
    });
  });

  it("advances when verification is not supported but records NOT_VERIFIED honestly", () => {
    const progress =
      createWorkflowRecipeProgress(
        recipe,
        {
          rootId: "root",
          workspaceFileId:
            "version-1",
        },
      );

    const next =
      applyWorkflowStepVerification(
        progress,
        {
          stepIndex: 0,
          sourceVersionId:
            "version-1",
          outputVersionId:
            "version-2",
          verification:
            verification(
              "NOT_VERIFIED",
            ),
        },
      );

    expect(next).toMatchObject({
      currentStep: 1,
      status: "IN_PROGRESS",
      currentWorkspaceFileId:
        "version-2",
    });
    expect(
      next.steps[0],
    ).toMatchObject({
      state: "COMPLETED",
      outputVersionId:
        "version-2",
      verification: {
        status:
          "NOT_VERIFIED",
      },
    });
  });

  it("blocks recipe advancement when a deterministic verification fails", () => {
    const progress =
      createWorkflowRecipeProgress(
        recipe,
        {
          rootId: "root",
          workspaceFileId:
            "version-1",
        },
      );

    const next =
      applyWorkflowStepVerification(
        progress,
        {
          stepIndex: 0,
          sourceVersionId:
            "version-1",
          outputVersionId:
            "version-2",
          verification:
            verification("FAILED"),
        },
      );

    expect(next).toMatchObject({
      currentStep: 0,
      status:
        "BLOCKED_BY_VERIFICATION",
      currentWorkspaceFileId:
        "version-2",
    });
    expect(
      next.steps[0].state,
    ).toBe(
      "FAILED_VERIFICATION",
    );
  });

  it("marks the recipe completed after the final recorded decision", () => {
    let progress =
      createWorkflowRecipeProgress(
        recipe,
        {
          rootId: "root",
          workspaceFileId:
            "version-1",
        },
      );

    progress =
      applyWorkflowStepDecision(
        progress,
        {
          stepIndex: 0,
          state: "NOT_NEEDED",
          workspaceFileId:
            "version-1",
        },
      );
    progress =
      applyWorkflowStepDecision(
        progress,
        {
          stepIndex: 1,
          state: "SKIPPED",
          workspaceFileId:
            "version-1",
        },
      );
    progress =
      applyWorkflowStepDecision(
        progress,
        {
          stepIndex: 2,
          state: "SKIPPED",
          workspaceFileId:
            "version-1",
        },
      );

    expect(progress.status).toBe(
      "COMPLETED",
    );
    expect(progress.currentStep).toBe(
      3,
    );
  });

  it("builds only verification requests Kukureku can state explicitly", () => {
    expect(
      createWorkflowVerificationRequests(
        "remove-metadata",
        3,
        5000,
      ),
    ).toEqual([
      {
        kind: "pdf-openable",
      },
      {
        kind:
          "page-count-equals",
        expected: 3,
      },
      {
        kind:
          "common-metadata-empty",
      },
    ]);

    expect(
      createWorkflowVerificationRequests(
        "protect-pdf",
        3,
        5000,
      ),
    ).toEqual([
      {
        kind:
          "encryption-applied",
      },
    ]);
  });
});
