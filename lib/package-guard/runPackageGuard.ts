import {
  createDocumentArtifact,
} from "../document-engine/artifact";
import {
  inspectPdfArtifact,
} from "../document-engine/inspection/inspectPdf";
import {
  createPdfContentSignal,
} from "../document-engine/workspace-intelligence/contentSignals";
import {
  scanSensitiveText,
} from "../document-engine/workspace-intelligence/sensitiveSignals";
import {
  verifyWorkspaceRelationships,
} from "../document-engine/workspace-intelligence/verification";
import {
  evaluatePackageGuard,
} from "../document-engine/package-guard/evaluate";
import type {
  PackageGuardDocumentEvidence,
  PackageGuardPolicy,
  PackageGuardReport,
} from "../document-engine/package-guard/types";
import {
  getWorkspaceFile,
  listWorkspaceFileSummaries,
} from "../storage/workspaceFiles";
import {
  groupWorkspaceDocuments,
} from "../storage/workspaceGraph";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function inspectHead(nodeId: string): Promise<PackageGuardDocumentEvidence | null> {
  const summaries = await listWorkspaceFileSummaries();
  const summary = summaries.find((item) => item.id === nodeId);
  if (!summary) return null;
  const file = await getWorkspaceFile(nodeId);
  if (!file) {
    return { nodeId, documentId: summary.documentId, name: summary.name, size: summary.size, sha256: null, openable: false, pageCount: null, commonMetadataCount: null, formFieldCount: null, hasXfa: null, sensitiveMatchCount: null, selectableTextChars: null, mixedPageSizes: null, rotatedPageCount: null, customCropBoxPageCount: null };
  }

  let inspection: Awaited<ReturnType<typeof inspectPdfArtifact>> | null = null;
  let signal: Awaited<ReturnType<typeof createPdfContentSignal>> | null = null;

  try {
    inspection = await inspectPdfArtifact(createDocumentArtifact(file, { id: summary.id, name: summary.name, mimeType: summary.type, source: summary.role === "source" ? "upload" : "operation" }));
  } catch {
    inspection = null;
  }

  try {
    signal = await createPdfContentSignal(file);
  } catch {
    signal = null;
  }

  const sensitive = signal ? scanSensitiveText(signal.rawText ?? "") : null;

  return {
    nodeId: summary.id,
    documentId: summary.documentId,
    name: summary.name,
    size: summary.size,
    sha256: signal?.sha256 ?? null,
    openable: Boolean(inspection),
    pageCount: inspection?.facts.pageCount ?? signal?.pageCount ?? null,
    commonMetadataCount: inspection?.facts.commonMetadataFieldsPresent.length ?? null,
    formFieldCount: inspection?.facts.form.fieldCount ?? null,
    hasXfa: inspection?.facts.form.hasXfa ?? null,
    sensitiveMatchCount: sensitive?.totalMatches ?? null,
    selectableTextChars: signal?.selectableTextChars ?? null,
    mixedPageSizes: inspection?.facts.hasMixedPageSizes ?? null,
    rotatedPageCount: inspection?.facts.rotatedPageCount ?? null,
    customCropBoxPageCount: inspection?.facts.customCropBoxPageCount ?? null,
  };
}

export async function runPackageGuard(policy: PackageGuardPolicy): Promise<PackageGuardReport> {
  const summaries = await listWorkspaceFileSummaries();
  const heads = groupWorkspaceDocuments(summaries).map((group) => group.head);
  const documents = (await Promise.all(heads.map((head) => inspectHead(head.id)))).filter((item): item is PackageGuardDocumentEvidence => Boolean(item));
  const graphReport = verifyWorkspaceRelationships(summaries);
  const snapshotMaterial = documents
    .map((document) => document.documentId + ":" + document.nodeId + ":" + (document.sha256 ?? "unhashed") + ":" + document.size)
    .sort()
    .join("|");
  const snapshotFingerprint = await sha256Hex(snapshotMaterial);

  return evaluatePackageGuard({
    policy,
    documents,
    graph: {
      status: graphReport.status,
      failedCount: graphReport.checks.filter((check) => check.status === "FAILED").length,
      notVerifiedCount: graphReport.checks.filter((check) => check.status === "NOT_VERIFIED").length,
    },
    snapshotFingerprint,
  });
}