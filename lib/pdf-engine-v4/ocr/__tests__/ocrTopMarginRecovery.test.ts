import { describe, expect, it } from "vitest";
import {
  acceptRecoveredTopHeading,
  mergeRecoveredTopHeading,
  planTopMarginRecovery,
} from "../ocrTopMarginRecovery";

describe("OCR top-margin heading recovery", () => {
  const body = "Reference number: SV-2048\nCustomer: Mira Sen\nVisit date: 14 August 2026\nEquipment details and inspection follow.";
  it("always crops a bounded top strip for a first-page OCR text result", () => {
    expect(planTopMarginRecovery(body, 1786, 2526))
      .toEqual({ left: 0, top: 0, width: 1786, height: 555 });
    expect(planTopMarginRecovery(body, 1980, 2800))
      .toEqual({ left: 0, top: 0, width: 1980, height: 616 });
  });

  it("does not depend on Tesseract word blocks, which can be missing when text survives", () => {
    // This crop still runs even when full-page data.blocks is absent.
    expect(planTopMarginRecovery(body, 1786, 2526)?.height).toBe(555);
  });

  it("rejects invalid, undersized and nearly blank OCR pages", () => {
    expect(planTopMarginRecovery("", 1786, 2526)).toBeNull();
    expect(planTopMarginRecovery(body, 0, 2526)).toBeNull();
    expect(planTopMarginRecovery(body, 320, 2526)).toBeNull();
    expect(planTopMarginRecovery(body, 1786, 450)).toBeNull();
    expect(planTopMarginRecovery(body, Infinity, 2526)).toBeNull();
  });

  it("accepts the exact recognized high-confidence source title", () => {
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 96.35, body))
      .toBe("SERVICE VISIT NOTE");
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE\n", 96.35, body))
      .toBe("SERVICE VISIT NOTE");
  });

  it("rejects duplicate, weak, nonsense and multi-line candidates", () => {
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 60, body)).toBeNull();
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 96.35,
      "SERVICE VISIT NOTE\n" + body)).toBeNull();
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE\nCustomer Mira", 96.35, body))
      .toBe("SERVICE VISIT NOTE");
    expect(acceptRecoveredTopHeading("Reference number: SV-2048", 96.35, body))
      .toBeNull();
    expect(acceptRecoveredTopHeading("??? OCR ???", 96.35, body)).toBeNull();
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", Number.NaN, body))
      .toBeNull();
  });

  it("recovers multi-line top banner and subtitle from the actual scan", () => {
    expect(acceptRecoveredTopHeading(
      "COMMUNITY NOTICE\nSAMPLE PUBLIC SERVICE INFORMATION - OCR TEST DOCUMENT",
      95.6,
      body,
    )).toBe("COMMUNITY NOTICE\nSAMPLE PUBLIC SERVICE INFORMATION - OCR TEST DOCUMENT");
    expect(acceptRecoveredTopHeading(
      "COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE\nOCR HEADING REGRESSION TEST",
      95.9,
      body,
    )).toBe("COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE\nOCR HEADING REGRESSION TEST");
  });

  it("does not duplicate already-recognized heading or subtitle lines", () => {
    expect(acceptRecoveredTopHeading(
      "COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE",
      95,
      body + "\nOCTOBER MAINTENANCE UPDATE",
    )).toBe("COMMUNITY SERVICE\nBULLETIN");
  });

  it("rejects untrustworthy multi-line crop results", () => {
    expect(acceptRecoveredTopHeading(
      "Customer name\nCOMMUNITY SERVICE",
      96,
      body,
    )).toBeNull();
    expect(acceptRecoveredTopHeading(
      "COMMUNITY SERVICE\nBULLETIN",
      70,
      body,
    )).toBeNull();
    expect(acceptRecoveredTopHeading(
      "ONE TITLE\nTWO TITLE\nTHREE TITLE\nFOUR TITLE\nFIVE TITLE",
      96,
      body,
    )).toBeNull();
  });


  it("merges missing subtitle into correct heading order without duplicates", () => {
    const original = "COMMUNITY SERVICE\nBULLETIN\nNotice ID: HX-2026-005\nIssued: 09 October 2026";
    const recovered = "COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE";
    const merged = mergeRecoveredTopHeading(recovered, 95, original);
    expect(merged).toBe(
      "COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE\n\n" +
      "Notice ID: HX-2026-005\nIssued: 09 October 2026",
    );
    expect(merged.match(/COMMUNITY SERVICE/g)).toHaveLength(1);
  });

  it("restores missing initial lines before an already recognized subtitle", () => {
    const bodyWithSubtitle = "OCTOBER MAINTENANCE UPDATE\nOCR HEADING REGRESSION TEST\nNotice ID: HX-2026-005";
    const cropped = "COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE\nOCR HEADING REGRESSION TEST";
    const merged = mergeRecoveredTopHeading(cropped, 97, bodyWithSubtitle);
    expect(merged).toMatch(/^COMMUNITY SERVICE\nBULLETIN\nOCTOBER MAINTENANCE UPDATE\nOCR HEADING REGRESSION TEST\n\nNotice ID/);
    expect(merged.match(/OCTOBER MAINTENANCE UPDATE/g)).toHaveLength(1);
    expect(mergeRecoveredTopHeading(cropped, 60, bodyWithSubtitle)).toBe(bodyWithSubtitle);
  });

});
