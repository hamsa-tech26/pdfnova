import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createDocumentArtifact,
} from "../artifact";
import {
  verifyPdfArtifact,
} from "../verification/verifyPdf";
import {
  flattenStandardPdfForm,
} from "../../pdf/formFields";
import {
  applyPdfMetadata,
} from "../../pdf/metadataEditor";
import {
  createReliabilityPdfBytes,
  RELIABILITY_FIXTURE_PAGE_COUNT,
} from "../../pdf/__tests__/fixtures/reliabilityFixture";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "../../pdf/safeDocument";

function artifactFromBytes(
  id: string,
  bytes: Uint8Array,
) {
  return createDocumentArtifact(
    new Blob([bytes], {
      type: "application/pdf",
    }),
    {
      id,
      name: `${id}.pdf`,
      source: "test",
    },
  );
}

describe("shared PDF verification", () => {
  it("verifies openability and expected page count", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const report =
      await verifyPdfArtifact(
        artifactFromBytes(
          "fixture",
          bytes,
        ),
        [
          {
            kind: "pdf-openable",
          },
          {
            kind: "page-count-equals",
            expected:
              RELIABILITY_FIXTURE_PAGE_COUNT,
          },
        ],
      );

    expect(report.status).toBe(
      "PASS",
    );

    expect(
      report.checks.every(
        (check) =>
          check.status === "PASS",
      ),
    ).toBe(true);
  });

  it("verifies removal of common metadata without claiming forensic sanitization", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await loadPdfWithoutMetadataMutation(
        source,
      );

    applyPdfMetadata(pdf, {
      title: "",
      author: "",
      subject: "",
      keywords: "",
      creator: "",
      producer: "",
    });

    const bytes =
      await savePdfWithoutFormAppearanceMutation(
        pdf,
      );

    const report =
      await verifyPdfArtifact(
        artifactFromBytes(
          "metadata-removed",
          bytes,
        ),
        [
          {
            kind: "common-metadata-empty",
          },
        ],
      );

    expect(report.status).toBe(
      "PASS",
    );
  });

  it("verifies standard form flattening after reopening serialized output", async () => {
    const source =
      await createReliabilityPdfBytes();

    const pdf =
      await loadPdfWithoutMetadataMutation(
        source,
      );

    flattenStandardPdfForm(pdf);

    const bytes =
      await savePdfWithoutFormAppearanceMutation(
        pdf,
      );

    const report =
      await verifyPdfArtifact(
        artifactFromBytes(
          "flattened",
          bytes,
        ),
        [
          {
            kind: "pdf-openable",
          },
          {
            kind: "forms-flattened",
          },
          {
            kind: "page-count-equals",
            expected:
              RELIABILITY_FIXTURE_PAGE_COUNT,
          },
        ],
      );

    expect(report.status).toBe(
      "PASS",
    );

    expect(
      report.checks.find(
        (check) =>
          check.kind ===
          "forms-flattened",
      )?.status,
    ).toBe("PASS");
  });

  it("fails deterministic file-size requirements", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const artifact =
      artifactFromBytes(
        "too-large",
        bytes,
      );

    const report =
      await verifyPdfArtifact(
        artifact,
        [
          {
            kind: "file-size-at-most",
            maxBytes:
              artifact.size - 1,
          },
        ],
      );

    expect(report.status).toBe(
      "FAILED",
    );
  });

  it("uses NOT_VERIFIED instead of pretending encryption was proven", async () => {
    const artifact =
      createDocumentArtifact(
        new Blob(["not inspected"]),
        {
          id: "encrypted",
          name: "encrypted.pdf",
          source: "test",
        },
      );

    const report =
      await verifyPdfArtifact(
        artifact,
        [
          {
            kind: "encryption-applied",
          },
        ],
      );

    expect(report.status).toBe(
      "NOT_VERIFIED",
    );

    expect(
      report.checks[0].status,
    ).toBe("NOT_VERIFIED");
  });

  it("fails rasterized-pages verification when ordinary PDF content is still present", async () => {
    const bytes =
      await createReliabilityPdfBytes();

    const report =
      await verifyPdfArtifact(
        artifactFromBytes(
          "mixed-verification",
          bytes,
        ),
        [
          {
            kind: "pdf-openable",
          },
          {
            kind: "rasterized-pages",
          },
        ],
      );

    expect(report.status).toBe(
      "FAILED",
    );

    expect(
      report.checks.map(
        (check) => check.status,
      ),
    ).toEqual([
      "PASS",
      "FAILED",
    ]);
  });

  it("reports invalid PDFs as failed openability instead of throwing away the verification report", async () => {
    const artifact =
      createDocumentArtifact(
        new Blob(["not a pdf"], {
          type: "application/pdf",
        }),
        {
          id: "invalid",
          name: "invalid.pdf",
          source: "test",
        },
      );

    const report =
      await verifyPdfArtifact(
        artifact,
        [
          {
            kind: "pdf-openable",
          },
        ],
      );

    expect(report.status).toBe(
      "FAILED",
    );
    expect(
      report.checks[0].status,
    ).toBe("FAILED");
  });
});
