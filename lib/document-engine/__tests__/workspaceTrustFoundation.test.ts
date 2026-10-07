import {
  createSafeSharePlan,
} from "../workspace-intelligence/safeShare";
import {
  scanSensitiveText,
} from "../workspace-intelligence/sensitiveSignals";
import {
  verifyWorkspaceRelationships,
} from "../workspace-intelligence/verification";
import type {
  InspectionReport,
  WorkspaceIntelligenceNode,
} from "..";
import {
  describe,
  expect,
  it,
} from "vitest";

function node(
  overrides: Partial<WorkspaceIntelligenceNode> & {
    id: string;
  },
): WorkspaceIntelligenceNode {
  return {
    id: overrides.id,
    name:
      overrides.name ??
      `${overrides.id}.pdf`,
    type:
      "application/pdf",
    size: 100,
    lastModified: 1,
    documentId:
      overrides.documentId ??
      overrides.id,
    parentIds:
      overrides.parentIds ?? [],
    rootIds:
      overrides.rootIds ?? [
        overrides.id,
      ],
    relationKind:
      overrides.relationKind ??
      "source",
    version:
      overrides.version ?? 1,
    generation:
      overrides.generation ?? 0,
  };
}

function inspection(
  options: {
    metadataCount?: number;
    fieldCount?: number;
    hasXfa?: boolean;
  } = {},
): InspectionReport {
  const metadataKeys =
    options.metadataCount
      ? ["title"]
      : [];

  return {
    artifactId: "a",
    valid: true,
    facts: {
      mimeType:
        "application/pdf",
      size: 100,
      pageCount: 1,
      pages: [],
      hasMixedPageSizes:
        false,
      rotatedPageCount: 0,
      customCropBoxPageCount:
        0,
      metadata: {
        title:
          options.metadataCount
            ? "Private"
            : "",
        author: "",
        subject: "",
        keywords: "",
        creator: "",
        producer: "",
      },
      commonMetadataFieldsPresent:
        metadataKeys as never,
      form: {
        hasAcroForm:
          Boolean(
            options.fieldCount,
          ),
        hasXfa:
          options.hasXfa ??
          false,
        fieldCount:
          options.fieldCount ??
          0,
        filledFieldCount: 0,
        fieldKinds: {
          text: 0,
          checkbox: 0,
          dropdown: 0,
          "option-list": 0,
          radio: 0,
          unsupported: 0,
        },
      },
    },
    capabilities: [
      {
        id:
          "page-geometry",
        status: "checked",
      },
      {
        id:
          "common-metadata",
        status: "checked",
      },
    ],
    inspectedAt: 1,
  };
}

describe(
  "workspace trust foundation",
  () => {
    it("fails relationship verification when a parent reference is missing", () => {
      const report =
        verifyWorkspaceRelationships([
          node({
            id: "child",
            relationKind:
              "branch",
            parentIds: [
              "missing",
            ],
          }),
        ]);

      expect(
        report.status,
      ).toBe("FAILED");
    });

    it("passes a valid revision relationship", () => {
      const first = node({
        id: "v1",
        documentId: "doc",
      });
      const second = node({
        id: "v2",
        documentId: "doc",
        parentIds: [
          "v1",
        ],
        rootIds: [
          "v1",
        ],
        relationKind:
          "revision",
        version: 2,
        generation: 1,
      });

      const report =
        verifyWorkspaceRelationships([
          first,
          second,
        ]);

      expect(
        report.status,
      ).toBe("PASS");
    });

    it("detects common sensitive-looking patterns without returning matched values", () => {
      const report =
        scanSensitiveText(
          "Email person@example.com Phone 9876543210 PAN ABCDE1234F DOB: 01-02-1990",
        );

      expect(
        report.signals.map(
          (signal) =>
            signal.kind,
        ),
      ).toEqual(
        expect.arrayContaining([
          "email",
          "phone",
          "pan-like",
          "date-of-birth-like",
        ]),
      );
      expect(
        JSON.stringify(
          report,
        ),
      ).not.toContain(
        "person@example.com",
      );
    });

    it("requires safe-share review for metadata, forms, or sensitive patterns", () => {
      const sensitive =
        scanSensitiveText(
          "Contact person@example.com",
        );
      const plan =
        createSafeSharePlan(
          inspection({
            metadataCount: 1,
            fieldCount: 2,
          }),
          sensitive,
          100,
        );

      expect(
        plan.status,
      ).toBe(
        "REVIEW_REQUIRED",
      );
      expect(
        plan.issues.map(
          (issue) =>
            issue.kind,
        ),
      ).toEqual(
        expect.arrayContaining([
          "common-metadata",
          "interactive-forms",
          "sensitive-patterns",
        ]),
      );
    });

    it("never labels an uncovered scan as safe", () => {
      const plan =
        createSafeSharePlan(
          inspection(),
          scanSensitiveText(""),
          0,
        );

      expect(
        plan.status,
      ).toBe(
        "COVERAGE_LIMITED",
      );
      expect(
        plan.statement.toLowerCase(),
      ).not.toContain(
        "safe to share",
      );
    });
  },
);
