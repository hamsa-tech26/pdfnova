import { inspectPdfEncryption } from "../../pdf/qpdf";
import { inspectRasterizedPages } from "../../pdf/rasterVerification";
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
      if (
        typeof window ===
        "undefined"
      ) {
        checks.push({
          kind: request.kind,
          status: "NOT_VERIFIED",
          message:
            "Encryption verification requires the browser QPDF runtime.",
        });
        continue;
      }

      const encryption =
        await inspectPdfEncryption(
          artifact.blob,
        );

      checks.push({
        kind: request.kind,
        status:
          encryption ===
          "encrypted"
            ? "PASS"
            : encryption ===
                "not-encrypted"
              ? "FAILED"
              : "NOT_VERIFIED",
        message:
          encryption ===
          "encrypted"
            ? "QPDF confirms that the output PDF is encrypted."
            : encryption ===
                "not-encrypted"
              ? "QPDF confirms that the output PDF is not encrypted."
              : "QPDF could not determine the PDF encryption state.",
        expected: true,
        actual:
          encryption ===
          "unknown"
            ? undefined
            : encryption ===
                "encrypted",
      });
      continue;
    }

    if (
      request.kind ===
      "rasterized-pages"
    ) {
      const raster =
        await inspectRasterizedPages(
          artifact.blob,
        );
      const passed =
        raster.pageCount > 0 &&
        raster.imageOnlyPageCount ===
          raster.pageCount;

      checks.push({
        kind: request.kind,
        status: passed
          ? "PASS"
          : "FAILED",
        message: passed
          ? "Every page has a strict image-only page structure with no text, font, pattern, shading, or vector-painting operators detected."
          : raster.reason ??
            "The PDF could not be verified as image-only.",
        expected:
          raster.pageCount,
        actual:
          raster.imageOnlyPageCount,
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
