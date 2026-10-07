import type {
  InspectionReport,
} from "../inspection/types";
import {
  getKukurekuOperation,
} from "../operations/registry";
import type {
  KukurekuOperationId,
} from "../operations/types";
import type {
  MagicDropEffectPreview,
} from "../planning/types";
import type {
  WorkflowRecipePlan,
  WorkflowRecipeStep,
  WorkflowRecipeStepKind,
} from "./types";

const LARGE_PDF_BYTES =
  10 * 1024 * 1024;

function effectPreview(
  operationId: KukurekuOperationId,
  mode?: string,
): MagicDropEffectPreview | undefined {
  const operation =
    getKukurekuOperation(
      operationId,
    );

  if (!operation) {
    throw new Error(
      "Unknown Kukureku operation: " +
        operationId,
    );
  }

  const effect =
    operation.effectProfiles.find(
      (profile) =>
        profile.mode === mode,
    ) ??
    operation.effectProfiles[0];

  if (!effect) {
    return undefined;
  }

  return {
    mode: effect.mode,
    description:
      effect.description,
    preserves: [
      ...effect.preserves,
    ],
    modifies: [
      ...effect.modifies,
    ],
    destroys: [
      ...effect.destroys,
    ],
    risks: [...effect.risks],
  };
}

function recipeStep({
  index,
  operationId,
  kind,
  reason,
  evidence,
  mode,
}: {
  index: number;
  operationId: KukurekuOperationId;
  kind: WorkflowRecipeStepKind;
  reason: string;
  evidence: string[];
  mode?: string;
}): WorkflowRecipeStep {
  const operation =
    getKukurekuOperation(
      operationId,
    );

  if (!operation) {
    throw new Error(
      "Unknown Kukureku operation: " +
        operationId,
    );
  }

  return {
    index,
    operationId,
    title: operation.title,
    route: operation.route,
    kind,
    reason,
    evidence,
    effect: effectPreview(
      operationId,
      mode,
    ),
  };
}

function formatMb(bytes: number) {
  return (
    bytes /
    1024 /
    1024
  ).toFixed(1);
}

function coverageCautions(
  report: InspectionReport,
) {
  const notChecked =
    report.capabilities.filter(
      (capability) =>
        capability.status ===
        "not-checked",
    ).length;
  const notSupported =
    report.capabilities.filter(
      (capability) =>
        capability.status ===
        "not-supported",
    ).length;

  const cautions: string[] = [];

  if (notChecked > 0) {
    cautions.push(
      String(notChecked) +
        " inspection capabilities remain not checked. A recipe must not turn those unknowns into a clean claim.",
    );
  }

  if (notSupported > 0) {
    cautions.push(
      String(notSupported) +
        " inspection capabilities are not supported by the current local inspector, including forensic-cleanliness limits.",
    );
  }

  return cautions;
}

function prepareForSharing(
  report: InspectionReport,
): WorkflowRecipePlan {
  const metadataCount =
    report.facts
      .commonMetadataFieldsPresent
      .length;
  const isLarge =
    report.facts.size >=
    LARGE_PDF_BYTES;

  return {
    id: "prepare-for-sharing",
    title:
      "Prepare for Sharing",
    description:
      "Create a cleaner, optionally smaller and optionally password-protected copy before you send a PDF to someone else.",
    availability: "AVAILABLE",
    availabilityReason:
      "This is a user-selected sharing workflow. Kukureku does not assume that password protection or compression is required.",
    evidence: [
      metadataCount > 0
        ? String(metadataCount) +
          " common metadata " +
          (metadataCount === 1
            ? "field is present"
            : "fields are present")
        : "No common document-information metadata field is currently detected",
      formatMb(
        report.facts.size,
      ) + " MB current file size",
    ],
    cautions: [
      "Remove Metadata clears common document-information metadata only; it is not forensic sanitization.",
      "Password protection is an access-control choice, not proof that the document is safe to share.",
      ...coverageCautions(
        report,
      ),
    ],
    steps: [
      recipeStep({
        index: 0,
        operationId:
          "remove-metadata",
        kind:
          metadataCount > 0
            ? "REQUIRED"
            : "NOT_NEEDED",
        reason:
          metadataCount > 0
            ? "Common document-information metadata is present, so removing it is a concrete privacy step for this selected sharing workflow."
            : "No common document-information metadata field is currently detected, so this step is not needed for the facts Kukureku can prove.",
        evidence: [
          metadataCount > 0
            ? String(
                metadataCount,
              ) +
              " common metadata " +
              (metadataCount ===
              1
                ? "field detected"
                : "fields detected")
            : "Common metadata check found no populated field",
        ],
      }),
      recipeStep({
        index: 1,
        operationId:
          "compress-pdf",
        kind: "OPTIONAL",
        reason: isLarge
          ? "The file is at least 10 MB. Compression is relevant when transfer or upload size matters."
          : "Compression is optional. The current file is below 10 MB, so Kukureku will not imply that rewriting it is necessary.",
        evidence: [
          formatMb(
            report.facts.size,
          ) + " MB file size",
        ],
        mode:
          "structure-preserving",
      }),
      recipeStep({
        index: 2,
        operationId:
          "protect-pdf",
        kind:
          "USER_DECISION",
        reason:
          "Use password protection only if your sharing goal requires recipients to enter a password. The PDF itself cannot prove that intent.",
        evidence: [
          "Access-control intent is supplied by you, not inferred from document content",
        ],
        mode: "aes-256",
      }),
    ],
  };
}

function finalizeStandardForm(
  report: InspectionReport,
): WorkflowRecipePlan {
  const { form } =
    report.facts;

  const availability =
    form.hasXfa
      ? "BLOCKED"
      : form.fieldCount > 0
        ? "AVAILABLE"
        : "UNAVAILABLE";

  const availabilityReason =
    form.hasXfa
      ? "XFA is present. Kukureku will not route this recipe through the standard AcroForm flattening path."
      : form.fieldCount > 0
        ? String(
            form.fieldCount,
          ) +
          " standard form " +
          (form.fieldCount === 1
            ? "field is present"
            : "fields are present") +
          ", so a user-selected finalization workflow is applicable."
        : "No standard AcroForm field is currently detected, so there is nothing for this recipe to flatten.";

  return {
    id:
      "finalize-standard-form",
    title:
      "Finalize Standard Form",
    description:
      "Turn supported standard form fields into ordinary page content, then optionally reduce size or add password protection.",
    availability,
    availabilityReason,
    evidence: [
      String(
        form.fieldCount,
      ) +
        " standard form " +
        (form.fieldCount === 1
          ? "field"
          : "fields"),
      String(
        form.filledFieldCount,
      ) + " currently filled",
      form.hasXfa
        ? "XFA detected"
        : "No XFA detected",
    ],
    cautions: [
      "Flattening is irreversible in the derived PDF version, although the earlier workspace version remains available.",
      "Unsupported custom widgets are not guaranteed to flatten correctly.",
      ...coverageCautions(
        report,
      ),
    ],
    steps: [
      recipeStep({
        index: 0,
        operationId:
          "flatten-form",
        kind: form.hasXfa
          ? "BLOCKED"
          : form.fieldCount > 0
            ? "REQUIRED"
            : "NOT_NEEDED",
        reason: form.hasXfa
          ? "Standard AcroForm flattening is blocked because XFA is present."
          : form.fieldCount > 0
            ? "Supported standard form fields are present. Flattening is the defining step of this selected finalization workflow."
            : "No standard form field is detected.",
        evidence: [
          form.hasXfa
            ? "XFA presence detected"
            : String(
                form.fieldCount,
              ) +
              " standard form " +
              (form.fieldCount ===
              1
                ? "field detected"
                : "fields detected"),
        ],
        mode:
          "standard-acroform",
      }),
      recipeStep({
        index: 1,
        operationId:
          "compress-pdf",
        kind: "OPTIONAL",
        reason:
          report.facts.size >=
          LARGE_PDF_BYTES
            ? "The finalized copy is based on a file that is at least 10 MB, so a structure-preserving compression pass may be useful."
            : "Compression remains optional and should be used only when output size matters.",
        evidence: [
          formatMb(
            report.facts.size,
          ) + " MB current file size",
        ],
        mode:
          "structure-preserving",
      }),
      recipeStep({
        index: 2,
        operationId:
          "protect-pdf",
        kind:
          "USER_DECISION",
        reason:
          "Add password protection only when your delivery or access-control goal requires it.",
        evidence: [
          "Password need is a user decision, not an inspected document fact",
        ],
        mode: "aes-256",
      }),
    ],
  };
}

function controlledCopy(
  report: InspectionReport,
): WorkflowRecipePlan {
  return {
    id: "controlled-copy",
    title:
      "Create a Controlled Copy",
    description:
      "Manually remove visible content you already know must not appear, then optionally password-protect the resulting copy.",
    availability: "AVAILABLE",
    availabilityReason:
      "This workflow is available only as an explicit user-selected goal. Kukureku does not infer that the PDF contains sensitive content.",
    evidence: [
      "Visible redaction targets are supplied manually by you",
      String(
        report.facts.pageCount,
      ) +
        " page " +
        (report.facts.pageCount ===
        1
          ? "document"
          : "document"),
    ],
    cautions: [
      "Redaction in the current tool rasterizes pages and destroys selectable text plus many interactive/non-page structures.",
      "Kukureku does not identify sensitive content automatically. You must choose the visible areas to redact.",
      ...coverageCautions(
        report,
      ),
    ],
    steps: [
      recipeStep({
        index: 0,
        operationId:
          "redact-pdf",
        kind:
          "USER_DECISION",
        reason:
          "Open Redact PDF only if you already know which visible areas must be removed. Kukureku will not invent redaction targets.",
        evidence: [
          "No sensitive-content inference is performed",
        ],
        mode:
          "raster-redaction",
      }),
      recipeStep({
        index: 1,
        operationId:
          "protect-pdf",
        kind:
          "USER_DECISION",
        reason:
          "Password protection is optional and should be added only if the controlled copy needs access control.",
        evidence: [
          "Access-control intent comes from you",
        ],
        mode: "aes-256",
      }),
    ],
  };
}

export function createWorkflowRecipePlans(
  report: InspectionReport,
): WorkflowRecipePlan[] {
  return [
    prepareForSharing(report),
    finalizeStandardForm(
      report,
    ),
    controlledCopy(report),
  ];
}
