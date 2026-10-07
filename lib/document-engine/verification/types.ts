export type VerificationStatus =
  | "PASS"
  | "PASS_WITH_WARNING"
  | "FAILED"
  | "NOT_VERIFIED";

export type VerificationCheckKind =
  | "pdf-openable"
  | "page-count-equals"
  | "common-metadata-empty"
  | "forms-flattened"
  | "file-size-at-most"
  | "encryption-applied"
  | "rasterized-pages";

export type VerificationRequest =
  | {
      kind: "pdf-openable";
    }
  | {
      kind: "page-count-equals";
      expected: number;
    }
  | {
      kind: "common-metadata-empty";
    }
  | {
      kind: "forms-flattened";
    }
  | {
      kind: "file-size-at-most";
      maxBytes: number;
    }
  | {
      kind: "encryption-applied";
    }
  | {
      kind: "rasterized-pages";
    };

export type VerificationCheckResult = {
  kind: VerificationCheckKind;
  status:
    | "PASS"
    | "FAILED"
    | "NOT_VERIFIED";
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
};

export type VerificationReport = {
  artifactId: string;
  status: VerificationStatus;
  checks: VerificationCheckResult[];
  verifiedAt: number;
};
