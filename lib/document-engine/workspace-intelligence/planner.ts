import type {
  SafeSharePlan,
} from "./safeShare";
import type {
  WorkspaceFactContradiction,
} from "./facts";
import type {
  WorkspaceRelationshipVerificationReport,
} from "./verification";
import type {
  WorkspaceIntelligenceNode,
} from "./types";

export type WorkspacePlanStep = {
  id: string;
  order: number;
  label: string;
  reason: string;
  route?: string;
  targetNodeId?: string;
  requiresConfirmation: true;
};

export type WorkspaceActionPlan = {
  title: string;
  steps: WorkspacePlanStep[];
  autoExecutionAllowed: false;
};

function head(
  nodes: WorkspaceIntelligenceNode[],
) {
  return [...nodes].sort(
    (left, right) =>
      right.version -
        left.version ||
      right.generation -
        left.generation,
  )[0];
}

export function createWorkspaceActionPlan({
  nodes,
  activeNodeId,
  verification,
  safeShare,
  contradictions,
}: {
  nodes: WorkspaceIntelligenceNode[];
  activeNodeId?: string | null;
  verification: WorkspaceRelationshipVerificationReport;
  safeShare?: SafeSharePlan | null;
  contradictions: WorkspaceFactContradiction[];
}): WorkspaceActionPlan {
  const active =
    nodes.find(
      (node) =>
        node.id ===
        activeNodeId,
    ) ?? null;
  const steps: WorkspacePlanStep[] =
    [];

  function add(
    step: Omit<
      WorkspacePlanStep,
      "order" |
        "requiresConfirmation"
    >,
  ) {
    steps.push({
      ...step,
      order:
        steps.length + 1,
      requiresConfirmation:
        true,
    });
  }

  if (
    verification.status ===
    "FAILED"
  ) {
    add({
      id:
        "review-relationships",
      label:
        "Review relationship failures",
      reason:
        "Workspace provenance has a deterministic verification failure.",
      route:
        "/workspace-findings",
    });
  }

  if (active) {
    const sameDocument =
      nodes.filter(
        (node) =>
          node.documentId ===
          active.documentId,
      );
    const latest =
      head(
        sameDocument,
      );

    if (
      latest &&
      latest.id !== active.id
    ) {
      add({
        id:
          "use-latest-version",
        label:
          "Switch to the newest saved version",
        reason:
          `Version ${latest.version} is newer than the active Version ${active.version}.`,
        targetNodeId:
          latest.id,
      });
    }
  }

  if (
    contradictions.length > 0
  ) {
    add({
      id:
        "review-conflicts",
      label:
        "Review conflicting facts",
      reason:
        `${contradictions.length} labeled cross-document conflict(s) need human review.`,
      route:
        "/workspace-copilot",
    });
  }

  if (safeShare) {
    for (
      const issue of safeShare.issues
    ) {
      if (
        !issue.actionRoute ||
        !issue.actionLabel
      ) {
        continue;
      }

      add({
        id:
          "share-" +
          issue.kind,
        label:
          issue.actionLabel,
        reason:
          issue.title,
        route:
          issue.actionRoute,
        targetNodeId:
          active?.id,
      });
    }
  }

  if (
    steps.length === 0
  ) {
    add({
      id:
        "inspect-current",
      label:
        "Inspect the current document",
      reason:
        "No higher-priority deterministic issue is blocking the workspace.",
      route:
        "/document-inspector",
      targetNodeId:
        active?.id,
    });
  }

  return {
    title:
      "Recommended workspace action sequence",
    steps,
    autoExecutionAllowed:
      false,
  };
}
