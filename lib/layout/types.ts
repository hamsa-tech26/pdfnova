export type PdfWord = {
  text: string;

  x: number;
  y: number;

  width: number;
  height: number;

  fontSize: number;

  pageNumber: number;
};

export type PdfLine = {
  words: PdfWord[];

  y: number;

  height: number;
};

export type PdfParagraph = {
  lines: PdfLine[];
};

export type PdfCell = {
  text: string;

  columnIndex: number;
};

export type PdfRow = {
  cells: PdfCell[];
};

export type PdfTable = {
  rows: PdfRow[];
};

export type PdfPageLayout = {
  pageNumber: number;

  words: PdfWord[];

  lines: PdfLine[];

  paragraphs: PdfParagraph[];

  tables: PdfTable[];
};