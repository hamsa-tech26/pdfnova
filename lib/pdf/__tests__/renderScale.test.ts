import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculatePdfRenderScale,
} from "../render";

describe("calculatePdfRenderScale", () => {
  it("keeps the requested scale when the page fits the cap", () => {
    expect(
      calculatePdfRenderScale({
        pageWidth: 600,
        pageHeight: 800,
        requestedScale: 1.5,
        maxDimension: 2000,
      }),
    ).toBe(1.5);
  });

  it("reduces scale for unusually large pages", () => {
    expect(
      calculatePdfRenderScale({
        pageWidth: 4000,
        pageHeight: 3000,
        requestedScale: 2,
        maxDimension: 3000,
      }),
    ).toBeCloseTo(
      0.75,
      8,
    );
  });

  it("never upscales beyond the requested scale", () => {
    expect(
      calculatePdfRenderScale({
        pageWidth: 200,
        pageHeight: 300,
        requestedScale: 1,
        maxDimension: 4000,
      }),
    ).toBe(1);
  });

  it("rejects invalid render inputs", () => {
    expect(() =>
      calculatePdfRenderScale({
        pageWidth: 0,
        pageHeight: 800,
        requestedScale: 1,
      }),
    ).toThrow(
      "greater than zero",
    );

    expect(() =>
      calculatePdfRenderScale({
        pageWidth: 600,
        pageHeight: 800,
        requestedScale: 1,
        maxDimension: 0,
      }),
    ).toThrow(
      "maximum dimension",
    );
  });
});
