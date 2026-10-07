import type {
  WorkspaceIntelligenceFinding,
  WorkspaceIntelligenceNode,
  WorkspaceIntelligenceReport,
} from "./types";

export type WorkspaceRelationshipActionKind =
  | "make-current"
  | "inspect-document";

export type WorkspaceRelationshipAction = {
  id: string;
  kind: WorkspaceRelationshipActionKind;
  label: string;
  detail: string;
  sourceFindingId: string;
  targetNodeId: string;
};

function selectDocumentHead(
  nodes: WorkspaceIntelligenceNode[],
) {
  return [...nodes].sort((left, right) => {
    return (
      right.version - left.version ||
      right.generation - left.generation ||
      right.id.localeCompare(left.id)
    );
  })[0];
}

function isRelevantFinding(
  finding: WorkspaceIntelligenceFinding,
  active: WorkspaceIntelligenceNode,
) {
  return (
    finding.nodeIds.includes(active.id) ||
    finding.documentIds.includes(
      active.documentId,
    )
  );
}

export function createWorkspaceRelationshipActions(
  nodes: WorkspaceIntelligenceNode[],
  report: WorkspaceIntelligenceReport,
  activeNodeId?: string | null,
): WorkspaceRelationshipAction[] {
  if (!activeNodeId) {
    return [];
  }

  const byId = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ]),
  );
  const active =
    byId.get(activeNodeId);

  if (!active) {
    return [];
  }

  const byDocument = new Map<
    string,
    WorkspaceIntelligenceNode[]
  >();

  for (const node of nodes) {
    const current =
      byDocument.get(
        node.documentId,
      ) ?? [];
    current.push(node);
    byDocument.set(
      node.documentId,
      current,
    );
  }

  const documentHead = (
    documentId: string,
  ) => {
    const documentNodes =
      byDocument.get(documentId);

    return documentNodes?.length
      ? selectDocumentHead(
          documentNodes,
        )
      : null;
  };

  const actions: WorkspaceRelationshipAction[] =
    [];
  const seen = new Set<string>();

  function addAction(
    action: WorkspaceRelationshipAction,
  ) {
    const key = [
      action.kind,
      action.targetNodeId,
      action.sourceFindingId,
    ].join(":");

    if (
      action.targetNodeId ===
        active.id ||
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);
    actions.push(action);
  }

  for (const finding of report.findings) {
    if (
      !isRelevantFinding(
        finding,
        active,
      )
    ) {
      continue;
    }

    if (
      finding.kind ===
      "version-chain"
    ) {
      const head =
        documentHead(
          active.documentId,
        );

      if (
        head &&
        head.id !== active.id
      ) {
        addAction({
          id: `latest-version:${finding.id}:${head.id}`,
          kind: "make-current",
          label: "Use latest version",
          detail:
            "Switch the active workspace document to its newest saved version.",
          sourceFindingId:
            finding.id,
          targetNodeId: head.id,
        });
      }

      continue;
    }

    if (
      finding.kind ===
      "branch-lineage"
    ) {
      const branchNode =
        byDocument
          .get(
            active.documentId,
          )
          ?.find(
            (node) =>
              node.relationKind ===
              "branch",
          );
      const parent =
        branchNode?.parentIds
          .map((id) =>
            byId.get(id),
          )
          .find(
            (
              node,
            ): node is WorkspaceIntelligenceNode =>
              Boolean(node),
          );

      if (parent) {
        addAction({
          id: `review-parent:${finding.id}:${parent.id}`,
          kind: "make-current",
          label:
            "Review parent document",
          detail:
            "Switch back to the stored parent that created this child branch.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            parent.id,
        });
      }

      continue;
    }

    if (
      finding.kind ===
      "composition"
    ) {
      const compositionNode =
        finding.nodeIds
          .map((id) =>
            byId.get(id),
          )
          .find(
            (node) =>
              node?.relationKind ===
                "composition" &&
              node.documentId ===
                active.documentId,
          );

      for (const parentId of (
        compositionNode?.parentIds ??
        []
      ).slice(0, 3)) {
        const parent =
          byId.get(parentId);

        if (!parent) {
          continue;
        }

        addAction({
          id: `inspect-parent:${finding.id}:${parent.id}`,
          kind:
            "inspect-document",
          label: `Inspect parent: ${parent.name}`,
          detail:
            "Open this known parent in the Document Inspector without changing it.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            parent.id,
        });
      }

      continue;
    }

    if (
      finding.kind ===
        "shared-ancestry" ||
      finding.kind ===
        "possible-duplicate"
    ) {
      const otherDocumentId =
        finding.documentIds.find(
          (documentId) =>
            documentId !==
            active.documentId,
        );
      const target =
        otherDocumentId
          ? documentHead(
              otherDocumentId,
            )
          : null;

      if (target) {
        addAction({
          id: `inspect-related:${finding.id}:${target.id}`,
          kind:
            "inspect-document",
          label:
            finding.kind ===
            "possible-duplicate"
              ? "Inspect possible duplicate"
              : "Inspect related document",
          detail:
            finding.kind ===
            "possible-duplicate"
              ? "Open the other candidate in the Document Inspector before deciding whether it is actually a duplicate."
              : "Open the related document in the Document Inspector while preserving the current workspace graph.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            target.id,
        });
      }

      continue;
    }

    if (
      finding.kind ===
      "branch-divergence"
    ) {
      const parent =
        finding.nodeIds.length > 0
          ? byId.get(
              finding.nodeIds[0],
            )
          : null;
      const parentDocumentId =
        parent?.documentId ??
        null;
      const candidateDocumentId =
        finding.documentIds.find(
          (documentId) =>
            documentId !==
              active.documentId &&
            documentId !==
              parentDocumentId,
        );
      const target =
        candidateDocumentId
          ? documentHead(
              candidateDocumentId,
            )
          : null;

      if (target) {
        addAction({
          id: `inspect-branch:${finding.id}:${target.id}`,
          kind:
            "inspect-document",
          label:
            active.documentId ===
            parentDocumentId
              ? "Inspect child branch"
              : "Inspect sibling branch",
          detail:
            "Open another branch in the Document Inspector before deciding whether the branches should remain separate.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            target.id,
        });
      }
    }
  }

  return actions;
}
