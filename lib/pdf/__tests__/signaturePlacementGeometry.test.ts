import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateSignaturePdfPlacement,
  getVisibleSignatureBoxSize,
} from "../signaturePlacementGeometry";

describe("signaturePlacementGeometry", () => {
  it("swaps visible dimensions for 90 degree rotation", () => {
    expect(
      getVisibleSignatureBoxSize(
        {
          x: 0,
          y: 0,
          width: 600,
          height: 800,
        },
        90,
      ),
    ).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("maps an unrotated signature from preview top-left coordinates", () => {
    const placement =
      calculateSignaturePdfPlacement({
        cropBox: {
          x: 0,
          y: 0,
          width: 600,
          height: 800,
        },
        rotationAngle: 0,
        xRatio: 0.25,
        yRatio: 0.5,
        widthRatio: 0.25,
        signatureAspect: 3,
      });

    expect(placement.x).toBeCloseTo(
      150,
      6,
    );
    expect(placement.width).toBeCloseTo(
      150,
      6,
    );
    expect(placement.height).toBeCloseTo(
      50,
      6,
    );
    expect(placement.y).toBeCloseTo(
      350,
      6,
    );
    expect(placement.rotation).toBe(0);
  });

  it("maps a 90 degree visible placement back into page coordinates", () => {
    const placement =
      calculateSignaturePdfPlacement({
        cropBox: {
          x: 0,
          y: 0,
          width: 600,
          height: 800,
        },
        rotationAngle: 90,
        xRatio: 0.1,
        yRatio: 0.2,
        widthRatio: 0.25,
        signatureAspect: 4,
      });

    expect(placement.rotation).toBe(90);
    expect(placement.width).toBeCloseTo(
      200,
      6,
    );
    expect(placement.height).toBeCloseTo(
      50,
      6,
    );
    expect(placement.x).toBeCloseTo(
      170,
      6,
    );
    expect(placement.y).toBeCloseTo(
      80,
      6,
    );
  });

  it("accounts for CropBox offsets", () => {
    const placement =
      calculateSignaturePdfPlacement({
        cropBox: {
          x: 20,
          y: 30,
          width: 560,
          height: 740,
        },
        rotationAngle: 0,
        xRatio: 0,
        yRatio: 0,
        widthRatio: 0.2,
        signatureAspect: 2,
      });

    expect(placement.x).toBeCloseTo(
      20,
      6,
    );
    expect(placement.y).toBeCloseTo(
      714,
      6,
    );
  });

  it("clamps placement so the signature remains visible", () => {
    const placement =
      calculateSignaturePdfPlacement({
        cropBox: {
          x: 0,
          y: 0,
          width: 600,
          height: 800,
        },
        rotationAngle: 0,
        xRatio: 0.95,
        yRatio: 0.95,
        widthRatio: 0.3,
        signatureAspect: 3,
      });

    expect(placement.xRatio).toBeCloseTo(
      0.7,
      6,
    );
    expect(
      placement.yRatio +
        placement.heightRatio,
    ).toBeLessThanOrEqual(1);
  });
});
