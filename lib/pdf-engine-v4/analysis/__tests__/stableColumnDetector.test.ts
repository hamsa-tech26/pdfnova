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

function createOcrLine(
  index: number,
  entries: Array<{
    text: string;
    x: number;
    width?: number;
  }>,
): PdfLine {
  const line =
    createLine(
      index,
      entries,
    );

  return {
    ...line,
    words:
      line.words.map(
        (word) => ({
          ...word,
          font: {
            ...word.font,
            name: "ocr-tesseract",
          },
          extractionProvenance: {
            source:
              "ocr-tesseract",
            confidence: 90,
          },
        }),
      ),
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

function createMultiLevelHeaderBlock():
  PdfVisualBlock {
  const lines: PdfLine[] = [
    createLine(
      0,
      [
        {
          text:
            "Water Supply Details",
          x: 238,
          width: 110,
        },
      ],
    ),
    createLine(
      1,
      [
        {
          text: "Sl No",
          x: 78,
          width: 30,
        },
        {
          text: "Name of Scheme",
          x: 118,
          width: 100,
        },
        {
          text: "Status",
          x: 360,
          width: 50,
        },
        {
          text: "Remarks",
          x: 438,
          width: 55,
        },
      ],
    ),
  ];

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    lines.push(
      createLine(
        index + 2,
        [
          {
            text: `${index + 1}`,
            x: 78,
            width: 6,
          },
          {
            text:
              `Scheme${index + 1}`,
            x: 118,
            width: 70,
          },
          {
            text: "Functional",
            x: 360,
            width: 55,
          },
          {
            text: "Normal supply",
            x: 438,
            width: 65,
          },
        ],
      ),
    );
  }

  return {
    id:
      "multi-level-header-table",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 60,
      y: 500,
      width: 460,
      height: 220,
    },
    lines,
    text:
      lines
        .map(
          (line) =>
            line.text,
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
    it(
      "does not recover a spanning multi-level title as an internal column",
      () => {
        const result =
          detectStableColumnsV4(
            createMultiLevelHeaderBlock(),
          );
        expect(
          result.columns,
        ).toHaveLength(4);

        expect(
          result.columns.some(
            (column) =>
              Math.abs(
                column.x - 238,
              ) <= 1,
          ),
        ).toBe(false);
      },
    );
    it(
      "merges split OCR serial alignments into one logical column",
      () => {
        const lines: PdfLine[] =
  [];

lines.push(
  createOcrLine(
    0,
    [
{
  text: "Sl",
  x: 34,
  width: 8,
},
{
  text: "No",
  x: 51,
  width: 10,
},
      {
        text: "Name",
        x: 78,
        width: 30,
      },
      {
        text: "GP/VC",
        x: 270,
        width: 30,
      },
      {
        text: "Status",
        x: 375,
        width: 35,
      },
      {
        text: "Remarks",
        x: 449,
        width: 40,
      },
    ],
  ),
);

for (
  let index = 1;
  index <= 9;
  index += 1
) {
  const serialX =
    [3, 5, 6, 7].includes(
      index,
    )
      ? 34
      : 51;

  const entries: Array<{
    text: string;
    x: number;
    width?: number;
  }> = [
    {
      text: String(index),
      x: serialX,
      width: 4,
    },
    {
      text:
        `Scheme${index}`,
      x: 78,
      width: 40,
    },
    {
      text:
        `VC${index}`,
      x: 270,
      width: 30,
    },
    {
      text: "Functional",
      x: 375,
      width: 45,
    },
    {
      text: "Normal",
      x: 449,
      width: 30,
    },
  ];

  lines.push(
    createOcrLine(
      index,
      entries,
    ),
  );
}

const block:
  PdfVisualBlock = {
    id:
      "ocr-leading-noise-table",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 30,
      y: 450,
      width: 500,
      height: 270,
    },
    lines,
    text:
      lines
        .map(
          (line) =>
            line.text,
        )
        .join(" "),
    confidence: 0.9,
  };

const result =
  detectStableColumnsV4(
    block,
  );

const acceptedXs =
  result.columns.map(
    (column) =>
      Math.round(
        column.x,
      ),
  );

expect(
  result.columns,
).toHaveLength(5);

expect(
  acceptedXs.some(
    (x) =>
      x >= 34 &&
      x <= 51,
  ),
).toBe(true);
      },
    );
  },
);
