import type {
  PdfBoundingBox,
  PdfWord,
} from "./types";

export type LogicalCell = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  text: string;
  words: PdfWord[];
  bounds: PdfBoundingBox;
  confidence: number;
};

export type LogicalRowProvenance = {
  pageNumber: number;
  blockId: string;
  originalRowIndex: number;
};

export type LogicalRow = {
  id: string;
  rowIndex: number;
  cells: LogicalCell[];
  confidence: number;
  provenance?: LogicalRowProvenance;
};

export type LogicalTable = {
  id: string;
  pageNumber: number;
  rows: LogicalRow[];
  columnCount: number;
  bounds: PdfBoundingBox;
  confidence: number;
};

export type LogicalTableCollection = {
  tables: LogicalTable[];
  confidence: number;
};
