import type {
  PackageGuardCheck,
  PackageGuardCheckStatus,
  PackageGuardDocumentEvidence,
  PackageGuardGraphEvidence,
  PackageGuardPolicy,
  PackageGuardReport,
  PackageGuardSeverityMode,
} from "./types";

function modeStatus(mode: PackageGuardSeverityMode): PackageGuardCheckStatus | null {
  if (mode === "ignore") return null;
  return mode === "fail" ? "FAIL" : "WARN";
}

function action(label: string, route: string, nodeIds: string[]) {
  return { label, route, nodeIds };
}

function affectedRule(options: {
  id: string;
  mode: PackageGuardSeverityMode;
  title: string;
  passDetail: string;
  issueDetail: string;
  affected: PackageGuardDocumentEvidence[];
  evidence: string[];
  action?: PackageGuardCheck["action"];
}): PackageGuardCheck | null {
  const issueStatus = modeStatus(options.mode);
  if (!issueStatus) return null;
  if (options.affected.length === 0) {
    return { id: options.id, status: "PASS", title: options.title, detail: options.passDetail, nodeIds: [], evidence: options.evidence };
  }
  return {
    id: options.id,
    status: issueStatus,
    title: options.title,
    detail: options.issueDetail,
    nodeIds: options.affected.map((item) => item.nodeId),
    evidence: options.evidence,
    action: options.action,
  };
}

function duplicateGroups(documents: PackageGuardDocumentEvidence[]) {
  const byHash = new Map<string, PackageGuardDocumentEvidence[]>();
  for (const document of documents) {
    if (!document.sha256) continue;
    const group = byHash.get(document.sha256) ?? [];
    group.push(document);
    byHash.set(document.sha256, group);
  }
  return [...byHash.values()].filter((group) => group.length > 1);
}

export function evaluatePackageGuard(options: {
  policy: PackageGuardPolicy;
  documents: PackageGuardDocumentEvidence[];
  graph: PackageGuardGraphEvidence;
  snapshotFingerprint: string;
  evaluatedAt?: number;
}): PackageGuardReport {
  const { policy, documents, graph, snapshotFingerprint } = options;
  const checks: PackageGuardCheck[] = [];
  const totalBytes = documents.reduce((sum, document) => sum + document.size, 0);

  checks.push({
    id: "document-count-minimum",
    status: documents.length >= policy.minDocuments ? "PASS" : "FAIL",
    title: "Minimum document count",
    detail: documents.length >= policy.minDocuments
      ? "Package contains " + documents.length + " current document head(s), meeting the configured minimum of " + policy.minDocuments + "."
      : "Package contains " + documents.length + " current document head(s), below the configured minimum of " + policy.minDocuments + ".",
    nodeIds: documents.map((document) => document.nodeId),
    evidence: ["currentHeads=" + documents.length, "minimum=" + policy.minDocuments],
  });

  if (policy.maxDocuments !== null) {
    checks.push({
      id: "document-count-maximum",
      status: documents.length <= policy.maxDocuments ? "PASS" : "FAIL",
      title: "Maximum document count",
      detail: documents.length <= policy.maxDocuments ? "Package stays within the configured maximum document count." : "Package exceeds the configured maximum document count.",
      nodeIds: documents.map((document) => document.nodeId),
      evidence: ["currentHeads=" + documents.length, "maximum=" + policy.maxDocuments],
    });
  }

  if (policy.maxTotalBytes !== null) {
    checks.push({ id: "package-size", status: totalBytes <= policy.maxTotalBytes ? "PASS" : "FAIL", title: "Package size limit", detail: totalBytes <= policy.maxTotalBytes ? "Total package size is within the configured limit." : "Total package size exceeds the configured limit.", nodeIds: documents.map((document) => document.nodeId), evidence: ["totalBytes=" + totalBytes, "maximumBytes=" + policy.maxTotalBytes] });
  }

  if (policy.maxFileBytes !== null) {
    const oversized = documents.filter((document) => document.size > policy.maxFileBytes!);
    checks.push({ id: "per-file-size", status: oversized.length === 0 ? "PASS" : "FAIL", title: "Per-file size limit", detail: oversized.length === 0 ? "Every document stays within the configured per-file size limit." : oversized.length + " document(s) exceed the configured per-file size limit.", nodeIds: oversized.map((document) => document.nodeId), evidence: ["maximumBytes=" + policy.maxFileBytes, ...oversized.map((document) => document.name + ":" + document.size)], action: oversized.length ? action("Review compression", "/compress-pdf", oversized.map((document) => document.nodeId)) : undefined });
  }

  const unreadable = documents.filter((document) => !document.openable);
  checks.push({ id: "pdf-openability", status: unreadable.length === 0 ? "PASS" : "FAIL", title: "PDF openability", detail: unreadable.length === 0 ? "Every current document head opened successfully in the Kukureku inspector." : unreadable.length + " document(s) could not be opened by the shared PDF inspection engine.", nodeIds: unreadable.map((document) => document.nodeId), evidence: unreadable.length === 0 ? ["opened=" + documents.length] : unreadable.map((document) => "unreadable:" + document.name), action: unreadable.length ? action("Open Inspector", "/document-inspector", unreadable.map((document) => document.nodeId)) : undefined });

  const graphFailed = graph.status === "FAILED";
  const graphLimited = graph.status === "NOT_VERIFIED" || graph.status === "PASS_WITH_WARNING";
  checks.push({ id: "graph-integrity", status: graphFailed ? (policy.graphIntegrity === "fail" ? "FAIL" : "WARN") : graphLimited ? "NOT_VERIFIED" : "PASS", title: "Workspace graph integrity", detail: graphFailed ? graph.failedCount + " stored relationship check(s) failed." : graphLimited ? graph.notVerifiedCount + " relationship check(s) remain unverified." : "Stored parent, branch, revision, and composition relationships pass the current graph checks.", nodeIds: [], evidence: ["graphStatus=" + graph.status, "failedChecks=" + graph.failedCount, "notVerifiedChecks=" + graph.notVerifiedCount], action: graphFailed || graphLimited ? action("Open Findings Center", "/workspace-findings", []) : undefined });

  const duplicates = duplicateGroups(documents);
  const duplicateCheck = affectedRule({ id: "exact-duplicates", mode: policy.exactDuplicates, title: "Exact duplicate documents", passDetail: "No byte-identical duplicate document heads were found.", issueDetail: duplicates.length + " exact duplicate group(s) were found by local SHA-256.", affected: duplicates.flat(), evidence: duplicates.map((group) => group.map((document) => document.name).join(" = ")), action: duplicates.length ? action("Compare duplicates", "/compare-documents", duplicates[0].map((document) => document.nodeId)) : undefined });
  if (duplicateCheck) checks.push(duplicateCheck);

  const rules: Array<{ id: string; mode: PackageGuardSeverityMode; title: string; passDetail: string; issueDetail: (count: number) => string; affected: PackageGuardDocumentEvidence[]; evidence: (document: PackageGuardDocumentEvidence) => string; actionLabel: string; actionRoute: string; }> = [
    { id: "common-metadata", mode: policy.commonMetadata, title: "Common document metadata", passDetail: "No common document-information metadata was found in the inspected heads.", issueDetail: (count) => count + " document(s) contain common document-information metadata.", affected: documents.filter((document) => (document.commonMetadataCount ?? 0) > 0), evidence: (document) => document.name + ":" + document.commonMetadataCount, actionLabel: "Remove metadata", actionRoute: "/remove-pdf-metadata" },
    { id: "interactive-forms", mode: policy.interactiveForms, title: "Interactive form fields", passDetail: "No standard interactive form fields were detected.", issueDetail: (count) => count + " document(s) still contain standard form fields.", affected: documents.filter((document) => (document.formFieldCount ?? 0) > 0), evidence: (document) => document.name + ":" + document.formFieldCount, actionLabel: "Review flattening", actionRoute: "/flatten-pdf" },
    { id: "xfa", mode: policy.xfa, title: "XFA form structure", passDetail: "No XFA form structure was detected.", issueDetail: (count) => count + " document(s) contain XFA, which Kukureku cannot safely flatten with the standard form tool.", affected: documents.filter((document) => document.hasXfa === true), evidence: (document) => "xfa:" + document.name, actionLabel: "Inspect XFA document", actionRoute: "/document-inspector" },
    { id: "sensitive-patterns", mode: policy.sensitivePatterns, title: "Sensitive-looking text patterns", passDetail: "No supported sensitive-looking pattern was found in selectable text.", issueDetail: (count) => count + " document(s) contain supported sensitive-looking text patterns that need human review.", affected: documents.filter((document) => (document.sensitiveMatchCount ?? 0) > 0), evidence: (document) => document.name + ":" + document.sensitiveMatchCount, actionLabel: "Review Safe Share", actionRoute: "/safe-share" },
    { id: "selectable-text-coverage", mode: policy.noSelectableText, title: "Selectable-text coverage", passDetail: "Every inspected document exposes selectable text to the V1 pattern checks.", issueDetail: (count) => count + " document(s) have no selectable text; image-only content can contain information not covered by this gate.", affected: documents.filter((document) => document.selectableTextChars === 0), evidence: (document) => "noSelectableText:" + document.name, actionLabel: "Open Workspace Copilot", actionRoute: "/workspace-copilot" },
    { id: "mixed-page-sizes", mode: policy.mixedPageSizes, title: "Mixed page sizes", passDetail: "No mixed page-size condition was detected.", issueDetail: (count) => count + " document(s) contain mixed page sizes.", affected: documents.filter((document) => document.mixedPageSizes === true), evidence: (document) => "mixedPageSizes:" + document.name, actionLabel: "Review page resizing", actionRoute: "/resize-pdf-pages" },
    { id: "rotated-pages", mode: policy.rotatedPages, title: "Rotated pages", passDetail: "No rotated pages were detected.", issueDetail: (count) => count + " document(s) contain rotated pages.", affected: documents.filter((document) => (document.rotatedPageCount ?? 0) > 0), evidence: (document) => document.name + ":" + document.rotatedPageCount, actionLabel: "Review rotation", actionRoute: "/rotate-pdf" },
    { id: "custom-crop-boxes", mode: policy.customCropBoxes, title: "Custom crop boxes", passDetail: "No custom CropBox condition was detected.", issueDetail: (count) => count + " document(s) contain custom CropBox geometry.", affected: documents.filter((document) => (document.customCropBoxPageCount ?? 0) > 0), evidence: (document) => document.name + ":" + document.customCropBoxPageCount, actionLabel: "Inspect page geometry", actionRoute: "/document-inspector" },
  ];

  for (const rule of rules) {
    const check = affectedRule({ id: rule.id, mode: rule.mode, title: rule.title, passDetail: rule.passDetail, issueDetail: rule.issueDetail(rule.affected.length), affected: rule.affected, evidence: rule.affected.map(rule.evidence), action: rule.affected.length ? action(rule.actionLabel, rule.actionRoute, rule.affected.map((document) => document.nodeId)) : undefined });
    if (check) checks.push(check);
  }

  if (policy.sensitivePatterns !== "ignore") {
    const unknown = documents.filter((document) => document.sensitiveMatchCount === null);
    if (unknown.length) checks.push({ id: "sensitive-pattern-coverage", status: "NOT_VERIFIED", title: "Sensitive-pattern coverage", detail: unknown.length + " document(s) could not be checked for selectable-text patterns.", nodeIds: unknown.map((document) => document.nodeId), evidence: unknown.map((document) => "notVerified:" + document.name), action: action("Open Safe Share", "/safe-share", unknown.map((document) => document.nodeId)) });
  }

  for (const token of policy.requiredFilenameTokens) {
    const normalized = token.trim().toLowerCase();
    if (!normalized) continue;
    const matches = documents.filter((document) => document.name.toLowerCase().includes(normalized));
    checks.push({ id: "required-filename:" + normalized, status: matches.length ? "PASS" : "FAIL", title: "Required filename label: " + token, detail: matches.length ? matches.length + " document(s) have filenames containing " + token + "." : "No current document head has a filename containing " + token + ". This rule checks filenames only and does not infer document meaning.", nodeIds: matches.map((document) => document.nodeId), evidence: ["filenameToken=" + token, "matches=" + matches.length] });
  }

  const summary = { passed: checks.filter((check) => check.status === "PASS").length, warnings: checks.filter((check) => check.status === "WARN").length, failed: checks.filter((check) => check.status === "FAIL").length, notVerified: checks.filter((check) => check.status === "NOT_VERIFIED").length };
  const status = summary.failed > 0 ? "BLOCKED" : summary.warnings > 0 || summary.notVerified > 0 ? "REVIEW" : "READY";

  return { schemaVersion: 1, policy, status, snapshotFingerprint, evaluatedAt: options.evaluatedAt ?? Date.now(), documentCount: documents.length, totalBytes, summary, checks, coverage: { evaluatesCurrentDocumentHeadsOnly: true, semanticComplianceClaimed: false, legalComplianceClaimed: false, filenameRequirementsAreSemantic: false, notes: ["Package Guard evaluates the latest stored state for each workspace document identity.", "READY means the configured deterministic checks passed. It is not a legal, regulatory, filing, or safety certification.", "Required document labels are checked against filenames only and do not prove document contents.", "Sensitive-pattern checks use selectable text in V1; scanned/image-only text can remain outside this gate."] } };
}