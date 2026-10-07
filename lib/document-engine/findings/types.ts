export type DocumentFindingSeverity =
  | "info"
  | "warning";

export type DocumentFindingCode =
  | "common-metadata-present"
  | "interactive-form"
  | "xfa-form"
  | "filled-form-values"
  | "mixed-page-sizes"
  | "rotated-pages"
  | "custom-crop-box";

export type DocumentFinding = {
  id: string;
  code: DocumentFindingCode;
  severity: DocumentFindingSeverity;
  title: string;
  description: string;
  evidence?: Record<
    string,
    string | number | boolean
  >;
};
