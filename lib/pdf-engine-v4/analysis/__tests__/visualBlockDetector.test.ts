import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectVisualBlocksForPage,
} from "../visualBlockDetector";

import type {
  PdfLine,
  PdfPageModel,
  PdfWord,
} from "../../model/types";

function createOcrLine(
  index: number,
  text: string,
  y: number,
): PdfLine {
  const word: PdfWord = {
    id: `word-${index}`,
    text,
    pageNumber: 1,
    bounds: {
      x: 50,
      y,
      width: 490,
      height: 12,
    },
    font: {
      size: 10,
    },
    rotation: 0,
    extractionProvenance: {
      source: "ocr-tesseract",
      confidence: 0.92,
    },
  };

  return {
    id: `line-${index}`,
    pageNumber: 1,
    words: [word],
    bounds: {
      x: 50,
      y,
      width: 490,
      height: 12,
    },
    text,
  };
}

describe(
  "Visual Block Detector",
  () => {
    it(
      "keeps adjacent OCR table header and rows in one visual block",
      () => {
        const lines = [
          createOcrLine(
            0,
            "Sl. No. Description",
            700,
          ),
          createOcrLine(
            1,
            "Quantity",
            684,
          ),
          createOcrLine(
            2,
            "1 Test item A 10",
            640,
          ),
          createOcrLine(
            3,
            "2 Test item B 20",
            600,
          ),
          createOcrLine(
            4,
            "3 Test item C 30",
            560,
          ),
        ];

        const page: PdfPageModel = {
          pageNumber: 1,
          width: 595,
          height: 842,
          words: lines.flatMap(
            (line) => line.words,
          ),
          lines,
          blocks: [],
          textExtraction: {
            wordCount: 20,
            lineCount: 5,
            characterCount: 80,
            status: "sufficient",
            qualityScore: 1,
          },
        };

        const blocks =
          detectVisualBlocksForPage(
            page,
          );

        expect(blocks).toHaveLength(1);

        expect(
  blocks[0].type,
).toBe("paragraph");

if (
  blocks[0].type !==
  "paragraph"
) {
  throw new Error(
    "Expected paragraph block",
  );
}

expect(
  blocks[0].lines,
).toHaveLength(5);
      },
    );
  },
);