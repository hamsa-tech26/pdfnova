import type { VerificationCheckKind } from "../verification/types";

export type KukurekuOperationId =
  | "remove-metadata"
  | "flatten-form"
  | "compress-pdf"
  | "redact-pdf"
  | "protect-pdf"
  | "add-image-stamp-pdf"
  | "crop-pdf"
  | "edit-pdf-metadata"
  | "reorder-pdf-pages"
  | "resize-pdf-pages"
  | "rotate-pdf";

export type DocumentFeature =
  | "page-count"
  | "page-geometry"
  | "page-content"
  | "page-order"
  | "pdf-structure"
  | "file-size"
  | "common-metadata"
  | "interactive-forms"
  | "selectable-text"
  | "annotations"
  | "links"
  | "bookmarks"
  | "attachments"
  | "digital-signatures"
  | "javascript-actions"
  | "vector-content"
  | "encryption";

export type OperationEffectProfile = {
  mode: string;
  description: string;
  preserves: DocumentFeature[];
  modifies: DocumentFeature[];
  destroys: DocumentFeature[];
  risks: string[];
  verifiableEffects: VerificationCheckKind[];
};

export type KukurekuOperationDescriptor = {
  id: KukurekuOperationId;
  title: string;
  route: string;
  inputMimeTypes: string[];
  localProcessing: boolean;
  reversible: boolean;
  requirements: string[];
  effectProfiles: OperationEffectProfile[];
};
