import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizedRectFromPercent,
  normalizedRectToPercent,
  nudgeNormalizedPosition,
} from "../previewAccessibility";

describe("preview accessibility geometry", () => {
  it("nudges a normalized position and clamps it to visible bounds", () => {
    expect(
      nudgeNormalizedPosition({
        position: {
          x: 0.79,
          y: 0.89,
        },
        deltaX: 0.05,
        deltaY: 0.05,
        maxX: 0.8,
        maxY: 0.9,
      }),
    ).toEqual({
      x: 0.8,
      y: 0.9,
    });
  });

  it("converts percentage rectangle inputs into safe normalized bounds", () => {
    expect(
      normalizedRectFromPercent({
        x: 90,
        y: 80,
        width: 40,
        height: 40,
      }),
    ).toEqual({
      x: 0.9,
      y: 0.8,
      width:
        0.09999999999999998,
      height:
        0.19999999999999996,
    });
  });

  it("keeps a minimum usable rectangle at the bottom-right edge", () => {
    const rect =
      normalizedRectFromPercent({
        x: 100,
        y: 100,
        width: 20,
        height: 20,
      });

    expect(rect.x).toBe(0.995);
    expect(rect.y).toBe(0.995);
    expect(rect.width).toBeCloseTo(0.005, 8);
    expect(rect.height).toBeCloseTo(0.005, 8);
  });

  it("round-trips normalized rectangle values into readable percentages", () => {
    expect(
      normalizedRectToPercent({
        x: 0.1234,
        y: 0.5678,
        width: 0.25,
        height: 0.1,
      }),
    ).toEqual({
      x: 12.3,
      y: 56.8,
      width: 25,
      height: 10,
    });
  });
});
