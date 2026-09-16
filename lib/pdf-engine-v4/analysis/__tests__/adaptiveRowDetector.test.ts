import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PdfLine,
  PdfParagraphBlock,
  PdfWord,
} from "../../model/types";

import {
  detectAdaptiveRowsV4,
} from "../adaptiveRowDetector";

import type {
  ColumnCandidate,
} from "../stableColumnDetector";

function createWord(
  id: string,
  text: string,
  x: number,
  y: number,
  width = 20,
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
      name: "ocr-tesseract",
      size: 10,
    },
    rotation: 0,
    extractionProvenance: {
      source: "ocr-tesseract",
      confidence: 90,
    },
  };
}

function createLine(
  id: string,
  y: number,
  words: PdfWord[],
): PdfLine {
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
    id,
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

const columns: ColumnCandidate[] = [
  {
    id: "column-1",
    x: 50,
    minX: 45,
    maxX: 55,
    leftBoundary: 35,
    rightBoundary: 75,
    occurrences: 3,
    distinctLineCount: 3,
    averageDeviation: 1,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  },
  {
    id: "column-2",
    x: 100,
    minX: 95,
    maxX: 105,
    leftBoundary: 75,
    rightBoundary: 250,
    occurrences: 3,
    distinctLineCount: 3,
    averageDeviation: 1,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  },
  {
    id: "column-3",
    x: 300,
    minX: 295,
    maxX: 305,
    leftBoundary: 250,
    rightBoundary: 375,
    occurrences: 3,
    distinctLineCount: 3,
    averageDeviation: 1,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  },
  {
    id: "column-4",
    x: 400,
    minX: 395,
    maxX: 405,
    leftBoundary: 375,
    rightBoundary: 475,
    occurrences: 3,
    distinctLineCount: 3,
    averageDeviation: 1,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  },
  {
    id: "column-5",
    x: 500,
    minX: 495,
    maxX: 505,
    leftBoundary: 475,
    rightBoundary: 575,
    occurrences: 3,
    distinctLineCount: 3,
    averageDeviation: 1,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  },
];

describe(
  "detectAdaptiveRowsV4",
  () => {
    it(
      "recovers an OCR-confused first serial when the next row starts with serial 2",
      () => {
        const headerLine =
          createLine(
            "header",
            700,
            [
              createWord(
                "header-serial",
                "Sl No",
                50,
                700,
                25,
              ),
              createWord(
                "header-name",
                "Name of Scheme",
                100,
                700,
                90,
              ),
              createWord(
                "header-gp",
                "GP / VC",
                300,
                700,
                50,
              ),
              createWord(
                "header-capacity",
                "Capacity",
                400,
                700,
                55,
              ),
              createWord(
                "header-status",
                "Status",
                500,
                700,
                45,
              ),
            ],
          );

        const firstRowContent =
          createLine(
            "row-1-content",
            680,
            [
              createWord(
                "row-1-name",
                "Rani Para",
                100,
                680,
                60,
              ),
              createWord(
                "row-1-gp",
                "Damcherra",
                300,
                680,
                60,
              ),
              createWord(
                "row-1-capacity",
                "30,000 G/day",
                400,
                680,
                75,
              ),
            ],
          );

        const confusedSerialLine =
          createLine(
            "row-1-serial",
            665,
            [
              createWord(
                "row-1-confused-serial",
                "il",
                50,
                665,
                8,
              ),
              createWord(
                "row-1-status",
                "Functional",
                500,
                665,
                65,
              ),
            ],
          );

        const secondRow =
          createLine(
            "row-2",
            620,
            [
              createWord(
                "row-2-serial",
                "2",
                50,
                620,
                8,
              ),
              createWord(
                "row-2-name",
                "Khahamthai Para",
                100,
                620,
                90,
              ),
              createWord(
                "row-2-gp",
                "West Damcherra",
                300,
                620,
                90,
              ),
              createWord(
                "row-2-capacity",
                "75,000 G/day",
                400,
                620,
                75,
              ),
              createWord(
                "row-2-status",
                "Functional",
                500,
                620,
                65,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
            id: "table-block",
            type: "paragraph",
            pageNumber: 1,
            bounds: {
              x: 40,
              y: 620,
              width: 540,
              height: 90,
            },
            lines: [
              headerLine,
              firstRowContent,
              confusedSerialLine,
              secondRow,
            ],
            text: [
              headerLine.text,
              firstRowContent.text,
              confusedSerialLine.text,
              secondRow.text,
            ].join("\n"),
            confidence: 1,
          };

        const result =
          detectAdaptiveRowsV4(
            block,
            columns,
          );

        expect(
          result.rows,
        ).toHaveLength(3);

        expect(
          result.rows[1].words.map(
            (word) => word.text,
          ),
        ).toContain("1");

        expect(
          result.rows[1].words.map(
            (word) => word.text,
          ),
        ).not.toContain("il");

        expect(
          result.rows[2].words[0]
            ?.text,
        ).toBe("2");
      },
    );
    it(
      "keeps wrapped physical lines inside the same logical row",
      () => {
        const headerLine =
          createLine(
            "header",
            700,
            [
              createWord(
                "header-serial",
                "Sl No",
                50,
                700,
                25,
              ),
              createWord(
                "header-name",
                "Name of Scheme",
                100,
                700,
                90,
              ),
              createWord(
                "header-gp",
                "GP / VC",
                300,
                700,
                50,
              ),
              createWord(
                "header-capacity",
                "Capacity",
                400,
                700,
                55,
              ),
              createWord(
                "header-status",
                "Status",
                500,
                700,
                45,
              ),
            ],
          );

        const firstRowLine =
          createLine(
            "row-1",
            680,
            [
              createWord(
                "row-1-serial",
                "1",
                50,
                680,
                8,
              ),
              createWord(
                "row-1-name",
                "Rani Para Innovative",
                100,
                680,
                120,
              ),
              createWord(
                "row-1-gp",
                "Damcherra RF VC",
                300,
                680,
                90,
              ),
              createWord(
                "row-1-capacity",
                "30,000 G/day",
                400,
                680,
                75,
              ),
              createWord(
                "row-1-status",
                "Functional",
                500,
                680,
                65,
              ),
            ],
          );

        const wrappedLine =
          createLine(
            "row-1-wrapped",
            665,
            [
              createWord(
                "row-1-wrapped-name",
                "Scheme Extension",
                100,
                665,
                100,
              ),
              createWord(
                "row-1-wrapped-gp",
                "North Zone",
                300,
                665,
                70,
              ),
            ],
          );

        const secondRowLine =
          createLine(
            "row-2",
            620,
            [
              createWord(
                "row-2-serial",
                "2",
                50,
                620,
                8,
              ),
              createWord(
                "row-2-name",
                "Khahamthai Para",
                100,
                620,
                90,
              ),
              createWord(
                "row-2-gp",
                "West Damcherra",
                300,
                620,
                90,
              ),
              createWord(
                "row-2-capacity",
                "75,000 G/day",
                400,
                620,
                75,
              ),
              createWord(
                "row-2-status",
                "Functional",
                500,
                620,
                65,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
            id: "wrapped-table-block",
            type: "paragraph",
            pageNumber: 1,
            bounds: {
              x: 40,
              y: 620,
              width: 540,
              height: 90,
            },
            lines: [
              headerLine,
              firstRowLine,
              wrappedLine,
              secondRowLine,
            ],
            text: [
              headerLine.text,
              firstRowLine.text,
              wrappedLine.text,
              secondRowLine.text,
            ].join("\n"),
            confidence: 1,
          };

        const result =
          detectAdaptiveRowsV4(
            block,
            columns,
          );

        expect(
          result.rows,
        ).toHaveLength(3);

        expect(
          result.rows[1].lines,
        ).toHaveLength(2);

        expect(
          result.rows[1].words.map(
            (word) => word.text,
          ),
        ).toContain(
          "Scheme Extension",
        );

        expect(
          result.rows[2].words[0]
            ?.text,
        ).toBe("2");
      },
    );
    it(
      "starts a new OCR row when punctuation appears before a valid serial number",
      () => {
        const firstRow =
          createLine(
            "ocr-row-1",
            680,
            [
              createWord(
                "row-1-serial",
                "1",
                50,
                680,
                8,
              ),
              createWord(
                "row-1-name",
                "Rani Para",
                100,
                680,
                80,
              ),
              createWord(
                "row-1-gp",
                "Damcherra",
                300,
                680,
                70,
              ),
              createWord(
                "row-1-status",
                "Functional",
                400,
                680,
                65,
              ),
              createWord(
                "row-1-remarks",
                "Normal",
                500,
                680,
                50,
              ),
            ],
          );

const secondRow =
  createLine(
    "ocr-row-2",
    660,
    [
      createWord(
        "row-2-noise-1",
        "|",
        35,
        660,
        3,
      ),
      createWord(
        "row-2-noise-2",
        "a",
        40,
        660,
        3,
      ),
      createWord(
        "row-2-noise-3",
        "|",
        45,
        660,
        3,
      ),
      createWord(
        "row-2-serial",
        "2",
        50,
        660,
        8,
      ),
              createWord(
                "row-2-name",
                "Khahamthai Para",
                100,
                660,
                90,
              ),
              createWord(
                "row-2-gp",
                "West Damcherra",
                300,
                660,
                90,
              ),
              createWord(
                "row-2-status",
                "Functional",
                400,
                660,
                65,
              ),
              createWord(
                "row-2-remarks",
                "Normal",
                500,
                660,
                50,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
            id:
              "ocr-leading-noise-rows",
            type: "paragraph",
            pageNumber: 1,
            bounds: {
              x: 35,
              y: 660,
              width: 520,
              height: 30,
            },
            lines: [
              firstRow,
              secondRow,
            ],
            text:
              [
                firstRow.text,
                secondRow.text,
              ].join(" "),
            confidence: 0.9,
          };

        const result =
          detectAdaptiveRowsV4(
            block,
            columns,
          );

        expect(
          result.rows,
        ).toHaveLength(2);

        expect(
          result.rows[1]
            ?.words.some(
              (word) =>
                word.text ===
                "2",
            ),
        ).toBe(true);
      },
    );
it(
  "does not create a logical row from an OCR punctuation-only artifact line",
  () => {
    const firstRow =
      createLine(
        "row-1",
        680,
        [
          createWord(
            "row-1-serial",
            "1",
            50,
            680,
            8,
          ),
          createWord(
            "row-1-name",
            "Rani Para",
            100,
            680,
            80,
          ),
          createWord(
            "row-1-status",
            "Functional",
            400,
            680,
            65,
          ),
        ],
      );

    const artifactLine =
      createLine(
        "ocr-artifact",
        640,
        [
          createWord(
            "ocr-artifact-word",
            "|",
            50,
            640,
            3,
          ),
        ],
      );

    const secondRow =
      createLine(
        "row-2",
        600,
        [
          createWord(
            "row-2-serial",
            "2",
            50,
            600,
            8,
          ),
          createWord(
            "row-2-name",
            "Khahamthai Para",
            100,
            600,
            90,
          ),
          createWord(
            "row-2-status",
            "Functional",
            400,
            600,
            65,
          ),
        ],
      );

    const block:
      PdfParagraphBlock = {
        id:
          "ocr-punctuation-artifact",
        type: "paragraph",
        pageNumber: 1,
        bounds: {
          x: 40,
          y: 600,
          width: 520,
          height: 90,
        },
        lines: [
          firstRow,
          artifactLine,
          secondRow,
        ],
        text: [
          firstRow.text,
          artifactLine.text,
          secondRow.text,
        ].join(" "),
        confidence: 0.9,
      };

    const result =
      detectAdaptiveRowsV4(
        block,
        columns,
      );

    expect(
      result.rows,
    ).toHaveLength(2);

    expect(
      result.rows.some(
        (row) =>
          row.words.length === 1 &&
          row.words[0]?.text === "|",
      ),
    ).toBe(false);
  },
);
  },
);
