import type {
  InspectionReport,
} from "../inspection/types";
import type {
  SensitiveTextReport,
} from "./sensitiveSignals";

export type SafeShareStatus =
  | "REVIEW_REQUIRED"
  | "COVERAGE_LIMITED"
  | "NO_CURRENT_FINDINGS";

export type SafeShareIssueKind =
  | "common-metadata"
  | "interactive-forms"
  | "sensitive-patterns"
  | "selectable-text-coverage"
  | "inspection-coverage";

export type SafeShareIssue = {
  kind: SafeShareIssueKind;
  title: string;
  detail: string;
  actionRoute?: string;
  actionLabel?: string;
};

export type SafeSharePlan = {
  status: SafeShareStatus;
  issues: SafeShareIssue[];
  statement: string;
};

export function createSafeSharePlan(
  inspection: InspectionReport,
  sensitive: SensitiveTextReport,
  selectableTextChars: number,
): SafeSharePlan {
  const issues: SafeShareIssue[] =
    [];

  if (
    inspection.facts
      .commonMetadataFieldsPresent
      .length > 0
  ) {
    issues.push({
      kind:
        "common-metadata",
      title:
        "Common metadata is present",
      detail:
        `${inspection.facts.commonMetadataFieldsPresent.length} common document-information field(s) contain values.`,
      actionRoute:
        "/remove-pdf-metadata",
      actionLabel:
        "Remove metadata",
    });
  }

  if (
    inspection.facts.form
      .fieldCount > 0 ||
    inspection.facts.form
      .hasXfa
  ) {
    issues.push({
      kind:
        "interactive-forms",
      title:
        "Interactive form structure remains",
      detail:
        `${inspection.facts.form.fieldCount} standard form field(s) were detected${inspection.facts.form.hasXfa ? " and XFA is present" : ""}.`,
      actionRoute:
        "/flatten-pdf",
      actionLabel:
        "Review flattening",
    });
  }

  if (
    sensitive.totalMatches > 0
  ) {
    issues.push({
      kind:
        "sensitive-patterns",
      title:
        "Sensitive-looking text patterns need review",
      detail:
        `${sensitive.totalMatches} pattern match(es) were detected across ${sensitive.signals.length} signal type(s). Pattern detection is assistance, not proof that data is sensitive.`,
      actionRoute:
        "/redact-pdf",
      actionLabel:
        "Review redaction",
    });
  }

  if (
    selectableTextChars === 0
  ) {
    issues.push({
      kind:
        "selectable-text-coverage",
      title:
        "Selectable-text scan has no coverage",
      detail:
        "No selectable text was extracted. Image-only or scanned text may still contain sensitive information.",
    });
  }

  const limited =
    inspection.capabilities.filter(
      (capability) =>
        capability.status !==
        "checked",
    );

  if (limited.length > 0) {
    issues.push({
      kind:
        "inspection-coverage",
      title:
        "Some document areas are not fully inspected",
      detail:
        `${limited.length} Inspector capability area(s) are not checked or not supported, including areas such as attachments, signatures, actions, or forensic metadata.`,
    });
  }

  const substantive =
    issues.filter(
      (issue) =>
        issue.kind !==
          "inspection-coverage" &&
        issue.kind !==
          "selectable-text-coverage",
    );

  const status:
    SafeShareStatus =
    substantive.length > 0
      ? "REVIEW_REQUIRED"
      : issues.length > 0
        ? "COVERAGE_LIMITED"
        : "NO_CURRENT_FINDINGS";

  return {
    status,
    issues,
    statement:
      status ===
      "REVIEW_REQUIRED"
        ? "Review the findings before sharing. Kukureku has identified items that may deserve action."
        : status ===
            "COVERAGE_LIMITED"
          ? "No actionable issue was found in the checks that ran, but coverage limits remain."
          : "No issue was found in the checks that ran. This is not a guarantee that the document is safe to share.",
  };
}
