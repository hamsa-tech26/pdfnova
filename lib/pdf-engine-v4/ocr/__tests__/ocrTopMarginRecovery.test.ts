import { describe, expect, it } from "vitest";
import type { PdfV4OcrWord } from "../ocrRecognizer";
import {
  acceptRecoveredTopHeading,
  planTopMarginRecovery,
} from "../ocrTopMarginRecovery";

const word = (y: number, confidence = 94): PdfV4OcrWord => ({
  text: "Reference",
  confidence,
  bounds: { x0: 170, y0: y, x1: 260, y1: y + 20 },
  coordinateSpace: "rendered-image-pixels",
  source: "ocr-tesseract",
});

describe("OCR top-margin heading recovery", () => {
  const body = "Reference number: SV-2048\nCustomer: Mira Sen\nVisit date: 14 August 2026\nEquipment details and inspection follow.";
  it("probes only an unused top strip above existing body text", () => {
    const plan = planTopMarginRecovery(
      Array.from({ length: 18 }, () => word(410)),
      body,
      1980,
      2800,
    );
    expect(plan).toEqual({ left: 0, top: 0, width: 1980, height: 376 });
  });
  it("reprobes a short top strip when layout blocks contain a heading omitted from text", () => {
    // Regression for the original 1786x2526 scan: the heading starts
    // near y=177 while the body text export starts at SV-2048.
    const plan = planTopMarginRecovery(
      [word(177), ...Array.from({ length: 18 }, () => word(372))],
      body,
      1786,
      2526,
    );
    expect(plan).toEqual({ left: 0, top: 0, width: 1786, height: 341 });
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 96.35, body))
      .toBe("SERVICE VISIT NOTE");
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 96.35, "SERVICE VISIT NOTE\\n" + body))
      .toBeNull();
  });
  it("keeps probing bounded when other top-region words were already recognized", () => {
    const plan = planTopMarginRecovery(
      [word(210), ...Array.from({ length: 18 }, () => word(410))],
      body, 1980, 2800,
    );
    expect(plan).toEqual({ left: 0, top: 0, width: 1980, height: 378 });
  });
  it("does not probe underspecified/empty OCR pages", () => {
    expect(planTopMarginRecovery([word(410)], body, 1980, 2800)).toBeNull();
    expect(planTopMarginRecovery(
      Array.from({ length: 18 }, () => word(410)),
      "", 1980, 2800,
    )).toBeNull();
  });
  it("accepts scanned high-confidence uppercase title without inventing words", () => {
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 93, body)).toBe("SERVICE VISIT NOTE");
  });
  it("refuses weak, duplicate, multi-line, and paragraph evidence", () => {
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 60, body)).toBeNull();
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE", 92, "SERVICE VISIT NOTE\n" + body)).toBeNull();
    expect(acceptRecoveredTopHeading("SERVICE VISIT NOTE\nReference number: SV-2048", 92, body)).toBeNull();
    expect(acceptRecoveredTopHeading("Reference number: SV-2048", 92, body)).toBeNull();
  });
});
