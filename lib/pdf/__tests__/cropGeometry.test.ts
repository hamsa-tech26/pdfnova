import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateVisibleCropBox,
} from "../cropGeometry";

const box = {
  x: 10,
  y: 20,
  width: 600,
  height: 800,
};

const margins = {
  top: 10,
  right: 20,
  bottom: 30,
  left: 40,
};

describe("cropGeometry", () => {
  it("applies visible margins directly to an unrotated page", () => {
    expect(
      calculateVisibleCropBox(
        box,
        0,
        margins,
      ),
    ).toEqual({
      x: 50,
      y: 50,
      width: 540,
      height: 760,
    });
  });

  it("maps visible margins correctly for a 90 degree rotated page", () => {
    expect(
      calculateVisibleCropBox(
        box,
        90,
        margins,
      ),
    ).toEqual({
      x: 20,
      y: 60,
      width: 560,
      height: 740,
    });
  });

  it("maps visible margins correctly for a 180 degree rotated page", () => {
    expect(
      calculateVisibleCropBox(
        box,
        180,
        margins,
      ),
    ).toEqual({
      x: 30,
      y: 30,
      width: 540,
      height: 760,
    });
  });

  it("maps visible margins correctly for a 270 degree rotated page", () => {
    expect(
      calculateVisibleCropBox(
        box,
        270,
        margins,
      ),
    ).toEqual({
      x: 40,
      y: 40,
      width: 560,
      height: 740,
    });
  });

  it("preserves CropBox offsets", () => {
    const result =
      calculateVisibleCropBox(
        {
          x: 25,
          y: 35,
          width: 500,
          height: 700,
        },
        0,
        {
          top: 5,
          right: 6,
          bottom: 7,
          left: 8,
        },
      );

    expect(result.x).toBe(33);
    expect(result.y).toBe(42);
  });

  it("rejects margins that leave too little visible page area", () => {
    expect(() =>
      calculateVisibleCropBox(
        {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        0,
        {
          top: 40,
          right: 40,
          bottom: 40,
          left: 40,
        },
        36,
      ),
    ).toThrow(
      "too little visible page area",
    );
  });
});
