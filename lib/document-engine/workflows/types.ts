import type {
  KukurekuOperationId,
} from "../operations/types";
import type {
  MagicDropEffectPreview,
} from "../planning/types";

export const WORKFLOW_RECIPE_IDS = [
  "prepare-for-sharing",
  "finalize-standard-form",
  "controlled-copy",
] as const;

export type WorkflowRecipeId =
  (typeof WORKFLOW_RECIPE_IDS)[number];

export type WorkflowRecipeAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "BLOCKED";

export type WorkflowRecipeStepKind =
  | "REQUIRED"
  | "OPTIONAL"
  | "USER_DECISION"
  | "NOT_NEEDED"
  | "BLOCKED";

export type WorkflowRecipeStep = {
  index: number;
  operationId: KukurekuOperationId;
  title: string;
  route: string;
  kind: WorkflowRecipeStepKind;
  reason: string;
  evidence: string[];
  effect?: MagicDropEffectPreview;
};

export type WorkflowRecipePlan = {
  id: WorkflowRecipeId;
  title: string;
  description: string;
  availability: WorkflowRecipeAvailability;
  availabilityReason: string;
  evidence: string[];
  cautions: string[];
  steps: WorkflowRecipeStep[];
};

export function isWorkflowRecipeId(
  value: string | null | undefined,
): value is WorkflowRecipeId {
  return WORKFLOW_RECIPE_IDS.includes(
    value as WorkflowRecipeId,
  );
}
