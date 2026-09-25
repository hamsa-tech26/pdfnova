import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PdfWord,
} from "../../model/types";

import type {
  LogicalCell,
  LogicalRow,
  LogicalTable,
} from "../../model/logicalTable";

import {
  repairLogicalTableV1,
} from "../cellRepairEngine";

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
      name: "test",
      size: 10,
    },
    rotation: 0,
    extractionProvenance: {
      source: "native-pdf",
      confidence: 1,
    },
  };
}

function createCell(
  rowIndex: number,
  columnIndex: number,
  words: PdfWord[],
): LogicalCell {
  if (words.length === 0) {
    return {
      id:
        `cell-${rowIndex}-${columnIndex}`,
      rowIndex,
      columnIndex,
      text: "",
      words: [],
      bounds: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      confidence: 0,
    };
  }

  const minX =
    Math.min(
      ...words.map(
        (word) => word.bounds.x,
      ),
    );

  const minY =
    Math.min(
      ...words.map(
        (word) => word.bounds.y,
      ),
    );

  const maxX =
    Math.max(
      ...words.map(
        (word) =>
          word.bounds.x +
          word.bounds.width,
      ),
    );

  const maxY =
    Math.max(
      ...words.map(
        (word) =>
          word.bounds.y +
          word.bounds.height,
      ),
    );

  return {
    id:
      `cell-${rowIndex}-${columnIndex}`,
    rowIndex,
    columnIndex,
    text:
      words
        .sort(
          (first, second) =>
            second.bounds.y -
              first.bounds.y ||
            first.bounds.x -
              second.bounds.x,
        )
        .map(
          (word) => word.text,
        )
        .join(" "),
    words,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    confidence: 1,
  };
}

function createRow(
  rowIndex: number,
  cells: LogicalCell[],
): LogicalRow {
  return {
    id: `row-${rowIndex}`,
    rowIndex,
    cells,
    confidence: 1,
  };
}

describe(
  "repairLogicalTableV1",
  () => {
    it(
      "does not move a valid wrapped cell fragment into an empty cell in the next numbered row",
      () => {
        const header =
          createRow(
            0,
            [
              createCell(
                0,
                0,
                [
                  createWord(
                    "h-serial",
                    "Sl No",
                    50,
                    130,
                  ),
                ],
              ),
              createCell(
                0,
                1,
                [
                  createWord(
                    "h-gp",
                    "GP / VC",
                    300,
                    130,
                    60,
                  ),
                ],
              ),
              createCell(
                0,
                2,
                [
                  createWord(
                    "h-status",
                    "Status",
                    500,
                    130,
                  ),
                ],
              ),
            ],
          );

        const sourceRow =
          createRow(
            1,
            [
              createCell(
                1,
                0,
                [
                  createWord(
                    "r4-serial",
                    "4",
                    50,
                    100,
                    8,
                  ),
                ],
              ),
              createCell(
                1,
                1,
                [
                  createWord(
                    "r4-gp-line-1",
                    "Kacharicherra",
                    300,
                    100,
                    75,
                  ),
                  createWord(
                    "r4-gp-line-2a",
                    "Village",
                    300,
                    85,
                    40,
                  ),
                  createWord(
                    "r4-gp-line-2b",
                    "Council",
                    345,
                    85,
                    40,
                  ),
                ],
              ),
              createCell(
                1,
                2,
                [
                  createWord(
                    "r4-status-1",
                    "Currently",
                    500,
                    100,
                  ),
                  createWord(
                    "r4-status-2",
                    "fully",
                    545,
                    100,
                  ),
                  createWord(
                    "r4-status-3",
                    "functional",
                    580,
                    100,
                  ),
                  createWord(
                    "r4-status-4",
                    "water",
                    635,
                    100,
                  ),
                  createWord(
                    "r4-status-5",
                    "supply",
                    680,
                    100,
                  ),
                ],
              ),
            ],
          );

        const nextRow =
          createRow(
            2,
            [
              createCell(
                2,
                0,
                [
                  createWord(
                    "r5-serial",
                    "5",
                    50,
                    60,
                    8,
                  ),
                ],
              ),
              createCell(
                2,
                1,
                [],
              ),
              createCell(
                2,
                2,
                [
                  createWord(
                    "r5-status-1",
                    "Currently",
                    500,
                    60,
                  ),
                  createWord(
                    "r5-status-2",
                    "fully",
                    545,
                    60,
                  ),
                  createWord(
                    "r5-status-3",
                    "functional",
                    580,
                    60,
                  ),
                  createWord(
                    "r5-status-4",
                    "water",
                    635,
                    60,
                  ),
                  createWord(
                    "r5-status-5",
                    "supply",
                    680,
                    60,
                  ),
                ],
              ),
            ],
          );

        const table:
          LogicalTable = {
            id: "wrapped-table",
            pageNumber: 1,
            rows: [
              header,
              sourceRow,
              nextRow,
            ],
            columnCount: 3,
            bounds: {
              x: 40,
              y: 50,
              width: 700,
              height: 100,
            },
            confidence: 1,
          };

        const result =
          repairLogicalTableV1(
            table,
          );

        expect(
          result.actions,
        ).toHaveLength(0);

        expect(
          result.table.rows[1]
            .cells[1].text,
        ).toBe(
          "Kacharicherra Village Council",
        );

        expect(
          result.table.rows[2]
            .cells[1].text,
        ).toBe("");
      },
    );
    it(
      "moves a wrapped fragment when it is physically close to the next numbered row",
      () => {
        const header =
          createRow(
            0,
            [
              createCell(
                0,
                0,
                [
                  createWord(
                    "h-serial",
                    "Sl No",
                    50,
                    130,
                  ),
                ],
              ),
              createCell(
                0,
                1,
                [
                  createWord(
                    "h-gp",
                    "GP / VC",
                    300,
                    130,
                    60,
                  ),
                ],
              ),
            ],
          );

        const sourceRow =
          createRow(
            1,
            [
              createCell(
                1,
                0,
                [
                  createWord(
                    "r4-serial",
                    "4",
                    50,
                    100,
                    8,
                  ),
                ],
              ),
              createCell(
                1,
                1,
                [
                  createWord(
                    "r4-gp-line-1",
                    "Kacharicherra",
                    300,
                    100,
                    75,
                  ),
                  createWord(
                    "r4-gp-line-2a",
                    "Village",
                    300,
                    70,
                    40,
                  ),
                  createWord(
                    "r4-gp-line-2b",
                    "Council",
                    345,
                    70,
                    40,
                  ),
                ],
              ),
            ],
          );

        const nextRow =
          createRow(
            2,
            [
              createCell(
                2,
                0,
                [
                  createWord(
                    "r5-serial",
                    "5",
                    50,
                    60,
                    8,
                  ),
                ],
              ),
              createCell(
                2,
                1,
                [],
              ),
            ],
          );

        const table:
          LogicalTable = {
            id: "close-fragment-table",
            pageNumber: 1,
            rows: [
              header,
              sourceRow,
              nextRow,
            ],
            columnCount: 2,
            bounds: {
              x: 40,
              y: 50,
              width: 400,
              height: 100,
            },
            confidence: 1,
          };

        const result =
          repairLogicalTableV1(
            table,
          );

        expect(
          result.actions,
        ).toHaveLength(1);

        expect(
          result.actions[0].type,
        ).toBe(
          "move-to-next-row",
        );

        expect(
          result.actions[0].text,
        ).toBe(
          "Village Council",
        );

        expect(
          result.table.rows[1]
            .cells[1].text,
        ).toBe(
          "Kacharicherra",
        );

        expect(
          result.table.rows[2]
            .cells[1].text,
        ).toBe(
          "Village Council",
        );
      },
    );
    it(
      "does not move a valid short cell from the final column just because there is no right-hand neighbour",
      () => {
        const header =
          createRow(
            0,
            [
              createCell(
                0,
                0,
                [
                  createWord(
                    "h-serial",
                    "Sl No",
                    50,
                    130,
                  ),
                ],
              ),
              createCell(
                0,
                1,
                [
                  createWord(
                    "h-remarks",
                    "Remarks",
                    300,
                    130,
                  ),
                ],
              ),
            ],
          );

        const previousRow =
          createRow(
            1,
            [
              createCell(
                1,
                0,
                [
                  createWord(
                    "r5-serial",
                    "5",
                    50,
                    100,
                    8,
                  ),
                ],
              ),
              createCell(
                1,
                1,
                [],
              ),
            ],
          );

        const sourceRow =
          createRow(
            2,
            [
              createCell(
                2,
                0,
                [
                  createWord(
                    "r6-serial",
                    "6",
                    50,
                    90,
                    8,
                  ),
                ],
              ),
              createCell(
                2,
                1,
                [
                  createWord(
                    "r6-tanker",
                    "Tanker used",
                    300,
                    90,
                    80,
                  ),
                ],
              ),
            ],
          );

        const nextRow =
          createRow(
            3,
            [
              createCell(
                3,
                0,
                [
                  createWord(
                    "r7-serial",
                    "7",
                    50,
                    80,
                    8,
                  ),
                ],
              ),
              createCell(
                3,
                1,
                [
                  createWord(
                    "r7-remarks",
                    "Pipe damage",
                    300,
                    80,
                    80,
                  ),
                ],
              ),
            ],
          );

        const table:
          LogicalTable = {
            id: "final-column-valid-cell-table",
            pageNumber: 1,
            rows: [
              header,
              previousRow,
              sourceRow,
              nextRow,
            ],
            columnCount: 2,
            bounds: {
              x: 40,
              y: 70,
              width: 400,
              height: 80,
            },
            confidence: 1,
          };

        const result =
          repairLogicalTableV1(
            table,
          );

        expect(
          result.actions,
        ).toHaveLength(0);

        expect(
          result.table.rows[2]
            .cells[1].text,
        ).toBe(
          "Tanker used",
        );

        expect(
          result.table.rows[1]
            .cells[1].text,
        ).toBe(
          "",
        );
      },
    );

  },
);
