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
  "starts a new OCR row when punctuation is attached to the serial number",
  () => {
    const firstRow =
      createLine(
        "ocr-row-7",
        680,
        [
          createWord(
            "row-7-serial",
            "7",
            50,
            680,
            8,
          ),
          createWord(
            "row-7-name",
            "Gouranga Para Scheme",
            100,
            680,
            120,
          ),
          createWord(
            "row-7-gp",
            "West Damcherra",
            300,
            680,
            90,
          ),
          createWord(
            "row-7-status",
            "Repair",
            400,
            680,
            50,
          ),
          createWord(
            "row-7-remarks",
            "Pipe damage",
            500,
            680,
            70,
          ),
        ],
      );

    const secondRow =
      createLine(
        "ocr-row-8",
        660,
        [
          createWord(
            "row-8-serial",
            "'8",
            50,
            660,
            10,
          ),
          createWord(
            "row-8-name",
            "Halam Para Scheme",
            100,
            660,
            110,
          ),
          createWord(
            "row-8-gp",
            "Damcherra",
            300,
            660,
            70,
          ),
          createWord(
            "row-8-status",
            "Functional",
            400,
            660,
            65,
          ),
          createWord(
            "row-8-remarks",
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
          "ocr-attached-serial-noise",
        type: "paragraph",
        pageNumber: 1,
        bounds: {
          x: 50,
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
            "'8",
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
it(
  "does not merge a short OCR artifact line into a complete row before the next sequential serial",
  () => {
    const rowFive =
      createLine(
        "artifact-mixed-row-5",
        680,
        [
          createWord(
            "artifact-mixed-row-5-serial",
            "5",
            50,
            680,
            8,
          ),
          createWord(
            "artifact-mixed-row-5-name",
            "Kamalacherri Scheme",
            100,
            680,
            120,
          ),
          createWord(
            "artifact-mixed-row-5-gp",
            "Thumsarai",
            300,
            680,
            70,
          ),
          createWord(
            "artifact-mixed-row-5-status",
            "Functional",
            400,
            680,
            70,
          ),
          createWord(
            "artifact-mixed-row-5-remarks",
            "Normal",
            500,
            680,
            55,
          ),
        ],
      );

    const artifactLine =
      createLine(
        "artifact-mixed-noise",
        660,
        [
          createWord(
            "artifact-mixed-pipe",
            "|",
            50,
            660,
            5,
          ),
          createWord(
            "artifact-mixed-rm",
            "rm",
            400,
            660,
            18,
          ),
          createWord(
            "artifact-mixed-jum",
            "Jum",
            500,
            660,
            25,
          ),
        ],
      );

    const rowSix =
      createLine(
        "artifact-mixed-row-6",
        640,
        [
          createWord(
            "artifact-mixed-row-6-serial",
            "6",
            50,
            640,
            8,
          ),
          createWord(
            "artifact-mixed-row-6-name",
            "Purnaram Para Scheme",
            100,
            640,
            120,
          ),
          createWord(
            "artifact-mixed-row-6-gp",
            "Thumsarai",
            300,
            640,
            70,
          ),
          createWord(
            "artifact-mixed-row-6-status",
            "Low source",
            400,
            640,
            70,
          ),
          createWord(
            "artifact-mixed-row-6-remarks",
            "Tanker",
            500,
            640,
            55,
          ),
        ],
      );

    const block: PdfParagraphBlock = {
      id: "mixed-ocr-artifact",
      type: "paragraph",
      pageNumber: 1,
      bounds: {
        x: 40,
        y: 640,
        width: 520,
        height: 60,
      },
      lines: [
        rowFive,
        artifactLine,
        rowSix,
      ],
      text: [
        rowFive.text,
        artifactLine.text,
        rowSix.text,
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

    const extractedWords =
      result.rows.flatMap(
        (row) =>
          row.words.map(
            (word) =>
              word.text,
          ),
      );

    expect(
      extractedWords,
    ).not.toEqual(
      expect.arrayContaining([
        "|",
        "rm",
        "Jum",
      ]),
    );
  },
);
it(
  "does not merge a distant trailing OCR footer into the final serial row",
  () => {
    const finalRow =
      createLine(
        "row-9",
        300,
        [
          createWord(
            "row-9-serial",
            "9",
            50,
            300,
            8,
          ),
          createWord(
            "row-9-name",
            "Serechandra Para",
            100,
            300,
            100,
          ),
          createWord(
            "row-9-gp",
            "Thumsarai",
            300,
            300,
            70,
          ),
          createWord(
            "row-9-status",
            "Low pressure",
            400,
            300,
            80,
          ),
          createWord(
            "row-9-remarks",
            "Tail end",
            500,
            300,
            60,
          ),
        ],
      );

    const footerLine =
      createLine(
        "ocr-footer",
        230,
        [
          createWord(
            "footer-1",
            "CONTROLLED",
            100,
            230,
            80,
          ),
          createWord(
            "footer-2",
            "TEST",
            190,
            230,
            40,
          ),
          createWord(
            "footer-3",
            "FIXTURE",
            240,
            230,
            60,
          ),
        ],
      );

    const block:
      PdfParagraphBlock = {
        id:
          "ocr-trailing-footer",
        type: "paragraph",
        pageNumber: 1,
        bounds: {
          x: 50,
          y: 230,
          width: 520,
          height: 80,
        },
        lines: [
          finalRow,
          footerLine,
        ],
        text: [
          finalRow.text,
          footerLine.text,
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
    ).toHaveLength(1);

    expect(
      result.rows[0]
        ?.words.some(
          (word) =>
            word.text ===
            "CONTROLLED",
        ),
    ).toBe(false);
  },
);
    it(
      "starts a new row when OCR loses the serial but the remaining columns are strongly populated",
      () => {
        const rowThree =
          createLine(
            "row-3",
            600,
            [
              createWord(
                "row-3-serial",
                "3",
                50,
                600,
                8,
              ),
              createWord(
                "row-3-name",
                "Jalidhan Para Scheme",
                100,
                600,
                120,
              ),
              createWord(
                "row-3-gp",
                "Uttamjoy VC",
                300,
                600,
                80,
              ),
              createWord(
                "row-3-status",
                "Functional",
                400,
                600,
                70,
              ),
              createWord(
                "row-3-remarks",
                "Normal",
                500,
                600,
                55,
              ),
            ],
          );

        const rowFourWithoutSerial =
          createLine(
            "row-4-no-serial",
            575,
            [
              createWord(
                "row-4-name",
                "Nilbusan Para Scheme",
                100,
                575,
                120,
              ),
              createWord(
                "row-4-gp",
                "Kacharicherra",
                300,
                575,
                80,
              ),
              createWord(
                "row-4-status",
                "Repair",
                400,
                575,
                55,
              ),
              createWord(
                "row-4-remarks",
                "Motor fault",
                500,
                575,
                70,
              ),
            ],
          );

                const rowFive =
          createLine(
            "row-5",
            550,
            [
              createWord(
                "row-5-serial",
                "5",
                50,
                550,
                8,
              ),
              createWord(
                "row-5-name",
                "Kamalacherri Scheme",
                100,
                550,
                120,
              ),
              createWord(
                "row-5-gp",
                "Thumsarai",
                300,
                550,
                70,
              ),
              createWord(
                "row-5-status",
                "Functional",
                400,
                550,
                70,
              ),
              createWord(
                "row-5-remarks",
                "Normal",
                500,
                550,
                55,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
          id:
            "missing-serial-new-row",
          type: "paragraph",
          pageNumber: 1,
          bounds: {
            x: 50,
            y: 575,
            width: 520,
            height: 40,
          },
          lines: [
  rowThree,
  rowFourWithoutSerial,
  rowFive,
],
          text: [
  rowThree.text,
  rowFourWithoutSerial.text,
  rowFive.text,
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
).toHaveLength(3);

        expect(
          result.rows[1]
            ?.words.some(
              (word) =>
                word.text ===
                "Nilbusan Para Scheme",
            ),
        ).toBe(true);
      },
    );
        it(
      "starts a new row when the missing serial cell contains only OCR punctuation",
      () => {
        const rowThree =
          createLine(
            "noisy-row-3",
            600,
            [
              createWord(
                "noisy-row-3-serial",
                "3",
                50,
                600,
                8,
              ),
              createWord(
                "noisy-row-3-name",
                "Jalidhan Para Scheme",
                100,
                600,
                120,
              ),
              createWord(
                "noisy-row-3-gp",
                "Uttamjoy VC",
                300,
                600,
                80,
              ),
              createWord(
                "noisy-row-3-status",
                "Functional",
                400,
                600,
                70,
              ),
              createWord(
                "noisy-row-3-remarks",
                "Normal",
                500,
                600,
                55,
              ),
            ],
          );

        const rowFour =
          createLine(
            "noisy-row-4",
            575,
            [
              createWord(
                "noisy-row-4-artifact",
                "|",
                50,
                575,
                5,
              ),
              createWord(
                "noisy-row-4-name",
                "Nilbusan Para Scheme",
                100,
                575,
                120,
              ),
              createWord(
                "noisy-row-4-gp",
                "Kacharicherra",
                300,
                575,
                80,
              ),
              createWord(
                "noisy-row-4-status",
                "Repair",
                400,
                575,
                55,
              ),
              createWord(
                "noisy-row-4-remarks",
                "Motor fault",
                500,
                575,
                70,
              ),
            ],
          );

        const rowFive =
          createLine(
            "noisy-row-5",
            550,
            [
              createWord(
                "noisy-row-5-serial",
                "5",
                50,
                550,
                8,
              ),
              createWord(
                "noisy-row-5-name",
                "Kamalacherri Scheme",
                100,
                550,
                120,
              ),
              createWord(
                "noisy-row-5-gp",
                "Thumsarai",
                300,
                550,
                70,
              ),
              createWord(
                "noisy-row-5-status",
                "Functional",
                400,
                550,
                70,
              ),
              createWord(
                "noisy-row-5-remarks",
                "Normal",
                500,
                550,
                55,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
          id:
            "missing-serial-punctuation",
          type: "paragraph",
          pageNumber: 1,
          bounds: {
            x: 45,
            y: 550,
            width: 530,
            height: 70,
          },
          lines: [
            rowThree,
            rowFour,
            rowFive,
          ],
          text: [
            rowThree.text,
            rowFour.text,
            rowFive.text,
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
        ).toHaveLength(3);

        expect(
          result.rows[1]
            ?.words.some(
              (word) =>
                word.text ===
                "Nilbusan Para Scheme",
            ),
        ).toBe(true);
      },
    );
        it(
      "keeps a split missing-serial OCR row together as a new logical row",
      () => {
        const rowThree =
          createLine(
            "split-row-3",
            600,
            [
              createWord(
                "split-row-3-serial",
                "3",
                50,
                600,
                8,
              ),
              createWord(
                "split-row-3-name",
                "Jalidhan Para Scheme",
                100,
                600,
                120,
              ),
              createWord(
                "split-row-3-gp",
                "Uttamjoy VC",
                300,
                600,
                80,
              ),
              createWord(
                "split-row-3-status",
                "Functional",
                400,
                600,
                70,
              ),
              createWord(
                "split-row-3-remarks",
                "Normal",
                500,
                600,
                55,
              ),
            ],
          );

        const rowFourLeading =
          createLine(
            "split-row-4-leading",
            575,
            [
              createWord(
                "split-row-4-artifact",
                "|",
                50,
                575,
                5,
              ),
              createWord(
                "split-row-4-name",
                "Nilbusan Para Scheme",
                100,
                575,
                120,
              ),
            ],
          );

        const rowFourTrailing =
          createLine(
            "split-row-4-trailing",
            565,
            [
              createWord(
                "split-row-4-gp",
                "Kacharicherra",
                300,
                565,
                80,
              ),
              createWord(
                "split-row-4-status",
                "Repair",
                400,
                565,
                55,
              ),
              createWord(
                "split-row-4-remarks",
                "Motor fault",
                500,
                565,
                70,
              ),
            ],
          );

        const rowFive =
          createLine(
            "split-row-5",
            540,
            [
              createWord(
                "split-row-5-serial",
                "5",
                50,
                540,
                8,
              ),
              createWord(
                "split-row-5-name",
                "Kamalacherri Scheme",
                100,
                540,
                120,
              ),
              createWord(
                "split-row-5-gp",
                "Thumsarai",
                300,
                540,
                70,
              ),
              createWord(
                "split-row-5-status",
                "Functional",
                400,
                540,
                70,
              ),
              createWord(
                "split-row-5-remarks",
                "Normal",
                500,
                540,
                55,
              ),
            ],
          );

        const block:
          PdfParagraphBlock = {
          id:
            "split-missing-serial-row",
          type: "paragraph",
          pageNumber: 1,
          bounds: {
            x: 45,
            y: 540,
            width: 530,
            height: 80,
          },
          lines: [
            rowThree,
            rowFourLeading,
            rowFourTrailing,
            rowFive,
          ],
          text: [
            rowThree.text,
            rowFourLeading.text,
            rowFourTrailing.text,
            rowFive.text,
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
        ).toHaveLength(3);

        expect(
          result.rows[1]
            ?.words.map(
              (word) =>
                word.text,
            ),
        ).toEqual(
          expect.arrayContaining([
            "Nilbusan Para Scheme",
            "Kacharicherra",
            "Repair",
            "Motor fault",
          ]),
        );
      },
    );
        it(
      "starts a new logical row when a missing-serial OCR row is split across two complementary lines",
      () => {
        const rowThree =
          createLine(
            "two-part-row-3",
            600,
            [
              createWord(
                "two-part-row-3-serial",
                "3",
                50,
                600,
                8,
              ),
              createWord(
                "two-part-row-3-name",
                "Jalidhan Para Scheme",
                100,
                600,
                120,
              ),
              createWord(
                "two-part-row-3-gp",
                "Uttamjoy VC",
                300,
                600,
                80,
              ),
              createWord(
                "two-part-row-3-status",
                "Functional",
                400,
                600,
                70,
              ),
              createWord(
                "two-part-row-3-remarks",
                "Normal",
                500,
                600,
                55,
              ),
            ],
          );

        const rowFourPartOne =
          createLine(
            "two-part-row-4-a",
            575,
            [
              createWord(
                "two-part-row-4-name",
                "Nilbusan Para Scheme",
                100,
                575,
                120,
              ),
              createWord(
                "two-part-row-4-remarks",
                "Motor fault",
                500,
                575,
                70,
              ),
            ],
          );

        const rowFourPartTwo =
          createLine(
            "two-part-row-4-b",
            565,
            [
              createWord(
                "two-part-row-4-gp",
                "Kacharicherra",
                300,
                565,
                80,
              ),
              createWord(
                "two-part-row-4-status",
                "Repair",
                400,
                565,
                55,
              ),
            ],
          );

        const rowFive =
          createLine(
            "two-part-row-5",
            540,
            [
              createWord(
                "two-part-row-5-serial",
                "5",
                50,
                540,
                8,
              ),
              createWord(
                "two-part-row-5-name",
                "Kamalacherri Scheme",
                100,
                540,
                120,
              ),
              createWord(
                "two-part-row-5-gp",
                "Thumsarai",
                300,
                540,
                70,
              ),
              createWord(
                "two-part-row-5-status",
                "Functional",
                400,
                540,
                70,
              ),
              createWord(
                "two-part-row-5-remarks",
                "Normal",
                500,
                540,
                55,
              ),
            ],
          );

                const interveningArtifact = createLine(
          "two-part-row-4-artifact",
          555,
          [
            createWord(
              "two-part-row-4-artifact-word",
              "|",
              50,
              555,
              5,
            ),
          ],
        );

        const block: PdfParagraphBlock = {
          id: "two-part-missing-serial-row",
          type: "paragraph",
          pageNumber: 1,
          bounds: {
            x: 45,
            y: 540,
            width: 530,
            height: 80,
          },
          lines: [
            rowThree,
            rowFourPartOne,
            rowFourPartTwo,
            interveningArtifact,
            rowFive,
          ],
          text: [
            rowThree.text,
            rowFourPartOne.text,
            rowFourPartTwo.text,
            interveningArtifact.text,
            rowFive.text,
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
        ).toHaveLength(3);

        expect(
          result.rows[1]
            ?.words.map(
              (word) =>
                word.text,
            ),
        ).toEqual(
          expect.arrayContaining([
            "Nilbusan Para Scheme",
            "Kacharicherra",
            "Repair",
            "Motor fault",
          ]),
        );
                expect(
          result.rows.map((row) =>
            row.lines.map((line) => line.id),
          ),
        ).toEqual([
          [rowThree.id],
          [
            rowFourPartOne.id,
            rowFourPartTwo.id,
          ],
          [rowFive.id],
        ]);

        expect(
          result.rows.map((row) =>
            row.words.map((word) => word.id),
          ),
        ).toEqual([
          rowThree.words.map((word) => word.id),
          [
            ...rowFourPartOne.words,
            ...rowFourPartTwo.words,
          ].map((word) => word.id),
          rowFive.words.map((word) => word.id),
        ]);
      },
    );
  },
);
