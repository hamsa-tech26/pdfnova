import { describe, expect, it } from "vitest";
import { evaluatePackageGuard } from "../package-guard/evaluate";
import { getPackageGuardPreset } from "../package-guard/policies";
import type { PackageGuardDocumentEvidence } from "../package-guard/types";

function document(overrides: Partial<PackageGuardDocumentEvidence> & { nodeId: string; name: string }): PackageGuardDocumentEvidence {
  return {
    nodeId: overrides.nodeId,
    documentId: overrides.documentId ?? overrides.nodeId,
    name: overrides.name,
    size: overrides.size ?? 1000,
    sha256: overrides.sha256 ?? overrides.nodeId + "-hash",
    openable: overrides.openable ?? true,
    pageCount: overrides.pageCount ?? 1,
    commonMetadataCount: overrides.commonMetadataCount ?? 0,
    formFieldCount: overrides.formFieldCount ?? 0,
    hasXfa: overrides.hasXfa ?? false,
    sensitiveMatchCount: overrides.sensitiveMatchCount ?? 0,
    selectableTextChars: overrides.selectableTextChars ?? 100,
    mixedPageSizes: overrides.mixedPageSizes ?? false,
    rotatedPageCount: overrides.rotatedPageCount ?? 0,
    customCropBoxPageCount: overrides.customCropBoxPageCount ?? 0,
  };
}

describe("Package Guard V1", () => {
  it("returns READY when configured deterministic checks pass", () => {
    const policy = { ...getPackageGuardPreset("strict-submission-review"), commonMetadata: "ignore" as const, interactiveForms: "ignore" as const, xfa: "ignore" as const, sensitivePatterns: "ignore" as const, noSelectableText: "ignore" as const, mixedPageSizes: "ignore" as const, customCropBoxes: "ignore" as const, exactDuplicates: "ignore" as const };
    const report = evaluatePackageGuard({ policy, documents: [document({ nodeId: "a", name: "application.pdf" })], graph: { status: "PASS", failedCount: 0, notVerifiedCount: 0 }, snapshotFingerprint: "snapshot", evaluatedAt: 1 });
    expect(report.status).toBe("READY");
    expect(report.summary.failed).toBe(0);
    expect(report.snapshotFingerprint).toBe("snapshot");
  });

  it("blocks on unreadable PDFs and required filename labels that are missing", () => {
    const policy = { ...getPackageGuardPreset("integrity-only"), requiredFilenameTokens: ["certificate"] };
    const report = evaluatePackageGuard({ policy, documents: [document({ nodeId: "a", name: "application.pdf", openable: false })], graph: { status: "PASS", failedCount: 0, notVerifiedCount: 0 }, snapshotFingerprint: "snapshot" });
    expect(report.status).toBe("BLOCKED");
    expect(report.checks.find((check) => check.id === "pdf-openability")?.status).toBe("FAIL");
    expect(report.checks.find((check) => check.id === "required-filename:certificate")?.status).toBe("FAIL");
  });

  it("detects exact duplicate heads by local SHA-256 and requires review", () => {
    const policy = getPackageGuardPreset("integrity-only");
    const report = evaluatePackageGuard({ policy, documents: [document({ nodeId: "a", name: "one.pdf", sha256: "same" }), document({ nodeId: "b", name: "two.pdf", sha256: "same" })], graph: { status: "PASS", failedCount: 0, notVerifiedCount: 0 }, snapshotFingerprint: "snapshot" });
    expect(report.status).toBe("REVIEW");
    expect(report.checks.find((check) => check.id === "exact-duplicates")?.status).toBe("WARN");
  });

  it("blocks strict submission on metadata while keeping sensitive matches as review", () => {
    const policy = getPackageGuardPreset("strict-submission-review");
    const report = evaluatePackageGuard({ policy, documents: [document({ nodeId: "a", name: "application.pdf", commonMetadataCount: 2, sensitiveMatchCount: 1 })], graph: { status: "PASS", failedCount: 0, notVerifiedCount: 0 }, snapshotFingerprint: "snapshot" });
    expect(report.status).toBe("BLOCKED");
    expect(report.checks.find((check) => check.id === "common-metadata")?.status).toBe("FAIL");
    expect(report.checks.find((check) => check.id === "sensitive-patterns")?.status).toBe("WARN");
  });

  it("never treats an unverified graph as READY", () => {
    const policy = { ...getPackageGuardPreset("integrity-only"), exactDuplicates: "ignore" as const, xfa: "ignore" as const };
    const report = evaluatePackageGuard({ policy, documents: [document({ nodeId: "a", name: "application.pdf" })], graph: { status: "PASS_WITH_WARNING", failedCount: 0, notVerifiedCount: 1 }, snapshotFingerprint: "snapshot" });
    expect(report.status).toBe("REVIEW");
    expect(report.summary.notVerified).toBeGreaterThan(0);
  });
});