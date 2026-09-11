import type {
  LogicalCell,
  LogicalExtractionProvenance,
  LogicalExtractionSource,
  LogicalRow,
  LogicalTable,
} from "../model/logicalTable";

import type {
  PdfWord,
} from "../model/types";

function average(
  values: number[],
) {
  if (values.length === 0) {
    return undefined;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function getUniqueWords(
  words: PdfWord[],
) {
  const uniqueWords =
    new Map<string, PdfWord>();

  for (const word of words) {
    if (
      !uniqueWords.has(
        word.id,
      )
    ) {
      uniqueWords.set(
        word.id,
        word,
      );
    }
  }

  return [
    ...uniqueWords.values(),
  ];
}

function getPageNumbers(
  words: PdfWord[],
) {
  return [
    ...new Set(
      words.map(
        (word) =>
          word.pageNumber,
      ),
    ),
  ].sort(
    (a, b) =>
      a - b,
  );
}

function classifySource(
  nativeWordCount: number,
  ocrWordCount: number,
  unknownWordCount: number,
): LogicalExtractionSource {
  const populatedSources = [
    nativeWordCount > 0,
    ocrWordCount > 0,
    unknownWordCount > 0,
  ].filter(Boolean).length;

  if (
    populatedSources === 0
  ) {
    return "unknown";
  }

  if (
    populatedSources > 1
  ) {
    return "mixed";
  }

  if (
    nativeWordCount > 0
  ) {
    return "native-pdf";
  }

  if (
    ocrWordCount > 0
  ) {
    return "ocr-tesseract";
  }

  return "unknown";
}

export function summarizeWordExtractionProvenance(
  inputWords: PdfWord[],
): LogicalExtractionProvenance {
  const words =
    getUniqueWords(
      inputWords,
    );

  let nativeWordCount = 0;
  let ocrWordCount = 0;
  let unknownWordCount = 0;

  const confidenceValues:
    number[] = [];

  for (const word of words) {
    const provenance =
      word.extractionProvenance;

    if (
      provenance?.source ===
      "native-pdf"
    ) {
      nativeWordCount += 1;
    } else if (
      provenance?.source ===
      "ocr-tesseract"
    ) {
      ocrWordCount += 1;
    } else {
      unknownWordCount += 1;
    }

    if (
      provenance?.confidence !==
        undefined &&
      Number.isFinite(
        provenance.confidence,
      )
    ) {
      confidenceValues.push(
        provenance.confidence,
      );
    }
  }

  const confidence =
    average(
      confidenceValues,
    );

  return {
    source:
      classifySource(
        nativeWordCount,
        ocrWordCount,
        unknownWordCount,
      ),
    wordCount:
      words.length,
    nativeWordCount,
    ocrWordCount,
    unknownWordCount,
    pageNumbers:
      getPageNumbers(
        words,
      ),
    ...(confidence !== undefined
      ? { confidence }
      : {}),
  };
}

export function summarizeCellExtractionProvenance(
  cell: LogicalCell,
) {
  return summarizeWordExtractionProvenance(
    cell.words,
  );
}

function getRowWords(
  row: LogicalRow,
) {
  return row.cells.flatMap(
    (cell) =>
      cell.words,
  );
}

export function summarizeRowExtractionProvenance(
  row: LogicalRow,
) {
  return summarizeWordExtractionProvenance(
    getRowWords(row),
  );
}

function getTableWords(
  table: LogicalTable,
) {
  return table.rows.flatMap(
    (row) =>
      getRowWords(row),
  );
}

export function summarizeTableExtractionProvenance(
  table: LogicalTable,
) {
  return summarizeWordExtractionProvenance(
    getTableWords(table),
  );
}

export function attachTableExtractionProvenance(
  table: LogicalTable,
): LogicalTable {
  const rows =
    table.rows.map(
      (row) => {
        const cells =
          row.cells.map(
            (cell) => ({
              ...cell,
              extractionProvenance:
                summarizeCellExtractionProvenance(
                  cell,
                ),
            }),
          );

        const updatedRow: LogicalRow = {
          ...row,
          cells,
        };

        return {
          ...updatedRow,
          extractionProvenance:
            summarizeRowExtractionProvenance(
              updatedRow,
            ),
        };
      },
    );

  const updatedTable: LogicalTable = {
    ...table,
    rows,
  };

  return {
    ...updatedTable,
    extractionProvenance:
      summarizeTableExtractionProvenance(
        updatedTable,
      ),
  };
}