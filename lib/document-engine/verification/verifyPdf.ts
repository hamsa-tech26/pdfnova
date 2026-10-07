import type { DocumentArtifact } from "../artifact";
import { inspectPdfArtifact } from "../inspection/inspectPdf";
import type { InspectionReport } from "../inspection/types";
import type {
  VerificationCheckResult,
  VerificationReport,
  VerificationRequest,
  VerificationStatus,
} from "./types";

function getOverallStatus(
  checks: VerificationCheckResult[],
): VerificationStatus {
  if (
    checks.some(
      (check) =>
        check.status === "FAILED",
    )
  ) {
    return "FAILED";
  }

  const notVerifiedCount =
    checks.filter(
      (check) =>
        check.status ===
        "NOT_VERIFIED",
    ).length;

  if (
    notVerifiedCount > 0 &&
    notVerifiedCount ===
      checks.length
  ) {
    return "NOT_VERIFIED";
  }

  if (notVerifiedCount > 0) {
    return "PASS_WITH_WARNING";
  }

  return "PASS";
}

export async function verifyPdfArtifact(
  artifact: DocumentArtifact,
  requests: VerificationRequest[],
): Promise<VerificationReport> {
  let inspection:
    | InspectionReport
    | undefined;
  let inspectionError:
    | unknown
    | undefined;

  async function getInspection() {
    if (inspection) {
      return inspection;
    }

    if (inspectionError) {
      throw inspectionError;
    }

    try {
      inspection =
        await inspectPdfArtifact(
          artifact,
        );
      return inspection;
    } catch (error) {
      inspectionError = error;
      throw error;
    }
  }

  const checks: VerificationCheckResult[] =
    [];

  for (const request of requests) {
    if (
      request.kind ===
      "file-size-at-most"
    ) {
      const passed =
        artifact.size <=
        request.maxBytes;

      checks.push({
        kind: request.kind,
        status: passed
          ? "PASS"
          : "FAILED",
        message: passed
          ? "The artifact is within the requested file-size limit."
          : "The artifact exceeds the requested file-size limit.",
        expected:
          request.maxBytes,
        actual: artifact.size,
      });
      continue;
    }

    if (
      request.kind ===
      "encryption-applied"
    ) {
      checks.push({
        kind: request.kind,
        status: "NOT_VERIFIED",
        message:
          "Encryption verification is not implemented in the foundation engine yet. Browser QPDF roundtrip tests exist, but this shared verifier will not claim encryption from file bytes alone.",
      });
      continue;
    }

    if (
      request.kind ===
      "rasterized-pages"
    ) {
      checks.push({
        kind: request.kind,
        status: "NOT_VERIFIED",
        message:
          "Raster-only page verification is not implemented in the foundation engine yet.",
      });
      continue;
    }

    let report: InspectionReport;

    try {
      report = await getInspection();
    } catch {
      checks.push({
        kind: request.kind,
        status: "FAILED",
        message:
          "The PDF could not be opened for this verification check.",
      });
      continue;
    }

    if (
      request.kind ===
      "pdf-openable"
    ) {
      checks.push({
        kind: request.kind,
        status: "PASS",
        message:
          "The PDF opened successfully with the shared inspection engine.",
      });
      continue;
    }

    if (
      request.kind ===
      "page-count-equals"
    ) {
      const actual =
        report.facts.pageCount;
      const passed =
        actual === request.expected;

      checks.push({
        kind: request.kind,
        status: passed
          ? "PASS"
          : "FAILED",
        message: passed
          ? "The page count matches the expected value."
          : "The page count does not match the expected value.",
        expected:
          request.expected,
        actual,
      });
      continue;
    }

    if (
      request.kind ===
      "common-metadata-empty"
    ) {
      const actual =
        report.facts
          .commonMetadataFieldsPresent
          .length;
      const passed = actual === 0;

      checks.push({
        kind: request.kind,
        status: passed
          ? "PASS"
          : "FAILED",
        message: passed
          ? "No common document-information metadata values were detected."
          : "One or more common document-information metadata values remain.",
        expected: 0,
        actual,
      });
      continue;
    }

    if (
      request.kind ===
      "forms-flattened"
    ) {
      const { form } =
        report.facts;

      if (form.hasXfa) {
        checks.push({
          kind: request.kind,
          status: "FAILED",
          message:
            "XFA form data remains, so the document cannot be verified as flattened by the standard form check.",
        });
        continue;
      }

      const passed =
        form.fieldCount === 0;

      checks.push({
        kind: request.kind,
        status: passed
          ? "PASS"
          : "FAILED",
        message: passed
          ? "No standard interactive AcroForm fields remain."
          : "Standard interactive AcroForm fields remain.",
        expected: 0,
        actual: form.fieldCount,
      });
    }
  }

  return {
    artifactId: artifact.id,
    status:
      getOverallStatus(checks),
    checks,
    verifiedAt: Date.now(),
  };
}
