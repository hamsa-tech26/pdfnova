import {
  applyWorkflowStepDecision,
  applyWorkflowStepVerification,
  createDocumentArtifact,
  createWorkflowRecipePlans,
  createWorkflowRecipeProgress,
  inspectPdfArtifact,
  isWorkflowRecipeId,
  resumeWorkflowRecipeProgress,
  verifyPdfArtifact,
  type VerificationRequest,
  type WorkflowRecipePlan,
  type WorkflowRecipeProgress,
  type WorkflowRecipeProgressStepState,
} from "../document-engine";
import {
  getActiveWorkflowRecipeProgress,
  saveActiveWorkflowRecipeProgress,
} from "./workflowProgress";
import {
  getWorkspaceFile,
  getWorkspaceFileSummary,
  type WorkspaceFileSummary,
} from "./workspaceFiles";

function parseRecipeContext() {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  const params =
    new URLSearchParams(
      window.location.search,
    );
  const recipeId =
    params.get("recipe");
  const stepIndex =
    Number(
      params.get(
        "recipeStep",
      ),
    );

  if (
    !isWorkflowRecipeId(
      recipeId,
    ) ||
    !Number.isInteger(
      stepIndex,
    ) ||
    stepIndex < 0
  ) {
    return null;
  }

  return {
    recipeId,
    stepIndex,
  };
}

export async function ensureWorkflowRecipeProgress(
  recipe: WorkflowRecipePlan,
  summary: WorkspaceFileSummary,
) {
  const existing =
    getActiveWorkflowRecipeProgress();

  if (
    existing &&
    existing.rootId ===
      summary.rootId &&
    existing.recipeId ===
      recipe.id
  ) {
    const resumed =
      resumeWorkflowRecipeProgress(
        existing,
        summary.id,
      );

    return saveActiveWorkflowRecipeProgress(
      resumed,
    );
  }

  const created =
    createWorkflowRecipeProgress(
      recipe,
      {
        rootId:
          summary.rootId,
        workspaceFileId:
          summary.id,
      },
    );

  return saveActiveWorkflowRecipeProgress(
    created,
  );
}

export async function recordWorkflowStepDecision(
  options: {
    recipe: WorkflowRecipePlan;
    summary: WorkspaceFileSummary;
    stepIndex: number;
    state: Extract<
      WorkflowRecipeProgressStepState,
      "SKIPPED" | "NOT_NEEDED"
    >;
  },
) {
  const progress =
    await ensureWorkflowRecipeProgress(
      options.recipe,
      options.summary,
    );

  const updated =
    applyWorkflowStepDecision(
      progress,
      {
        stepIndex:
          options.stepIndex,
        state: options.state,
        workspaceFileId:
          options.summary.id,
      },
    );

  return saveActiveWorkflowRecipeProgress(
    updated,
  );
}

function verificationRequestsFor(
  operationId: string,
  sourcePageCount: number,
  sourceSize: number,
): VerificationRequest[] {
  if (
    operationId ===
    "remove-metadata"
  ) {
    return [
      { kind: "pdf-openable" },
      {
        kind:
          "page-count-equals",
        expected:
          sourcePageCount,
      },
      {
        kind:
          "common-metadata-empty",
      },
    ];
  }

  if (
    operationId ===
    "flatten-form"
  ) {
    return [
      { kind: "pdf-openable" },
      {
        kind:
          "page-count-equals",
        expected:
          sourcePageCount,
      },
      {
        kind:
          "forms-flattened",
      },
    ];
  }

  if (
    operationId ===
    "compress-pdf"
  ) {
    return [
      { kind: "pdf-openable" },
      {
        kind:
          "page-count-equals",
        expected:
          sourcePageCount,
      },
      {
        kind:
          "file-size-at-most",
        maxBytes:
          sourceSize,
      },
    ];
  }

  if (
    operationId ===
    "redact-pdf"
  ) {
    return [
      { kind: "pdf-openable" },
      {
        kind:
          "page-count-equals",
        expected:
          sourcePageCount,
      },
      {
        kind:
          "rasterized-pages",
      },
    ];
  }

  if (
    operationId ===
    "protect-pdf"
  ) {
    return [
      {
        kind:
          "encryption-applied",
      },
    ];
  }

  return [];
}

export function createWorkflowVerificationRequests(
  operationId: string,
  sourcePageCount: number,
  sourceSize: number,
) {
  return verificationRequestsFor(
    operationId,
    sourcePageCount,
    sourceSize,
  );
}

export async function recordWorkflowDerivedOutput(
  options: {
    sourceSummary: WorkspaceFileSummary;
    outputSummary: WorkspaceFileSummary;
  },
): Promise<WorkflowRecipeProgress | null> {
  const context =
    parseRecipeContext();

  if (!context) {
    return null;
  }

  const sourceFile =
    await getWorkspaceFile(
      options.sourceSummary.id,
    );
  const outputFile =
    await getWorkspaceFile(
      options.outputSummary.id,
    );

  if (
    !sourceFile ||
    !outputFile
  ) {
    return null;
  }

  const sourceArtifact =
    createDocumentArtifact(
      sourceFile,
      {
        id:
          options.sourceSummary
            .id,
        name:
          options.sourceSummary
            .name,
        mimeType:
          options.sourceSummary
            .type,
        source:
          options.sourceSummary
            .role === "derived"
            ? "operation"
            : "upload",
      },
    );
  const sourceReport =
    await inspectPdfArtifact(
      sourceArtifact,
    );
  const recipe =
    createWorkflowRecipePlans(
      sourceReport,
    ).find(
      (item) =>
        item.id ===
        context.recipeId,
    );

  if (!recipe) {
    return null;
  }

  const expectedStep =
    recipe.steps[
      context.stepIndex
    ];

  if (
    !expectedStep ||
    expectedStep.operationId !==
      options.outputSummary
        .operationId
  ) {
    return null;
  }

  let progress =
    getActiveWorkflowRecipeProgress();

  if (
    !progress ||
    progress.rootId !==
      options.sourceSummary
        .rootId ||
    progress.recipeId !==
      recipe.id
  ) {
    progress =
      await ensureWorkflowRecipeProgress(
        recipe,
        options.sourceSummary,
      );
  }

  const outputArtifact =
    createDocumentArtifact(
      outputFile,
      {
        id:
          options.outputSummary
            .id,
        name:
          options.outputSummary
            .name,
        mimeType:
          options.outputSummary
            .type,
        parentArtifactId:
          options.sourceSummary
            .id,
        createdBy:
          expectedStep.operationId,
        source: "operation",
      },
    );

  const requests =
    verificationRequestsFor(
      expectedStep.operationId,
      sourceReport.facts
        .pageCount,
      options.sourceSummary
        .size,
    );

  const verification =
    await verifyPdfArtifact(
      outputArtifact,
      requests,
    );

  const updated =
    applyWorkflowStepVerification(
      progress,
      {
        stepIndex:
          context.stepIndex,
        sourceVersionId:
          options.sourceSummary
            .id,
        outputVersionId:
          options.outputSummary
            .id,
        verification,
      },
    );

  return saveActiveWorkflowRecipeProgress(
    updated,
  );
}

export async function getWorkflowProgressForWorkspace(
  summary: WorkspaceFileSummary,
) {
  const progress =
    getActiveWorkflowRecipeProgress();

  if (
    !progress ||
    progress.rootId !==
      summary.rootId
  ) {
    return null;
  }

  const currentSummary =
    await getWorkspaceFileSummary(
      progress.currentWorkspaceFileId,
    );

  if (!currentSummary) {
    return null;
  }

  return progress;
}
