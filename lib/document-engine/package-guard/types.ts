export type PackageGuardStatus =
  | "READY"
  | "REVIEW"
  | "BLOCKED";

export type PackageGuardCheckStatus =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "NOT_VERIFIED";

export type PackageGuardSeverityMode =
  | "ignore"
  | "warn"
  | "fail";

export type PackageGuardPolicy = {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  minDocuments: number;
  maxDocuments: number | null;
  maxTotalBytes: number | null;
  maxFileBytes: number | null;
  exactDuplicates: PackageGuardSeverityMode;
  commonMetadata: PackageGuardSeverityMode;
  interactiveForms: PackageGuardSeverityMode;
  xfa: PackageGuardSeverityMode;
  sensitivePatterns: PackageGuardSeverityMode;
  noSelectableText: PackageGuardSeverityMode;
  mixedPageSizes: PackageGuardSeverityMode;
  rotatedPages: PackageGuardSeverityMode;
  customCropBoxes: PackageGuardSeverityMode;
  graphIntegrity: Exclude<PackageGuardSeverityMode, "ignore">;
  requiredFilenameTokens: string[];
};

export type PackageGuardDocumentEvidence = {
  nodeId: string;
  documentId: string;
  name: string;
  size: number;
  sha256: string | null;
  openable: boolean;
  pageCount: number | null;
  commonMetadataCount: number | null;
  formFieldCount: number | null;
  hasXfa: boolean | null;
  sensitiveMatchCount: number | null;
  selectableTextChars: number | null;
  mixedPageSizes: boolean | null;
  rotatedPageCount: number | null;
  customCropBoxPageCount: number | null;
};

export type PackageGuardGraphEvidence = {
  status: "PASS" | "PASS_WITH_WARNING" | "FAILED" | "NOT_VERIFIED";
  failedCount: number;
  notVerifiedCount: number;
};

export type PackageGuardAction = {
  label: string;
  route: string;
  nodeIds: string[];
};

export type PackageGuardCheck = {
  id: string;
  status: PackageGuardCheckStatus;
  title: string;
  detail: string;
  nodeIds: string[];
  evidence: string[];
  action?: PackageGuardAction;
};

export type PackageGuardReport = {
  schemaVersion: 1;
  policy: PackageGuardPolicy;
  status: PackageGuardStatus;
  snapshotFingerprint: string;
  evaluatedAt: number;
  documentCount: number;
  totalBytes: number;
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    notVerified: number;
  };
  checks: PackageGuardCheck[];
  coverage: {
    evaluatesCurrentDocumentHeadsOnly: true;
    semanticComplianceClaimed: false;
    legalComplianceClaimed: false;
    filenameRequirementsAreSemantic: false;
    notes: string[];
  };
};