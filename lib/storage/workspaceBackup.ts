import JSZip from "jszip";
import type { WorkspaceFileSummary } from "./workspaceFiles";

export const WORKSPACE_BACKUP_MAX_FILES = 60;
export const WORKSPACE_BACKUP_MAX_BYTES = 64 * 1024 * 1024;
export const WORKSPACE_BACKUP_MAX_ARCHIVE_BYTES = 96 * 1024 * 1024;
export const WORKSPACE_BACKUP_SCHEMA = "kukureku-private-workspace-backup-v1";

export type WorkspaceBackupEntry = {
  summary: WorkspaceFileSummary;
  bytes: Uint8Array;
};

type ArchiveEntry = { summary: WorkspaceFileSummary; entry: string; sha256: string };
type ArchiveManifest = {
  schema: string;
  createdAt: string;
  privacy: string;
  versions: ArchiveEntry[];
};

async function digest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const result = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(result), n => n.toString(16).padStart(2, "0")).join("");
}

function pdfHeader(bytes: Uint8Array) {
  return bytes.length >= 8 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

function assertSummary(input: unknown): asserts input is WorkspaceFileSummary {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid backup metadata.");
  const s = input as Record<string, unknown>;
  const simpleId = (x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(x);
  if (!simpleId(s.id) || !simpleId(s.documentId) || !simpleId(s.rootId) ||
      typeof s.name !== "string" || s.name.length === 0 || s.name.length > 255 ||
      s.type !== "application/pdf" ||
      !Number.isSafeInteger(s.size) || (s.size as number) < 8 ||
      !Number.isSafeInteger(s.lastModified) || (s.lastModified as number) < 0 ||
      typeof s.savedAt !== "string" || !Number.isFinite(Date.parse(s.savedAt)) ||
      !Number.isSafeInteger(s.version) || (s.version as number) < 1 ||
      !Number.isSafeInteger(s.generation) || (s.generation as number) < 0 ||
      (s.role !== "source" && s.role !== "derived") ||
      !["source", "revision", "branch", "composition"].includes(String(s.relationKind)) ||
      !Array.isArray(s.parentIds) || !Array.isArray(s.rootIds) || !(s.rootIds as unknown[]).length ||
      !(s.parentIds as unknown[]).every(simpleId) || !(s.rootIds as unknown[]).every(simpleId) ||
      !(s.parentId === null || simpleId(s.parentId)) ||
      !(s.operationId === null || (typeof s.operationId === "string" && s.operationId.length <= 128)) ||
      !(s.operationLabel === null || (typeof s.operationLabel === "string" && s.operationLabel.length <= 200))) {
    throw new Error("Invalid backup version metadata.");
  }
  if (s.role === "source") {
    if ((s.parentIds as string[]).length || s.parentId !== null ||
        s.relationKind !== "source" || s.documentId !== s.id ||
        s.rootId !== s.id || (s.version as number) !== 1) {
      throw new Error("Invalid source document lineage.");
    }
  } else if (!(s.parentIds as string[]).length || s.parentId !== (s.parentIds as string[])[0] ||
    s.relationKind === "source") {
    throw new Error("Invalid derived document lineage.");
  }
}

function validateGraph(entries: WorkspaceBackupEntry[]): void {
  const ids = new Set<string>();
  for (const {summary, bytes} of entries) {
    assertSummary(summary);
    if (ids.has(summary.id)) throw new Error("Backup contains duplicate document IDs.");
    ids.add(summary.id);
    if (bytes.length !== summary.size || !pdfHeader(bytes)) throw new Error("PDF backup size or header does not match its metadata.");
  }
  const parents = new Map(entries.map(({summary}) => [summary.id, summary.parentIds]));
  for (const {summary} of entries) {
    for (const id of [...summary.parentIds, ...summary.rootIds, summary.documentId]) {
      if (!ids.has(id)) throw new Error("Backup contains a missing document or ancestor reference.");
    }
    if (summary.parentIds.includes(summary.id)) throw new Error("Backup contains a self-referencing version.");
  }
  const visited = new Set<string>(), active = new Set<string>();
  const walk = (id: string) => {
    if (active.has(id)) throw new Error("Backup version graph contains a cycle.");
    if (visited.has(id)) return;
    active.add(id);
    for (const parent of parents.get(id) ?? []) walk(parent);
    active.delete(id);
    visited.add(id);
  };
  for (const id of ids) walk(id);
}

function limits(entries: WorkspaceBackupEntry[]) {
  if (!entries.length || entries.length > WORKSPACE_BACKUP_MAX_FILES) {
    throw new Error("Backups support between 1 and 60 stored PDF versions.");
  }
  const sum = entries.reduce((n, item) => n + item.bytes.byteLength, 0);
  if (!Number.isSafeInteger(sum) || sum > WORKSPACE_BACKUP_MAX_BYTES) {
    throw new Error("The workspace exceeds the 64 MB browser backup limit. Download individual PDFs instead.");
  }
}

export async function createWorkspaceBackupArchive(entries: WorkspaceBackupEntry[]): Promise<Uint8Array> {
  limits(entries);
  validateGraph(entries);
  const zip = new JSZip();
  const versions: ArchiveEntry[] = [];
  for (const [index, {summary, bytes}] of entries.entries()) {
    const entry = "files/" + index + ".pdf";
    versions.push({summary, entry, sha256: await digest(bytes)});
    zip.file(entry, bytes, {compression: "STORE"});
  }
  const manifest: ArchiveManifest = {
    schema: WORKSPACE_BACKUP_SCHEMA,
    createdAt: new Date().toISOString(),
    privacy: "Contains original PDF bytes and filenames. Keep this ZIP private. Not uploaded by Kukureku.",
    versions,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const output = await zip.generateAsync({type:"uint8array", compression:"STORE"});
  if (output.length > WORKSPACE_BACKUP_MAX_ARCHIVE_BYTES) throw new Error("Backup ZIP exceeds the allowed size.");
  return output;
}

export async function parseWorkspaceBackupArchive(bytes: Uint8Array): Promise<WorkspaceBackupEntry[]> {
  if (!bytes.byteLength || bytes.byteLength > WORKSPACE_BACKUP_MAX_ARCHIVE_BYTES) {
    throw new Error("Backup ZIP is empty or exceeds 96 MB.");
  }
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes, {checkCRC32:true}); }
  catch { throw new Error("The selected ZIP is damaged or invalid."); }
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Backup is missing manifest.json.");
  const manifestSize = (manifestFile as unknown as {_data?: {uncompressedSize?: number}})._data?.uncompressedSize;
  if (manifestSize === undefined || manifestSize > 256 * 1024) throw new Error("Backup manifest is too large.");
  let manifest: ArchiveManifest;
  try { manifest = JSON.parse(await manifestFile.async("string")) as ArchiveManifest; }
  catch { throw new Error("Backup manifest JSON is invalid."); }
  if (manifest?.schema !== WORKSPACE_BACKUP_SCHEMA ||
      !Array.isArray(manifest.versions) ||
      !manifest.versions.length || manifest.versions.length > WORKSPACE_BACKUP_MAX_FILES) {
    throw new Error("Unsupported or oversized Kukureku backup manifest.");
  }
  const allowedPaths = new Set(["manifest.json"]);
  let claimedBytes = 0;
  for (const [i, v] of manifest.versions.entries()) {
    if (!v || typeof v !== "object" || v.entry !== "files/" + i + ".pdf" ||
        !/^[0-9a-f]{64}$/.test(v.sha256)) throw new Error("Backup has an unsafe file entry.");
    assertSummary(v.summary);
    claimedBytes += v.summary.size;
    const entry = zip.file(v.entry);
    const expandedSize = (entry as unknown as {_data?: {uncompressedSize?: number}} | null)?._data?.uncompressedSize;
    if (!entry || expandedSize === undefined || expandedSize !== v.summary.size) {
      throw new Error("A PDF is missing or has an unsafe expanded archive size.");
    }
    allowedPaths.add(v.entry);
  }
  if (claimedBytes > WORKSPACE_BACKUP_MAX_BYTES) {
    throw new Error("The backup expands beyond the 64 MB safety limit.");
  }
  if (Object.keys(zip.files).some(name => !allowedPaths.has(name) && name !== "files/")) {
    throw new Error("The backup has unexpected archive entries.");
  }
  const entries: WorkspaceBackupEntry[] = [];
  for (const version of manifest.versions) {
    const file = zip.file(version.entry);
    if (!file) throw new Error("Missing PDF in backup.");
    const content = await file.async("uint8array");
    if (content.byteLength !== version.summary.size ||
        (await digest(content)) !== version.sha256) {
      throw new Error("Backup PDF SHA-256 mismatch: import rejected without changes.");
    }
    entries.push({summary:version.summary, bytes:content});
  }
  limits(entries);
  validateGraph(entries);
  return entries;
}
