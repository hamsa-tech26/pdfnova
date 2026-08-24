import {
  detectStableColumns,
  type ColumnDetectionResult,
} from "./columnDetector";
import {
  buildTableCells,
  type CellBuildResult,
} from "./cellBuilder";
import {
  detectRows,
  type RowDetectionResult,
} from "./rowDetector";
import {
  normalizeDetectedRows,
  type RowNormalizationResult,
} from "./rowNormalizer";
import type {
  PdfPageLayout,
  PdfTable,
} from "./types";

export type PageLayoutAnalysis = {
  pageNumber: number;
  columnDetection: ColumnDetectionResult;
  rowDetection: RowDetectionResult;
  cellBuild: CellBuildResult;
  normalization: RowNormalizationResult;
  table: PdfTable | null;
  confidence: number;
};

export type DocumentLayoutAnalysis = {
  pages: PageLayoutAnalysis[];
  averageConfidence: number;
};

function createPdfTable(
  cellBuild: CellBuildResult,
): PdfTable | null {
  if (cellBuild.rows.length === 0) {
    return null;
  }

  const rows = cellBuild.rows
    .map((row) => ({
      cells: row.cells.map((cell) => ({
        text: cell.text,
        columnIndex: cell.columnIndex,
      })),
    }))
    .filter((row) =>
      row.cells.some((cell) => cell.text),
    );

  if (rows.length < 2) {
    return null;
  }

  return {
    rows,
  };
}

function combineConfidence(
  columnConfidence: number,
  rowConfidence: number,
  cellConfidence: number,
) {
  const weightedScore =
    columnConfidence * 0.4 +
    rowConfidence * 0.3 +
    cellConfidence * 0.3;

  return Math.max(
    0,
    Math.min(1, weightedScore),
  );
}

export function analyzePdfPageLayout(
  page: PdfPageLayout,
): PageLayoutAnalysis {
  const columnDetection =
    detectStableColumns(page.lines);

  const rowDetection =
    detectRows(page.lines);

  const cellBuild =
    buildTableCells(
      rowDetection.rows,
      columnDetection.columns,
    );

    const normalization =
    normalizeDetectedRows(
      cellBuild.rows,
    );

  const normalizedCellBuild: CellBuildResult = {
    ...cellBuild,
    rows: normalization.rows,
  };

  const table =
    createPdfTable(
      normalizedCellBuild,
    );

  const confidence =
    combineConfidence(
      columnDetection.confidence,
      rowDetection.confidence,
      cellBuild.confidence,
    );

  return {
    pageNumber: page.pageNumber,
    columnDetection,
    rowDetection,
    cellBuild: normalizedCellBuild,
    normalization,
    table,
    confidence,
  };
}

export function analyzePdfDocumentLayout(
  pages: PdfPageLayout[],
): DocumentLayoutAnalysis {
  const analyses = pages.map(
    analyzePdfPageLayout,
  );

  const averageConfidence =
    analyses.length === 0
      ? 0
      : analyses.reduce(
          (sum, analysis) =>
            sum + analysis.confidence,
          0,
        ) / analyses.length;

  return {
    pages: analyses,
    averageConfidence,
  };
}