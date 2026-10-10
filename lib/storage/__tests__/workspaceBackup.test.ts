import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  createWorkspaceBackupArchive, parseWorkspaceBackupArchive,
  WORKSPACE_BACKUP_SCHEMA, type WorkspaceBackupEntry,
} from "../workspaceBackup";
import type {WorkspaceFileSummary} from "../workspaceFiles";

const pdf = new TextEncoder().encode("%PDF-1.4\nbody\n%%EOF");
function make(id: string, parents: string[] = []): WorkspaceBackupEntry {
  const derived = parents.length > 0;
  const summary: WorkspaceFileSummary = {
    id, name: id + ".pdf", size: pdf.length, type:"application/pdf",
    lastModified:1000, savedAt:"2026-10-10T03:00:00.000Z",
    role: derived ? "derived":"source",
    parentId: parents[0] ?? null, parentIds:parents,
    rootId:parents[0] ?? id,rootIds:[parents[0] ?? id],
    documentId:parents[0] ?? id,relationKind:derived?"revision":"source",
    operationId:derived?"rotate":null,operationLabel:derived?"Rotate":null,
    version:derived?2:1,generation:derived?1:0,
  };
  return {summary, bytes:new Uint8Array(pdf)};
}
describe("private ZIP backup integrity",()=>{
  it("exports and reimports PDF bytes and full version lineage", async()=>{
    const archive=await createWorkspaceBackupArchive([make("source"),make("revision",["source"])]);
    const parsed=await parseWorkspaceBackupArchive(archive);
    expect(parsed.map(v=>v.summary.id)).toEqual(["source","revision"]);
    expect(parsed[1].summary.parentIds).toEqual(["source"]);
    expect(parsed[0].bytes).toEqual(pdf);
  });
  it("rejects tampered PDFs before returning anything", async()=>{
    const zip=await JSZip.loadAsync(await createWorkspaceBackupArchive([make("source")]));
    zip.file("files/0.pdf",new TextEncoder().encode("%PDF-1.4\nchanged"),{compression:"STORE"});
    await expect(parseWorkspaceBackupArchive(await zip.generateAsync({type:"uint8array"}))).rejects.toThrow(/SHA-256 mismatch|expanded archive size/);
  });
  it("rejects unknown schemas, missing sources and external archive entries", async()=>{
    const zip=await JSZip.loadAsync(await createWorkspaceBackupArchive([make("source")]));
    const m=JSON.parse(await zip.file("manifest.json")!.async("string"));
    m.schema=WORKSPACE_BACKUP_SCHEMA+"-unknown";
    zip.file("manifest.json",JSON.stringify(m));
    await expect(parseWorkspaceBackupArchive(await zip.generateAsync({type:"uint8array"}))).rejects.toThrow(/Unsupported/);
    await expect(createWorkspaceBackupArchive([make("child",["missing"])] )).rejects.toThrow(/missing document/);
  });
  it("rejects cycles and non-PDF payloads", async()=>{
    const a=make("a");a.bytes=new TextEncoder().encode("NOT A PDF DOCUMENT");a.summary.size=a.bytes.length;
    await expect(createWorkspaceBackupArchive([a])).rejects.toThrow(/header/);
    const b=make("b",["c"]);const c=make("c",["b"]);
    await expect(createWorkspaceBackupArchive([b,c])).rejects.toThrow(/cycle/);
  });
});
