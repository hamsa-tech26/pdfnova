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
import {
  analyzeRowReliabilityV1,
  type RowReliabilityResult,
} from "../analysis/rowReliabilityAnalyzer";
import {
  selectRegionsForAnalysis,
} from "../analysis/continuationRegionSelector";
import {
  createPdfV4OcrDecision as createPdfV4OcrDecisionFromModule,
  type PdfV4OcrDecision as PdfV4OcrDecisionFromModule,
} from "../ocr/ocrDecision";
import {
  runPdfV4ControlledOcr,
  type PdfV4ControlledOcrResult,
} from "../ocr/controlledOcrFallback";

import {
  applyPdfV4OcrPagesToDocument,
} from "../ocr/ocrDocumentAdapter";

export type PdfV4TableAnalysis = {
  pageNumber: number;
  blockId: string;
  regionAnalysis: TableRegionAnalysis;
  columnDetection: StableColumnDetectionResult;
  rowDetection: AdaptiveRowDetectionResult;
  cellBuild: SmartCellBuilderResult;
  cellRepair: CellRepairResult | null;
  rowReliability:
  RowReliabilityResult | null;
  table: LogicalTable | null;
};

export type PdfV4CandidateRegionDiagnostic = {
  pageNumber: number;
  blockId: string;
  blockType: string;
  lineCount: number;
  analysis: TableRegionAnalysis;
  admittedAsContinuation: boolean;

  outcome:
    | "below-threshold"
    | "pending"
    | "rejected-insufficient-columns"
    | "rejected-no-rows"
    | "rejected-table-build"
    | "confirmed";

  acceptedColumnCount: number | null;
};

export type PdfV4ProcessingStatistics = {
  pageCount: number;
  wordCount: number;
  lineCount: number;
  blockCount: number;
  candidateTableRegionCount: number;
continuationAdmissionCount: number;
analyzedTableRegionCount: number;
confirmedTableRegionCount: number;

  rejectedForInsufficientColumns: number;
  rejectedForNoRows: number;
  rejectedForTableBuildFailure: number;

  rejectedWithZeroColumns: number;
  rejectedWithOneColumn: number;

  rejectedColumnTooFewLines: number;
  rejectedColumnLowSupport: number;
  rejectedColumnUnstableAlignment: number;

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

export type PdfV4TextExtractionProfileStatus =
  | "empty"
  | "low-text"
  | "mixed"
  | "sufficient";

export type PdfV4TextExtractionProfile = {
  status: PdfV4TextExtractionProfileStatus;
  pageCount: number;
  noTextPageCount: number;
  lowTextPageCount: number;
  sufficientTextPageCount: number;
};

export type PdfV4OcrDecision =
  PdfV4OcrDecisionFromModule;

export type PdfV4OcrDecisionStatus =
  PdfV4OcrDecision["status"];

export function createPdfV4OcrDecision(
  document: Pick<
    PdfDocumentModel,
    "pages"
  >,
): PdfV4OcrDecision {
  return createPdfV4OcrDecisionFromModule(
    document,
  );
}

export function createPdfV4TextExtractionProfile(
  document: Pick<
    PdfDocumentModel,
    "pages"
  >,
): PdfV4TextExtractionProfile {
  const pageCount =
    document.pages.length;

  const noTextPageCount =
    document.pages.filter(
      (page) =>
        page.textExtraction.status ===
        "none",
    ).length;

  const lowTextPageCount =
    document.pages.filter(
      (page) =>
        page.textExtraction.status ===
        "low",
    ).length;

  const sufficientTextPageCount =
    document.pages.filter(
      (page) =>
        page.textExtraction.status ===
        "sufficient",
    ).length;

  let status:
    PdfV4TextExtractionProfileStatus;

  if (
    pageCount === 0 ||
    noTextPageCount === pageCount
  ) {
    status = "empty";
  } else if (
    sufficientTextPageCount === pageCount
  ) {
    status = "sufficient";
  } else if (
    sufficientTextPageCount > 0
  ) {
    status = "mixed";
  } else {
    status = "low-text";
  }

  return {
    status,
    pageCount,
    noTextPageCount,
    lowTextPageCount,
    sufficientTextPageCount,
  };
}

export type PdfEngineV4Result = {
  document: PdfDocumentModel;
  tables: LogicalTable[];
  tableAnalyses: PdfV4TableAnalysis[];

  candidateRegionDiagnostics:
  PdfV4CandidateRegionDiagnostic[];

  mergedTableReliability:
  RowReliabilityResult[];
  statistics: PdfV4ProcessingStatistics;
  processingTimes: PdfV4ProcessingTimes;
  analysisOutcome: PdfV4AnalysisOutcome;
  textExtractionProfile: PdfV4TextExtractionProfile;
ocrDecision: PdfV4OcrDecision;
controlledOcrResult?: PdfV4ControlledOcrResult;
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

function attachRowProvenance(
  table: LogicalTable,
  pageNumber: number,
  blockId: string,
): LogicalTable {
  return {
    ...table,
    rows: table.rows.map(
      (row) => ({
        ...row,
        provenance: {
          pageNumber,
          blockId,
          originalRowIndex:
            row.rowIndex,
        },
      }),
    ),
  };
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
  enableControlledOcr?: boolean;
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

export function countConfirmedTableRegions(
  analyses: Pick<
    PdfV4TableAnalysis,
    "table"
  >[],
) {
  return analyses.filter(
    (analysis) =>
      analysis.table !== null,
  ).length;
}

function createStatistics(
  document: PdfDocumentModel,
  tableAnalyses: PdfV4TableAnalysis[],
  tables: LogicalTable[],
  candidateTableRegionCount: number,
  continuationAdmissionCount: number,
analyzedTableRegionCount: number,
  rejectedForInsufficientColumns: number,
  rejectedWithZeroColumns: number,
  rejectedWithOneColumn: number,
  rejectedForNoRows: number,
  rejectedForTableBuildFailure: number,
  rejectedColumnTooFewLines: number,
  rejectedColumnLowSupport: number,
  rejectedColumnUnstableAlignment: number,
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
continuationAdmissionCount,
analyzedTableRegionCount,
confirmedTableRegionCount:
  countConfirmedTableRegions(
    tableAnalyses,
  ),

rejectedForInsufficientColumns,
rejectedWithZeroColumns,
rejectedWithOneColumn,
rejectedForNoRows,
rejectedForTableBuildFailure,

rejectedColumnTooFewLines,
rejectedColumnLowSupport,
rejectedColumnUnstableAlignment,

logicalTableCount:
  tables.length,
    detectedColumnCount,
    detectedRowCount,
    populatedCellCount:
      countPopulatedCells(tables),
  };
}

export type PdfV4AnalysisOutcome =
  | "no-extractable-text"
  | "no-table-candidates"
  | "resolved-no-table"
  | "confirmed-table"
  | "incomplete-analysis"
  | "table-build-failure";

  export function classifyPdfV4AnalysisOutcome(
  diagnostics: Pick<
    PdfV4CandidateRegionDiagnostic,
    "outcome"
  >[],
  hasExtractableText = true,
): PdfV4AnalysisOutcome {
  if (!hasExtractableText) {
  return "no-extractable-text";
}

  const analyzedDiagnostics =
    diagnostics.filter(
      (diagnostic) =>
        diagnostic.outcome !==
        "below-threshold",
    );

  if (analyzedDiagnostics.length === 0) {
    return "no-table-candidates";
  }

  if (
    analyzedDiagnostics.some(
      (diagnostic) =>
        diagnostic.outcome ===
        "pending",
    )
  ) {
    return "incomplete-analysis";
  }

  if (
    analyzedDiagnostics.some(
      (diagnostic) =>
        diagnostic.outcome ===
        "rejected-table-build",
    )
  ) {
    return "table-build-failure";
  }

  if (
    analyzedDiagnostics.some(
      (diagnostic) =>
        diagnostic.outcome ===
        "confirmed",
    )
  ) {
    return "confirmed-table";
  }

  return "resolved-no-table";
}

export function getPdfV4OutcomeConfidenceMultiplier(
  outcome: PdfV4AnalysisOutcome,
) {
  if (
  outcome ===
  "no-extractable-text"
) {
  return 0;
}
  if (
    outcome ===
    "no-table-candidates"
  ) {
    return 0.85;
  }

  if (
    outcome ===
    "resolved-no-table"
  ) {
    return 0.9;
  }

  if (
    outcome ===
    "incomplete-analysis"
  ) {
    return 0.5;
  }

  if (
    outcome ===
    "table-build-failure"
  ) {
    return 0.35;
  }

  return null;
}

function calculateEngineConfidence(
  document: PdfDocumentModel,
  analyses: PdfV4TableAnalysis[],
  tables: LogicalTable[],
  diagnostics:
    PdfV4CandidateRegionDiagnostic[],
) {
  const documentConfidence =
    document.confidence;

  const analysisOutcome =
  classifyPdfV4AnalysisOutcome(
    diagnostics,
    document.confidence > 0,
  );

  const outcomeConfidenceMultiplier =
  getPdfV4OutcomeConfidenceMultiplier(
    analysisOutcome,
  );

if (
  outcomeConfidenceMultiplier !==
  null
) {
  return (
    documentConfidence *
    outcomeConfidenceMultiplier
  );
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

const nativeOcrDecision =
  createPdfV4OcrDecision(
    rawDocument,
  );

  const readingMs =
  now() - readingStart;

  const nativeTextExtractionProfile =
  createPdfV4TextExtractionProfile(
    rawDocument,
  );

  const controlledOcrResult =
  options?.enableControlledOcr
    ? await runPdfV4ControlledOcr(
        file,
        nativeOcrDecision,
      )
    : undefined;

    const analysisSourceDocument =
  controlledOcrResult?.pages.length
    ? applyPdfV4OcrPagesToDocument(
        rawDocument,
        controlledOcrResult.pages,
      )
    : rawDocument;

  const blockStart = now();

  const document =
  detectVisualBlocks(
    analysisSourceDocument,
  );

  const visualBlockDetectionMs =
    now() - blockStart;

  const tableStart = now();

  const tableAnalyses:
    PdfV4TableAnalysis[] = [];

    const candidateRegionDiagnostics:
  PdfV4CandidateRegionDiagnostic[] =
  [];

  const tables: LogicalTable[] = [];

  let candidateTableRegionCount = 0;

  let continuationAdmissionCount = 0;

let analyzedTableRegionCount = 0;
  
  let rejectedForInsufficientColumns =
  0;

  let rejectedWithZeroColumns =
  0;

let rejectedWithOneColumn =
  0;

  let rejectedForNoRows =
  0;

  let rejectedForTableBuildFailure =
  0;

  let rejectedColumnTooFewLines =
  0;

let rejectedColumnLowSupport =
  0;

let rejectedColumnUnstableAlignment =
  0;

  for (const page of document.pages) {
    const detection =
      detectTableRegionsForPage(
        page.blocks,
      );

    const hasPreviousPageTableAnalysis =
  tableAnalyses.some(
    (analysis) =>
      analysis.pageNumber ===
      page.pageNumber - 1,
  );

const {
  regionsToAnalyze,
  continuationRegionIds,
} = selectRegionsForAnalysis(
  detection.regions,
  detection.tableRegions,
  hasPreviousPageTableAnalysis,
);

candidateTableRegionCount +=
  detection.tableRegions.length;

continuationAdmissionCount +=
  continuationRegionIds.size;

analyzedTableRegionCount +=
  regionsToAnalyze.length;

for (const region of detection.regions) {
  candidateRegionDiagnostics.push({
    pageNumber:
      page.pageNumber,
    blockId:
      region.block.id,
    blockType:
      region.block.type,
    lineCount:
      region.block.type ===
        "paragraph" ||
      region.block.type ===
        "heading"
        ? region.block.lines.length
        : 0,
    analysis:
  region.analysis,
admittedAsContinuation:
  continuationRegionIds.has(
    region.block.id,
  ),
outcome:
  regionsToAnalyze.some(
    (analyzedRegion) =>
      analyzedRegion.block.id ===
      region.block.id,
  )
    ? "pending"
    : "below-threshold",
acceptedColumnCount: null,
});
}

for (const region of regionsToAnalyze) {
  const isContinuationAdmission =
    continuationRegionIds.has(
      region.block.id,
    );

  const shouldAnalyze =
    isContinuationAdmission ||
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
    .columns.length >
    columnDetection.columns.length
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

  const usedCandidateIds =
    new Set<string>();

  const recoveredCandidates =
    previousColumns
      .filter(
        (previousColumn) =>
          !currentColumns.some(
            (currentColumn) =>
              Math.abs(
                currentColumn.x -
                  previousColumn.x,
              ) <= recoveryTolerance,
          ),
      )
      .map((previousColumn) => {
        const candidate =
          columnDetection
            .rejectedCandidates
            .filter(
              (item) =>
                item.confidence >=
                  0.7 &&
                !usedCandidateIds.has(
                  item.id,
                ),
            )
            .filter(
              (item) =>
                Math.abs(
                  item.x -
                    previousColumn.x,
                ) <=
                recoveryTolerance,
            )
            .sort(
              (first, second) => {
                const firstDistance =
                  Math.abs(
                    first.x -
                      previousColumn.x,
                  );

                const secondDistance =
                  Math.abs(
                    second.x -
                      previousColumn.x,
                  );

                if (
                  firstDistance !==
                  secondDistance
                ) {
                  return (
                    firstDistance -
                    secondDistance
                  );
                }

                return (
                  second.confidence -
                  first.confidence
                );
              },
            )[0];

        if (!candidate) {
          return null;
        }

        usedCandidateIds.add(
          candidate.id,
        );

        return {
          ...candidate,
          accepted: true,
          reason:
            "Recovered from a rejected candidate because the previous page supports the same logical column.",
        };
      })
      .filter(
  (
    candidate,
  ): candidate is NonNullable<
    typeof candidate
  > =>
    candidate !== null,
);

  const recoveredColumns = [
    ...currentColumns,
    ...recoveredCandidates,
  ];

  if (
    sharedColumnCount >= 2 &&
    recoveredColumns.length ===
      previousColumns.length
  ) {
    const normalizedColumns =
      recoveredColumns
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
            id:
              `column-candidate-${index}`,
            leftBoundary:
              index === 0
                ? region.block.bounds.x
                : (
                    columns[index - 1]
                      .x +
                    column.x
                  ) / 2,
            rightBoundary:
              index ===
              columns.length - 1
                ? region.block.bounds.x +
                  region.block.bounds
                    .width
                : (
                    column.x +
                    columns[index + 1]
                      .x
                  ) / 2,
          }),
        );

    columnDetection = {
      ...columnDetection,
      columns:
        normalizedColumns,
      rejectedCandidates:
        columnDetection
          .rejectedCandidates
          .filter(
            (candidate) =>
              !usedCandidateIds.has(
                candidate.id,
              ),
          ),
    };
  }
}

const regionDiagnostic =
  candidateRegionDiagnostics.find(
    (diagnostic) =>
      diagnostic.pageNumber ===
        page.pageNumber &&
      diagnostic.blockId ===
        region.block.id,
  );

if (regionDiagnostic) {
  regionDiagnostic.acceptedColumnCount =
    columnDetection.columns.length;
}

if (
  columnDetection.columns.length <
  2
) {
  rejectedForInsufficientColumns +=
    1;

    if (regionDiagnostic) {
  regionDiagnostic.outcome =
    "rejected-insufficient-columns";
}
    
    if (
  columnDetection.columns.length ===
  0
) {
  rejectedWithZeroColumns += 1;
} else if (
  columnDetection.columns.length ===
  1
) {
  rejectedWithOneColumn += 1;
}

  for (
    const candidate of
    columnDetection.rejectedCandidates
  ) {
    if (
      candidate.reason ===
      "Rejected because too few distinct lines support this position."
    ) {
      rejectedColumnTooFewLines +=
        1;
    } else if (
      candidate.reason ===
      "Rejected because the support ratio is too low."
    ) {
      rejectedColumnLowSupport +=
        1;
    } else if (
      candidate.reason ===
      "Rejected because the alignment varies too much."
    ) {
      rejectedColumnUnstableAlignment +=
        1;
    }
  }

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
  rejectedForNoRows += 1;

  if (regionDiagnostic) {
    regionDiagnostic.outcome =
      "rejected-no-rows";
  }

  continue;
}

      const cellBuild =
        buildSmartTableV4(
          page.pageNumber,
          rowDetection.rows,
          columnDetection.columns,
        );

      const builtTable =
  cellBuild.table
    ? attachRowProvenance(
        cellBuild.table,
        page.pageNumber,
        region.block.id,
      )
    : null;

let cellRepair:
  CellRepairResult | null =
  null;

if (builtTable !== null) {
  cellRepair =
    repairLogicalTableV1(
      builtTable,
    );
}

const finalTable =
  cellRepair?.table ??
  builtTable;

  if (finalTable === null) {
  rejectedForTableBuildFailure +=
    1;

  if (regionDiagnostic) {
    regionDiagnostic.outcome =
      "rejected-table-build";
  }
}
  const rowReliability =
  finalTable
    ? analyzeRowReliabilityV1(
        finalTable,
      )
    : null;

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
          rowReliability,
          table:
            finalTable,
        };

      tableAnalyses.push(
        tableAnalysis,
      );

      if (finalTable) {
  if (regionDiagnostic) {
    regionDiagnostic.outcome =
      "confirmed";
  }

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

  const mergedTableReliability =
  mergedTables.map(
    (table) =>
      analyzeRowReliabilityV1(
        table,
      ),
  );

  const tableAnalysisMs =
    now() - tableStart;

  const statistics =
  createStatistics(
    document,
    tableAnalyses,
    mergedTables,
    candidateTableRegionCount,
    continuationAdmissionCount,
analyzedTableRegionCount,
    rejectedForInsufficientColumns,
    rejectedWithZeroColumns,
    rejectedWithOneColumn,
    rejectedForNoRows,
    rejectedForTableBuildFailure,
    rejectedColumnTooFewLines,
    rejectedColumnLowSupport,
    rejectedColumnUnstableAlignment,
  );

const textExtractionProfile =
  nativeTextExtractionProfile;

const ocrDecision =
  nativeOcrDecision; 

const analysisOutcome =
  classifyPdfV4AnalysisOutcome(
    candidateRegionDiagnostics,
    document.confidence > 0,
  );

const confidence =
  calculateEngineConfidence(
    document,
    tableAnalyses,
    mergedTables,
    candidateRegionDiagnostics,
  );

  const totalMs =
    now() - totalStart;

  return {
    document,
    tables: mergedTables,
    tableAnalyses,
    candidateRegionDiagnostics,
    mergedTableReliability,
    statistics,
    processingTimes: {
    readingMs,
    visualBlockDetectionMs,
    tableAnalysisMs,
    totalMs,
},
analysisOutcome,
textExtractionProfile,
ocrDecision,
controlledOcrResult,
confidence,
  };
}
