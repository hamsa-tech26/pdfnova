import type { PdfFormFieldKind } from "@/lib/pdf/formFields";
import type { PdfMetadataValues } from "@/lib/pdf/metadataEditor";

export type PdfBoxFacts = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageFacts = {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  mediaBox: PdfBoxFacts;
  cropBox: PdfBoxFacts;
  hasCustomCropBox: boolean;
};

export type PdfFormFacts = {
  hasAcroForm: boolean;
  hasXfa: boolean;
  fieldCount: number;
  filledFieldCount: number;
  fieldKinds: Record<
    PdfFormFieldKind,
    number
  >;
};

export type DocumentFacts = {
  mimeType: string;
  size: number;
  pageCount: number;
  pages: PdfPageFacts[];
  hasMixedPageSizes: boolean;
  rotatedPageCount: number;
  customCropBoxPageCount: number;
  metadata: PdfMetadataValues;
  commonMetadataFieldsPresent: Array<
    keyof PdfMetadataValues
  >;
  form: PdfFormFacts;
};

export type InspectionCapabilityId =
  | "page-geometry"
  | "common-metadata"
  | "acroform"
  | "xfa";

export type InspectionCapability = {
  id: InspectionCapabilityId;
  status: "checked" | "not-supported";
  note?: string;
};

export type InspectionReport = {
  artifactId: string;
  valid: true;
  facts: DocumentFacts;
  capabilities: InspectionCapability[];
  inspectedAt: number;
};
