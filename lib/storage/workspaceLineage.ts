export type WorkspaceFileRole =
  | "source"
  | "derived";

export type WorkspaceRelationKind =
  | "source"
  | "revision"
  | "branch"
  | "composition";

export type WorkspaceLineage = {
  role: WorkspaceFileRole;
  parentId: string | null;
  parentIds: string[];
  rootId: string;
  rootIds: string[];
  documentId: string;
  relationKind: WorkspaceRelationKind;
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

function uniqueIds(
  values: Array<
    string | null | undefined
  >,
) {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          Boolean(value),
      ),
    ),
  ];
}

export function createSourceLineage(
  id: string,
): WorkspaceLineage {
  return {
    role: "source",
    parentId: null,
    parentIds: [],
    rootId: id,
    rootIds: [id],
    documentId: id,
    relationKind: "source",
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
  const normalized =
    normalizeWorkspaceLineage(
      parent,
    );

  return {
    role: "derived",
    parentId: parent.id,
    parentIds: [parent.id],
    rootId:
      normalized.rootId,
    rootIds: [
      ...normalized.rootIds,
    ],
    documentId:
      normalized.documentId,
    relationKind: "revision",
    operationId:
      operation.operationId,
    operationLabel:
      operation.operationLabel,
    version: nextVersion,
    generation:
      Math.max(
        0,
        normalized.generation,
      ) + 1,
  };
}

export function createBranchLineage(
  parent: WorkspaceLineage & {
    id: string;
  },
  id: string,
  operation: WorkspaceOperationDescriptor,
): WorkspaceLineage {
  const normalized =
    normalizeWorkspaceLineage(
      parent,
    );

  return {
    role: "derived",
    parentId: parent.id,
    parentIds: [parent.id],
    rootId:
      normalized.rootId,
    rootIds: [
      ...normalized.rootIds,
    ],
    documentId: id,
    relationKind: "branch",
    operationId:
      operation.operationId,
    operationLabel:
      operation.operationLabel,
    version: 1,
    generation:
      Math.max(
        0,
        normalized.generation,
      ) + 1,
  };
}

export function createCompositionLineage(
  parents: Array<
    WorkspaceLineage & {
      id: string;
    }
  >,
  id: string,
  operation: WorkspaceOperationDescriptor,
): WorkspaceLineage {
  if (parents.length < 2) {
    throw new Error(
      "A composed workspace document requires at least two parents.",
    );
  }

  const normalized =
    parents.map((parent) => ({
      id: parent.id,
      lineage:
        normalizeWorkspaceLineage(
          parent,
        ),
    }));
  const parentIds =
    uniqueIds(
      normalized.map(
        (parent) =>
          parent.id,
      ),
    );
  const rootIds =
    uniqueIds(
      normalized.flatMap(
        (parent) =>
          parent.lineage
            .rootIds,
      ),
    );

  return {
    role: "derived",
    parentId:
      parentIds[0] ?? null,
    parentIds,
    rootId:
      rootIds[0] ?? id,
    rootIds:
      rootIds.length
        ? rootIds
        : [id],
    documentId: id,
    relationKind:
      "composition",
    operationId:
      operation.operationId,
    operationLabel:
      operation.operationLabel,
    version: 1,
    generation:
      Math.max(
        ...normalized.map(
          (parent) =>
            parent.lineage
              .generation,
        ),
        0,
      ) + 1,
  };
}

export function normalizeWorkspaceLineage(
  value:
    | (Partial<
        WorkspaceLineage
      > & {
        id: string;
      }),
): WorkspaceLineage {
  const legacyParentId =
    typeof value.parentId ===
      "string"
      ? value.parentId
      : null;
  const parentIds =
    uniqueIds([
      ...(Array.isArray(
        value.parentIds,
      )
        ? value.parentIds
        : []),
      legacyParentId,
    ]);
  const legacyRootId =
    typeof value.rootId ===
      "string" &&
    value.rootId
      ? value.rootId
      : value.id;
  const rootIds =
    uniqueIds([
      ...(Array.isArray(
        value.rootIds,
      )
        ? value.rootIds
        : []),
      legacyRootId,
    ]);
  const isDerived =
    value.role === "derived" &&
    parentIds.length > 0;
  const relationKind:
    WorkspaceRelationKind =
    value.relationKind ===
      "branch" ||
    value.relationKind ===
      "composition" ||
    value.relationKind ===
      "revision" ||
    value.relationKind ===
      "source"
      ? value.relationKind
      : isDerived
        ? "revision"
        : "source";
  const documentId =
    typeof value.documentId ===
      "string" &&
    value.documentId
      ? value.documentId
      : relationKind ===
          "revision"
        ? legacyRootId
        : value.id;

  return {
    role: isDerived
      ? "derived"
      : "source",
    parentId: isDerived
      ? parentIds[0] ??
        null
      : null,
    parentIds: isDerived
      ? parentIds
      : [],
    rootId:
      rootIds[0] ??
      value.id,
    rootIds:
      rootIds.length > 0
        ? rootIds
        : [value.id],
    documentId,
    relationKind: isDerived
      ? relationKind
      : "source",
    operationId: isDerived
      ? value.operationId ??
        null
      : null,
    operationLabel: isDerived
      ? value.operationLabel ??
        null
      : null,
    version:
      typeof value.version ===
        "number" &&
      value.version >= 1
        ? Math.floor(
            value.version,
          )
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
