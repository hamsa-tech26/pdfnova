import { createDocumentFindings } from "../findings/createFindings";
import type { InspectionReport } from "../inspection/types";
import { getKukurekuOperation } from "../operations/registry";
import type { KukurekuOperationId } from "../operations/types";
import type {
  MagicDropCaution,
  MagicDropPlan,
  MagicDropRecommendation,
  MagicDropRecommendationKind,
} from "./types";

const LARGE_PDF_BYTES = 10 * 1024 * 1024;

const capabilityLabels: Record<string, string> = {
  attachments: "attachments",
  "digital-signatures": "digital signatures",
  "javascript-actions": "JavaScript / actions",
  "forensic-metadata": "forensic metadata / hidden objects",
};

function operationRecommendation({
  id,
  kind,
  reason,
  evidence,
  mode,
}: {
  id: KukurekuOperationId;
  kind: MagicDropRecommendationKind;
  reason: string;
  evidence: string[];
  mode?: string;
}): MagicDropRecommendation {
  const operation = getKukurekuOperation(id);

  if (!operation) {
    throw new Error("Unknown Kukureku operation: " + id);
  }

  const effect =
    operation.effectProfiles.find(
      (profile) => profile.mode === mode,
    ) ?? operation.effectProfiles[0];

  return {
    id: id + "-" + kind.toLowerCase(),
    kind,
    title: operation.title,
    route:
      kind === "BLOCKED"
        ? undefined
        : operation.route,
    operationId: id,
    reason,
    evidence,
    effect: effect
      ? {
          mode: effect.mode,
          description: effect.description,
          preserves: [...effect.preserves],
          modifies: [...effect.modifies],
          destroys: [...effect.destroys],
          risks: [...effect.risks],
        }
      : undefined,
  };
}

function unknownCapabilityCaution(
  report: InspectionReport,
): MagicDropCaution | null {
  const unknown = report.capabilities
    .filter(
      (capability) =>
        capability.status === "not-checked",
    )
    .map(
      (capability) =>
        capabilityLabels[capability.id] ??
        capability.id,
    );

  if (unknown.length === 0) {
    return null;
  }

  return {
    id: "not-checked-capabilities",
    title: "Some PDF structures were not checked",
    description:
      "Magic Drop V1 has not checked " +
      unknown.join(", ") +
      ". Their absence must not be assumed before rewriting or externally sharing the PDF.",
  };
}

function unsupportedCapabilityCaution(
  report: InspectionReport,
): MagicDropCaution | null {
  const unsupported = report.capabilities
    .filter(
      (capability) =>
        capability.status ===
        "not-supported",
    )
    .map(
      (capability) =>
        capabilityLabels[capability.id] ??
        capability.id,
    );

  if (unsupported.length === 0) {
    return null;
  }

  return {
    id: "unsupported-capabilities",
    title: "Forensic cleanliness is not verified",
    description:
      "Current local inspection does not support " +
      unsupported.join(", ") +
      ". Kukureku will not label this document completely clean.",
  };
}

export function createMagicDropPlan(
  report: InspectionReport,
): MagicDropPlan {
  const findings =
    createDocumentFindings(report);
  const { facts } = report;
  const recommendations: MagicDropRecommendation[] =
    [];
  const cautions: MagicDropCaution[] = [];

  if (
    facts.commonMetadataFieldsPresent
      .length > 0
  ) {
    recommendations.push(
      operationRecommendation({
        id: "remove-metadata",
        kind: "RECOMMENDED",
        reason:
          "Common document-information metadata is present. If this PDF will be shared externally, reviewing or removing those values is a concrete privacy step.",
        evidence: [
          String(
            facts
              .commonMetadataFieldsPresent
              .length,
          ) +
            " common metadata " +
            (facts
              .commonMetadataFieldsPresent
              .length === 1
              ? "field detected"
              : "fields detected"),
        ],
      }),
    );
  }

  if (facts.form.hasXfa) {
    recommendations.push(
      operationRecommendation({
        id: "flatten-form",
        kind: "BLOCKED",
        reason:
          "XFA form data is present. Kukureku's standard AcroForm flattening path must not be recommended as a safe automatic next step for this document.",
        evidence: [
          "XFA presence detected",
        ],
      }),
    );
  } else if (
    facts.form.fieldCount > 0
  ) {
    recommendations.push(
      operationRecommendation({
        id: "flatten-form",
        kind: "RECOMMENDED",
        reason:
          facts.form.filledFieldCount > 0
            ? "This PDF contains filled standard form fields. Flattening can be useful before workflows that should preserve the visible values while removing interactivity."
            : "This PDF contains standard interactive form fields. Flattening is a relevant option before workflows that should no longer keep editable fields.",
        evidence: [
          String(
            facts.form.fieldCount,
          ) +
            " standard form " +
            (facts.form.fieldCount === 1
              ? "field"
              : "fields"),
          String(
            facts.form.filledFieldCount,
          ) +
            " currently filled",
        ],
      }),
    );
  }

  if (facts.size >= LARGE_PDF_BYTES) {
    recommendations.push(
      operationRecommendation({
        id: "compress-pdf",
        kind: "OPTIONAL",
        reason:
          "The file is at least 10 MB. Compression may help when upload, email, or storage size matters, but size alone does not mean the PDF should be rewritten.",
        evidence: [
          (
            facts.size /
            1024 /
            1024
          ).toFixed(1) + " MB file size",
        ],
        mode: "structure-preserving",
      }),
    );
  }

  if (
    facts.hasMixedPageSizes ||
    facts.rotatedPageCount > 0 ||
    facts.customCropBoxPageCount > 0
  ) {
    const details: string[] = [];

    if (facts.hasMixedPageSizes) {
      details.push("mixed page sizes");
    }

    if (facts.rotatedPageCount > 0) {
      details.push(
        String(
          facts.rotatedPageCount,
        ) + " rotated page(s)",
      );
    }

    if (
      facts.customCropBoxPageCount > 0
    ) {
      details.push(
        String(
          facts.customCropBoxPageCount,
        ) + " custom CropBox page(s)",
      );
    }

    cautions.push({
      id: "page-geometry-care",
      title:
        "Page geometry needs care",
      description:
        "The Inspector detected " +
        details.join(", ") +
        ". Use geometry-aware tools and review the detailed Inspector when page placement or sizing matters.",
    });
  }

  const unknownCaution =
    unknownCapabilityCaution(report);

  if (unknownCaution) {
    cautions.push(unknownCaution);
  }

  const unsupportedCaution =
    unsupportedCapabilityCaution(
      report,
    );

  if (unsupportedCaution) {
    cautions.push(
      unsupportedCaution,
    );
  }

  const order: Record<
    MagicDropRecommendationKind,
    number
  > = {
    BLOCKED: 0,
    RECOMMENDED: 1,
    OPTIONAL: 2,
  };

  recommendations.sort(
    (a, b) =>
      order[a.kind] - order[b.kind],
  );

  const actionableCount =
    recommendations.filter(
      (item) =>
        item.kind === "RECOMMENDED",
    ).length;

  const optionalCount =
    recommendations.filter(
      (item) =>
        item.kind === "OPTIONAL",
    ).length;

  let headline =
    "No fact-derived cleanup step is required";
  let summary =
    "Kukureku did not find a supported document fact that requires a cleanup recommendation. Choose the next tool based on your actual goal.";

  if (actionableCount > 0) {
    headline =
      String(actionableCount) +
      " fact-derived next " +
      (actionableCount === 1
        ? "step"
        : "steps") +
      " found";
    summary =
      "These recommendations come only from facts Kukureku actually checked. Review the effect and risks before opening a tool.";
  } else if (optionalCount > 0) {
    headline =
      "No required cleanup step; one optional action is relevant";
    summary =
      "The optional action is based on a deterministic file fact, not a claim that the PDF needs changing.";
  }

  const checkedCapabilityCount =
    report.capabilities.filter(
      (capability) =>
        capability.status === "checked",
    ).length;

  return {
    headline,
    summary,
    recommendations,
    cautions,
    findingCount: findings.length,
    checkedCapabilityCount,
    unknownCapabilityCount:
      report.capabilities.length -
      checkedCapabilityCount,
  };
}
