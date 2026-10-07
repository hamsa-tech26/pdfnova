export type WorkspaceFileRole =
  | "source"
  | "derived";

export type WorkspaceLineage = {
  role: WorkspaceFileRole;
  parentId: string | null;
  rootId: string;
  operationId: string | null;
  operationLabel: string | null;
  version: number;
  generation: number;
};

export type WorkspaceFileFingerprint = {
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export type WorkspaceOperationDescriptor = {
  operationId: string;
  operationLabel: string;
};

export function createSourceLineage(
  id: string,
): WorkspaceLineage {
  return {
    role: "source",
    parentId: null,
    rootId: id,
    operationId: null,
    operationLabel: null,
    version: 1,
    generation: 0,
  };
}

export function createDerivedLineage(
  parent: WorkspaceLineage & {
    id: string;
  },
  nextVersion: number,
  operation: WorkspaceOperationDescriptor,
): WorkspaceLineage {
  return {
    role: "derived",
    parentId: parent.id,
    rootId:
      parent.rootId || parent.id,
    operationId:
      operation.operationId,
    operationLabel:
      operation.operationLabel,
    version: nextVersion,
    generation:
      Math.max(
        0,
        parent.generation,
      ) + 1,
  };
}

export function normalizeWorkspaceLineage(
  value: Partial<WorkspaceLineage> & {
    id: string;
  },
): WorkspaceLineage {
  const isDerived =
    value.role === "derived" &&
    Boolean(value.parentId);

  return {
    role: isDerived
      ? "derived"
      : "source",
    parentId: isDerived
      ? value.parentId ?? null
      : null,
    rootId:
      value.rootId || value.id,
    operationId: isDerived
      ? value.operationId ?? null
      : null,
    operationLabel: isDerived
      ? value.operationLabel ?? null
      : null,
    version:
      typeof value.version ===
        "number" &&
      value.version >= 1
        ? Math.floor(value.version)
        : 1,
    generation:
      typeof value.generation ===
        "number" &&
      value.generation >= 0
        ? Math.floor(
            value.generation,
          )
        : isDerived
          ? 1
          : 0,
  };
}

export function isSameWorkspaceFileFingerprint(
  left: WorkspaceFileFingerprint,
  right: WorkspaceFileFingerprint,
) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified ===
      right.lastModified &&
    (left.type ||
      "application/pdf") ===
      (right.type ||
        "application/pdf")
  );
}
