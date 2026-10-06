import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateHeaderFooterPlacement,
  getVisibleHeaderFooterPageSize,
  renderHeaderFooterTemplate,
} from "../headerFooterGeometry";

describe("headerFooterGeometry", () => {
  it("renders page and total tokens", () => {
    expect(
      renderHeaderFooterTemplate(
        "Page {page} of {total}",
        3,
        10,
      ),
    ).toBe("Page 3 of 10");
  });

  it("keeps ordinary text unchanged", () => {
    expect(
      renderHeaderFooterTemplate(
        "Confidential",
        1,
        4,
      ),
    ).toBe("Confidential");
  });

  it("swaps visible dimensions for a 90 degree page rotation", () => {
    expect(
      getVisibleHeaderFooterPageSize(
        600,
        800,
        90,
      ),
    ).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("centers a footer on an unrotated page", () => {
    const placement =
      calculateHeaderFooterPlacement({
        pageWidth: 600,
        pageHeight: 800,
        rotationAngle: 0,
        textWidth: 100,
        fontSize: 12,
        margin: 36,
        alignment: "center",
        slot: "footer",
      });

    expect(placement.x).toBeCloseTo(
      250,
      6,
    );
    expect(placement.y).toBeCloseTo(
      36,
      6,
    );
    expect(placement.rotation).toBe(0);
  });

  it("maps a visible left footer through a 90 degree rotation", () => {
    const placement =
      calculateHeaderFooterPlacement({
        pageWidth: 600,
        pageHeight: 800,
        rotationAngle: 90,
        textWidth: 100,
        fontSize: 12,
        margin: 36,
        alignment: "left",
        slot: "footer",
      });

    expect(placement.x).toBeCloseTo(
      564,
      6,
    );
    expect(placement.y).toBeCloseTo(
      36,
      6,
    );
    expect(placement.rotation).toBe(90);
  });

  it("maps a right header through a 270 degree rotation", () => {
    const placement =
      calculateHeaderFooterPlacement({
        pageWidth: 600,
        pageHeight: 800,
        rotationAngle: 270,
        textWidth: 100,
        fontSize: 12,
        margin: 36,
        alignment: "right",
        slot: "header",
      });

    expect(
      placement.rotation,
    ).toBe(270);
    expect(
      placement.visibleWidth,
    ).toBe(800);
    expect(
      placement.visibleHeight,
    ).toBe(600);
  });
});
