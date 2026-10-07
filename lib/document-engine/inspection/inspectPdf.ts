import type { DocumentArtifact } from "../artifact";
import {
  describePdfFormFields,
  type PdfFormFieldKind,
  type PdfFormFieldValue,
} from "../../pdf/formFields";
import { readPdfMetadata } from "../../pdf/metadataEditor";
import { hasAcroFormDictionary } from "../../pdf/pdfInputSafety";
import { loadPdfWithoutMetadataMutation } from "../../pdf/safeDocument";
import type {
  DocumentFacts,
  InspectionReport,
  PdfBoxFacts,
} from "./types";

const BOX_TOLERANCE = 0.01;
const PAGE_SIZE_TOLERANCE = 0.5;

function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function boxesEqual(
  first: PdfBoxFacts,
  second: PdfBoxFacts,
) {
  return (
    Math.abs(first.x - second.x) <=
      BOX_TOLERANCE &&
    Math.abs(first.y - second.y) <=
      BOX_TOLERANCE &&
    Math.abs(
      first.width - second.width,
    ) <= BOX_TOLERANCE &&
    Math.abs(
      first.height - second.height,
    ) <= BOX_TOLERANCE
  );
}

function isFieldValueFilled(
  value: PdfFormFieldValue,
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return false;
}

function createEmptyFieldKinds(): Record<
  PdfFormFieldKind,
  number
> {
  return {
    text: 0,
    checkbox: 0,
    dropdown: 0,
    "option-list": 0,
    radio: 0,
    unsupported: 0,
  };
}

export async function inspectPdfArtifact(
  artifact: DocumentArtifact,
): Promise<InspectionReport> {
  const bytes =
    await artifact.blob.arrayBuffer();

  const pdf =
    await loadPdfWithoutMetadataMutation(
      bytes,
    );

  const pages = pdf
    .getPages()
    .map((page, index) => {
      const mediaBox =
        page.getMediaBox();
      const cropBox =
        page.getCropBox();

      return {
        pageNumber: index + 1,
        width: cropBox.width,
        height: cropBox.height,
        rotation:
          normalizeRotation(
            page.getRotation().angle,
          ),
        mediaBox,
        cropBox,
        hasCustomCropBox:
          !boxesEqual(
            mediaBox,
            cropBox,
          ),
      };
    });

  const firstPage =
    pages[0];

  const hasMixedPageSizes =
    Boolean(firstPage) &&
    pages.some(
      (page) =>
        Math.abs(
          page.width -
            firstPage.width,
        ) >
          PAGE_SIZE_TOLERANCE ||
        Math.abs(
          page.height -
            firstPage.height,
        ) >
          PAGE_SIZE_TOLERANCE,
    );

  const metadata =
    readPdfMetadata(pdf);

  const commonMetadataFieldsPresent =
    (
      Object.entries(
        metadata,
      ) as Array<
        [
          keyof typeof metadata,
          string,
        ]
      >
    )
      .filter(
        ([, value]) =>
          value.trim().length > 0,
      )
      .map(([key]) => key);

  const hasAcroForm =
    hasAcroFormDictionary(pdf);

  const fieldKinds =
    createEmptyFieldKinds();

  let hasXfa = false;
  let fieldCount = 0;
  let filledFieldCount = 0;

  if (hasAcroForm) {
    const form =
      describePdfFormFields(pdf);

    hasXfa = form.hasXfa;
    fieldCount = form.fields.length;

    for (const field of form.fields) {
      fieldKinds[field.kind] += 1;

      if (
        isFieldValueFilled(
          field.value,
        )
      ) {
        filledFieldCount += 1;
      }
    }
  }

  const facts: DocumentFacts = {
    mimeType:
      artifact.mimeType,
    size: artifact.size,
    pageCount: pages.length,
    pages,
    hasMixedPageSizes,
    rotatedPageCount:
      pages.filter(
        (page) =>
          page.rotation !== 0,
      ).length,
    customCropBoxPageCount:
      pages.filter(
        (page) =>
          page.hasCustomCropBox,
      ).length,
    metadata,
    commonMetadataFieldsPresent,
    form: {
      hasAcroForm,
      hasXfa,
      fieldCount,
      filledFieldCount,
      fieldKinds,
    },
  };

  return {
    artifactId: artifact.id,
    valid: true,
    facts,
    capabilities: [
      {
        id: "page-geometry",
        status: "checked",
      },
      {
        id: "common-metadata",
        status: "checked",
        note:
          "Common document-information metadata only; this does not claim forensic XMP or hidden-object inspection.",
      },
      {
        id: "acroform",
        status: "checked",
      },
      {
        id: "xfa",
        status: "checked",
      },
      {
        id: "attachments",
        status: "not-checked",
        note:
          "Embedded file and attachment enumeration is outside Unified Document Inspector V1.",
      },
      {
        id: "digital-signatures",
        status: "not-checked",
        note:
          "Digital-signature discovery and cryptographic validation are outside Unified Document Inspector V1.",
      },
      {
        id: "javascript-actions",
        status: "not-checked",
        note:
          "JavaScript, launch actions, and other action dictionaries are not inspected in Unified Document Inspector V1.",
      },
      {
        id: "forensic-metadata",
        status: "not-supported",
        note:
          "Kukureku currently inspects common document-information metadata only and does not claim forensic XMP, hidden-object, or sanitization coverage.",
      },
    ],
    inspectedAt: Date.now(),
  };
}
