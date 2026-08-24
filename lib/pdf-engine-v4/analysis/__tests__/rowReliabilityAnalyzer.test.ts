import {
  describe,
  expect,
  it,
} from "vitest";

import {
  analyzeRowReliabilityV1,
} from "../rowReliabilityAnalyzer";

import type {
  LogicalCell,
  LogicalRow,
  LogicalTable,
} from "../../model/logicalTable";

import type {
  PdfWord,
} from "../../model/types";

function createWord(
  id: string,
  text: string,
): PdfWord {
  return {
    id,
    text,
    pageNumber: 1,
    bounds: {
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    },
    font: {
      name: "test-font",
      size: 10,
      bold: false,
      italic: false,
    },
    rotation: 0,
  };
}

function createCell(
  rowIndex: number,
  columnIndex: number,
  text: string,
  words: PdfWord[] = [],
): LogicalCell {
  return {
    id:
      `cell-${rowIndex}-${columnIndex}`,
    rowIndex,
    columnIndex,
    text,
    words,
    bounds: {
      x: columnIndex * 100,
      y: rowIndex * 20,
      width: 80,
      height: 15,
    },
    confidence: 1,
  };
}

function createRow(
  rowIndex: number,
  values: string[],
): LogicalRow {
  return {
    id: `row-${rowIndex}`,
    rowIndex,
    cells: values.map(
      (value, columnIndex) =>
        createCell(
          rowIndex,
          columnIndex,
          value,
        ),
    ),
    confidence: 1,
  };
}

function createTable(
  rows: string[][],
): LogicalTable {
  return {
    id: "test-table",
    pageNumber: 1,
    rows: rows.map(
      (values, rowIndex) =>
        createRow(
          rowIndex,
          values,
        ),
    ),
    columnCount:
      rows[0]?.length ?? 0,
    bounds: {
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    },
    confidence: 1,
  };
}

describe(
  "Row Reliability V2",
  () => {
    it(
      "uses serial mode for a normal sequential table",
      () => {
        const table =
          createTable([
            ["1", "Alpha", "Functional"],
            ["2", "Beta", "Functional"],
            ["3", "Gamma", "Functional"],
            ["4", "Delta", "Functional"],
          ]);

        const result =
          analyzeRowReliabilityV1(
            table,
          );

        expect(
          result.analysisMode,
        ).toBe("serial");

        expect(
          result
            .serialColumnDiagnostics
            .detectedColumnIndex,
        ).toBe(0);

        expect(
          result
            .serialColumnDiagnostics
            .sequenceConfidence,
        ).toBe(1);

        expect(
          result.rows,
        ).toHaveLength(4);
      },
    );
        it(
      "detects serial numbers prefixed to cell text",
      () => {
        const table =
          createTable([
            [
              "20 Ramting Lal Tripura",
              "Male",
              "7928380",
            ],
            [
              "21 SUSEN TRIPURA",
              "Male",
              "8124502",
            ],
            [
              "22 UBAJAY REANG",
              "Male",
              "8124502",
            ],
            [
              "23 Vanzoichim Tripura",
              "Female",
              "7928380",
            ],
          ]);

        const result =
          analyzeRowReliabilityV1(
            table,
          );

        expect(
          result.analysisMode,
        ).toBe("serial");

        expect(
          result
            .serialColumnDiagnostics
            .detectedColumnIndex,
        ).toBe(0);

        expect(
          result
            .serialColumnDiagnostics
            .sequenceConfidence,
        ).toBe(1);

        expect(
          result.rows,
        ).toHaveLength(4);

        expect(
          result.rows.map(
            (row) =>
              row.serialNumber,
          ),
        ).toEqual([
          20,
          21,
          22,
          23,
        ]);
      },
    );
        it(
      "uses structural mode for a non-serial table",
      () => {
        const table =
          createTable([
            [
              "Parameter",
              "Value",
              "Status",
            ],
            [
              "Population",
              "384 persons",
              "Verified",
            ],
            [
              "Water Requirement",
              "45 KLD",
              "Available",
            ],
            [
              "Source",
              "Hill stream",
              "Available",
            ],
            [
              "Pumping System",
              "Electric pump",
              "Functional",
            ],
            [
              "Distribution",
              "PVC pipeline",
              "Functional",
            ],
            [
              "Storage",
              "CWR 10,000 gallon",
              "Available",
            ],
            [
              "Water Quality",
              "Tested regularly",
              "Acceptable",
            ],
            [
              "Remarks",
              "Supply monitored daily",
              "Normal",
            ],
          ]);

        const result =
          analyzeRowReliabilityV1(
            table,
          );

        expect(
          result.analysisMode,
        ).toBe("structural");

        expect(
          result
            .serialColumnDiagnostics
            .detectedColumnIndex,
        ).toBeNull();

        expect(
          result.rows,
        ).toHaveLength(8);

        expect(
          result.reliableRowCount,
        ).toBe(8);

        expect(
          result.reviewRowCount,
        ).toBe(0);
      },
    );
        it(
      "does not mistake ordinary numeric values for a serial column",
      () => {
        const table =
          createTable([
            [
              "Parameter",
              "Value",
              "Status",
            ],
            [
              "Population",
              "384",
              "Verified",
            ],
            [
              "Water Requirement",
              "45",
              "Available",
            ],
            [
              "Storage",
              "10000",
              "Available",
            ],
            [
              "Pump Capacity",
              "2500",
              "Functional",
            ],
          ]);

        const result =
          analyzeRowReliabilityV1(
            table,
          );

        expect(
          result.analysisMode,
        ).toBe("structural");

        expect(
          result
            .serialColumnDiagnostics
            .detectedColumnIndex,
        ).toBeNull();

        expect(
          result.rows,
        ).toHaveLength(4);
      },
    );

    it(
      "records source fragment count for unusually short content",
      () => {
        const table =
          createTable([
            [
              "1",
              "Inno Scheme with masonry well Alpha",
              "Habitation A",
            ],
            [
              "2",
              "Inno Scheme with masonry well Beta",
              "Habitation B",
            ],
            [
              "3",
              "Inno Scheme with masonry well Gamma",
              "Habitation C",
            ],
            [
              "4",
              "G/Day)",
              "Nutan Para",
            ],
          ]);

        table.rows[3].cells[1].words = [
          createWord(
            "nutan-source-1",
            "G/Day)",
          ),
        ];

        const result =
          analyzeRowReliabilityV1(
            table,
          );

        const reason =
          result.rows[3].reasons.find(
            (item) =>
              item.code ===
              "unusually-short-content" &&
              item.columnIndex === 1,
          );

        expect(reason).toBeDefined();

        expect(
          reason?.sourceFragmentCount,
        ).toBe(1);
      },
    );

  },
);