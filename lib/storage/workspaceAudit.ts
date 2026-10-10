import type { WorkspaceFileSummary } from "./workspaceFiles";

export type WorkspaceAuditEntry = Pick<WorkspaceFileSummary, "id" | "documentId" | "parentIds" | "size">;
export type WorkspaceHealth = {
  versionCount: number;
  documentCount: number;
  totalReferencedBytes: number;
  missingParentReferences: number;
  duplicateIds: number;
};

export function auditWorkspaceVersions(entries: WorkspaceAuditEntry[]): WorkspaceHealth {
  const known = new Set(entries.map(e => e.id));
  const missingParentReferences = entries.reduce((sum, entry) =>
    sum + entry.parentIds.filter(id => !known.has(id)).length, 0);
  return {
    versionCount: entries.length,
    documentCount: new Set(entries.map(e=>e.documentId)).size,
    totalReferencedBytes: entries.reduce((n,e)=>n+(Number.isFinite(e.size)&&e.size>0?e.size:0),0),
    missingParentReferences,
    duplicateIds: entries.length - known.size,
  };
}
