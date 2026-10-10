import { describe, expect, it } from "vitest";
import { auditWorkspaceVersions } from "../workspaceAudit";
describe("workspace metadata-only health audit", () => {
  it("counts version nodes, documents, bytes, and missing parent links", () => {
    const entries = [
      { id: "a", documentId:"a", parentIds:[], size:120 },
      { id: "b", documentId:"a", parentIds:["a"], size:180 },
      { id: "c", documentId:"c", parentIds:["b","unavailable"], size:0 },
    ];
    expect(auditWorkspaceVersions(entries)).toEqual({
      versionCount:3, documentCount:2, totalReferencedBytes:300,
      missingParentReferences:1, duplicateIds:0
    });
  });
  it("handles empty workspace without claiming storage integrity", () => {
    expect(auditWorkspaceVersions([])).toMatchObject({versionCount:0,documentCount:0,missingParentReferences:0});
  });
  it("reports duplicate identifiers defensively",()=>{
    expect(auditWorkspaceVersions([{id:"a",documentId:"d",parentIds:[],size:1},{id:"a",documentId:"d",parentIds:[],size:2}]).duplicateIds).toBe(1);
  });
});
