import type { InspectionReport } from "../inspection/types";
import type { DocumentFinding } from "./types";

export function createDocumentFindings(
  report: InspectionReport,
): DocumentFinding[] {
  const findings: DocumentFinding[] = [];
  const { facts } = report;

  if (
    facts.commonMetadataFieldsPresent
      .length > 0
  ) {
    findings.push({
      id: "common-metadata-present",
      code: "common-metadata-present",
      severity: "warning",
      title:
        "Common document metadata is present",
      description:
        "Review common title, author, subject, keyword, creator, and producer metadata before external sharing when those values matter.",
      evidence: {
        fields:
          facts.commonMetadataFieldsPresent
            .join(", "),
      },
    });
  }

  if (facts.form.hasXfa) {
    findings.push({
      id: "xfa-form",
      code: "xfa-form",
      severity: "warning",
      title: "XFA form data detected",
      description:
        "XFA is a specialized form format that Kukureku does not treat as safely editable or flattenable with the standard AcroForm engine.",
    });
  } else if (
    facts.form.fieldCount > 0
  ) {
    findings.push({
      id: "interactive-form",
      code: "interactive-form",
      severity: "info",
      title:
        "Interactive form fields detected",
      description:
        "The document contains standard AcroForm fields. Some page-copying or destructive operations may require flattening first.",
      evidence: {
        fieldCount:
          facts.form.fieldCount,
      },
    });
  }

  if (
    facts.form.filledFieldCount > 0
  ) {
    findings.push({
      id: "filled-form-values",
      code: "filled-form-values",
      severity: "warning",
      title:
        "Filled form values detected",
      description:
        "One or more standard form fields currently contain values. Review them before sharing or flattening the document.",
      evidence: {
        filledFieldCount:
          facts.form.filledFieldCount,
      },
    });
  }

  if (facts.hasMixedPageSizes) {
    findings.push({
      id: "mixed-page-sizes",
      code: "mixed-page-sizes",
      severity: "info",
      title:
        "Mixed page sizes detected",
      description:
        "The PDF contains pages with different CropBox dimensions.",
    });
  }

  if (
    facts.rotatedPageCount > 0
  ) {
    findings.push({
      id: "rotated-pages",
      code: "rotated-pages",
      severity: "info",
      title: "Rotated pages detected",
      description:
        "One or more pages use non-zero PDF page rotation.",
      evidence: {
        pageCount:
          facts.rotatedPageCount,
      },
    });
  }

  if (
    facts.customCropBoxPageCount > 0
  ) {
    findings.push({
      id: "custom-crop-box",
      code: "custom-crop-box",
      severity: "info",
      title:
        "Custom CropBox detected",
      description:
        "One or more pages use a CropBox that differs from the MediaBox, so visible-page geometry needs CropBox-aware operations.",
      evidence: {
        pageCount:
          facts.customCropBoxPageCount,
      },
    });
  }

  return findings;
}
