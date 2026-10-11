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
  it("does not replace an occupied heading region", () => {
    expect(planTopMarginRecovery(
      [word(210), ...Array.from({ length: 18 }, () => word(410))],
      body, 1980, 2800,
    )).toBeNull();
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
