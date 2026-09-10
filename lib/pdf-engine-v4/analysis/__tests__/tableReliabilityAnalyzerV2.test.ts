import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  LogicalCell,
  LogicalRow,
  LogicalTable,
} from "../../model/logicalTable";

import type {
  RowReliabilityResult,
} from "../rowReliabilityAnalyzer";

import {
  analyzeTableReliabilityV2,
} from "../tableReliabilityAnalyzerV2";

function createCell(
  rowIndex: number,
  columnIndex: number,
  text: string,
): LogicalCell {
  return {
    id:
      `cell-${rowIndex}-${columnIndex}`,
    rowIndex,
    columnIndex,
    text,
    words: [],
    bounds: {
      x: columnIndex * 100,
      y: rowIndex * 20,
      width: 90,
      height: 18,
    },
    confidence: 0.95,
  };
}

function createRow(
  rowIndex: number,
  values: string[],
): LogicalRow {
  return {
    id: `row-${rowIndex}`,
    rowIndex,
    cells:
      values.map(
        (value, columnIndex) =>
          createCell(
            rowIndex,
            columnIndex,
            value,
          ),
      ),
    confidence: 0.95,
  };
}

function createTable(
  rows: LogicalRow[],
  confidence = 0.95,
): LogicalTable {
  return {
    id: "table-1",
    pageNumber: 1,
    rows,
    columnCount:
      Math.max(
        0,
        ...rows.map(
          (row) =>
            row.cells.length,
        ),
      ),
    bounds: {
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    },
    confidence,
  };
}

function createRowReliability(
  rows: LogicalRow[],
  options?: {
    confidence?: number;
    analysisMode?:
      | "serial"
      | "structural";
    sequenceConfidence?: number;
    serialColumnIndex?:
      number | null;
  },
): RowReliabilityResult {
  const confidence =
    options?.confidence ?? 0.95;

  return {
    rows:
      rows.map(
        (row) => ({
          rowIndex:
            row.rowIndex,

          serialNumber:
            options?.analysisMode ===
            "serial"
              ? row.rowIndex + 1
              : null,

          score: confidence,

          status:
            confidence >= 0.75
              ? "reliable"
              : "needs-review",

          reasons: [],
        }),
      ),

    reliableRowCount:
      confidence >= 0.75
        ? rows.length
        : 0,

    reviewRowCount:
      confidence >= 0.75
        ? 0
        : rows.length,

    confidence,

    analysisMode:
      options?.analysisMode ??
      "structural",

    serialColumnDiagnostics: {
      detectedColumnIndex:
        options?.serialColumnIndex ??
        null,

      sequenceConfidence:
        options?.sequenceConfidence ??
        0,

      candidates: [],
    },
  };
}

describe(
  "analyzeTableReliabilityV2",
  () => {
    it(
      "classifies a strong serial table as high reliability",
      () => {
        const rows = [
          createRow(
            0,
            ["1", "Item A", "10"],
          ),
          createRow(
            1,
            ["2", "Item B", "20"],
          ),
          createRow(
            2,
            ["3", "Item C", "30"],
          ),
        ];

        const table =
          createTable(rows);

        const rowReliability =
          createRowReliability(
            rows,
            {
              analysisMode:
                "serial",
              serialColumnIndex: 0,
              sequenceConfidence:
                1,
            },
          );

        const result =
          analyzeTableReliabilityV2(
            table,
            rowReliability,
          );

        expect(
          result.level,
        ).toBe("high");

        expect(
          result.score,
        ).toBeGreaterThanOrEqual(
          0.85,
        );
      },
    );

    it(
      "does not penalize a stable structural table for having no serial column",
      () => {
        const rows = [
          createRow(
            0,
            ["Alpha", "Ready", ""],
          ),
          createRow(
            1,
            ["Beta", "Ready", ""],
          ),
          createRow(
            2,
            [
              "Gamma",
              "Ready",
              "Optional note",
            ],
          ),
        ];

        const table =
          createTable(rows);

        const rowReliability =
          createRowReliability(
            rows,
            {
              analysisMode:
                "structural",
            },
          );

        const result =
          analyzeTableReliabilityV2(
            table,
            rowReliability,
          );

        expect(
          result.level,
        ).toBe("high");

        expect(
          result.structuralConsistencyScore,
        ).toBe(1);
      },
    );

    it(
  "ignores a sparse optional column when evaluating row shape",
  () => {
    const rows = [
      createRow(
        0,
        [
          "Alpha",
          "Ready",
          "",
        ],
      ),
      createRow(
        1,
        [
          "Beta",
          "Ready",
          "",
        ],
      ),
      createRow(
        2,
        [
          "Gamma",
          "Ready",
          "",
        ],
      ),
      createRow(
        3,
        [
          "Delta",
          "Ready",
          "Optional note",
        ],
      ),
    ];

    const table =
      createTable(rows);

    const rowReliability =
      createRowReliability(
        rows,
        {
          analysisMode:
            "structural",
        },
      );

    const result =
      analyzeTableReliabilityV2(
        table,
        rowReliability,
      );

    expect(
      result.level,
    ).toBe("high");

    expect(
      result.columnConsistencyScore,
    ).toBe(1);

    expect(
      result.rowShapeConsistencyScore,
    ).toBe(1);
  },
);

    it(
      "classifies a structurally weak table as low reliability",
      () => {
        const rows = [
          createRow(
            0,
            ["1", "Item A", "10"],
          ),
          createRow(
            1,
            ["2", "", ""],
          ),
          createRow(
            2,
            ["5", "", ""],
          ),
        ];

        const table =
          createTable(
            rows,
            0.4,
          );

        const rowReliability =
          createRowReliability(
            rows,
            {
              confidence: 0.4,
              analysisMode:
                "serial",
              serialColumnIndex: 0,
              sequenceConfidence:
                0.2,
            },
          );

        const result =
          analyzeTableReliabilityV2(
            table,
            rowReliability,
          );

        expect(
          result.level,
        ).toBe("low");

        expect(
          result.reasons.some(
            (reason) =>
              reason.code ===
              "low-row-reliability",
          ),
        ).toBe(true);

        expect(
          result.reasons.some(
            (reason) =>
              reason.code ===
              "serial-sequence-instability",
          ),
        ).toBe(true);
      },
    );

    it(
      "downgrades a high-scoring table to review when one row needs review",
      () => {
        const rows = [
          createRow(
            0,
            ["1", "Item A", "10"],
          ),
          createRow(
            1,
            ["2", "Item B", "20"],
          ),
          createRow(
            2,
            ["3", "G/Day)", "30"],
          ),
        ];

        const table =
          createTable(
            rows,
            0.99,
          );

        const rowReliability =
          createRowReliability(
            rows,
            {
              confidence: 0.93,
              analysisMode:
                "serial",
              serialColumnIndex: 0,
              sequenceConfidence:
                1,
            },
          );

        rowReliability.rows[2] = {
          ...rowReliability.rows[2],
          score: 0.64,
          status: "needs-review",
        };

        rowReliability.reliableRowCount =
          2;

        rowReliability.reviewRowCount =
          1;

        const result =
          analyzeTableReliabilityV2(
            table,
            rowReliability,
          );

        expect(
          result.level,
        ).toBe("review");

        expect(
          result.score,
        ).toBeGreaterThanOrEqual(
          0.85,
        );

        expect(
          result.reasons.some(
            (reason) =>
              reason.code ===
              "row-review-required",
          ),
        ).toBe(true);
      },
    );
  },
);