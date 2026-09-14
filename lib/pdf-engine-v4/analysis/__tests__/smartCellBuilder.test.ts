import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PdfLine,
  PdfWord,
} from "../../model/types";

import type {
  LogicalRowCandidate,
} from "../adaptiveRowDetector";

import {
  buildSmartTableV4,
} from "../smartCellBuilder";

import type {
  ColumnCandidate,
} from "../stableColumnDetector";

function createWord(
  id: string,
  text: string,
  x: number,
  y: number,
  width = 30,
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

function createRow(
  id: string,
  index: number,
  y: number,
  words: PdfWord[],
): LogicalRowCandidate {
  const line: PdfLine = {
    id: `${id}-line`,
    pageNumber: 1,
    words,
    bounds: {
      x: Math.min(
        ...words.map(
          (word) => word.bounds.x,
        ),
      ),
      y,
      width: 520,
      height: 10,
    },
    text:
      words
        .map(
          (word) => word.text,
        )
        .join(" "),
  };

  return {
    id,
    index,
    lines: [line],
    words,
    startY: y,
    endY: y,
    isNewRecord:
      index > 0,
    score:
      index > 0 ? 60 : 0,
    confidence: 1,
    breakdown: {
      serialNumber:
        index > 0 ? 40 : 0,
      verticalGap: 0,
      leftAlignment: 0,
      emptyLeadingColumns: 0,
      wrappedText: 0,
    },
    reason:
      index > 0
        ? "Started a new logical row."
        : "Header row.",
  };
}

function createColumn(
  id: string,
  x: number,
  leftBoundary: number,
  rightBoundary: number,
): ColumnCandidate {
  return {
    id,
    x,
    minX: x,
    maxX: x,
    leftBoundary,
    rightBoundary,
    occurrences: 6,
    distinctLineCount: 6,
    averageDeviation: 0,
    stability: 1,
    confidence: 1,
    accepted: true,
    reason: "test",
  };
}

describe(
  "buildSmartTableV4",
  () => {
    it(
      "keeps OCR words in the intended wide text column",
      () => {
        const columns:
          ColumnCandidate[] = [
            createColumn(
              "column-1",
              50,
              40,
              75,
            ),
            createColumn(
              "column-2",
              100,
              75,
              200,
            ),
            createColumn(
              "column-3",
              300,
              200,
              350,
            ),
            createColumn(
              "column-4",
              400,
              350,
              450,
            ),
            createColumn(
              "column-5",
              500,
              450,
              570,
            ),
          ];

        const header =
          createRow(
            "header",
            0,
            700,
            [
              createWord(
                "h1",
                "Sl No",
                50,
                700,
              ),
              createWord(
                "h2",
                "Name of Scheme",
                100,
                700,
                90,
              ),
              createWord(
                "h3",
                "GP / VC",
                300,
                700,
                50,
              ),
              createWord(
                "h4",
                "Capacity",
                400,
                700,
                55,
              ),
              createWord(
                "h5",
                "Status",
                500,
                700,
                45,
              ),
            ],
          );

        const dataRow =
          createRow(
            "row-1",
            1,
            650,
            [
              createWord(
                "r1-serial",
                "1",
                50,
                650,
                8,
              ),
              createWord(
                "r1-name-1",
                "Rani",
                100,
                650,
                25,
              ),
              createWord(
                "r1-name-2",
                "Para",
                130,
                650,
                25,
              ),
              createWord(
                "r1-name-3",
                "Innovative",
                160,
                650,
                45,
              ),
              createWord(
                "r1-name-4",
                "Scheme",
                215,
                650,
                45,
              ),
              createWord(
                "r1-gp-1",
                "Damcherra",
                300,
                650,
                50,
              ),
              createWord(
                "r1-gp-2",
                "RF",
                355,
                650,
                15,
              ),
              createWord(
                "r1-gp-3",
                "VC",
                375,
                650,
                15,
              ),
              createWord(
                "r1-capacity",
                "30,000 G/day",
                407,
                650,
                70,
              ),
              createWord(
                "r1-repair",
                "Repair",
                485,
                650,
                31,
              ),
              createWord(
                "r1-ongoing",
                "ongoing",
                520,
                650,
                39,
              ),
            ],
          );

        const result =
          buildSmartTableV4(
            1,
            [
              header,
              dataRow,
            ],
            columns,
          );

        expect(
          result.table,
        ).not.toBeNull();

        const row =
          result.table!.rows[1];

        expect(
          row.cells[0].text,
        ).toBe("1");

        expect(
          row.cells[1].text,
        ).toBe(
          "Rani Para Innovative Scheme",
        );

        expect(
          row.cells[2].text,
        ).toBe(
          "Damcherra RF VC",
        );

        expect(
          row.cells[3].text,
        ).toBe(
          "30,000 G/day",
        );

        expect(
          row.cells[4].text,
        ).toBe(
          "Repair ongoing",
        );
      },
    );
    it(
      "joins wrapped physical lines into the correct logical cells",
      () => {
        const columns:
          ColumnCandidate[] = [
            createColumn(
              "column-1",
              50,
              40,
              75,
            ),
            createColumn(
              "column-2",
              100,
              75,
              200,
            ),
            createColumn(
              "column-3",
              300,
              200,
              350,
            ),
            createColumn(
              "column-4",
              400,
              350,
              450,
            ),
            createColumn(
              "column-5",
              500,
              450,
              570,
            ),
          ];

        const header =
          createRow(
            "header",
            0,
            700,
            [
              createWord(
                "h1",
                "Sl No",
                50,
                700,
              ),
              createWord(
                "h2",
                "Name of Scheme",
                100,
                700,
                90,
              ),
              createWord(
                "h3",
                "GP / VC",
                300,
                700,
                50,
              ),
              createWord(
                "h4",
                "Capacity",
                400,
                700,
                55,
              ),
              createWord(
                "h5",
                "Status",
                500,
                700,
                45,
              ),
            ],
          );

        const firstLineWords = [
          createWord(
            "r1-serial",
            "1",
            50,
            650,
            8,
          ),
          createWord(
            "r1-name-1",
            "Rani",
            100,
            650,
            25,
          ),
          createWord(
            "r1-name-2",
            "Para",
            130,
            650,
            25,
          ),
          createWord(
            "r1-name-3",
            "Innovative",
            160,
            650,
            35,
          ),
          createWord(
            "r1-gp",
            "Damcherra",
            300,
            650,
            45,
          ),
          createWord(
            "r1-capacity",
            "30,000 G/day",
            400,
            650,
            70,
          ),
          createWord(
            "r1-status",
            "Functional",
            500,
            650,
            60,
          ),
        ];

        const dataRow =
          createRow(
            "row-1",
            1,
            650,
            firstLineWords,
          );

        const wrappedWords = [
          createWord(
            "r1-wrapped-name-1",
            "Scheme",
            100,
            635,
            40,
          ),
          createWord(
            "r1-wrapped-name-2",
            "Extension",
            145,
            635,
            45,
          ),
          createWord(
            "r1-wrapped-gp-1",
            "North",
            300,
            635,
            30,
          ),
          createWord(
            "r1-wrapped-gp-2",
            "Zone",
            335,
            635,
            15,
          ),
        ];

        const wrappedLine:
          PdfLine = {
            id: "row-1-wrapped-line",
            pageNumber: 1,
            words: wrappedWords,
            bounds: {
              x: 100,
              y: 635,
              width: 250,
              height: 10,
            },
            text:
              wrappedWords
                .map(
                  (word) =>
                    word.text,
                )
                .join(" "),
          };

        const multilineRow:
          LogicalRowCandidate = {
            ...dataRow,
            lines: [
              dataRow.lines[0],
              wrappedLine,
            ],
            words: [
              ...dataRow.words,
              ...wrappedWords,
            ],
            endY: 635,
          };

        const result =
          buildSmartTableV4(
            1,
            [
              header,
              multilineRow,
            ],
            columns,
          );

        expect(
          result.table,
        ).not.toBeNull();

        const row =
          result.table!.rows[1];

        expect(
          row.cells[0].text,
        ).toBe("1");

        expect(
          row.cells[1].text,
        ).toBe(
          "Rani Para Innovative Scheme Extension",
        );

        expect(
          row.cells[2].text,
        ).toBe(
          "Damcherra North Zone",
        );

        expect(
          row.cells[3].text,
        ).toBe(
          "30,000 G/day",
        );

        expect(
          row.cells[4].text,
        ).toBe(
          "Functional",
        );
      },
    );
  },
);
