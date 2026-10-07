export type DocumentArtifactSource =
  | "upload"
  | "operation"
  | "test"
  | "unknown";

export type DocumentArtifact = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  parentArtifactId?: string;
  createdBy?: string;
  source: DocumentArtifactSource;
  createdAt: number;
};

export type CreateDocumentArtifactOptions = {
  id?: string;
  name: string;
  mimeType?: string;
  parentArtifactId?: string;
  createdBy?: string;
  source?: DocumentArtifactSource;
  createdAt?: number;
};

function createArtifactId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `artifact-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function createDocumentArtifact(
  blob: Blob,
  options: CreateDocumentArtifactOptions,
): DocumentArtifact {
  const mimeType =
    options.mimeType ||
    blob.type ||
    "application/octet-stream";

  return {
    id: options.id ?? createArtifactId(),
    name: options.name,
    mimeType,
    size: blob.size,
    blob,
    parentArtifactId:
      options.parentArtifactId,
    createdBy: options.createdBy,
    source: options.source ?? "unknown",
    createdAt:
      options.createdAt ?? Date.now(),
  };
}

export function createDerivedArtifact(
  parent: DocumentArtifact,
  blob: Blob,
  options: Omit<
    CreateDocumentArtifactOptions,
    "parentArtifactId"
  >,
) {
  return createDocumentArtifact(blob, {
    ...options,
    parentArtifactId: parent.id,
    source:
      options.source ?? "operation",
  });
}
