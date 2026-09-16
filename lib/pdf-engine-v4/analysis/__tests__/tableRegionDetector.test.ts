import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectTableRegionsForPage,
  getTableContentStartLineIndex,
} from "../tableRegionDetector";

import type {
  PdfLine,
  PdfParagraphBlock,
  PdfVisualBlock,
  PdfWord,
} from "../../model/types";

function createWord(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
): PdfWord {
  return {
    id,
    text,
    pageNumber: 1,
    bounds: {
      x,
      y,
      width,
      height: 12,
    },
    font: {
      size: 10,
    },
    rotation: 0,
  };
}

function createLine(
  index: number,
  text: string,
): PdfLine {
  const y =
    700 - index * 18;

  const word =
    createWord(
      `word-${index}`,
      text,
      50,
      y,
      490,
    );

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

function createParagraph(
  texts: string[],
): PdfParagraphBlock {
  const lines =
    texts.map(
      (text, index) =>
        createLine(
          index,
          text,
        ),
    );

  return {
    id: "paragraph-1",
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 50,
      y: 640,
      width: 492,
      height: 80,
    },
    lines,
    text: texts.join(" "),
    confidence: 1,
  };
}

function createSingleLineParagraph(
  index: number,
  text: string,
): PdfVisualBlock {
  const line =
    createLine(index, text);

  return {
    id: `paragraph-${index}`,
    type: "paragraph",
    pageNumber: 1,
    bounds: line.bounds,
    lines: [line],
    text,
    confidence: 1,
  };
}

function createMultiLineParagraph(
  id: string,
  startLineIndex: number,
  texts: string[],
  source?:
    | "native-pdf"
    | "ocr-tesseract",
): PdfParagraphBlock {
  const lines =
    texts.map(
      (text, offset) => {
        const line =
          createLine(
            startLineIndex + offset,
            text,
          );

        return {
          ...line,
          words:
            line.words.map(
              (word) => ({
                ...word,
                extractionProvenance:
                  source
                    ? {
                        source,
                        confidence: 85,
                      }
                    : undefined,
              }),
            ),
        };
      },
    );

  const minY =
    Math.min(
      ...lines.map(
        (line) => line.bounds.y,
      ),
    );

  const maxY =
    Math.max(
      ...lines.map(
        (line) =>
          line.bounds.y +
          line.bounds.height,
      ),
    );

  return {
    id,
    type: "paragraph",
    pageNumber: 1,
    bounds: {
      x: 50,
      y: minY,
      width: 490,
      height: maxY - minY,
    },
    lines,
    text: texts.join(" "),
    confidence: 1,
  };
}

function createOcrMultiLineParagraph(
  id: string,
  startLineIndex: number,
  texts: string[],
): PdfParagraphBlock {
  return createMultiLineParagraph(
    id,
    startLineIndex,
    texts,
    "ocr-tesseract",
  );
}

describe(
  "Table Region Detector V2",
  () => {
    it(
      "does not treat a long Name of work paragraph as a table candidate",
      () => {
        const block =
          createParagraph([
            "Name of work: FDR retrofitting of different water supply scheme during the year 2024-25",
            "Deployment of vehicle for supply drinking water in different habitation within the jurisdiction",
            "of DWS Sub-Division Damcherra under the concerned work group",
          ]);

        const result =
          detectTableRegionsForPage([
            block,
          ]);

        expect(
          result.tableRegions.length,
        ).toBe(0);

        expect(
          result.regions[0]
            .analysis.breakdown.header
            .score,
        ).toBe(0);
      },
    );

    it(
      "still recognizes compact table header text as header evidence",
      () => {
        const block =
          createParagraph([
            "Sl No",
            "Name of Habitation",
            "Remarks",
          ]);

        const result =
          detectTableRegionsForPage([
            block,
          ]);

        expect(
          result.regions[0]
            .analysis.breakdown.header
            .score,
        ).toBeGreaterThan(0);
      },
    );
    it(
      "recognizes consecutive single-line blocks as one table candidate",
      () => {
        const blocks = [
          createSingleLineParagraph(
            10,
            "Sl No Name of Scheme GP / VC Capacity Status",
          ),
          createSingleLineParagraph(
            11,
            "1 Rani Para Innovative Scheme Damcherra RF VC 30,000 G/day Functional",
          ),
          createSingleLineParagraph(
            12,
            "2 Khahamthai Para Water Supply West Damcherra 75,000 G/day Functional",
          ),
          createSingleLineParagraph(
            13,
            "3 Jalidhan Para Innovative Scheme Uttamjoy Para VC 20,000 G/day Repair ongoing",
          ),
          createSingleLineParagraph(
            14,
            "4 Nilbhusan Para Innovative Scheme Kacharicherra VC 15,000 G/day Functional",
          ),
          createSingleLineParagraph(
            15,
            "5 Kamalacherri Innovative Scheme 15,000 G/day Functional",
          ),
          createSingleLineParagraph(
            16,
            "6 Purnaram Para Innovative Scheme Thumsarai Para 30,000 G/day Source low",
          ),
        ];

        const result =
          detectTableRegionsForPage(
            blocks,
          );

        expect(
          result.tableRegions.some(
            (region) =>
              region.block.type ===
              "paragraph" &&
              region.block.lines.length ===
              7,
          ),
        ).toBe(true);
      },
    );

    it(
      "recovers fragmented multi-line OCR blocks as one table candidate",
      () => {
        const blocks = [
          createOcrMultiLineParagraph(
            "ocr-fragment-1",
            10,
            [
              "Sl No Name of Scheme GP / VC Status Remarks",
              "1 Rani Para Scheme Damcherra RF Functional Normal",
            ],
          ),
          createOcrMultiLineParagraph(
            "ocr-fragment-2",
            15,
            [
              "2 Khahamthai Para West Damcherra Functional Normal",
              "3 Jalidhan Para Scheme Uttamjoy VC Functional Normal",
            ],
          ),
          createOcrMultiLineParagraph(
            "ocr-fragment-3",
            20,
            [
              "4 Nilbusan Para Scheme Kacharicherra Repair Motor fault",
              "5 Kamalacherri Scheme Thumsarai Functional Normal",
            ],
          ),
        ];

        const result =
          detectTableRegionsForPage(
            blocks,
          );

        expect(
          result.tableRegions.some(
            (region) =>
              region.block.type ===
                "paragraph" &&
              region.block.lines.length ===
                6,
          ),
        ).toBe(true);
      },
    );

    it(
      "does not keep a contained OCR fragment beside its larger recovered table candidate",
      () => {
        const blocks = [
          createOcrMultiLineParagraph(
            "ocr-overlap-1",
            10,
            [
              "Sl No Name of Scheme GP / VC Status Remarks",
              "1 Rani Para Scheme Damcherra RF Functional Normal",
              "2 Khahamthai Para West Damcherra Functional Normal",
            ],
          ),
          createOcrMultiLineParagraph(
            "ocr-overlap-2",
            16,
            [
              "3 Jalidhan Para Scheme Uttamjoy VC Functional Normal",
              "4 Nilbusan Para Scheme Kacharicherra Repair Motor fault",
              "5 Kamalacherri Scheme Thumsarai Functional Normal",
            ],
          ),
          createOcrMultiLineParagraph(
            "ocr-overlap-3",
            22,
            [
              "6 Purnaram Para Scheme Thumsarai Low source Tanker used",
              "7 Gouranga Para Scheme West Damcherra Repair Pipe damage",
              "8 Halam Para Scheme Damcherra Functional Normal",
            ],
          ),
        ];

        const result =
          detectTableRegionsForPage(
            blocks,
          );

        const recoveredRegions =
          result.tableRegions.filter(
            (region) =>
              region.block.type ===
                "paragraph" &&
              region.block.id.startsWith(
                "ocr-cross-block-",
              ),
          );

        expect(
          recoveredRegions,
        ).toHaveLength(1);

        expect(
          result.tableRegions,
        ).toHaveLength(1);
      },
    );

it(
  "does not merge two nearby OCR tables into one recovered table",
  () => {
    const blocks = [
      createOcrMultiLineParagraph(
        "ocr-table-a-1",
        10,
        [
          "Sl No Name of Scheme GP / VC Status Remarks",
          "1 Rani Para Scheme Damcherra RF Functional Normal",
        ],
      ),
      createOcrMultiLineParagraph(
        "ocr-table-a-2",
        13,
        [
          "2 Khahamthai Para West Damcherra Functional Normal",
          "3 Jalidhan Para Scheme Uttamjoy VC Functional Normal",
        ],
      ),
      createOcrMultiLineParagraph(
        "ocr-table-a-3",
        16,
        [
          "4 Nilbusan Para Scheme Kacharicherra Repair Motor fault",
          "5 Kamalacherri Scheme Thumsarai Functional Normal",
        ],
      ),
      createOcrMultiLineParagraph(
        "ocr-table-b-1",
        20,
        [
          "Sl No Description Quantity Rate Amount Remarks",
          "1 Pipe repair 10 250 2500 Completed",
        ],
      ),
      createOcrMultiLineParagraph(
        "ocr-table-b-2",
        23,
        [
          "2 Valve replacement 4 500 2000 Completed",
          "3 Pump repair 1 1500 1500 Pending",
        ],
      ),
      createOcrMultiLineParagraph(
        "ocr-table-b-3",
        26,
        [
          "4 Fitting replacement 8 150 1200 Completed",
          "5 Labour charge 2 600 1200 Completed",
        ],
      ),
    ];

    const result =
      detectTableRegionsForPage(
        blocks,
      );

    const recoveredRegions =
  result.regions.filter(
        (region) =>
          region.block.id.startsWith(
            "ocr-cross-block-",
          ),
      );

    expect(
      recoveredRegions,
    ).toHaveLength(2);

    expect(
      recoveredRegions.every(
        (region) =>
          region.block.type ===
            "paragraph" &&
          region.block.lines.length ===
            6,
      ),
    ).toBe(true);

expect(
  recoveredRegions.some(
    (region) =>
      region.block.type ===
        "paragraph" &&
      region.block.lines.length >
        6,
  ),
).toBe(false);
  },
);

    it(
      "does not automatically join fragmented native multi-line blocks",
      () => {
        const blocks = [
          createMultiLineParagraph(
            "native-fragment-1",
            20,
            [
              "Sl No Name of Scheme GP / VC Status Remarks",
              "1 Rani Para Scheme Damcherra RF Functional Normal",
            ],
            "native-pdf",
          ),
          createMultiLineParagraph(
            "native-fragment-2",
            25,
            [
              "2 Khahamthai Para West Damcherra Functional Normal",
              "3 Jalidhan Para Scheme Uttamjoy VC Functional Normal",
            ],
            "native-pdf",
          ),
          createMultiLineParagraph(
            "native-fragment-3",
            30,
            [
              "4 Nilbusan Para Scheme Kacharicherra Repair Motor fault",
              "5 Kamalacherri Scheme Thumsarai Functional Normal",
            ],
            "native-pdf",
          ),
        ];

        const result =
          detectTableRegionsForPage(
            blocks,
          );

        expect(
          result.tableRegions.some(
            (region) =>
              region.block.type ===
                "paragraph" &&
              region.block.lines.length ===
                6,
          ),
        ).toBe(false);
      },
    );

    it(
      "does not treat consecutive single-line prose blocks as a table candidate",
      () => {
        const blocks = [
          createSingleLineParagraph(
            20,
            "This document explains the proposed water supply improvement work.",
          ),
          createSingleLineParagraph(
            21,
            "The scheme will serve households located within the project area.",
          ),
          createSingleLineParagraph(
            22,
            "Implementation will proceed after administrative approval is received.",
          ),
        ];

        const result =
          detectTableRegionsForPage(
            blocks,
          );

        expect(
          result.tableRegions.length,
        ).toBe(0);
      },
    );
    it(
      "starts table analysis at the real header when multiple preamble lines come first",
      () => {
        const block =
          createParagraph([
            "PDFNova Phase 10.9 Controlled Fixture",
            "Table A - North Zone",
            "Sl No Name of Scheme Status Remarks",
            "1 Rani Para Scheme Functional Normal supply",
            "2 Khahamthai Para Scheme Functional Normal supply",
          ]);

        expect(
          getTableContentStartLineIndex(
            block.lines,
          ),
        ).toBe(2);
      },
    );

    it(
      "preserves a single upper-level title above the column header",
      () => {
        const block =
          createParagraph([
            "Water Supply Details",
            "Sl No Name of Scheme Status Remarks",
            "1 Rani Para Scheme Functional Normal supply",
            "2 Khahamthai Para Scheme Functional Normal supply",
          ]);

        expect(
          getTableContentStartLineIndex(
            block.lines,
          ),
        ).toBe(0);
      },
    );
it(
  "starts at the real header when a report title contains header-like words",
  () => {
    const block =
      createParagraph([
        "WATER SUPPLY SCHEME STATUS REPORT",
        "Sl No Name of Scheme GP / VC Status Remarks",
        "1 Rani Para Scheme Damcherra RF Functional Normal",
        "2 Khahamthai Para West Damcherra Functional Normal",
      ]);

    expect(
      getTableContentStartLineIndex(
        block.lines,
      ),
    ).toBe(1);
  },
);
  },
);
