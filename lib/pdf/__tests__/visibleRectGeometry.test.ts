import { describe, expect, it } from "vitest";
import {
  normalizeVisibleRect,
  visibleRectToPdfPlacement,
} from "../visibleRectGeometry";

describe("visibleRectGeometry", () => {
  it("normalizes a backwards drag", () => {
    const rect = normalizeVisibleRect({
      x: 0.7,
      y: 0.8,
      width: -0.3,
      height: -0.2,
    });
    expect(rect.x).toBeCloseTo(0.4, 8);
    expect(rect.y).toBeCloseTo(0.6, 8);
    expect(rect.width).toBeCloseTo(0.3, 8);
    expect(rect.height).toBeCloseTo(0.2, 8);
  });

  it("maps an unrotated visible rectangle to PDF coordinates", () => {
    const placement = visibleRectToPdfPlacement(
      { x: 10, y: 20, width: 600, height: 800 },
      0,
      { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    );
    expect(placement.x).toBeCloseTo(70, 6);
    expect(placement.y).toBeCloseTo(580, 6);
    expect(placement.width).toBeCloseTo(180, 6);
    expect(placement.height).toBeCloseTo(80, 6);
  });

  it("maps a visible rectangle through a 90 degree page rotation", () => {
    const placement = visibleRectToPdfPlacement(
      { x: 0, y: 0, width: 600, height: 800 },
      90,
      { x: 0.1, y: 0.2, width: 0.25, height: 0.1 },
    );
    expect(placement.rotation).toBe(90);
    expect(placement.width).toBeCloseTo(200, 6);
    expect(placement.height).toBeCloseTo(60, 6);
    expect(placement.x).toBeCloseTo(180, 6);
    expect(placement.y).toBeCloseTo(80, 6);
  });
});
