import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PdfLine,
  PdfVisualBlock,
  PdfWord,
} from "../../model/types";

import {
  detectStableColumnsV4,
} from "../stableColumnDetector";

function createWord(
  id: string,
  text: string,
  x: number,
  y: number,
  width = 40,
): PdfWord {
  return {
    id,
    text,
    pageNumber: 1,
    bounds: {
      x,
      y,
      width,
      height: 10,
    },
    font: {
      size: 10,
    },
    rotation: 0,
  };
}

function createLine(
  index: number,
  entries: Array<{
    text: string;
    x: number;
    width?: number;
  }>,
): PdfLine {
  const y =
    700 - index * 18;

  const words =
    entries.map(
      (entry, wordIndex) =>
        createWord(
          `word-${index}-${wordIndex}`,
          entry.text,
          entry.x,
          y,
          entry.width ?? 40,
        ),
    );

  const left =
    Math.min(
      ...words.map(
        (word) => word.bounds.x,
      ),
    );

  const right =
    Math.max(
      ...words.map(
        (word) =>
          word.bounds.x +
          word.bounds.width,
      ),
    );

  return {
    id: `line-${index}`,
    pageNumber: 1,
    words,
    bounds: {
      x: left,
      y,
      width: right - left,
      height: 10,
    },
    text:
      words
        .map(
          (word) => word.text,
        )
        .join(" "),
  };
}

function createSparseTrailingColumnBlock():
  PdfVisualBlock {
  const lines: PdfLine[] = [];

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    const entries = [
      {
        text:
          index === 0
            ? "Scheme"
            : `Scheme${index}`,
        x: 50,
        width: 60,
      },
      {
        text:
          index === 0
            ? "GP/VC"
            : `VC${index}`,
        x: 200,
        width: 50,
      },
      {
        text:
          index === 0
            ? "Capacity"
            : "30000",
        x: 330,
        width: 55,
      },
    ];

    if (index === 0) {
      entries.push({
        text: "Remarks",
        x: 470,
        width: 55,
      });
    }

    lines.push(
      createLine(
        index,
        entries,
      ),
    );
  }

  return {
    id: "sparse-table",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 40,
      y: 520,
      width: 500,
      height: 190,
    },
    lines,
    text:
      lines
        .map(
          (line) => line.text,
        )
        .join(" "),
    confidence: 1,
  };
}
function createSparseInternalColumnBlock():
  PdfVisualBlock {
  const lines: PdfLine[] = [];

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    const entries = [
      {
        text:
          index === 0
            ? "Scheme"
            : `Scheme${index}`,
        x: 50,
        width: 60,
      },
      {
        text:
          index === 0
            ? "Capacity"
            : "30000",
        x: 330,
        width: 55,
      },
      {
        text:
          index === 0
            ? "Remarks"
            : "Functional",
        x: 470,
        width: 70,
      },
    ];

    if (index === 0) {
      entries.splice(
        1,
        0,
        {
          text: "GP/VC",
          x: 200,
          width: 50,
        },
      );
    }

    lines.push(
      createLine(
        index,
        entries,
      ),
    );
  }

  return {
    id: "sparse-internal-table",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 40,
      y: 520,
      width: 520,
      height: 190,
    },
    lines,
    text:
      lines
        .map(
          (line) => line.text,
        )
        .join(" "),
    confidence: 1,
  };
}
describe(
  "Stable Column Detector V4",
  () => {
    it(
      "recovers a sparse trailing column supported by the header",
      () => {
        const result =
          detectStableColumnsV4(
            createSparseTrailingColumnBlock(),
          );

        expect(
          result.columns,
        ).toHaveLength(4);

        const trailingColumn =
          result.columns[
            result.columns.length - 1
          ];

        expect(
          trailingColumn.x,
        ).toBeCloseTo(
          470,
          0,
        );

        expect(
          trailingColumn.reason,
        ).toContain(
          "Recovered as a sparse trailing column",
        );
      },
    );
    it(
      "preserves a sparse internal column supported by the header",
      () => {
        const result =
          detectStableColumnsV4(
            createSparseInternalColumnBlock(),
          );

        expect(
          result.columns,
        ).toHaveLength(4);

        expect(
          result.columns.some(
            (column) =>
              Math.abs(
                column.x - 200,
              ) <= 1,
          ),
        ).toBe(true);
      },
    );
  },
);