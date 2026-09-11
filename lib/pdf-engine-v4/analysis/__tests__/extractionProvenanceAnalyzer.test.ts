import {
  describe,
  expect,
  it,
} from "vitest";

import {
  attachTableExtractionProvenance,
  summarizeWordExtractionProvenance,
} from "../extractionProvenanceAnalyzer";

import type {
  LogicalTable,
} from "../../model/logicalTable";

import type {
  PdfWord,
  PdfWordExtractionProvenance,
} from "../../model/types";

function createWord(
  id: string,
  text: string,
  pageNumber: number,
  extractionProvenance?:
    PdfWordExtractionProvenance,
): PdfWord {
  return {
    id,
    text,
    pageNumber,
    bounds: {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    font: {
      size: 10,
    },
    rotation: 0,
    extractionProvenance,
  };
}

function createTable(
  wordsByCell:
    PdfWord[][][],
): LogicalTable {
  return {
    id: "table-1",
    pageNumber: 1,
    columnCount:
      wordsByCell[0]?.length ??
      0,
    bounds: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    },
    confidence: 0.95,
    rows:
      wordsByCell.map(
        (
          rowCells,
          rowIndex,
        ) => ({
          id:
            `logical-row-${rowIndex}`,
          rowIndex,
          confidence: 0.95,
          cells:
            rowCells.map(
              (
                words,
                columnIndex,
              ) => ({
                id:
                  `logical-cell-${rowIndex}-${columnIndex}`,
                rowIndex,
                columnIndex,
                text:
                  words
                    .map(
                      (word) =>
                        word.text,
                    )
                    .join(" "),
                words,
                bounds: {
                  x:
                    columnIndex *
                    50,
                  y:
                    rowIndex *
                    20,
                  width: 40,
                  height: 15,
                },
                confidence:
                  0.95,
              }),
            ),
        }),
      ),
  };
}

describe(
  "extractionProvenanceAnalyzer",
  () => {
    it(
      "summarizes native PDF words",
      () => {
        const result =
          summarizeWordExtractionProvenance(
            [
              createWord(
                "word-1",
                "Native",
                1,
                {
                  source:
                    "native-pdf",
                  confidence: 1,
                },
              ),
              createWord(
                "word-2",
                "Text",
                1,
                {
                  source:
                    "native-pdf",
                  confidence: 0.9,
                },
              ),
            ],
          );

        expect(
          result.source,
        ).toBe(
          "native-pdf",
        );

        expect(
          result.wordCount,
        ).toBe(2);

        expect(
          result.nativeWordCount,
        ).toBe(2);

        expect(
          result.ocrWordCount,
        ).toBe(0);

        expect(
          result.unknownWordCount,
        ).toBe(0);

        expect(
          result.pageNumbers,
        ).toEqual([1]);

        expect(
          result.confidence,
        ).toBeCloseTo(
          0.95,
        );
      },
    );

    it(
      "summarizes OCR words",
      () => {
        const result =
          summarizeWordExtractionProvenance(
            [
              createWord(
                "word-1",
                "OCR",
                2,
                {
                  source:
                    "ocr-tesseract",
                  confidence: 0.82,
                },
              ),
            ],
          );

        expect(
          result.source,
        ).toBe(
          "ocr-tesseract",
        );

        expect(
          result.nativeWordCount,
        ).toBe(0);

        expect(
          result.ocrWordCount,
        ).toBe(1);

        expect(
          result.pageNumbers,
        ).toEqual([2]);
      },
    );

    it(
      "classifies native and OCR words as mixed",
      () => {
        const result =
          summarizeWordExtractionProvenance(
            [
              createWord(
                "word-1",
                "Native",
                1,
                {
                  source:
                    "native-pdf",
                },
              ),
              createWord(
                "word-2",
                "OCR",
                2,
                {
                  source:
                    "ocr-tesseract",
                },
              ),
            ],
          );

        expect(
          result.source,
        ).toBe("mixed");

        expect(
          result.wordCount,
        ).toBe(2);

        expect(
          result.nativeWordCount,
        ).toBe(1);

        expect(
          result.ocrWordCount,
        ).toBe(1);

        expect(
          result.pageNumbers,
        ).toEqual([
          1,
          2,
        ]);
      },
    );

    it(
      "reports missing word provenance as unknown",
      () => {
        const result =
          summarizeWordExtractionProvenance(
            [
              createWord(
                "word-1",
                "Unknown",
                3,
              ),
            ],
          );

        expect(
          result.source,
        ).toBe("unknown");

        expect(
          result.wordCount,
        ).toBe(1);

        expect(
          result.unknownWordCount,
        ).toBe(1);

        expect(
          result.confidence,
        ).toBeUndefined();
      },
    );

    it(
      "attaches provenance to cells rows and the complete table",
      () => {
        const table =
          createTable([
            [
              [
                createWord(
                  "word-1",
                  "Native",
                  1,
                  {
                    source:
                      "native-pdf",
                    confidence:
                      1,
                  },
                ),
              ],
              [
                createWord(
                  "word-2",
                  "OCR",
                  1,
                  {
                    source:
                      "ocr-tesseract",
                    confidence:
                      0.8,
                  },
                ),
              ],
            ],
            [
              [
                createWord(
                  "word-3",
                  "Page",
                  2,
                  {
                    source:
                      "native-pdf",
                    confidence:
                      0.9,
                  },
                ),
              ],
              [],
            ],
          ]);

        const result =
          attachTableExtractionProvenance(
            table,
          );

        expect(
          result.rows[0]
            .cells[0]
            .extractionProvenance
            ?.source,
        ).toBe(
          "native-pdf",
        );

        expect(
          result.rows[0]
            .cells[1]
            .extractionProvenance
            ?.source,
        ).toBe(
          "ocr-tesseract",
        );

        expect(
          result.rows[0]
            .extractionProvenance
            ?.source,
        ).toBe("mixed");

        expect(
          result.rows[1]
            .extractionProvenance
            ?.source,
        ).toBe(
          "native-pdf",
        );

        expect(
          result
            .extractionProvenance
            ?.source,
        ).toBe("mixed");

        expect(
          result
            .extractionProvenance
            ?.wordCount,
        ).toBe(3);

        expect(
          result
            .extractionProvenance
            ?.nativeWordCount,
        ).toBe(2);

        expect(
          result
            .extractionProvenance
            ?.ocrWordCount,
        ).toBe(1);

        expect(
          result
            .extractionProvenance
            ?.pageNumbers,
        ).toEqual([
          1,
          2,
        ]);
      },
    );

    it(
      "does not count duplicate word ids twice",
      () => {
        const duplicateWord =
          createWord(
            "word-1",
            "Repeated",
            1,
            {
              source:
                "native-pdf",
            },
          );

        const result =
          summarizeWordExtractionProvenance(
            [
              duplicateWord,
              duplicateWord,
            ],
          );

        expect(
          result.wordCount,
        ).toBe(1);

        expect(
          result.nativeWordCount,
        ).toBe(1);
      },
    );
  },
);