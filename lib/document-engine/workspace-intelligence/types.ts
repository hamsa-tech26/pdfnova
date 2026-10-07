export type WorkspaceIntelligenceRelationKind =
  | "source"
  | "revision"
  | "branch"
  | "composition";

export type WorkspaceIntelligenceNode = {
  id: string;
  name: string;
  type?: string;
  size: number;
  lastModified: number;
  documentId: string;
  parentIds: string[];
  rootIds: string[];
  relationKind: WorkspaceIntelligenceRelationKind;
  version: number;
  generation: number;
};

export type WorkspaceIntelligenceConfidence =
  | "certain"
  | "strong"
  | "possible";

export type WorkspaceIntelligenceSeverity =
  | "info"
  | "attention";

export type WorkspaceIntelligenceFindingKind =
  | "composition"
  | "branch-lineage"
  | "branch-divergence"
  | "version-chain"
  | "shared-ancestry"
  | "possible-duplicate"
  | "missing-parent-reference";

export type WorkspaceIntelligenceFinding = {
  id: string;
  kind: WorkspaceIntelligenceFindingKind;
  confidence: WorkspaceIntelligenceConfidence;
  severity: WorkspaceIntelligenceSeverity;
  title: string;
  detail: string;
  nodeIds: string[];
  documentIds: string[];
  evidence: string[];
  nextStep?: string;
};

export type WorkspaceIntelligenceReport = {
  schemaVersion: 1;
  activeNodeId: string | null;
  activeDocumentId: string | null;
  summary: {
    nodeCount: number;
    documentCount: number;
    rootCount: number;
    compositionCount: number;
    branchCount: number;
  };
  findings: WorkspaceIntelligenceFinding[];
  coverage: {
    mode: "graph-metadata-only";
    readsDocumentContent: false;
    usesCryptographicHash: false;
    notes: string[];
  };
};
