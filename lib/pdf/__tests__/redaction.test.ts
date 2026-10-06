import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isUsefulRedactionRect,
  normalizeRedactionRect,
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
});
