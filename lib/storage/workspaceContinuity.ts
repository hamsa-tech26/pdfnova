import {
  getActiveWorkspaceFileSummary,
  getWorkspaceFileSummary,
  saveDerivedWorkspaceFile,
  type WorkspaceFileSummary,
} from "./workspaceFiles";
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

  return null;
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

    const bytes =
      options.outputBytes.slice();
    const outputFile =
      new File(
        [bytes.buffer],
        options.outputFileName,
        {
          type: "application/pdf",
          lastModified:
            Date.now(),
        },
      );

    return await saveDerivedWorkspaceFile(
      outputFile,
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
      "Kukureku could not persist the derived browser workspace version.",
      error,
    );
    return null;
  }
}
