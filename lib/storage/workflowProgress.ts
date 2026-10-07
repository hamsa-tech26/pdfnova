import type {
  WorkflowRecipeProgress,
} from "../document-engine";

const STORAGE_KEY =
  "kukureku-workflow-progress-v1";

export const WORKFLOW_PROGRESS_CHANGE_EVENT =
  "kukureku-workflow-progress-change";

function canUseStorage() {
  return (
    typeof window !== "undefined" &&
    "localStorage" in window
  );
}

function parseProgress(
  raw: string | null,
): WorkflowRecipeProgress | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        raw,
      ) as WorkflowRecipeProgress;

    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.rootId !==
        "string" ||
      typeof parsed.recipeId !==
        "string" ||
      !Array.isArray(
        parsed.steps,
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function notifyChanged() {
  if (
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(
      new Event(
        WORKFLOW_PROGRESS_CHANGE_EVENT,
      ),
    );
  }
}

export function getWorkflowRecipeProgressSnapshot() {
  if (!canUseStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(
      STORAGE_KEY,
    );
  } catch {
    return null;
  }
}

export function getActiveWorkflowRecipeProgress(): WorkflowRecipeProgress | null {
  return parseProgress(
    getWorkflowRecipeProgressSnapshot(),
  );
}

export function saveActiveWorkflowRecipeProgress(
  progress: WorkflowRecipeProgress,
) {
  if (!canUseStorage()) {
    throw new Error(
      "Browser workflow progress storage is unavailable.",
    );
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      progress,
    ),
  );
  notifyChanged();

  return progress;
}

export function clearWorkflowRecipeProgress() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(
      STORAGE_KEY,
    );
    notifyChanged();
  } catch {
    // PDF workspace clearing must not fail only because
    // lightweight progress metadata storage is unavailable.
  }
}

export function subscribeWorkflowRecipeProgress(
  listener: () => void,
) {
  if (
    typeof window === "undefined"
  ) {
    return () => undefined;
  }

  const onStorage = (
    event: StorageEvent,
  ) => {
    if (
      event.key ===
      STORAGE_KEY
    ) {
      listener();
    }
  };

  window.addEventListener(
    WORKFLOW_PROGRESS_CHANGE_EVENT,
    listener,
  );
  window.addEventListener(
    "storage",
    onStorage,
  );

  return () => {
    window.removeEventListener(
      WORKFLOW_PROGRESS_CHANGE_EVENT,
      listener,
    );
    window.removeEventListener(
      "storage",
      onStorage,
    );
  };
}
