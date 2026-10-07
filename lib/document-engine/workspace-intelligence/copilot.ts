import type {
  PdfContentComparison,
} from "./contentSignals";
import type {
  SafeSharePlan,
} from "./safeShare";
import type {
  WorkspaceRelationshipVerificationReport,
} from "./verification";
import type {
  WorkspaceIntelligenceNode,
  WorkspaceIntelligenceReport,
} from "./types";

export type WorkspaceCopilotQuestion =
  | "which-version"
  | "what-changed"
  | "sharing-attention"
  | "next-step";

export type WorkspaceCopilotAnswerStatus =
  | "ready"
  | "attention"
  | "not-verified";

export type WorkspaceCopilotEvidence = {
  label: string;
  value: string;
};

export type WorkspaceCopilotActionKind =
  | "make-current"
  | "compare-documents"
  | "safe-share"
  | "findings-center"
  | "inspect-document";

export type WorkspaceCopilotAction = {
  kind: WorkspaceCopilotActionKind;
  label: string;
  targetNodeId?: string;
  targetNodeIds?: string[];
};

export type WorkspaceCopilotAnswer = {
  question: WorkspaceCopilotQuestion;
  status: WorkspaceCopilotAnswerStatus;
  title: string;
  answer: string;
  evidence: WorkspaceCopilotEvidence[];
  action?: WorkspaceCopilotAction;
};

export type WorkspaceCopilotComparisonContext = {
  targetNodeId: string;
  targetName: string;
  reason:
    | "parent"
    | "latest-version"
    | "sibling-branch"
    | "shared-ancestry"
    | "possible-duplicate";
  comparison: PdfContentComparison;
};

function selectDocumentHead(
  nodes: WorkspaceIntelligenceNode[],
) {
  return [...nodes].sort(
    (left, right) =>
      right.version -
        left.version ||
      right.generation -
        left.generation ||
      right.id.localeCompare(
        left.id,
      ),
  )[0];
}

function formatPercent(
  value: number | null,
) {
  return value === null
    ? "Not verified"
    : `${Math.round(
        value * 100,
      )}%`;
}

export function selectWorkspaceCopilotComparisonTarget(
  nodes: WorkspaceIntelligenceNode[],
  report: WorkspaceIntelligenceReport,
  activeNodeId?: string | null,
) {
  if (!activeNodeId) {
    return null;
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
    return null;
  }

  const parent =
    active.parentIds
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
    return {
      targetNodeId:
        parent.id,
      reason:
        "parent" as const,
    };
  }

  const sameDocument =
    nodes.filter(
      (node) =>
        node.documentId ===
          active.documentId &&
        node.id !== active.id,
    );

  if (sameDocument.length > 0) {
    const head =
      selectDocumentHead([
        active,
        ...sameDocument,
      ]);

    if (head.id !== active.id) {
      return {
        targetNodeId:
          head.id,
        reason:
          "latest-version" as const,
      };
    }

    const previous =
      [...sameDocument].sort(
        (left, right) =>
          right.version -
            left.version ||
          right.generation -
            left.generation,
      )[0];

    if (previous) {
      return {
        targetNodeId:
          previous.id,
        reason:
          "latest-version" as const,
      };
    }
  }

  const siblingFinding =
    report.findings.find(
      (finding) =>
        finding.kind ===
          "branch-divergence" &&
        finding.nodeIds.includes(
          active.id,
        ),
    );

  if (siblingFinding) {
    const sibling =
      siblingFinding.nodeIds
        .map((id) =>
          byId.get(id),
        )
        .find(
          (node) =>
            node &&
            node.id !==
              active.id &&
            node.documentId !==
              active.documentId &&
            node.parentIds.some(
              (parentId) =>
                active.parentIds.includes(
                  parentId,
                ),
            ),
        );

    if (sibling) {
      return {
        targetNodeId:
          sibling.id,
        reason:
          "sibling-branch" as const,
      };
    }
  }

  const relationshipFinding =
    report.findings.find(
      (finding) =>
        (
          finding.kind ===
            "shared-ancestry" ||
          finding.kind ===
            "possible-duplicate"
        ) &&
        finding.nodeIds.includes(
          active.id,
        ),
    );

  if (relationshipFinding) {
    const target =
      relationshipFinding.nodeIds
        .map((id) =>
          byId.get(id),
        )
        .find(
          (node) =>
            node &&
            node.id !==
              active.id,
        );

    if (target) {
      return {
        targetNodeId:
          target.id,
        reason:
          relationshipFinding.kind ===
          "possible-duplicate"
            ? ("possible-duplicate" as const)
            : ("shared-ancestry" as const),
      };
    }
  }

  return null;
}

export function createWorkspaceCopilotAnswers({
  nodes,
  report,
  verification,
  activeNodeId,
  comparison,
  safeShare,
}: {
  nodes: WorkspaceIntelligenceNode[];
  report: WorkspaceIntelligenceReport;
  verification: WorkspaceRelationshipVerificationReport;
  activeNodeId?: string | null;
  comparison?: WorkspaceCopilotComparisonContext | null;
  safeShare?: SafeSharePlan | null;
}): WorkspaceCopilotAnswer[] {
  const byId = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ]),
  );
  const active =
    activeNodeId
      ? byId.get(
          activeNodeId,
        ) ?? null
      : null;

  if (!active) {
    return [
      {
        question:
          "which-version",
        status:
          "not-verified",
        title:
          "No active workspace document",
        answer:
          "Kukureku needs an active browser-local document before it can recommend a version.",
        evidence: [],
      },
      {
        question:
          "what-changed",
        status:
          "not-verified",
        title:
          "No comparison is available",
        answer:
          "Add or select a document with a stored parent, version, branch, or related document to compare.",
        evidence: [],
      },
      {
        question:
          "sharing-attention",
        status:
          "not-verified",
        title:
          "Sharing review has not run",
        answer:
          "Select a workspace document before running local Safe Share checks.",
        evidence: [],
      },
      {
        question:
          "next-step",
        status:
          "not-verified",
        title:
          "Add a document first",
        answer:
          "Start with Magic Drop or another PDF tool so Kukureku has local workspace evidence to reason over.",
        evidence: [],
      },
    ];
  }

  const documentNodes =
    nodes.filter(
      (node) =>
        node.documentId ===
        active.documentId,
    );
  const latest =
    selectDocumentHead(
      documentNodes,
    );
  const activeIsLatest =
    latest.id === active.id;

  const versionAnswer: WorkspaceCopilotAnswer =
    activeIsLatest
      ? {
          question:
            "which-version",
          status:
            verification.status ===
            "FAILED"
              ? "attention"
              : "ready",
          title:
            documentNodes.length ===
            1
              ? "This is the only saved version"
              : "You are on the newest saved version",
          answer:
            verification.status ===
            "FAILED"
              ? "This is the newest recorded state, but the workspace relationship verification has a failure. Review the graph before treating provenance as complete."
              : "Use this version for continued work unless you intentionally need an older state or a separate branch.",
          evidence: [
            {
              label:
                "Current version",
              value:
                `Version ${active.version}`,
            },
            {
              label:
                "Saved versions",
              value:
                String(
                  documentNodes.length,
                ),
            },
            {
              label:
                "Relationship verification",
              value:
                verification.status,
            },
          ],
          action:
            verification.status ===
            "FAILED"
              ? {
                  kind:
                    "findings-center",
                  label:
                    "Review findings",
                }
              : undefined,
        }
      : {
          question:
            "which-version",
          status:
            "attention",
          title:
            "A newer saved version is available",
          answer:
            `${latest.name} is recorded as Version ${latest.version}. Use the newer state for normal continuation unless you deliberately need this older version.`,
          evidence: [
            {
              label:
                "Current",
              value:
                `${active.name} · V${active.version}`,
            },
            {
              label:
                "Newest",
              value:
                `${latest.name} · V${latest.version}`,
            },
          ],
          action: {
            kind:
              "make-current",
            label:
              "Use latest version",
            targetNodeId:
              latest.id,
          },
        };

  let changeAnswer: WorkspaceCopilotAnswer;

  if (!comparison) {
    changeAnswer = {
      question:
        "what-changed",
      status:
        "not-verified",
      title:
        "No related document is available for comparison",
      answer:
        "Kukureku could not find a stored parent, alternate version, sibling branch, shared-ancestry document, or duplicate candidate to compare with the active state.",
      evidence: [
        {
          label:
            "Active document",
          value:
            active.name,
        },
      ],
    };
  } else {
    const result =
      comparison.comparison;
    const relationshipTitle =
      result.relationship ===
      "exact-duplicate"
        ? "No byte-level change detected"
        : result.relationship ===
            "probable-revision"
          ? "This looks like a document revision"
          : result.relationship ===
              "related"
            ? "The documents are related but changed"
            : result.relationship ===
                "distinct"
              ? "The documents differ substantially"
              : "Text change is not verified";

    const relationshipAnswer =
      result.relationship ===
      "exact-duplicate"
        ? "The two files have the same local SHA-256 hash, so they are byte-identical."
        : result.relationship ===
            "probable-revision"
          ? "Selectable-text overlap is strong enough to classify the pair as a probable revision. Review the page and line deltas for the scale of change."
          : result.relationship ===
              "related"
            ? "The pair shares meaningful selectable-text overlap, but the differences are large enough that Kukureku does not call it a probable revision."
            : result.relationship ===
                "distinct"
              ? "Selectable-text overlap is low. Treat these as materially different documents unless other evidence says otherwise."
              : "At least one document lacks enough selectable text for deterministic text similarity. Scanned or image-only changes may still exist.";

    changeAnswer = {
      question:
        "what-changed",
      status:
        result.relationship ===
        "unverified"
          ? "not-verified"
          : "ready",
      title:
        relationshipTitle,
      answer:
        relationshipAnswer,
      evidence: [
        {
          label:
            "Compared with",
          value:
            comparison.targetName,
        },
        {
          label:
            "Relationship",
          value:
            result.relationship,
        },
        {
          label:
            "Text similarity",
          value:
            formatPercent(
              result.textSimilarity,
            ),
        },
        {
          label:
            "Page delta",
          value:
            String(
              result.pageCountDelta,
            ),
        },
        {
          label:
            "Unique normalized lines",
          value:
            `${result.leftOnlyLineCount} current-only · ${result.rightOnlyLineCount} comparison-only`,
        },
      ],
      action: {
        kind:
          "compare-documents",
        label:
          "Open full comparison",
        targetNodeId:
          comparison.targetNodeId,
        targetNodeIds: [
          active.id,
          comparison.targetNodeId,
        ],
      },
    };
  }

  let sharingAnswer: WorkspaceCopilotAnswer;

  if (!safeShare) {
    sharingAnswer = {
      question:
        "sharing-attention",
      status:
        "not-verified",
      title:
        "Safe Share evidence is not available",
      answer:
        "Kukureku has not completed the local sharing review for this document.",
      evidence: [],
      action: {
        kind:
          "safe-share",
        label:
          "Run Safe Share review",
        targetNodeId:
          active.id,
      },
    };
  } else if (
    safeShare.status ===
    "REVIEW_REQUIRED"
  ) {
    sharingAnswer = {
      question:
        "sharing-attention",
      status:
        "attention",
      title:
        "Review findings before sharing",
      answer:
        safeShare.statement,
      evidence: [
        {
          label:
            "Safe Share status",
          value:
            safeShare.status,
        },
        {
          label:
            "Findings",
          value:
            String(
              safeShare.issues.length,
            ),
        },
        ...safeShare.issues
          .slice(0, 3)
          .map((issue) => ({
            label:
              "Attention",
            value:
              issue.title,
          })),
      ],
      action: {
        kind:
          "safe-share",
        label:
          "Open Safe Share",
        targetNodeId:
          active.id,
      },
    };
  } else {
    sharingAnswer = {
      question:
        "sharing-attention",
      status:
        safeShare.status ===
        "COVERAGE_LIMITED"
          ? "attention"
          : "ready",
      title:
        safeShare.status ===
        "COVERAGE_LIMITED"
          ? "No actionable issue found, but coverage is limited"
          : "No current finding in the checks that ran",
      answer:
        safeShare.statement,
      evidence: [
        {
          label:
            "Safe Share status",
          value:
            safeShare.status,
        },
        {
          label:
            "Coverage notes",
          value:
            safeShare.issues.length ===
            0
              ? "No listed issue"
              : `${safeShare.issues.length} coverage item(s)`,
        },
      ],
      action: {
        kind:
          "safe-share",
        label:
          "Review Safe Share details",
        targetNodeId:
          active.id,
      },
    };
  }

  const attentionFindings =
    report.findings.filter(
      (finding) =>
        finding.severity ===
        "attention",
    );

  let nextAnswer: WorkspaceCopilotAnswer;

  if (
    verification.status ===
    "FAILED"
  ) {
    nextAnswer = {
      question:
        "next-step",
      status:
        "attention",
      title:
        "Resolve workspace relationship failures first",
      answer:
        "The graph has a deterministic verification failure. Review the Findings Center before using provenance-dependent actions.",
      evidence: [
        {
          label:
            "Relationship verification",
          value:
            verification.status,
        },
        {
          label:
            "Attention findings",
          value:
            String(
              attentionFindings.length,
            ),
        },
      ],
      action: {
        kind:
          "findings-center",
        label:
          "Open Findings Center",
      },
    };
  } else if (
    safeShare?.status ===
    "REVIEW_REQUIRED"
  ) {
    nextAnswer = {
      question:
        "next-step",
      status:
        "attention",
      title:
        "Review sharing risks before exporting or sending",
      answer:
        "Safe Share found items that may deserve action. Resolve or consciously accept those findings before distribution.",
      evidence: [
        {
          label:
            "Safe Share",
          value:
            safeShare.status,
        },
        {
          label:
            "Review items",
          value:
            String(
              safeShare.issues.length,
            ),
        },
      ],
      action: {
        kind:
          "safe-share",
        label:
          "Review Safe Share",
        targetNodeId:
          active.id,
      },
    };
  } else if (!activeIsLatest) {
    nextAnswer = {
      question:
        "next-step",
      status:
        "attention",
      title:
        "Move to the newest saved version",
      answer:
        "A newer state exists in the same document identity. Make it current before continuing unless this older version is intentional.",
      evidence: [
        {
          label:
            "Current",
          value:
            `V${active.version}`,
        },
        {
          label:
            "Newest",
          value:
            `V${latest.version}`,
        },
      ],
      action: {
        kind:
          "make-current",
        label:
          "Use latest version",
        targetNodeId:
          latest.id,
      },
    };
  } else if (
    comparison &&
    comparison.comparison.relationship !==
      "unverified"
  ) {
    nextAnswer = {
      question:
        "next-step",
      status:
        "ready",
      title:
        "Review the related document comparison",
      answer:
        "The workspace has a meaningful relationship that can inform your next operation. Review the comparison before merging, deleting, or replacing anything.",
      evidence: [
        {
          label:
            "Comparison target",
          value:
            comparison.targetName,
        },
        {
          label:
            "Relationship",
          value:
            comparison.comparison
              .relationship,
        },
      ],
      action: {
        kind:
          "compare-documents",
        label:
          "Review comparison",
        targetNodeId:
          comparison.targetNodeId,
        targetNodeIds: [
          active.id,
          comparison.targetNodeId,
        ],
      },
    };
  } else {
    nextAnswer = {
      question:
        "next-step",
      status:
        "ready",
      title:
        "No urgent workspace issue is blocking you",
      answer:
        "Continue with the operation you intend to perform, then keep Kukureku verification and version history enabled so the resulting state remains traceable.",
      evidence: [
        {
          label:
            "Relationship verification",
          value:
            verification.status,
        },
        {
          label:
            "Workspace findings",
          value:
            String(
              report.findings.length,
            ),
        },
      ],
      action: {
        kind:
          "inspect-document",
        label:
          "Inspect current document",
        targetNodeId:
          active.id,
      },
    };
  }

  return [
    versionAnswer,
    changeAnswer,
    sharingAnswer,
    nextAnswer,
  ];
}
