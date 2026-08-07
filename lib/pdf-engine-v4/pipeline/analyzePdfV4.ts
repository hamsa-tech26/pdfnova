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

      const columnDetection =
        detectStableColumnsV4(
          region.block,
        );

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

  const tableAnalysisMs =
    now() - tableStart;

  const statistics =
    createStatistics(
      document,
      tableAnalyses,
      tables,
      candidateTableRegionCount,
    );

  const confidence =
    calculateEngineConfidence(
      document,
      tableAnalyses,
      tables,
    );

  const totalMs =
    now() - totalStart;

  return {
    document,
    tables,
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
