import type {
  InspectionCapability,
  InspectionCapabilityId,
  InspectionReport,
} from "./types";

export type InspectorCheckStatus =
  | "CHECKED"
  | "ISSUE_FOUND"
  | "NOT_CHECKED"
  | "NOT_SUPPORTED";

export type InspectorCheck = {
  id: InspectionCapabilityId;
  label: string;
  status: InspectorCheckStatus;
  summary: string;
  note?: string;
};

const labels: Record<
  InspectionCapabilityId,
  string
> = {
  "page-geometry": "Page geometry",
  "common-metadata": "Common metadata",
  acroform: "Standard form fields",
  xfa: "XFA presence",
  attachments: "Attachments",
  "digital-signatures": "Digital signatures",
  "javascript-actions": "JavaScript / actions",
  "forensic-metadata":
    "Forensic metadata / hidden objects",
};

function geometrySummary(
  report: InspectionReport,
) {
  const { facts } = report;
  const details: string[] = [];

  if (facts.hasMixedPageSizes) {
    details.push("mixed page sizes");
  }

  if (facts.rotatedPageCount > 0) {
    details.push(
      String(facts.rotatedPageCount) +
        " rotated " +
        (facts.rotatedPageCount === 1
          ? "page"
          : "pages"),
    );
  }

  if (
    facts.customCropBoxPageCount > 0
  ) {
    details.push(
      String(
        facts.customCropBoxPageCount,
      ) +
        " custom " +
        (facts.customCropBoxPageCount === 1
          ? "CropBox"
          : "CropBoxes"),
    );
  }

  if (details.length === 0) {
    return (
      String(facts.pageCount) +
      " pages checked with no mixed sizes, non-zero rotations, or custom CropBoxes detected."
    );
  }

  return "Detected " + details.join(", ") + ".";
}

function checkedSummary(
  capability: InspectionCapability,
  report: InspectionReport,
) {
  const { facts } = report;

  switch (capability.id) {
    case "page-geometry":
      return geometrySummary(report);

    case "common-metadata":
      return facts
        .commonMetadataFieldsPresent
        .length > 0
        ? String(
            facts
              .commonMetadataFieldsPresent
              .length,
          ) +
            " common metadata " +
            (facts
              .commonMetadataFieldsPresent
              .length === 1
              ? "field is"
              : "fields are") +
            " present."
        : "No common document-information metadata fields were found.";

    case "acroform":
      if (facts.form.fieldCount === 0) {
        return "No standard AcroForm fields were detected.";
      }

      return (
        String(facts.form.fieldCount) +
        " standard form " +
        (facts.form.fieldCount === 1
          ? "field"
          : "fields") +
        " detected; " +
        (facts.form.filledFieldCount === 1
          ? "1 currently contains a value."
          : String(
              facts.form
                .filledFieldCount,
            ) +
            " currently contain values.")
      );

    case "xfa":
      return facts.form.hasXfa
        ? "XFA presence was detected."
        : "No XFA presence was detected.";

    default:
      return (
        capability.note ??
        "This capability was checked."
      );
  }
}

function hasIssue(
  id: InspectionCapabilityId,
  report: InspectionReport,
) {
  const { facts } = report;

  switch (id) {
    case "page-geometry":
      return (
        facts.hasMixedPageSizes ||
        facts.rotatedPageCount > 0 ||
        facts.customCropBoxPageCount > 0
      );

    case "common-metadata":
      return (
        facts
          .commonMetadataFieldsPresent
          .length > 0
      );

    case "acroform":
      return facts.form.fieldCount > 0;

    case "xfa":
      return facts.form.hasXfa;

    default:
      return false;
  }
}

export function createInspectorChecks(
  report: InspectionReport,
): InspectorCheck[] {
  return report.capabilities.map(
    (capability) => {
      if (
        capability.status ===
        "not-supported"
      ) {
        return {
          id: capability.id,
          label:
            labels[capability.id],
          status:
            "NOT_SUPPORTED" as const,
          summary:
            capability.note ??
            "This capability is not supported.",
          note: capability.note,
        };
      }

      if (
        capability.status ===
        "not-checked"
      ) {
        return {
          id: capability.id,
          label:
            labels[capability.id],
          status:
            "NOT_CHECKED" as const,
          summary:
            capability.note ??
            "This capability was not checked.",
          note: capability.note,
        };
      }

      return {
        id: capability.id,
        label: labels[capability.id],
        status: hasIssue(
          capability.id,
          report,
        )
          ? ("ISSUE_FOUND" as const)
          : ("CHECKED" as const),
        summary: checkedSummary(
          capability,
          report,
        ),
        note: capability.note,
      };
    },
  );
}
