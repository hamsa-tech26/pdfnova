import { describe, expect, it } from "vitest";

import {
  calculateProportionalFitScale,
  getVisiblePageSize,
  resolveResizeTarget,
} from "../resizePageGeometry";

describe("resizePageGeometry", () => {
  it("keeps A4 portrait dimensions for an unrotated portrait page", () => {
    const target = resolveResizeTarget(
      "a4",
      "auto",
      600,
      800,
      0,
    );

    expect(target.width).toBeCloseTo(595.28, 2);
    expect(target.height).toBeCloseTo(841.89, 2);
    expect(target.visibleOrientation).toBe("portrait");
  });

  it("uses landscape A4 for an unrotated landscape page in auto mode", () => {
    const target = resolveResizeTarget(
      "a4",
      "auto",
      800,
      600,
      0,
    );

    expect(target.width).toBeCloseTo(841.89, 2);
    expect(target.height).toBeCloseTo(595.28, 2);
    expect(target.visibleOrientation).toBe("landscape");
  });

  it("accounts for quarter-turn rotation when reading visible orientation", () => {
    const visible = getVisiblePageSize(
      595.28,
      841.89,
      90,
    );

    expect(visible.width).toBeCloseTo(841.89, 2);
    expect(visible.height).toBeCloseTo(595.28, 2);

    const target = resolveResizeTarget(
      "a4",
      "auto",
      595.28,
      841.89,
      90,
    );

    expect(target.visibleOrientation).toBe("landscape");
    expect(target.width).toBeCloseTo(595.28, 2);
    expect(target.height).toBeCloseTo(841.89, 2);
  });

  it("maps an explicit portrait target back through a 90 degree rotation", () => {
    const target = resolveResizeTarget(
      "letter",
      "portrait",
      600,
      800,
      90,
    );

    expect(target.visibleWidth).toBe(612);
    expect(target.visibleHeight).toBe(792);
    expect(target.width).toBe(792);
    expect(target.height).toBe(612);
  });

  it("calculates a proportional fit scale without stretching", () => {
    expect(
      calculateProportionalFitScale(
        1000,
        500,
        600,
        800,
      ),
    ).toBeCloseTo(0.6, 6);
  });
});
