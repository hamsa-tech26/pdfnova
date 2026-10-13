import { describe, expect, it } from "vitest";
import {
  acceptRecoveredTopHeading,
  planTopMarginRecovery,
} from "../ocrTopMarginRecovery";

describe("OCR top-margin heading recovery", () => {
  const body = "Reference number: SV-2048\nCustomer: Mira Sen\nVisit date: 14 August 2026\nEquipment details and inspection follow.";
  it("always crops a bounded top strip for a first-page OCR text result", () => {
    expect(planTopMarginRecovery(body, 1786, 2526))
      .toEqual({ left: 0, top: 0, width: 1786, height: 341 });
    expect(planTopMarginRecovery(body, 1980, 2800))
      .toEqual({ left: 0, top: 0, width: 1980, height: 378 });
  });

  it("does not depend on Tesseract word blocks, which can be missing when text survives", () => {
    // This crop still runs even when full-page data.blocks is absent.
    expect(planTopMarginRecovery(body, 1786, 2526)?.height).toBe(341);
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
      .toBeNull();
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
      "COMMUNITY SERVICE\nBULLETIN",
      95.9,
      body,
    )).toBe("COMMUNITY SERVICE\nBULLETIN");
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
      "COMMUNITY SERVICE\nCustomer name",
      96,
      body,
    )).toBeNull();
    expect(acceptRecoveredTopHeading(
      "COMMUNITY SERVICE\nBULLETIN",
      70,
      body,
    )).toBeNull();
    expect(acceptRecoveredTopHeading(
      "ONE TITLE\nTWO TITLE\nTHREE TITLE\nFOUR TITLE",
      96,
      body,
    )).toBeNull();
  });

});
