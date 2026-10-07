import type {
  WorkspaceIntelligenceFinding,
  WorkspaceIntelligenceNode,
  WorkspaceIntelligenceReport,
} from "./types";

export type WorkspaceRelationshipActionKind =
  | "make-current"
  | "inspect-document"
  | "compare-documents"
  | "prepare-merge";

export type WorkspaceRelationshipAction = {
  id: string;
  kind: WorkspaceRelationshipActionKind;
  label: string;
  detail: string;
  sourceFindingId: string;
  targetNodeId: string;
  targetNodeIds?: string[];
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

  const resolvedActiveNodeId =
    active.id;
  const actions: WorkspaceRelationshipAction[] =
    [];
  const seen = new Set<string>();

  function addAction(
    action: WorkspaceRelationshipAction,
  ) {
    const targets =
      action.targetNodeIds?.length
        ? action.targetNodeIds
        : [
            action.targetNodeId,
          ];
    const key = [
      action.kind,
      ...targets,
      action.sourceFindingId,
    ].join(":");

    if (
      targets.every(
        (id) =>
          id ===
          resolvedActiveNodeId,
      ) ||
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);
    actions.push(action);
  }

  function addCompareAction(
    finding: WorkspaceIntelligenceFinding,
    target: WorkspaceIntelligenceNode,
    label: string,
    detail: string,
  ) {
    addAction({
      id: `compare:${finding.id}:${resolvedActiveNodeId}:${target.id}`,
      kind:
        "compare-documents",
      label,
      detail,
      sourceFindingId:
        finding.id,
      targetNodeId:
        target.id,
      targetNodeIds: [
        resolvedActiveNodeId,
        target.id,
      ],
    });
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
          label:
            "Use latest version",
          detail:
            "Switch the active workspace document to its newest saved version.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            head.id,
        });

        addCompareAction(
          finding,
          head,
          "Compare versions",
          "Compare this saved state with the newest version using local SHA-256 and selectable-text overlap.",
        );
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

        addCompareAction(
          finding,
          parent,
          "Compare with parent",
          "Compare this child branch with its known parent without modifying either document.",
        );
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
      const parents =
        (
          compositionNode?.parentIds ??
          []
        )
          .map((id) =>
            byId.get(id),
          )
          .filter(
            (
              node,
            ): node is WorkspaceIntelligenceNode =>
              Boolean(node),
          );

      for (const parent of parents.slice(
        0,
        3,
      )) {
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

      if (
        parents.length >= 2
      ) {
        addAction({
          id: `compare-composition-parents:${finding.id}`,
          kind:
            "compare-documents",
          label:
            "Compare composition parents",
          detail:
            "Compare the first two known parent documents locally.",
          sourceFindingId:
            finding.id,
          targetNodeId:
            parents[0].id,
          targetNodeIds: [
            parents[0].id,
            parents[1].id,
          ],
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

        addCompareAction(
          finding,
          target,
          finding.kind ===
            "possible-duplicate"
            ? "Confirm duplicate locally"
            : "Compare related documents",
          finding.kind ===
            "possible-duplicate"
            ? "Run local SHA-256 and selectable-text comparison before treating these files as duplicates."
            : "Compare these related workspace documents locally without changing either one.",
        );
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

        addCompareAction(
          finding,
          target,
          active.documentId ===
            parentDocumentId
            ? "Compare child branch"
            : "Compare sibling branches",
          "Compare branch content locally before deciding whether to keep the branches separate.",
        );

        if (
          active.documentId !==
          parentDocumentId
        ) {
          addAction({
            id: `prepare-branch-merge:${finding.id}:${target.id}`,
            kind:
              "prepare-merge",
            label:
              "Prepare branch merge",
            detail:
              "Open Merge PDF with both branches preloaded. Kukureku will still require you to review order and explicitly confirm the merge.",
            sourceFindingId:
              finding.id,
            targetNodeId:
              target.id,
            targetNodeIds: [
              resolvedActiveNodeId,
              target.id,
            ],
          });
        }
      }
    }
  }

  return actions;
}
