import {
  isWorkflowRecipeId,
  type WorkflowRecipeId,
} from "./types";

export function buildWorkflowRecipesHref(
  workspaceFileId: string,
  recipeId?: WorkflowRecipeId,
  recipeStep?: number,
) {
  const params =
    new URLSearchParams({
      workspaceFile:
        workspaceFileId,
    });

  if (recipeId) {
    params.set(
      "recipe",
      recipeId,
    );

    params.set(
      "recipeStep",
      String(
        Math.max(
          0,
          recipeStep ?? 0,
        ),
      ),
    );
  }

  return (
    "/workflow-recipes?" +
    params.toString()
  );
}

export function buildWorkflowToolHref(
  route: string,
  workspaceFileId: string,
  recipeId: WorkflowRecipeId,
  recipeStep: number,
) {
  const params =
    new URLSearchParams({
      workspaceFile:
        workspaceFileId,
      recipe: recipeId,
      recipeStep: String(
        Math.max(
          0,
          recipeStep,
        ),
      ),
    });

  return (
    route +
    (route.includes("?")
      ? "&"
      : "?") +
    params.toString()
  );
}

export function getWorkflowContinuationHref(
  search: string,
  workspaceFileId: string,
) {
  const params =
    new URLSearchParams(
      search.startsWith("?")
        ? search.slice(1)
        : search,
    );
  const recipe =
    params.get("recipe");

  if (
    !isWorkflowRecipeId(
      recipe,
    )
  ) {
    return null;
  }

  const rawStep =
    Number(
      params.get(
        "recipeStep",
      ),
    );

  if (
    !Number.isInteger(
      rawStep,
    ) ||
    rawStep < 0
  ) {
    return null;
  }

  return buildWorkflowRecipesHref(
    workspaceFileId,
    recipe,
    rawStep + 1,
  );
}
