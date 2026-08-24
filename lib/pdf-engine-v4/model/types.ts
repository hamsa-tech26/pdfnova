export type PdfEngineMetadata = {
  fileName: string;
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
};

export type PdfBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfFontInfo = {
  name?: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
};

export type PdfWord = {
  id: string;
  text: string;
  pageNumber: number;
  bounds: PdfBoundingBox;
  font: PdfFontInfo;
  rotation: number;
};

export type PdfLine = {
  id: string;
  pageNumber: number;
  words: PdfWord[];
  bounds: PdfBoundingBox;
  text: string;
};

export type PdfParagraphBlock = {
  id: string;
  type: "paragraph";
  pageNumber: number;
  bounds: PdfBoundingBox;
  lines: PdfLine[];
  text: string;
  confidence: number;
};

export type PdfTableCell = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  bounds: PdfBoundingBox;
  words: PdfWord[];
  text: string;
  confidence: number;
};

export type PdfTableRow = {
  id: string;
  rowIndex: number;
  cells: PdfTableCell[];
  bounds: PdfBoundingBox;
};

export type PdfTableBlock = {
  id: string;
  type: "table";
  pageNumber: number;
  bounds: PdfBoundingBox;
  rows: PdfTableRow[];
  columnCount: number;
  confidence: number;
};

export type PdfHeadingBlock = {
  id: string;
  type: "heading";
  pageNumber: number;
  bounds: PdfBoundingBox;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  lines: PdfLine[];
  text: string;
  confidence: number;
};

export type PdfImageBlock = {
  id: string;
  type: "image";
  pageNumber: number;
  bounds: PdfBoundingBox;
  dataUrl?: string;
  altText?: string;
  confidence: number;
};

export type PdfUnknownBlock = {
  id: string;
  type: "unknown";
  pageNumber: number;
  bounds: PdfBoundingBox;
  words: PdfWord[];
  confidence: number;
};

export type PdfVisualBlock =
  | PdfParagraphBlock
  | PdfTableBlock
  | PdfHeadingBlock
  | PdfImageBlock
  | PdfUnknownBlock;

export type PdfPageTextExtractionStatus =
  | "none"
  | "low"
  | "sufficient";

export type PdfPageTextExtractionMetrics = {
  wordCount: number;
  lineCount: number;
  characterCount: number;
  status: PdfPageTextExtractionStatus;
  qualityScore: number;
};

export type PdfPageModel = {
  pageNumber: number;
  width: number;
  height: number;
  words: PdfWord[];
  lines: PdfLine[];
  blocks: PdfVisualBlock[];
  textExtraction: PdfPageTextExtractionMetrics;
};

export type PdfDocumentModel = {
  metadata: PdfEngineMetadata;
  pages: PdfPageModel[];
  confidence: number;
};

export type DetectorScore = {
  score: number;
  confidence: number;
};

export type TableScoreBreakdown = {
  alignment: DetectorScore;
  spacing: DetectorScore;
  density: DetectorScore;
  header: DetectorScore;
  numericColumn: DetectorScore;
};

export type TableRegionAnalysis = {
  isTable: boolean;
  totalScore: number;
  confidence: number;
  breakdown: TableScoreBreakdown;
};
