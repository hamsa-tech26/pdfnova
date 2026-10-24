import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isUsefulRedactionRect,
  normalizeRedactionRect,
  redactionPixelBounds,
  validateRedactionPlan,
  type RedactionRect,
} from "../redaction";

describe("redaction geometry", () => {
  it("normalizes a backwards drag", () => {
    expect(
      normalizeRedactionRect({
        x: 0.7,
        y: 0.8,
        width: -0.4,
        height: -0.5,
      }),
    ).toEqual({
      x: 0.29999999999999993,
      y: 0.30000000000000004,
      width: 0.4,
      height: 0.5,
    });
  });

  it("clamps redactions to the page", () => {
    const rect = normalizeRedactionRect({
      x: -0.2,
      y: 0.9,
      width: 1.4,
      height: 0.4,
    });

    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0.9);
    expect(rect.width).toBe(1);
    expect(rect.height).toBeCloseTo(0.1, 8);
  });

  it("rejects accidental tiny marks", () => {
    expect(
      isUsefulRedactionRect({
        x: 0.1,
        y: 0.1,
        width: 0.001,
        height: 0.002,
      }),
    ).toBe(false);
  });

  it("fully masks edge pixels touched by a fractional selection", () => {
    const rect = {x: 0.105, y: 0.205, width: 0.205, height: 0.305};
    const pixels = redactionPixelBounds(rect, 100, 100);
    // The old nearest-origin rounding left these selected edge pixels exposed.
    for (const [x, y] of [[10, 20], [10, 35], [20, 20], [30, 50]]) {
      expect(x >= pixels.x && x < pixels.x + pixels.width &&
        y >= pixels.y && y < pixels.y + pixels.height).toBe(true);
    }
    expect(pixels.x + pixels.width).toBeLessThanOrEqual(100);
    expect(pixels.y + pixels.height).toBeLessThanOrEqual(100);
  });

  it("covers the complete selected interval at multiple raster sizes without crossing page edges", () => {
    const rects = [
      {x: 0, y: 0, width: 1, height: 1},
      {x: 0.105, y: 0.205, width: 0.205, height: 0.305},
      {x: 0.7, y: 0.8, width: -0.4, height: -0.5},
      {x: -0.2, y: 0.9, width: 1.4, height: 0.4},
      {x: 0.993, y: 0.992, width: 0.007, height: 0.008},
    ];
    for (const [width, height] of [[100, 100], [613, 797], [2400, 3200]]) {
      for (const rect of rects) {
        const selected = normalizeRedactionRect(rect);
        const pixels = redactionPixelBounds(rect, width, height);
        expect(pixels.x).toBeLessThanOrEqual(selected.x * width);
        expect(pixels.y).toBeLessThanOrEqual(selected.y * height);
        expect(pixels.x + pixels.width).toBeGreaterThanOrEqual((selected.x + selected.width) * width - 1e-9);
        expect(pixels.y + pixels.height).toBeGreaterThanOrEqual((selected.y + selected.height) * height - 1e-9);
        expect(pixels.x).toBeGreaterThanOrEqual(0);
        expect(pixels.y).toBeGreaterThanOrEqual(0);
        expect(pixels.x + pixels.width).toBeLessThanOrEqual(width);
        expect(pixels.y + pixels.height).toBeLessThanOrEqual(height);
      }
    }
  });

  it("accepts actual page selections, backwards drags and clipped valid rectangles", () => {
    expect(() => validateRedactionPlan({
      1: [{x: 0.7, y: 0.8, width: -0.4, height: -0.5}],
      2: [{x: -0.2, y: 0.9, width: 1.4, height: 0.4}],
    }, 2)).not.toThrow();
  });

  it("refuses a selection on an absent page instead of exporting an unmasked PDF", () => {
    for (const key of ["0", "3", "01", "1.5", "-1"]) {
      const pages = {[key]: [{x: 0.1, y: 0.1, width: 0.3, height: 0.2}]};
      expect(() => validateRedactionPlan(pages as unknown as Record<number, RedactionRect[]>, 2))
        .toThrow(/outside this PDF/);
    }
    expect(() => validateRedactionPlan({
      1: [{x: 0.1, y: 0.1, width: 0.3, height: 0.2}],
      99: [{x: 0.1, y: 0.1, width: 0.3, height: 0.2}],
    }, 2)).toThrow(/outside this PDF/);
  });

  it("refuses any malformed or unusable mask even if other masks are valid", () => {
    const valid = {x: 0.1, y: 0.1, width: 0.3, height: 0.2};
    const malformed: unknown[] = [
      {x: Number.NaN, y: 0.2, width: 0.2, height: 0.2},
      {x: Number.POSITIVE_INFINITY, y: 0.2, width: 0.2, height: 0.2},
      {x: 1.5, y: 0.2, width: 0.2, height: 0.2},
      {x: 0.2, y: 0.2, width: 0.0001, height: 0.0001},
      {x: 0.2, y: 0.2, width: "0.3", height: 0.2},
      null,
    ];
    for (const bad of malformed) {
      expect(() => validateRedactionPlan({
        1: [valid, bad as RedactionRect],
      }, 2)).toThrow(/export was withheld/);
    }
  });

  it("refuses empty, invalid-shape or page-free redaction plans", () => {
    expect(() => validateRedactionPlan({}, 2)).toThrow(/at least one redaction/);
    expect(() => validateRedactionPlan({1: []}, 2)).toThrow(/at least one redaction/);
    expect(() => validateRedactionPlan({1: [{x: 0, y: 0, width: 1, height: 1}]}, 0))
      .toThrow(/Invalid redaction source/);
    expect(() => validateRedactionPlan({1: []} as unknown as Record<number, RedactionRect[]>, 1.5))
      .toThrow(/Invalid redaction source/);
    expect(() => validateRedactionPlan({1: null as unknown as RedactionRect[]}, 1))
      .toThrow(/invalid selection data/);
  });

});
