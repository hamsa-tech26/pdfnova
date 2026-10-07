import type {
  WorkspaceFileSummary,
} from "./workspaceFiles";

export type WorkspaceDocumentGroup = {
  documentId: string;
  head: WorkspaceFileSummary;
  versions: WorkspaceFileSummary[];
};

export function groupWorkspaceDocuments(
  summaries: WorkspaceFileSummary[],
): WorkspaceDocumentGroup[] {
  const grouped =
    new Map<
      string,
      WorkspaceFileSummary[]
    >();

  for (const summary of summaries) {
    const current =
      grouped.get(
        summary.documentId,
      ) ?? [];

    current.push(summary);
    grouped.set(
      summary.documentId,
      current,
    );
  }

  return [
    ...grouped.entries(),
  ]
    .map(
      ([
        documentId,
        versions,
      ]) => {
        const ordered =
          [...versions].sort(
            (
              left,
              right,
            ) =>
              left.version -
                right.version ||
              left.savedAt.localeCompare(
                right.savedAt,
              ),
          );

        return {
          documentId,
          head:
            ordered[
              ordered.length - 1
            ],
          versions: ordered,
        };
      },
    )
    .sort((left, right) =>
      right.head.savedAt.localeCompare(
        left.head.savedAt,
      ),
    );
}

export function getWorkspaceParents(
  summary: WorkspaceFileSummary,
  summaries: WorkspaceFileSummary[],
) {
  const byId =
    new Map(
      summaries.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    );

  return summary.parentIds
    .map((id) =>
      byId.get(id),
    )
    .filter(
      (
        item,
      ): item is WorkspaceFileSummary =>
        Boolean(item),
    );
}

export function getWorkspaceChildren(
  summary: WorkspaceFileSummary,
  summaries: WorkspaceFileSummary[],
) {
  return summaries.filter(
    (item) =>
      item.parentIds.includes(
        summary.id,
      ),
  );
}
