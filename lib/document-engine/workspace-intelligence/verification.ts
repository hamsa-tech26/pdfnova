import type {
  WorkspaceIntelligenceNode,
} from "./types";

export type WorkspaceRelationshipVerificationStatus =
  | "PASS"
  | "PASS_WITH_WARNING"
  | "FAILED"
  | "NOT_VERIFIED";

export type WorkspaceRelationshipVerificationCheck = {
  id: string;
  status:
    | "PASS"
    | "FAILED"
    | "NOT_VERIFIED";
  title: string;
  detail: string;
  nodeIds: string[];
};

export type WorkspaceRelationshipVerificationReport = {
  status: WorkspaceRelationshipVerificationStatus;
  checks: WorkspaceRelationshipVerificationCheck[];
  verifiedNodeCount: number;
  verifiedAt: number;
};

function overallStatus(
  checks: WorkspaceRelationshipVerificationCheck[],
): WorkspaceRelationshipVerificationStatus {
  if (
    checks.some(
      (check) =>
        check.status ===
        "FAILED",
    )
  ) {
    return "FAILED";
  }

  const notVerified =
    checks.filter(
      (check) =>
        check.status ===
        "NOT_VERIFIED",
    ).length;

  if (
    checks.length === 0 ||
    notVerified ===
      checks.length
  ) {
    return "NOT_VERIFIED";
  }

  return notVerified > 0
    ? "PASS_WITH_WARNING"
    : "PASS";
}

export function verifyWorkspaceRelationships(
  nodes: WorkspaceIntelligenceNode[],
): WorkspaceRelationshipVerificationReport {
  const byId = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ]),
  );
  const checks: WorkspaceRelationshipVerificationCheck[] =
    [];

  for (const node of nodes) {
    const missingParents =
      node.parentIds.filter(
        (parentId) =>
          !byId.has(parentId),
      );

    checks.push({
      id: `parents:${node.id}`,
      status:
        missingParents.length === 0
          ? "PASS"
          : "FAILED",
      title:
        missingParents.length === 0
          ? "Parent references resolve"
          : "Parent references are incomplete",
      detail:
        missingParents.length === 0
          ? `${node.name} has no missing stored parent reference.`
          : `${node.name} references ${missingParents.length} parent node(s) that are not stored in this browser workspace.`,
      nodeIds: [
        node.id,
        ...missingParents,
      ],
    });

    if (
      node.relationKind ===
      "composition"
    ) {
      const valid =
        node.parentIds.length >=
          2 &&
        missingParents.length ===
          0;

      checks.push({
        id: `composition:${node.id}`,
        status: valid
          ? "PASS"
          : "FAILED",
        title: valid
          ? "Composition provenance is complete"
          : "Composition provenance is incomplete",
        detail: valid
          ? `${node.name} retains at least two stored parents as expected for a composition.`
          : `${node.name} cannot be verified as a complete multi-parent composition from the stored graph.`,
        nodeIds: [
          node.id,
          ...node.parentIds,
        ],
      });
    }

    if (
      node.relationKind ===
      "branch"
    ) {
      checks.push({
        id: `branch:${node.id}`,
        status:
          node.parentIds.length >=
            1 &&
          missingParents.length ===
            0
            ? "PASS"
            : "FAILED",
        title:
          node.parentIds.length >=
            1 &&
          missingParents.length ===
            0
            ? "Branch provenance is linked"
            : "Branch provenance is incomplete",
        detail:
          node.parentIds.length >=
            1 &&
          missingParents.length ===
            0
            ? `${node.name} retains a stored parent relationship.`
            : `${node.name} is marked as a branch but its stored parent relationship is incomplete.`,
        nodeIds: [
          node.id,
          ...node.parentIds,
        ],
      });
    }

    if (
      node.relationKind ===
      "revision"
    ) {
      const parent =
        node.parentIds.length ===
        1
          ? byId.get(
              node.parentIds[0],
            )
          : null;
      const valid =
        Boolean(parent) &&
        parent?.documentId ===
          node.documentId &&
        parent.version <
          node.version;

      checks.push({
        id: `revision:${node.id}`,
        status: valid
          ? "PASS"
          : "FAILED",
        title: valid
          ? "Revision chain is internally consistent"
          : "Revision chain is inconsistent",
        detail: valid
          ? `${node.name} follows an earlier stored version of the same document identity.`
          : `${node.name} does not have a verifiable earlier-version parent within the same document identity.`,
        nodeIds: [
          node.id,
          ...node.parentIds,
        ],
      });
    }
  }

  if (nodes.length === 0) {
    checks.push({
      id: "workspace-empty",
      status:
        "NOT_VERIFIED",
      title:
        "No workspace relationships to verify",
      detail:
        "Add browser-local documents before running relationship verification.",
      nodeIds: [],
    });
  }

  return {
    status:
      overallStatus(checks),
    checks,
    verifiedNodeCount:
      nodes.length,
    verifiedAt: Date.now(),
  };
}
