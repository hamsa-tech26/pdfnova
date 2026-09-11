import type {
  PdfBoundingBox,
  PdfWord,
} from "./types";

export type LogicalExtractionSource =
  | "native-pdf"
  | "ocr-tesseract"
  | "mixed"
  | "unknown";

export type LogicalExtractionProvenance = {
  source: LogicalExtractionSource;
  wordCount: number;
  nativeWordCount: number;
  ocrWordCount: number;
  unknownWordCount: number;
  pageNumbers: number[];
  confidence?: number;
};

export type LogicalCell = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  text: string;
  words: PdfWord[];
  bounds: PdfBoundingBox;
  confidence: number;
  extractionProvenance?:
    LogicalExtractionProvenance;
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
  extractionProvenance?:
    LogicalExtractionProvenance;
};

export type LogicalTable = {
  id: string;
  pageNumber: number;
  rows: LogicalRow[];
  columnCount: number;
  bounds: PdfBoundingBox;
  confidence: number;
  extractionProvenance?:
    LogicalExtractionProvenance;
};

export type LogicalTableCollection = {
  tables: LogicalTable[];
  confidence: number;
};