import type {
  SafeSharePlan,
} from "./safeShare";
import type {
  WorkspaceActionPlan,
} from "./planner";
import type {
  WorkspaceFactContradiction,
} from "./facts";
import type {
  WorkspaceEvidenceIndex,
} from "./workspaceSearch";
import type {
  WorkspaceIntelligenceNode,
  WorkspaceIntelligenceReport,
} from "./types";
import type {
  WorkspaceRelationshipVerificationReport,
} from "./verification";

export type WorkspaceBrief = {
  headline: string;
  summary: string[];
  attention: string[];
  coverage: string[];
  nextAction:
    | string
    | null;
};

export function createWorkspaceBrief({
  nodes,
  report,
  verification,
  contradictions,
  evidenceIndex,
  safeShare,
  actionPlan,
}: {
  nodes: WorkspaceIntelligenceNode[];
  report: WorkspaceIntelligenceReport;
  verification: WorkspaceRelationshipVerificationReport;
  contradictions: WorkspaceFactContradiction[];
  evidenceIndex: WorkspaceEvidenceIndex;
  safeShare?: SafeSharePlan | null;
  actionPlan: WorkspaceActionPlan;
}): WorkspaceBrief {
  const latestVersions =
    new Map<
      string,
      number
    >();

  for (const node of nodes) {
    latestVersions.set(
      node.documentId,
      Math.max(
        latestVersions.get(
          node.documentId,
        ) ?? 0,
        node.version,
      ),
    );
  }

  const attention: string[] =
    [];

  if (
    verification.status ===
    "FAILED"
  ) {
    attention.push(
      "Workspace relationship verification has failures.",
    );
  }

  if (
    contradictions.length > 0
  ) {
    attention.push(
      `${contradictions.length} labeled cross-document fact conflict(s) were detected.`,
    );
  }

  const attentionFindings =
    report.findings.filter(
      (finding) =>
        finding.severity ===
        "attention",
    ).length;

  if (
    attentionFindings > 0
  ) {
    attention.push(
      `${attentionFindings} Workspace Intelligence finding(s) require attention.`,
    );
  }

  if (
    safeShare?.status ===
    "REVIEW_REQUIRED"
  ) {
    attention.push(
      `Safe Share has ${safeShare.issues.length} review item(s) for the active document.`,
    );
  }

  return {
    headline:
      attention.length > 0
        ? "Workspace review has items that deserve attention"
        : "No high-priority deterministic issue is currently blocking the workspace",
    summary: [
      `${latestVersions.size} document identity/identities across ${nodes.length} stored state(s).`,
      `${evidenceIndex.coverage.pageCount} selectable-text page(s) indexed into ${evidenceIndex.coverage.chunkCount} local evidence chunk(s).`,
      `${report.findings.length} relationship finding(s); verification status: ${verification.status}.`,
    ],
    attention,
    coverage: [
      ...evidenceIndex.coverage.notes,
      evidenceIndex.coverage.truncated
        ? "The local evidence index hit its configured V1 limit; some stored states were not indexed."
        : "The local evidence index covered every selected state within V1 limits.",
    ],
    nextAction:
      actionPlan.steps[0]
        ?.label ?? null,
  };
}
