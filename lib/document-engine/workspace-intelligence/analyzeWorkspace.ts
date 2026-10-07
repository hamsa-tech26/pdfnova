import type {
  WorkspaceIntelligenceFinding,
  WorkspaceIntelligenceNode,
  WorkspaceIntelligenceReport,
} from "./types";

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizedName(value: string) {
  return value.trim().toLowerCase();
}

function fingerprint(node: WorkspaceIntelligenceNode) {
  return [
    normalizedName(node.name),
    (node.type ?? "").trim().toLowerCase(),
    String(node.size),
    String(node.lastModified),
  ].join("|");
}

function findingPriority(finding: WorkspaceIntelligenceFinding) {
  if (finding.severity === "attention") {
    return 0;
  }

  if (finding.confidence === "certain") {
    return 1;
  }

  if (finding.confidence === "strong") {
    return 2;
  }

  return 3;
}

function selectDocumentHead(nodes: WorkspaceIntelligenceNode[]) {
  return [...nodes].sort((left, right) => {
    return (
      right.version - left.version ||
      right.generation - left.generation ||
      right.id.localeCompare(left.id)
    );
  })[0];
}

export function createWorkspaceIntelligenceReport(
  nodes: WorkspaceIntelligenceNode[],
  activeNodeId?: string | null,
): WorkspaceIntelligenceReport {
  const orderedNodes = [...nodes].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const byId = new Map(
    orderedNodes.map((node) => [node.id, node]),
  );
  const byDocument = new Map<
    string,
    WorkspaceIntelligenceNode[]
  >();

  for (const node of orderedNodes) {
    const current = byDocument.get(node.documentId) ?? [];
    current.push(node);
    byDocument.set(node.documentId, current);
  }

  const documentHeads = [...byDocument.entries()]
    .map(([documentId, documentNodes]) => ({
      documentId,
      node: selectDocumentHead(documentNodes),
    }))
    .sort((left, right) =>
      left.documentId.localeCompare(right.documentId),
    );

  const activeNode = activeNodeId
    ? byId.get(activeNodeId) ?? null
    : null;
  const findings: WorkspaceIntelligenceFinding[] = [];

  for (const node of orderedNodes) {
    const missingParentIds = node.parentIds.filter(
      (parentId) => !byId.has(parentId),
    );

    if (missingParentIds.length > 0) {
      findings.push({
        id: `missing-parent-reference:${node.id}`,
        kind: "missing-parent-reference",
        confidence: "certain",
        severity: "attention",
        title: "A document relationship is incomplete",
        detail: `${node.name} references ${missingParentIds.length} parent ${
          missingParentIds.length === 1 ? "document" : "documents"
        } that are not currently stored in this browser workspace.`,
        nodeIds: [node.id, ...missingParentIds],
        documentIds: [node.documentId],
        evidence: [
          `Missing parent IDs: ${missingParentIds.join(", ")}`,
        ],
        nextStep:
          "Keep the document, but treat its ancestry as incomplete until the missing parent is restored or intentionally removed.",
      });
    }

    if (
      node.relationKind === "composition" &&
      node.parentIds.length >= 2
    ) {
      findings.push({
        id: `composition:${node.id}`,
        kind: "composition",
        confidence: "certain",
        severity: "info",
        title: "This is a multi-document composition",
        detail: `${node.name} was created from ${node.parentIds.length} known parent documents.`,
        nodeIds: [node.id, ...node.parentIds],
        documentIds: uniqueSorted([
          node.documentId,
          ...node.parentIds
            .map((parentId) => byId.get(parentId)?.documentId)
            .filter((value): value is string => Boolean(value)),
        ]),
        evidence: [
          `Relationship type: ${node.relationKind}`,
          `Known parents: ${node.parentIds.length}`,
        ],
        nextStep:
          "Review the parent documents when provenance matters before continuing with another destructive operation.",
      });
    }

    if (node.relationKind === "branch") {
      findings.push({
        id: `branch-lineage:${node.id}`,
        kind: "branch-lineage",
        confidence: "certain",
        severity: "info",
        title: "This document is a child branch",
        detail: `${node.name} began as a separate child document while retaining its known source ancestry.`,
        nodeIds: [node.id, ...node.parentIds],
        documentIds: [node.documentId],
        evidence: [
          `Relationship type: ${node.relationKind}`,
          `Generation: ${node.generation}`,
        ],
      });
    }
  }

  for (const [documentId, documentNodes] of [...byDocument.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (documentNodes.length < 2) {
      continue;
    }

    const head = selectDocumentHead(documentNodes);
    findings.push({
      id: `version-chain:${documentId}`,
      kind: "version-chain",
      confidence: "certain",
      severity: "info",
      title: "Multiple saved versions belong to one document",
      detail: `${head.name} has ${documentNodes.length} workspace versions, with Version ${head.version} currently the newest recorded version.`,
      nodeIds: documentNodes.map((node) => node.id).sort(),
      documentIds: [documentId],
      evidence: [
        `Saved versions: ${documentNodes.length}`,
        `Newest version number: ${head.version}`,
      ],
    });
  }

  const childrenByParent = new Map<
    string,
    WorkspaceIntelligenceNode[]
  >();

  for (const node of orderedNodes) {
    for (const parentId of node.parentIds) {
      if (!byId.has(parentId)) {
        continue;
      }

      const children = childrenByParent.get(parentId) ?? [];
      children.push(node);
      childrenByParent.set(parentId, children);
    }
  }

  for (const [parentId, children] of [...childrenByParent.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const childDocumentIds = uniqueSorted(
      children.map((child) => child.documentId),
    );

    if (childDocumentIds.length < 2) {
      continue;
    }

    const parent = byId.get(parentId);
    findings.push({
      id: `branch-divergence:${parentId}`,
      kind: "branch-divergence",
      confidence: "certain",
      severity: "info",
      title: "One document state has multiple child documents",
      detail: `${parent?.name ?? "A workspace document"} has ${childDocumentIds.length} separate child document branches.`,
      nodeIds: [
        parentId,
        ...children.map((child) => child.id).sort(),
      ],
      documentIds: uniqueSorted([
        ...(parent ? [parent.documentId] : []),
        ...childDocumentIds,
      ]),
      evidence: [
        `Independent child documents: ${childDocumentIds.length}`,
      ],
      nextStep:
        "Treat each child as an independent document unless you intentionally merge or compare them later.",
    });
  }

  for (let leftIndex = 0; leftIndex < documentHeads.length; leftIndex += 1) {
    const left = documentHeads[leftIndex];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < documentHeads.length;
      rightIndex += 1
    ) {
      const right = documentHeads[rightIndex];
      const sharedRoots = uniqueSorted(
        left.node.rootIds.filter((rootId) =>
          right.node.rootIds.includes(rootId),
        ),
      );

      if (sharedRoots.length > 0) {
        findings.push({
          id: `shared-ancestry:${left.documentId}:${right.documentId}`,
          kind: "shared-ancestry",
          confidence: "certain",
          severity: "info",
          title: "Documents share known source ancestry",
          detail: `${left.node.name} and ${right.node.name} trace back to the same stored source lineage.`,
          nodeIds: [left.node.id, right.node.id],
          documentIds: [left.documentId, right.documentId],
          evidence: [
            `Shared root IDs: ${sharedRoots.join(", ")}`,
          ],
        });
        continue;
      }

      if (fingerprint(left.node) === fingerprint(right.node)) {
        findings.push({
          id: `possible-duplicate:${left.documentId}:${right.documentId}`,
          kind: "possible-duplicate",
          confidence: "strong",
          severity: "info",
          title: "Possible duplicate documents",
          detail: `${left.node.name} and ${right.node.name} have the same filename, MIME type, file size, and browser modification timestamp.`,
          nodeIds: [left.node.id, right.node.id],
          documentIds: [left.documentId, right.documentId],
          evidence: [
            `Filename: ${left.node.name}`,
            `Size: ${left.node.size} bytes`,
            `Browser timestamp: ${left.node.lastModified}`,
          ],
          nextStep:
            "Inspect both before deleting or merging them. Workspace Intelligence has not compared their bytes or computed a content hash.",
        });
      }
    }
  }

  findings.sort((left, right) => {
    return (
      findingPriority(left) - findingPriority(right) ||
      left.id.localeCompare(right.id)
    );
  });

  return {
    schemaVersion: 1,
    activeNodeId: activeNode?.id ?? null,
    activeDocumentId: activeNode?.documentId ?? null,
    summary: {
      nodeCount: orderedNodes.length,
      documentCount: byDocument.size,
      rootCount: new Set(
        orderedNodes.flatMap((node) => node.rootIds),
      ).size,
      compositionCount: orderedNodes.filter(
        (node) => node.relationKind === "composition",
      ).length,
      branchCount: orderedNodes.filter(
        (node) => node.relationKind === "branch",
      ).length,
    },
    findings,
    coverage: {
      mode: "graph-metadata-only",
      readsDocumentContent: false,
      usesCryptographicHash: false,
      notes: [
        "Known lineage findings come from browser-local workspace graph metadata.",
        "Possible duplicate findings compare filename, MIME type, file size, and browser modification timestamp only.",
        "This report does not read PDF text, compare page content, or compute a cryptographic content hash.",
      ],
    },
  };
}
