import type {
  KukurekuOperationId,
} from "../operations/types";
import type {
  VerificationReport,
} from "../verification/types";
import type {
  WorkflowRecipePlan,
  WorkflowRecipeId,
} from "./types";

export type WorkflowRecipeProgressStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED_BY_VERIFICATION";

export type WorkflowRecipeProgressStepState =
  | "PENDING"
  | "COMPLETED"
  | "SKIPPED"
  | "NOT_NEEDED"
  | "FAILED_VERIFICATION";

export type WorkflowRecipeProgressStep = {
  index: number;
  operationId: KukurekuOperationId;
  title: string;
  state: WorkflowRecipeProgressStepState;
  sourceVersionId: string | null;
  outputVersionId: string | null;
  verification: VerificationReport | null;
  updatedAt: number | null;
};

export type WorkflowRecipeProgress = {
  schemaVersion: 1;
  recipeId: WorkflowRecipeId;
  recipeTitle: string;
  rootId: string;
  currentWorkspaceFileId: string;
  currentStep: number;
  status: WorkflowRecipeProgressStatus;
  startedAt: number;
  updatedAt: number;
  steps: WorkflowRecipeProgressStep[];
};

export function createWorkflowRecipeProgress(
  recipe: WorkflowRecipePlan,
  options: {
    rootId: string;
    workspaceFileId: string;
    now?: number;
  },
): WorkflowRecipeProgress {
  const now =
    options.now ?? Date.now();

  return {
    schemaVersion: 1,
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    rootId: options.rootId,
    currentWorkspaceFileId:
      options.workspaceFileId,
    currentStep: 0,
    status: "IN_PROGRESS",
    startedAt: now,
    updatedAt: now,
    steps: recipe.steps.map(
      (step) => ({
        index: step.index,
        operationId:
          step.operationId,
        title: step.title,
        state: "PENDING",
        sourceVersionId: null,
        outputVersionId: null,
        verification: null,
        updatedAt: null,
      }),
    ),
  };
}

function nextProgressStatus(
  stepIndex: number,
  totalSteps: number,
): WorkflowRecipeProgressStatus {
  return stepIndex + 1 >=
    totalSteps
    ? "COMPLETED"
    : "IN_PROGRESS";
}

export function applyWorkflowStepDecision(
  progress: WorkflowRecipeProgress,
  options: {
    stepIndex: number;
    state:
      | "SKIPPED"
      | "NOT_NEEDED";
    workspaceFileId: string;
    now?: number;
  },
): WorkflowRecipeProgress {
  const step =
    progress.steps[
      options.stepIndex
    ];

  if (!step) {
    throw new Error(
      "Workflow recipe step is out of range.",
    );
  }

  const now =
    options.now ?? Date.now();
  const steps: WorkflowRecipeProgressStep[] =
    progress.steps.map(
      (item) =>
        item.index ===
        options.stepIndex
          ? {
              ...item,
              state:
                options.state,
              sourceVersionId:
                options.workspaceFileId,
              outputVersionId:
                null,
              verification:
                null,
              updatedAt: now,
            }
          : item,
    );

  return {
    ...progress,
    currentWorkspaceFileId:
      options.workspaceFileId,
    currentStep:
      options.stepIndex + 1,
    status:
      nextProgressStatus(
        options.stepIndex,
        progress.steps.length,
      ),
    updatedAt: now,
    steps,
  };
}

export function applyWorkflowStepVerification(
  progress: WorkflowRecipeProgress,
  options: {
    stepIndex: number;
    sourceVersionId: string;
    outputVersionId: string;
    verification: VerificationReport;
    now?: number;
  },
): WorkflowRecipeProgress {
  const step =
    progress.steps[
      options.stepIndex
    ];

  if (!step) {
    throw new Error(
      "Workflow recipe step is out of range.",
    );
  }

  const now =
    options.now ?? Date.now();
  const failed =
    options.verification.status ===
    "FAILED";

  const steps: WorkflowRecipeProgressStep[] =
    progress.steps.map(
      (item) =>
        item.index ===
        options.stepIndex
          ? {
              ...item,
              state: failed
                ? "FAILED_VERIFICATION"
                : "COMPLETED",
              sourceVersionId:
                options.sourceVersionId,
              outputVersionId:
                options.outputVersionId,
              verification:
                options.verification,
              updatedAt: now,
            }
          : item,
    );

  return {
    ...progress,
    currentWorkspaceFileId:
      options.outputVersionId,
    currentStep: failed
      ? options.stepIndex
      : options.stepIndex + 1,
    status: failed
      ? "BLOCKED_BY_VERIFICATION"
      : nextProgressStatus(
          options.stepIndex,
          progress.steps.length,
        ),
    updatedAt: now,
    steps,
  };
}

export function resumeWorkflowRecipeProgress(
  progress: WorkflowRecipeProgress,
  workspaceFileId: string,
  now = Date.now(),
): WorkflowRecipeProgress {
  return {
    ...progress,
    currentWorkspaceFileId:
      workspaceFileId,
    updatedAt: now,
  };
}
