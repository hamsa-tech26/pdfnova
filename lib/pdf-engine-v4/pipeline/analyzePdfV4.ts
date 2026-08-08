import type {
  PdfDocumentModel,
  TableRegionAnalysis,
} from "../model/types";
import type { LogicalTable } from "../model/logicalTable";
import {
  readPdfDocumentV4,
} from "../reader/pageReader";
import {
  detectVisualBlocks,
} from "../analysis/visualBlockDetector";
import {
  detectTableRegionsForPage,
} from "../analysis/tableRegionDetector";
import {
  detectStableColumnsV4,
  type StableColumnDetectionResult,
} from "../analysis/stableColumnDetector";
import {
  detectAdaptiveRowsV4,
  type AdaptiveRowDetectionResult,
} from "../analysis/adaptiveRowDetector";
import {
  buildSmartTableV4,
  type SmartCellBuilderResult,
} from "../analysis/smartCellBuilder";
import {
  repairLogicalTableV1,
  type CellRepairResult,
} from "../analysis/cellRepairEngine";

export type PdfV4TableAnalysis = {
  pageNumber: number;
  blockId: string;
  regionAnalysis: TableRegionAnalysis;
  columnDetection: StableColumnDetectionResult;
  rowDetection: AdaptiveRowDetectionResult;
  cellBuild: SmartCellBuilderResult;
  cellRepair: CellRepairResult | null;
  table: LogicalTable | null;
};

export type PdfV4ProcessingStatistics = {
  pageCount: number;
  wordCount: number;
  lineCount: number;
  blockCount: number;
  candidateTableRegionCount: number;
  confirmedTableRegionCount: number;
  logicalTableCount: number;
  detectedColumnCount: number;
  detectedRowCount: number;
  populatedCellCount: number;
};

export type PdfV4ProcessingTimes = {
  readingMs: number;
  visualBlockDetectionMs: number;
  tableAnalysisMs: number;
  totalMs: number;
};

export type PdfEngineV4Result = {
  document: PdfDocumentModel;
  tables: LogicalTable[];
  tableAnalyses: PdfV4TableAnalysis[];
  statistics: PdfV4ProcessingStatistics;
  processingTimes: PdfV4ProcessingTimes;
  confidence: number;
};
function getRowSerialNumber(
  row: LogicalTable["rows"][number],
) {
  const text =
    row.cells[0]?.text.trim() ?? "";

  const match =
    text.match(/^(\d+)[.)]?$/);

  if (!match) {
    return null;
  }

  const value =
    Number.parseInt(
      match[1],
      10,
    );

  return Number.isFinite(value)
    ? value
    : null;
}

function getFirstSerialRow(
  table: LogicalTable,
) {
  const limit =
    Math.min(
      table.rows.length,
      4,
    );

  for (
    let index = 0;
    index < limit;
    index += 1
  ) {
    const serialNumber =
      getRowSerialNumber(
        table.rows[index],
      );

    if (serialNumber !== null) {
      return {
        rowIndex: index,
        serialNumber,
      };
    }
  }

  return null;
}

function getLastSerialNumber(
  table: LogicalTable,
) {
  for (
    let index =
      table.rows.length - 1;
    index >= 0;
    index -= 1
  ) {
    const serialNumber =
      getRowSerialNumber(
        table.rows[index],
      );

    if (serialNumber !== null) {
      return serialNumber;
    }
  }

  return null;
}

function isLikelyHeaderRow(
  row: LogicalTable["rows"][number],
) {
  const text =
    row.cells
      .map((cell) =>
        cell.text.toLowerCase(),
      )
      .join(" ");

  const headerTerms = [
    "sl no",
    "serial",
    "name of",
    "status",
    "scheme",
    "remarks",
    "description",
    "quantity",
    "amount",
    "unit",
  ];

  const matches =
    headerTerms.filter((term) =>
      text.includes(term),
    ).length;

  return (
    text.includes("sl no") ||
    matches >= 2
  );
}

function getSharedColumnCount(
  previous:
    PdfV4TableAnalysis,
  current:
    PdfV4TableAnalysis,
) {
  const previousColumns =
    previous.columnDetection.columns;

  const currentColumns =
    current.columnDetection.columns;

  const tolerance =
    Math.max(
      previous.columnDetection
        .adaptiveTolerance * 2.5,
      current.columnDetection
        .adaptiveTolerance * 2.5,
      10,
    );

  const usedPreviousIndexes =
    new Set<number>();

  let sharedCount = 0;

  for (
    const currentColumn
    of currentColumns
  ) {
    let bestIndex = -1;
    let bestDistance =
      Number.POSITIVE_INFINITY;

    previousColumns.forEach(
      (
        previousColumn,
        index,
      ) => {
        if (
          usedPreviousIndexes.has(
            index,
          )
        ) {
          return;
        }

        const distance =
          Math.abs(
            currentColumn.x -
              previousColumn.x,
          );

        if (
          distance <
          bestDistance
        ) {
          bestDistance =
            distance;
          bestIndex = index;
        }
      },
    );

    if (
      bestIndex >= 0 &&
      bestDistance <= tolerance
    ) {
      usedPreviousIndexes.add(
        bestIndex,
      );

      sharedCount += 1;
    }
  }

  return sharedCount;
}

function reindexLogicalRows(
  rows: LogicalTable["rows"],
  startIndex: number,
) {
  return rows.map(
    (row, offset) => {
      const rowIndex =
        startIndex + offset;

      return {
        ...row,
        id:
          `logical-row-${rowIndex}`,
        rowIndex,
        cells:
          row.cells.map(
            (cell) => ({
              ...cell,
              id:
                `logical-cell-${rowIndex}-${cell.columnIndex}`,
              rowIndex,
            }),
          ),
      };
    },
  );
}

function mergeContinuedTablesV4(
  tableAnalyses:
    PdfV4TableAnalysis[],
) {
  const mergedTables:
    LogicalTable[] = [];

  let previousAnalysis:
    PdfV4TableAnalysis |
    null = null;

  for (
    const analysis
    of tableAnalyses
  ) {
    const currentTable =
      analysis.table;

    if (!currentTable) {
      continue;
    }

    const previousTable =
      mergedTables[
        mergedTables.length - 1
      ];

    const firstSerial =
      getFirstSerialRow(
        currentTable,
      );

    const previousLastSerial =
      previousTable
        ? getLastSerialNumber(
            previousTable,
          )
        : null;

    const sameColumnCount =
      Boolean(
        previousAnalysis &&
          previousAnalysis
            .columnDetection
            .columns.length ===
            analysis
              .columnDetection
              .columns.length,
      );

    const sharedColumns =
      previousAnalysis
        ? getSharedColumnCount(
            previousAnalysis,
            analysis,
          )
        : 0;

    const requiredSharedColumns =
      Math.max(
        3,
        analysis.columnDetection
          .columns.length - 1,
      );

    const leadingRowsAreHeaders =
      firstSerial
        ? currentTable.rows
            .slice(
              0,
              firstSerial.rowIndex,
            )
            .every(
              isLikelyHeaderRow,
            )
        : false;

    const isContinuation =
      Boolean(
        previousAnalysis &&
          previousTable &&
          previousAnalysis
            .pageNumber ===
            analysis.pageNumber - 1 &&
          sameColumnCount &&
          sharedColumns >=
            requiredSharedColumns &&
          firstSerial &&
          previousLastSerial !==
            null &&
          firstSerial.serialNumber ===
            previousLastSerial + 1 &&
          leadingRowsAreHeaders,
      );

    if (
      !isContinuation ||
      !previousTable ||
      !firstSerial
    ) {
      mergedTables.push({
        ...currentTable,
        rows:
          reindexLogicalRows(
            currentTable.rows,
            0,
          ),
      });

      previousAnalysis =
        analysis;

      continue;
    }

    const rowsToAppend =
      currentTable.rows.slice(
        firstSerial.rowIndex,
      );

    const reindexedRows =
      reindexLogicalRows(
        rowsToAppend,
        previousTable.rows.length,
      );

    const previousRowCount =
      previousTable.rows.length;

    const newRowCount =
      reindexedRows.length;

    const totalRowCount =
      previousRowCount +
      newRowCount;

    const mergedConfidence =
      totalRowCount === 0
        ? 0
        : (
            previousTable.confidence *
              previousRowCount +
            currentTable.confidence *
              newRowCount
          ) /
          totalRowCount;

    mergedTables[
      mergedTables.length - 1
    ] = {
      ...previousTable,
      rows: [
        ...previousTable.rows,
        ...reindexedRows,
      ],
      confidence:
        mergedConfidence,
    };

    previousAnalysis =
      analysis;
  }

  return mergedTables;
}

export type AnalyzePdfV4Options = {
  includePossibleTableRegions?: boolean;
};

function now() {
  return performance.now();
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function countPopulatedCells(
  tables: LogicalTable[],
) {
  return tables.reduce(
    (tableTotal, table) =>
      tableTotal +
      table.rows.reduce(
        (rowTotal, row) =>
          rowTotal +
          row.cells.filter(
            (cell) => cell.text.trim(),
          ).length,
        0,
      ),
    0,
  );
}

function createStatistics(
  document: PdfDocumentModel,
  tableAnalyses: PdfV4TableAnalysis[],
  tables: LogicalTable[],
  candidateTableRegionCount: number,
) {
  const wordCount =
    document.pages.reduce(
      (sum, page) =>
        sum + page.words.length,
      0,
    );

  const lineCount =
    document.pages.reduce(
      (sum, page) =>
        sum + page.lines.length,
      0,
    );

  const blockCount =
    document.pages.reduce(
      (sum, page) =>
        sum + page.blocks.length,
      0,
    );

  const detectedColumnCount =
    tableAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.columnDetection
          .columns.length,
      0,
    );

  const detectedRowCount =
    tableAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.rowDetection
          .rows.length,
      0,
    );

  return {
    pageCount:
      document.pages.length,
    wordCount,
    lineCount,
    blockCount,
    candidateTableRegionCount,
    confirmedTableRegionCount:
      tableAnalyses.length,
    logicalTableCount:
      tables.length,
    detectedColumnCount,
    detectedRowCount,
    populatedCellCount:
      countPopulatedCells(tables),
  };
}

function calculateEngineConfidence(
  document: PdfDocumentModel,
  analyses: PdfV4TableAnalysis[],
  tables: LogicalTable[],
) {
  const documentConfidence =
    document.confidence;

  if (analyses.length === 0) {
    return documentConfidence * 0.5;
  }

  const tableRegionConfidence =
    average(
      analyses.map(
        (analysis) =>
          analysis.regionAnalysis
            .confidence,
      ),
    );

  const columnConfidence =
    average(
      analyses.map(
        (analysis) =>
          analysis.columnDetection
            .confidence,
      ),
    );

  const rowConfidence =
    average(
      analyses.map(
        (analysis) =>
          analysis.rowDetection
            .confidence,
      ),
    );

  const tableConfidence =
    tables.length === 0
      ? 0
      : average(
          tables.map(
            (table) =>
              table.confidence,
          ),
        );

  return clamp(
    documentConfidence * 0.15 +
      tableRegionConfidence * 0.2 +
      columnConfidence * 0.25 +
      rowConfidence * 0.2 +
      tableConfidence * 0.2,
    0,
    1,
  );
}

export async function analyzePdfV4(
  file: File,
  options?: AnalyzePdfV4Options,
): Promise<PdfEngineV4Result> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF Engine V4 analysis must run inside the browser.",
    );
  }

  const totalStart = now();

  const readingStart = now();

  const rawDocument =
    await readPdfDocumentV4(file);

  const readingMs =
    now() - readingStart;

  const blockStart = now();

  const document =
    detectVisualBlocks(
      rawDocument,
    );

  const visualBlockDetectionMs =
    now() - blockStart;

  const tableStart = now();

  const tableAnalyses:
    PdfV4TableAnalysis[] = [];

  const tables: LogicalTable[] = [];

  let candidateTableRegionCount = 0;

  for (const page of document.pages) {
    const detection =
      detectTableRegionsForPage(
        page.blocks,
      );

    candidateTableRegionCount +=
      detection.tableRegions.length;

    for (const region of detection.tableRegions) {
      const shouldAnalyze =
        region.analysis.isTable ||
        options?.includePossibleTableRegions ===
          true;

      if (!shouldAnalyze) {
        continue;
      }

      let columnDetection =
  detectStableColumnsV4(
    region.block,
  );

const previousAnalysis =
  tableAnalyses[
    tableAnalyses.length - 1
  ];

if (
  previousAnalysis &&
  previousAnalysis.pageNumber ===
    page.pageNumber - 1 &&
  previousAnalysis.columnDetection
    .columns.length ===
    columnDetection.columns.length + 1
) {
  const previousColumns =
    previousAnalysis.columnDetection
      .columns;

  const currentColumns =
    columnDetection.columns;

  const recoveryTolerance =
    Math.max(
      columnDetection.adaptiveTolerance *
        2.5,
      10,
    );

  const sharedColumnCount =
    currentColumns.filter(
      (currentColumn) =>
        previousColumns.some(
          (previousColumn) =>
            Math.abs(
              currentColumn.x -
                previousColumn.x,
            ) <= recoveryTolerance,
        ),
    ).length;

  const recoveryCandidate =
    columnDetection.rejectedCandidates
      .filter(
        (candidate) =>
          candidate.confidence >= 0.7,
      )
      .filter((candidate) =>
        previousColumns.some(
          (previousColumn) =>
            Math.abs(
              candidate.x -
                previousColumn.x,
            ) <= recoveryTolerance,
        ),
      )
      .filter(
        (candidate) =>
          !currentColumns.some(
            (currentColumn) =>
              Math.abs(
                candidate.x -
                  currentColumn.x,
              ) <= recoveryTolerance,
          ),
      )
      .sort(
        (first, second) =>
          second.confidence -
          first.confidence,
      )[0];

  if (
    sharedColumnCount >= 3 &&
    recoveryCandidate
  ) {
    const recoveredColumns = [
      ...currentColumns,
      {
        ...recoveryCandidate,
        accepted: true,
        reason:
          "Recovered from a rejected candidate because the previous page supports the same logical column.",
      },
    ]
      .sort(
        (first, second) =>
          first.x - second.x,
      )
      .map(
        (
          column,
          index,
          columns,
        ) => ({
          ...column,
          id: `column-candidate-${index}`,
          leftBoundary:
            index === 0
              ? region.block.bounds.x
              : (
                    columns[index - 1].x +
                    column.x
                  ) / 2,
          rightBoundary:
            index ===
            columns.length - 1
              ? region.block.bounds.x +
                region.block.bounds.width
              : (
                    column.x +
                    columns[index + 1].x
                  ) / 2,
        }),
      );

    columnDetection = {
      ...columnDetection,
      columns: recoveredColumns,
      rejectedCandidates:
        columnDetection.rejectedCandidates.filter(
          (candidate) =>
            candidate.id !==
            recoveryCandidate.id,
        ),
    };
  }
}

if (
  columnDetection.columns.length <
  2
) {
  continue;
}

const rowDetection =
  detectAdaptiveRowsV4(
    region.block,
    columnDetection.columns,
  );

      if (
  rowDetection.rows.length === 0
) {
  continue;
}

      const cellBuild =
        buildSmartTableV4(
          page.pageNumber,
          rowDetection.rows,
          columnDetection.columns,
        );

      const cellRepair =
        cellBuild.table
          ? repairLogicalTableV1(
              cellBuild.table,
            )
          : null;

      const finalTable =
        cellRepair?.table ??
        cellBuild.table;

      const tableAnalysis:
        PdfV4TableAnalysis = {
          pageNumber:
            page.pageNumber,
          blockId:
            region.block.id,
          regionAnalysis:
            region.analysis,
          columnDetection,
          rowDetection,
          cellBuild,
          cellRepair,
          table:
            finalTable,
        };

      tableAnalyses.push(
        tableAnalysis,
      );

      if (finalTable) {
        tables.push(
          finalTable,
        );
      }
    }
  }

  const mergedTables =
  mergeContinuedTablesV4(
    tableAnalyses,
  );

  const tableAnalysisMs =
    now() - tableStart;

  const statistics =
  createStatistics(
    document,
    tableAnalyses,
    mergedTables,
    candidateTableRegionCount,
  );

const confidence =
  calculateEngineConfidence(
    document,
    tableAnalyses,
    mergedTables,
  );

  const totalMs =
    now() - totalStart;

  return {
    document,
    tables: mergedTables,
    tableAnalyses,
    statistics,
    processingTimes: {
      readingMs,
      visualBlockDetectionMs,
      tableAnalysisMs,
      totalMs,
    },
    confidence,
  };
}
