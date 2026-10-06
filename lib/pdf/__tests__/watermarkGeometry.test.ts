import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateWatermarkPlacement,
  getVisibleWatermarkPageSize,
} from "../watermarkGeometry";

const box = {
  x: 0,
  y: 0,
  width: 600,
  height: 800,
};

describe("watermarkGeometry", () => {
  it("uses visible dimensions for rotated pages", () => {
    expect(
      getVisibleWatermarkPageSize(
        box,
        90,
      ),
    ).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("centers an unrotated watermark", () => {
    const placement =
      calculateWatermarkPlacement({
        box,
        pageRotation: 0,
        watermarkRotation: 0,
        elementWidth: 200,
        elementHeight: 50,
        position: "center",
      });

    expect(placement.x).toBeCloseTo(
      200,
      6,
    );
    expect(placement.y).toBeCloseTo(
      375,
      6,
    );
    expect(
      placement.drawRotation,
    ).toBe(0);
  });

  it("keeps a 45 degree top-right watermark inside the visible page", () => {
    const placement =
      calculateWatermarkPlacement({
        box,
        pageRotation: 0,
        watermarkRotation: 45,
        elementWidth: 120,
        elementHeight: 40,
        position: "top-right",
        margin: 32,
      });

    expect(
      placement.boundingWidth,
    ).toBeCloseTo(
      113.13708498984761,
      6,
    );
    expect(
      placement.boundingHeight,
    ).toBeCloseTo(
      113.1370849898476,
      6,
    );
    expect(
      placement.drawRotation,
    ).toBe(45);
  });

  it("maps placement through a 90 degree page rotation and preserves CropBox offsets", () => {
    const placement =
      calculateWatermarkPlacement({
        box: {
          x: 20,
          y: 30,
          width: 560,
          height: 740,
        },
        pageRotation: 90,
        watermarkRotation: 0,
        elementWidth: 150,
        elementHeight: 50,
        position: "bottom-left",
        margin: 25,
      });

    expect(
      placement.drawRotation,
    ).toBe(90);
    expect(placement.x).toBeCloseTo(
      20 + 560 - 25,
      6,
    );
    expect(placement.y).toBeCloseTo(
      30 + 25,
      6,
    );
  });

  it("rejects watermarks that cannot fit within the margin", () => {
    expect(() =>
      calculateWatermarkPlacement({
        box: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        pageRotation: 0,
        watermarkRotation: 0,
        elementWidth: 80,
        elementHeight: 80,
        position: "center",
        margin: 20,
      }),
    ).toThrow(
      "watermark is too large",
    );
  });
});
