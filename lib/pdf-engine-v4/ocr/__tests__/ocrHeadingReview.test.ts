import { describe, expect, it } from "vitest";
import { suggestPdfV4OcrMissingHeading } from "../ocrHeadingReview";

describe("Release 58B heading review safety", () => {
  it("surfaces a distinct all-caps alternate opening as a hypothesis", () => {
    expect(suggestPdfV4OcrMissingHeading(
      "Record ID: DC-T316\nValve tested at north station.",
      "SITE INSPECTION SERVICE NOTE\nRecord ID: DC-7316",
    )).toBe("SITE INSPECTION SERVICE NOTE");
  });

  it("accepts plausible title-case headings without replacing raw text", () => {
    expect(suggestPdfV4OcrMissingHeading(
      "Pumps were inspected.\nReference: AB-1087",
      "Service Inspection Report\nPumps were inspected.",
    )).toBe("Service Inspection Report");
  });

  it("does not turn alternate record IDs or reordered body prose into a lost heading", () => {
    expect(suggestPdfV4OcrMissingHeading(
      "Body note\nRecord ID: DC-T316",
      "Record ID: DC-7316\nBody note",
    )).toBeNull();
    expect(suggestPdfV4OcrMissingHeading(
      "Maintenance team checked the valve.",
      "maintenance team checked the valve.\nLater text",
    )).toBeNull();
  });

  it("does not repeat headings already present with harmless formatting differences", () => {
    expect(suggestPdfV4OcrMissingHeading(
      "SITE-INSPECTION, SERVICE NOTE\nRecord ID: 123",
      "SITE INSPECTION SERVICE NOTE\nRecord ID: 123",
    )).toBeNull();
  });

  it("rejects very short and nonsensical OCR candidates", () => {
    expect(suggestPdfV4OcrMissingHeading("body", "AB\nbody")).toBeNull();
    expect(suggestPdfV4OcrMissingHeading("body", "### RANDOM !!!\nbody")).toBeNull();
    expect(suggestPdfV4OcrMissingHeading("body", "")).toBeNull();
  });
});
