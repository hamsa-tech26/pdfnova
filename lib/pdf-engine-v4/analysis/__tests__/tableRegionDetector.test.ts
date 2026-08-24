import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectTableRegionsForPage,
} from "../tableRegionDetector";

import type {
  PdfLine,
  PdfVisualBlock,
  PdfWord,
} from "../../model/types";

function createWord(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
): PdfWord {
  return {
    id,
    text,
    pageNumber: 1,
    bounds: {
      x,
      y,
      width,
      height: 12,
    },
    font: {
      size: 10,
    },
    rotation: 0,
  };
}

function createLine(
  index: number,
  text: string,
): PdfLine {
  const y =
    700 - index * 18;

  const word =
    createWord(
      `word-${index}`,
      text,
      50,
      y,
      490,
    );

  return {
    id: `line-${index}`,
    pageNumber: 1,
    words: [word],
    bounds: {
      x: 50,
      y,
      width: 490,
      height: 12,
    },
    text,
  };
}

function createParagraph(
  texts: string[],
): PdfVisualBlock {
  const lines =
    texts.map(
      (text, index) =>
        createLine(
          index,
          text,
        ),
    );

  return {
    id: "paragraph-1",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 50,
      y: 640,
      width: 492,
      height: 80,
    },
    lines,
    text: texts.join(" "),
    confidence: 1,
  };
}

describe(
  "Table Region Detector V2",
  () => {
    it(
      "does not treat a long Name of work paragraph as a table candidate",
      () => {
        const block =
          createParagraph([
            "Name of work: FDR retrofitting of different water supply scheme during the year 2024-25",
            "Deployment of vehicle for supply drinking water in different habitation within the jurisdiction",
            "of DWS Sub-Division Damcherra under the concerned work group",
          ]);

        const result =
          detectTableRegionsForPage([
            block,
          ]);

        expect(
          result.tableRegions.length,
        ).toBe(0);

        expect(
          result.regions[0]
            .analysis.breakdown.header
            .score,
        ).toBe(0);
      },
    );

    it(
      "still recognizes compact table header text as header evidence",
      () => {
        const block =
          createParagraph([
            "Sl No",
            "Name of Habitation",
            "Remarks",
          ]);

        const result =
          detectTableRegionsForPage([
            block,
          ]);

        expect(
          result.regions[0]
            .analysis.breakdown.header
            .score,
        ).toBeGreaterThan(0);
      },
    );
  },
);