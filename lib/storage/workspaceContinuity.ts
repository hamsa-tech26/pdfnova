import {
  ensureWorkspaceSourceFile,
  findWorkspaceFileSummaryByFingerprint,
  getActiveWorkspaceFileSummary,
  getWorkspaceFileSummary,
  saveBranchedWorkspaceFile,
  saveComposedWorkspaceFile,
  saveDerivedWorkspaceFile,
  type WorkspaceFileSummary,
} from "./workspaceFiles";
import {
  recordWorkflowDerivedOutput,
} from "./workflowRecipeContinuity";
import {
  isSameWorkspaceFileFingerprint,
  type WorkspaceOperationDescriptor,
} from "./workspaceLineage";

function getHandoffIdFromLocation() {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  return new URLSearchParams(
    window.location.search,
  ).get("workspaceFile");
}

async function resolveParent(
  sourceFile: File,
): Promise<WorkspaceFileSummary | null> {
  const handoffId =
    getHandoffIdFromLocation();

  if (handoffId) {
    const handoff =
      await getWorkspaceFileSummary(
        handoffId,
      );

    if (
      handoff &&
      isSameWorkspaceFileFingerprint(
        handoff,
        sourceFile,
      )
    ) {
      return handoff;
    }
  }

  const active =
    await getActiveWorkspaceFileSummary();

  if (
    active &&
    isSameWorkspaceFileFingerprint(
      active,
      sourceFile,
    )
  ) {
    return active;
  }

  return findWorkspaceFileSummaryByFingerprint(
    sourceFile,
  );
}

async function resolveOrCreateParent(
  sourceFile: File,
  explicitParentId?: string | null,
) {
  if (explicitParentId) {
    const explicit =
      await getWorkspaceFileSummary(
        explicitParentId,
      );

    if (explicit) {
      return explicit;
    }
  }

  return (
    (await resolveParent(
      sourceFile,
    )) ??
    ensureWorkspaceSourceFile(
      sourceFile,
      {
        activate: false,
      },
    )
  );
}

function outputFileFromBytes(
  outputBytes: Uint8Array,
  outputFileName: string,
) {
  const bytes =
    outputBytes.slice();

  return new File(
    [bytes.buffer],
    outputFileName,
    {
      type: "application/pdf",
      lastModified:
        Date.now(),
    },
  );
}

export async function saveDerivedPdfToWorkspace(
  options: {
    sourceFile: File;
    outputBytes: Uint8Array;
    outputFileName: string;
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary | null> {
  try {
    const parent =
      await resolveParent(
        options.sourceFile,
      );

    if (!parent) {
      return null;
    }

    const saved =
      await saveDerivedWorkspaceFile(
        outputFileFromBytes(
          options.outputBytes,
          options.outputFileName,
        ),
        {
          parentId: parent.id,
          operationId:
            options.operationId,
          operationLabel:
            options.operationLabel,
        },
      );

    try {
      await recordWorkflowDerivedOutput(
        {
          sourceSummary:
            parent,
          outputSummary:
            saved,
        },
      );
    } catch (recipeError) {
      console.warn(
        "Kukureku could not update recipe progress for this derived PDF.",
        recipeError,
      );
    }

    return saved;
  } catch (error) {
    console.warn(
      "Kukureku could not persist the derived browser workspace version.",
      error,
    );
    return null;
  }
}

export async function saveBranchedPdfToWorkspace(
  options: {
    sourceFile: File;
    outputBytes: Uint8Array;
    outputFileName: string;
    parentWorkspaceFileId?: string | null;
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary | null> {
  try {
    const parent =
      await resolveOrCreateParent(
        options.sourceFile,
        options.parentWorkspaceFileId,
      );

    return await saveBranchedWorkspaceFile(
      outputFileFromBytes(
        options.outputBytes,
        options.outputFileName,
      ),
      {
        parentId: parent.id,
        operationId:
          options.operationId,
        operationLabel:
          options.operationLabel,
      },
    );
  } catch (error) {
    console.warn(
      "Kukureku could not persist the branched browser workspace document.",
      error,
    );
    return null;
  }
}

export async function saveComposedPdfToWorkspace(
  options: {
    sourceFiles: File[];
    outputBytes: Uint8Array;
    outputFileName: string;
  } & WorkspaceOperationDescriptor,
): Promise<WorkspaceFileSummary | null> {
  if (
    options.sourceFiles.length <
    2
  ) {
    return null;
  }

  try {
    const parents =
      await Promise.all(
        options.sourceFiles.map(
          (file) =>
            resolveOrCreateParent(
              file,
            ),
        ),
      );

    return await saveComposedWorkspaceFile(
      outputFileFromBytes(
        options.outputBytes,
        options.outputFileName,
      ),
      {
        parentIds:
          parents.map(
            (parent) =>
              parent.id,
          ),
        operationId:
          options.operationId,
        operationLabel:
          options.operationLabel,
      },
    );
  } catch (error) {
    console.warn(
      "Kukureku could not persist the composed browser workspace document.",
      error,
    );
    return null;
  }
}
