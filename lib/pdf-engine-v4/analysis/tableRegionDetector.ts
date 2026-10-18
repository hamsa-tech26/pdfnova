import {splitParallelScientificTables} from "./parallelScientificTableRecovery";
import {findPairedNativeCaptionGrids} from "./pairedNativeCaptionGrid";
import {findNativeElevenColumnGrids} from "./nativeElevenColumnGrid";
import type {
  PdfLine,
  PdfVisualBlock,
  TableRegionAnalysis,
} from "../model/types";

export type AnalyzedTableRegion = {
  block: PdfVisualBlock;
  analysis: TableRegionAnalysis;
};

export type TableRegionDetectionResult = {
  regions: AnalyzedTableRegion[];
  tableRegions: AnalyzedTableRegion[];
};

type TableRegionDetectorOptions = {
  tableThreshold?: number;
  possibleTableThreshold?: number;
  xAlignmentTolerance?: number;
};

const DEFAULT_TABLE_THRESHOLD = 60;
const DEFAULT_POSSIBLE_TABLE_THRESHOLD = 42;
const DEFAULT_X_ALIGNMENT_TOLERANCE = 14;

const CROSS_BLOCK_MAXIMUM_GAP = 36;
const OCR_CROSS_BLOCK_MAXIMUM_GAP = 72;

const OCR_CROSS_BLOCK_MINIMUM_OVERLAP_RATIO =
  0.75;

const MAX_ALIGNMENT_SCORE = 30;
const MAX_SPACING_SCORE = 20;
const MAX_DENSITY_SCORE = 15;
const MAX_HEADER_SCORE = 20;
const MAX_NUMERIC_SCORE = 15;

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

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);

  const variance =
    values.reduce((sum, value) => {
      const difference = value - mean;
      return sum + difference * difference;
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function getBlockLines(
  block: PdfVisualBlock,
): PdfLine[] {
  if (
    block.type === "paragraph" ||
    block.type === "heading"
  ) {
    return block.lines;
  }

  return [];
}

function getSingleLineTextBlockLine(
  block: PdfVisualBlock,
): PdfLine | null {
  if (
    block.type !== "paragraph" &&
    block.type !== "heading"
  ) {
    return null;
  }

  if (block.lines.length !== 1) {
    return null;
  }

  return block.lines[0] ?? null;
}

function getCrossBlockVerticalGap(
  previousLine: PdfLine,
  currentLine: PdfLine,
) {
  return (
    previousLine.bounds.y -
    (currentLine.bounds.y +
      currentLine.bounds.height)
  );
}

function getCrossBlockHorizontalOverlapRatio(
  previousLine: PdfLine,
  currentLine: PdfLine,
) {
  const previousLeft =
    previousLine.bounds.x;

  const previousRight =
    previousLine.bounds.x +
    previousLine.bounds.width;

  const currentLeft =
    currentLine.bounds.x;

  const currentRight =
    currentLine.bounds.x +
    currentLine.bounds.width;

  const overlap =
    Math.max(
      0,
      Math.min(
        previousRight,
        currentRight,
      ) -
        Math.max(
          previousLeft,
          currentLeft,
        ),
    );

  const shorterWidth =
    Math.min(
      previousLine.bounds.width,
      currentLine.bounds.width,
    );

  return shorterWidth <= 0
    ? 0
    : overlap / shorterWidth;
}

function canJoinCrossBlockRun(
  previousBlock: PdfVisualBlock,
  currentBlock: PdfVisualBlock,
) {
  if (
    previousBlock.pageNumber !==
    currentBlock.pageNumber
  ) {
    return false;
  }

  const previousLine =
    getSingleLineTextBlockLine(
      previousBlock,
    );

  const currentLine =
    getSingleLineTextBlockLine(
      currentBlock,
    );

  if (!previousLine || !currentLine) {
    return false;
  }

  const verticalGap =
    getCrossBlockVerticalGap(
      previousLine,
      currentLine,
    );

  if (
    verticalGap < 0 ||
    verticalGap >
      CROSS_BLOCK_MAXIMUM_GAP
  ) {
    return false;
  }

  const horizontalOverlapRatio =
    getCrossBlockHorizontalOverlapRatio(
      previousLine,
      currentLine,
    );

  return horizontalOverlapRatio >= 0.75;
}

function createCrossBlockCandidate(
  blocks: PdfVisualBlock[],
): PdfVisualBlock | null {
  if (blocks.length < 3) {
    return null;
  }

  const lines =
    blocks
      .map(
        getSingleLineTextBlockLine,
      )
      .filter(
        (
          line,
        ): line is PdfLine =>
          line !== null,
      )
      .sort(
        (first, second) =>
          second.bounds.y -
          first.bounds.y,
      );

  if (lines.length !== blocks.length) {
    return null;
  }

  const firstBlock = blocks[0];
  const lastBlock =
    blocks[blocks.length - 1];

  if (!firstBlock || !lastBlock) {
    return null;
  }

  const minX =
    Math.min(
      ...lines.map(
        (line) => line.bounds.x,
      ),
    );

  const minY =
    Math.min(
      ...lines.map(
        (line) => line.bounds.y,
      ),
    );

  const maxX =
    Math.max(
      ...lines.map(
        (line) =>
          line.bounds.x +
          line.bounds.width,
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
    id:
      `cross-block-${firstBlock.pageNumber}-${firstBlock.id}-${lastBlock.id}`,
    type: "paragraph",
    pageNumber:
      firstBlock.pageNumber,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    lines,
    text: lines
      .map(
        (line) => line.text.trim(),
      )
      .filter(Boolean)
      .join(" "),
    confidence:
      Math.min(
        ...blocks.map(
          (block) =>
            block.confidence,
        ),
      ),
  };
}

function createCrossBlockCandidates(
  blocks: PdfVisualBlock[],
): PdfVisualBlock[] {
  const candidates: PdfVisualBlock[] =
    [];

  let currentRun: PdfVisualBlock[] =
    [];

  const flushCurrentRun = () => {
    const candidate =
      createCrossBlockCandidate(
        currentRun,
      );

    if (candidate) {
      candidates.push(candidate);
    }

    currentRun = [];
  };

  for (const block of blocks) {
    const line =
      getSingleLineTextBlockLine(
        block,
      );

    if (!line) {
      flushCurrentRun();
      continue;
    }

    if (currentRun.length === 0) {
      currentRun = [block];
      continue;
    }

    const previousBlock =
      currentRun[
        currentRun.length - 1
      ];

    if (
      previousBlock &&
      canJoinCrossBlockRun(
        previousBlock,
        block,
      )
    ) {
      currentRun.push(block);
      continue;
    }

    flushCurrentRun();
    currentRun = [block];
  }

  flushCurrentRun();

  return candidates;
}

function isOcrTextBlock(
  block: PdfVisualBlock,
) {
  const lines =
    getBlockLines(block);

  return (
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.words.length > 0 &&
        line.words.every(
          (word) =>
            word.extractionProvenance
              ?.source ===
            "ocr-tesseract",
        ),
    )
  );
}

function getCrossBlockBoundsVerticalGap(
  previousBlock: PdfVisualBlock,
  currentBlock: PdfVisualBlock,
) {
  return (
    previousBlock.bounds.y -
    (currentBlock.bounds.y +
      currentBlock.bounds.height)
  );
}

function getCrossBlockBoundsHorizontalOverlapRatio(
  previousBlock: PdfVisualBlock,
  currentBlock: PdfVisualBlock,
) {
  const previousLeft =
    previousBlock.bounds.x;

  const previousRight =
    previousBlock.bounds.x +
    previousBlock.bounds.width;

  const currentLeft =
    currentBlock.bounds.x;

  const currentRight =
    currentBlock.bounds.x +
    currentBlock.bounds.width;

  const overlap =
    Math.max(
      0,
      Math.min(
        previousRight,
        currentRight,
      ) -
        Math.max(
          previousLeft,
          currentLeft,
        ),
    );

  const shorterWidth =
    Math.min(
      previousBlock.bounds.width,
      currentBlock.bounds.width,
    );

  return shorterWidth <= 0
    ? 0
    : overlap / shorterWidth;
}

function canJoinOcrCrossBlockRun(
  previousBlock: PdfVisualBlock,
  currentBlock: PdfVisualBlock,
) {
  if (
    previousBlock.pageNumber !==
      currentBlock.pageNumber ||
    !isOcrTextBlock(previousBlock) ||
    !isOcrTextBlock(currentBlock)
  ) {
    return false;
  }

  const verticalGap =
    getCrossBlockBoundsVerticalGap(
      previousBlock,
      currentBlock,
    );

  if (
    verticalGap < 0 ||
    verticalGap >
      OCR_CROSS_BLOCK_MAXIMUM_GAP
  ) {
    return false;
  }

  const horizontalOverlapRatio =
    getCrossBlockBoundsHorizontalOverlapRatio(
      previousBlock,
      currentBlock,
    );

  return (
    horizontalOverlapRatio >=
    OCR_CROSS_BLOCK_MINIMUM_OVERLAP_RATIO
  );
}

function createOcrCrossBlockCandidate(
  blocks: PdfVisualBlock[],
): PdfVisualBlock | null {
  if (blocks.length < 3) {
    return null;
  }

  const hasMultiLineBlock =
    blocks.some(
      (block) =>
        getBlockLines(block).length >
        1,
    );

  if (!hasMultiLineBlock) {
    return null;
  }

  const lines =
    blocks
      .flatMap(
        getBlockLines,
      )
      .sort(
        (first, second) =>
          second.bounds.y -
          first.bounds.y,
      );

  if (lines.length < 5) {
    return null;
  }

  const hasHeaderEvidence =
    lines.some(
      isLikelyHeaderLine,
    );

  const numericLineCount =
    lines.filter(
      hasNumericStart,
    ).length;

  if (
    !hasHeaderEvidence &&
    numericLineCount < 3
  ) {
    return null;
  }

  const firstBlock =
    blocks[0];

  const lastBlock =
    blocks[blocks.length - 1];

  if (!firstBlock || !lastBlock) {
    return null;
  }

  const minX =
    Math.min(
      ...lines.map(
        (line) => line.bounds.x,
      ),
    );

  const minY =
    Math.min(
      ...lines.map(
        (line) => line.bounds.y,
      ),
    );

  const maxX =
    Math.max(
      ...lines.map(
        (line) =>
          line.bounds.x +
          line.bounds.width,
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
    id:
      `ocr-cross-block-${firstBlock.pageNumber}-${firstBlock.id}-${lastBlock.id}`,
    type: "paragraph",
    pageNumber:
      firstBlock.pageNumber,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    lines,
    text:
      lines
        .map(
          (line) =>
            line.text.trim(),
        )
        .filter(Boolean)
        .join(" "),
    confidence:
      Math.min(
        ...blocks.map(
          (block) =>
            block.confidence,
        ),
      ),
  };
}

function createOcrCrossBlockCandidates(
  blocks: PdfVisualBlock[],
): PdfVisualBlock[] {
  const candidates:
    PdfVisualBlock[] = [];

  let currentRun:
    PdfVisualBlock[] = [];

  const flushCurrentRun = () => {
    const candidate =
      createOcrCrossBlockCandidate(
        currentRun,
      );

    if (candidate) {
      candidates.push(
        candidate,
      );
    }

    currentRun = [];
  };

  for (const block of blocks) {
    if (!isOcrTextBlock(block)) {
      flushCurrentRun();
      continue;
    }

    if (currentRun.length === 0) {
      currentRun = [block];
      continue;
    }

const currentBlockHasHeaderEvidence =
  getBlockLines(
    block,
  ).some(
    hasExplicitColumnHeaderEvidence,
  );

const currentRunHasHeaderEvidence =
  currentRun.some(
    (runBlock) =>
      getBlockLines(
        runBlock,
      ).some(
        hasExplicitColumnHeaderEvidence,
      ),
  );

if (
  currentBlockHasHeaderEvidence &&
  currentRunHasHeaderEvidence
) {
  flushCurrentRun();
  currentRun = [block];
  continue;
}

    const previousBlock =
      currentRun[
        currentRun.length - 1
      ];

    if (
      previousBlock &&
      canJoinOcrCrossBlockRun(
        previousBlock,
        block,
      )
    ) {
      currentRun.push(block);
      continue;
    }

    flushCurrentRun();
    currentRun = [block];
  }

  flushCurrentRun();

  return candidates;
}

function isContainedByRecoveredOcrRegion(
  region: AnalyzedTableRegion,
  recoveredRegions:
    AnalyzedTableRegion[],
) {
  if (
    !isOcrTextBlock(region.block) ||
    region.block.id.startsWith(
      "ocr-cross-block-",
    )
  ) {
    return false;
  }

  const regionLines =
    getBlockLines(region.block);

  if (regionLines.length === 0) {
    return false;
  }

  return recoveredRegions.some(
    (recoveredRegion) => {
      const recoveredLines =
        getBlockLines(
          recoveredRegion.block,
        );

      if (
        recoveredLines.length <=
        regionLines.length
      ) {
        return false;
      }

      const recoveredLineIds =
        new Set(
          recoveredLines.map(
            (line) => line.id,
          ),
        );

      return regionLines.every(
        (line) =>
          recoveredLineIds.has(
            line.id,
          ),
      );
    },
  );
}

function getLineStarts(lines: PdfLine[]) {
  return lines.flatMap((line) =>
    line.words.map((word) => word.bounds.x),
  );
}

function clusterXPositions(
  values: number[],
  tolerance: number,
) {
  const sortedValues = [...values].sort(
    (first, second) => first - second,
  );

  const clusters: number[][] = [];

  for (const value of sortedValues) {
    const matchingCluster = clusters.find(
      (cluster) =>
        Math.abs(
          average(cluster) - value,
        ) <= tolerance,
    );

    if (matchingCluster) {
      matchingCluster.push(value);
    } else {
      clusters.push([value]);
    }
  }

  return clusters;
}

function scoreAlignment(
  lines: PdfLine[],
  tolerance: number,
) {
  if (lines.length < 3) {
    return { score: 0, confidence: 0 };
  }

  const starts = getLineStarts(lines);
  const clusters =
    clusterXPositions(
      starts,
      tolerance,
    );

  const strongClusters =
    clusters.filter(
      (cluster) => cluster.length >= 3,
    );

  const supportedItems =
    strongClusters.reduce(
      (sum, cluster) =>
        sum + cluster.length,
      0,
    );

  const supportRatio =
    starts.length === 0
      ? 0
      : supportedItems / starts.length;

  const clusterFactor =
    clamp(
      strongClusters.length / 6,
      0,
      1,
    );

  const score =
    MAX_ALIGNMENT_SCORE *
    clamp(
      supportRatio * 0.65 +
        clusterFactor * 0.35,
      0,
      1,
    );

  return {
    score,
    confidence: clamp(
      supportRatio,
      0,
      1,
    ),
  };
}

function scoreSpacing(lines: PdfLine[]) {
  if (lines.length < 4) {
    return { score: 0, confidence: 0 };
  }

  const sortedLines = [...lines].sort(
    (first, second) =>
      second.bounds.y -
      first.bounds.y,
  );

  const gaps: number[] = [];

  for (
    let index = 1;
    index < sortedLines.length;
    index += 1
  ) {
    const previousLine =
      sortedLines[index - 1];

    const currentLine =
      sortedLines[index];

    const gap =
      previousLine.bounds.y -
      (currentLine.bounds.y +
        currentLine.bounds.height);

    if (gap >= 0) {
      gaps.push(gap);
    }
  }

  if (gaps.length < 3) {
    return { score: 0, confidence: 0 };
  }

  const meanGap = average(gaps);
  const deviation =
    standardDeviation(gaps);

  const regularity =
    meanGap <= 0
      ? 0
      : clamp(
          1 - deviation / Math.max(meanGap, 1),
          0,
          1,
        );

  return {
    score:
      MAX_SPACING_SCORE *
      regularity,
    confidence: regularity,
  };
}

function scoreDensity(
  lines: PdfLine[],
  block: PdfVisualBlock,
) {
  if (
    lines.length === 0 ||
    block.bounds.width <= 0 ||
    block.bounds.height <= 0
  ) {
    return { score: 0, confidence: 0 };
  }

  const wordCount =
    lines.reduce(
      (sum, line) =>
        sum + line.words.length,
      0,
    );

  const area =
    block.bounds.width *
    block.bounds.height;

  const wordsPerThousandUnits =
    area <= 0
      ? 0
      : (wordCount / area) * 1000;

  const lineFactor =
    clamp(
      lines.length / 10,
      0,
      1,
    );

  const densityFactor =
    clamp(
      wordsPerThousandUnits / 1.2,
      0,
      1,
    );

  const combined =
    lineFactor * 0.55 +
    densityFactor * 0.45;

  return {
    score:
      MAX_DENSITY_SCORE *
      combined,
    confidence: combined,
  };
}

function isLikelyHeaderLine(line: PdfLine) {
  const text = line.text.trim();

  if (!text) return false;

  const lowerText =
    text.toLowerCase();

  const headerTerms = [
    "sl no",
    "serial",
    "name of",
    "habitation",
    "school",
    "status",
    "scheme",
    "quantity",
    "rate",
    "amount",
    "description",
    "unit",
    "remarks",
  ];

  const matchingTerms =
    headerTerms.filter((term) =>
      lowerText.includes(term),
    ).length;

    const wordCount =
  text
    .split(/\s+/)
    .filter(Boolean).length;

const headerTermDensity =
  matchingTerms /
  Math.max(wordCount, 1);

const hasHeaderLikeShape =
  wordCount <= 8 ||
  headerTermDensity >= 0.25;

  const mostlyText =
    text.replace(
      /[^a-zA-Z]/g,
      "",
    ).length >=
    text.replace(/\s/g, "").length *
      0.5;

  const looksLikeSentence =
    /[.!?]$/.test(text);

  return (
  matchingTerms > 0 &&
  mostlyText &&
  !looksLikeSentence &&
  hasHeaderLikeShape
);
}

function hasExplicitColumnHeaderEvidence(
  line: PdfLine,
) {
  const text =
    line.text
      .trim()
      .toLowerCase();

  if (!text) {
    return false;
  }

  const explicitHeaderTerms = [
    "sl no",
    "serial",
    "name of",
    "habitation",
    "quantity",
    "rate",
    "amount",
    "description",
    "unit",
    "remarks",
  ];

  return explicitHeaderTerms.some(
    (term) =>
      text.includes(term),
  );
}

function isLikelyReportTitleLine(
  line: PdfLine,
) {
  const text =
    line.text
      .trim()
      .toLowerCase();

  return (
    /\breport\b/.test(text) &&
    !hasExplicitColumnHeaderEvidence(
      line,
    )
  );
}

export function getTableContentStartLineIndex(
  lines: PdfLine[],
) {
  const firstHeaderIndex =
    lines.findIndex(
      isLikelyHeaderLine,
    );
if (
  firstHeaderIndex === 0 &&
  lines[0] &&
  isLikelyReportTitleLine(
    lines[0],
  )
) {
  const explicitHeaderIndex =
    lines
      .slice(1, 4)
      .findIndex(
        hasExplicitColumnHeaderEvidence,
      );

  if (
    explicitHeaderIndex >= 0
  ) {
    return (
      explicitHeaderIndex + 1
    );
  }
}

  if (firstHeaderIndex < 2) {
    return 0;
  }

  const remainingLineCount =
    lines.length -
    firstHeaderIndex;

  if (remainingLineCount < 3) {
    return 0;
  }

  return firstHeaderIndex;
}

function scoreHeader(lines: PdfLine[]) {
  if (lines.length === 0) {
    return { score: 0, confidence: 0 };
  }

  const firstLines =
    lines.slice(
      0,
      Math.min(5, lines.length),
    );

  const headerMatches =
    firstLines.filter(
      isLikelyHeaderLine,
    ).length;

  const ratio =
    firstLines.length === 0
      ? 0
      : headerMatches /
        firstLines.length;

  const score =
    MAX_HEADER_SCORE *
    clamp(
      ratio * 1.35,
      0,
      1,
    );

  return {
    score,
    confidence: clamp(
      ratio,
      0,
      1,
    ),
  };
}

function hasNumericStart(line: PdfLine) {
  const sortedWords =
    [...line.words].sort(
      (first, second) =>
        first.bounds.x -
        second.bounds.x,
    );

  const firstText =
    sortedWords[0]?.text.trim() ?? "";

  return /^\d+[.)]?$/.test(
    firstText,
  );
}

function scoreNumericColumn(
  lines: PdfLine[],
) {
  if (lines.length < 3) {
    return { score: 0, confidence: 0 };
  }

  const numericLines =
    lines.filter(
      hasNumericStart,
    ).length;

  const ratio =
    numericLines / lines.length;

  const normalized =
    clamp(
      ratio / 0.45,
      0,
      1,
    );

  return {
    score:
      MAX_NUMERIC_SCORE *
      normalized,
    confidence: normalized,
  };
}

function createZeroAnalysis(): TableRegionAnalysis {
  return {
    isTable: false,
    totalScore: 0,
    confidence: 0,
    breakdown: {
      alignment: { score: 0, confidence: 0 },
      spacing: { score: 0, confidence: 0 },
      density: { score: 0, confidence: 0 },
      header: { score: 0, confidence: 0 },
      numericColumn: { score: 0, confidence: 0 },
    },
  };
}

function analyzeBlock(
  block: PdfVisualBlock,
  options: Required<TableRegionDetectorOptions>,
): TableRegionAnalysis {
  const lines =
    getBlockLines(block);

  if (lines.length < 3) {
    return createZeroAnalysis();
  }

  const alignment =
    scoreAlignment(
      lines,
      options.xAlignmentTolerance,
    );

  const spacing =
    scoreSpacing(lines);

  const density =
    scoreDensity(
      lines,
      block,
    );

  const header =
    scoreHeader(lines);

  const numericColumn =
    scoreNumericColumn(lines);

  const totalScore =
    alignment.score +
    spacing.score +
    density.score +
    header.score +
    numericColumn.score;

  const confidence =
    clamp(
      average([
        alignment.confidence,
        spacing.confidence,
        density.confidence,
        header.confidence,
        numericColumn.confidence,
      ]),
      0,
      1,
    );

  return {
    isTable:
      totalScore >=
      options.tableThreshold,
    totalScore,
    confidence,
    breakdown: {
      alignment,
      spacing,
      density,
      header,
      numericColumn,
    },
  };
}

function convertBlockToTableCandidate(
  block: PdfVisualBlock,
  analysis: TableRegionAnalysis,
): PdfVisualBlock {
  if (
    !analysis.isTable ||
    block.type !== "paragraph"
  ) {
    return block;
  }

  return {
    id: block.id,
    type: "table",
    pageNumber: block.pageNumber,
    bounds: block.bounds,
    rows: [],
    columnCount: 0,
    confidence: analysis.confidence,
  };
}

/**
 * Recover captioned numeric tables swallowed by a large prose block.
 * Keep each original line exactly once: caption/prose remain as paragraph
 * fragments, while only the numeric grid is analyzed as a table candidate.
 */
type CaptionAnchoredCandidate = {
  sourceBlock: Extract<PdfVisualBlock, { type: "paragraph" }>;
  block: PdfVisualBlock;
  firstLineIndex: number;
  lastLineIndex: number;
};

function getBoundsForLines(lines: PdfLine[]) {
  const minX = Math.min(...lines.map(line => line.bounds.x));
  const minY = Math.min(...lines.map(line => line.bounds.y));
  const maxX = Math.max(...lines.map(line => line.bounds.x + line.bounds.width));
  const maxY = Math.max(...lines.map(line => line.bounds.y + line.bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function createCaptionAnchoredCandidates(
  blocks: PdfVisualBlock[],
): CaptionAnchoredCandidate[] {
  const candidates: CaptionAnchoredCandidate[] = [];
  const isCaption = (text: string) =>
    /^table\s+(?:\d{1,3}|s\d{1,3})(?:\s*[.:\u2013\u2014]\s*|\s*$)/i.test(text.trim());
  for (const block of blocks) {
    if (block.type !== "paragraph" || block.lines.length < 6) continue;
    for (let start = 0; start < block.lines.length; start += 1) {
      if (!isCaption(block.lines[start]?.text ?? "")) continue;
      // The next caption terminates this grid even when it shares a paragraph.
      const nextCaptionOffset = block.lines.slice(start + 1)
        .findIndex(line => isCaption(line.text));
      const nextCaptionIndex = nextCaptionOffset < 0
        ? block.lines.length
        : start + 1 + nextCaptionOffset;
      const windowLines = block.lines.slice(
        start + 1,
        Math.min(block.lines.length, start + 1 + 85, nextCaptionIndex),
      );
      if (windowLines.length < 4) continue;
      // Long scientific grids may exceed 22 lines. Stop after repeated prose
      // rather than including distant numbers in the table's bounds.
      const numericIndexes: number[] = [];
      let nonGridStreak = 0;
      for (const [index, line] of windowLines.entries()) {
        const words = [...line.words].sort((a, b) => a.bounds.x - b.bounds.x);
        const numeric = words.filter(word =>
          /^[-+]?\d[\d,.]*(?:%|[)])?$/.test(word.text.trim()),
        );
        const spread = words.length < 3
          ? 0
          : words[words.length - 1].bounds.x - words[0].bounds.x;
        if (numeric.length >= 2 && spread >= 85) {
          numericIndexes.push(index);
          nonGridStreak = 0;
        } else if (numericIndexes.length >= 2) {
          nonGridStreak += 1;
          if (nonGridStreak >= 3) break;
        }
      }
      if (numericIndexes.length < 2) continue;
      // Do not swallow the article's trailing prose into the table region.
      const tableLines = windowLines.slice(
        0,
        numericIndexes[numericIndexes.length - 1] + 1,
      );
      if (tableLines.length < 4) continue;
      candidates.push({
        sourceBlock: block,
        firstLineIndex: start + 1,
        lastLineIndex: start + tableLines.length,
        block: {
          id: "caption-table-" + block.pageNumber + "-" + block.id + "-" + start,
          type: "paragraph",
          pageNumber: block.pageNumber,
          bounds: getBoundsForLines(tableLines),
          lines: tableLines,
          text: tableLines.map(line => line.text).join(" "),
          confidence: block.confidence,
        },
      });
    }
  }
  return candidates;
}


/**
 * An intentionally high-specificity native-PDF rescue for long, uniformly
 * aligned scientific grids swallowed by one large paragraph block.
 *
 * Never lower global table thresholds. A qualifying run needs at least ten
 * consecutive rows with 5+ well-separated, nearly identical word anchors;
 * multi-column narrative text and short enumerations are not sufficient.
 */
function createRepeatedColumnGridCandidates(
  blocks: PdfVisualBlock[],
): CaptionAnchoredCandidate[] {
  const result: CaptionAnchoredCandidate[] = [];
  const tolerance = 7;
  const positions = (line: PdfLine): number[] | null => {
    if (line.words.length < 5 || line.words.length > 14) return null;
    // This isolated research release does not change OCR table behavior.
    if (line.words.some(word => word.extractionProvenance?.source === "ocr-tesseract"))
      return null;
    const words = [...line.words].sort((a, b) => a.bounds.x - b.bounds.x);
    const xs = words.map(word => word.bounds.x);
    if (xs[xs.length - 1] - xs[0] < 230) return null;
    if (xs.slice(1).some((x, index) => x - xs[index] < 20)) return null;
    return xs;
  };
  const isSameSignature = (a: number[], b: number[]) =>
    a.length === b.length &&
    a.every((x, index) => Math.abs(x - b[index]) <= tolerance);
  // Recover at most one sparse header/last row adjacent to a substantial
  // fixed-column grid. Require distinct column-anchor matches and normal
  // row spacing; this never classifies narrative alone as a table.
  const isSparseEdge = (
    edge: PdfLine | undefined,
    neighbor: PdfLine | undefined,
    anchors: number[],
    before: boolean,
  ) => {
    if (!edge || !neighbor || edge.words.length < 4 ||
        edge.words.length >= anchors.length) return false;
    if (edge.words.some(word =>
      word.extractionProvenance?.source === "ocr-tesseract")) return false;
    const xs = [...edge.words].map(word => word.bounds.x).sort((a,b)=>a-b);
    const indices = xs.map(x => anchors.findIndex(a => Math.abs(a-x)<=8));
    if (indices.some(i=>i<0) || new Set(indices).size !== indices.length)
      return false;
    if (xs[xs.length-1]-xs[0] < (anchors[anchors.length-1]-anchors[0])*0.65)
      return false;
    const gap = before
      ? edge.bounds.y - neighbor.bounds.y
      : neighbor.bounds.y - edge.bounds.y;
    return gap>=7 && gap<=22;
  };
  for (const block of blocks) {
    if (block.type !== "paragraph" || block.lines.length < 16) continue;
    const signatures = block.lines.map(positions);
    let index = 0;
    while (index < block.lines.length) {
      const base = signatures[index];
      if (!base) { index += 1; continue; }
      let end = index + 1;
      while (end < signatures.length) {
        const next = signatures[end];
        if (!next || !isSameSignature(base, next)) break;
        end += 1;
      }
      const count = end - index;
      if (count >= 10) {
        let start = index;
        let stop = end;
        if (isSparseEdge(
          block.lines[start-1],block.lines[start],base,true,
        )) start -= 1;
        if (isSparseEdge(
          block.lines[stop],block.lines[stop-1],base,false,
        )) stop += 1;
        const lines = block.lines.slice(start, stop);
        result.push({
          sourceBlock: block,
          firstLineIndex: start,
          lastLineIndex: stop - 1,
          block: {
            id: "aligned-grid-" + block.pageNumber + "-" + block.id + "-" + start,
            type: "paragraph",
            pageNumber: block.pageNumber,
            bounds: getBoundsForLines(lines),
            lines,
            text: lines.map(line => line.text).join(" "),
            confidence: block.confidence,
          },
        });
      }
      index = end;
    }
  }
  return result;
}

export function detectTableRegionsForPage(
  blocks: PdfVisualBlock[],
  options?: TableRegionDetectorOptions,
): TableRegionDetectionResult {
  const resolvedOptions: Required<TableRegionDetectorOptions> = {
    tableThreshold: options?.tableThreshold ?? DEFAULT_TABLE_THRESHOLD,
    possibleTableThreshold: options?.possibleTableThreshold ?? DEFAULT_POSSIBLE_TABLE_THRESHOLD,
    xAlignmentTolerance: options?.xAlignmentTolerance ?? DEFAULT_X_ALIGNMENT_TOLERANCE,
  };

  const splitNativeBlocks = splitParallelScientificTables(blocks);
  const crossBlockCandidates = createCrossBlockCandidates(splitNativeBlocks);
  const ocrCrossBlockCandidates = createOcrCrossBlockCandidates(splitNativeBlocks);

  // Never discard a source paragraph merely because it contains a caption.
  // Split only if the recovered grid passes the same scoped evidence gate as
  // PR #71. A rejected candidate leaves its original paragraph untouched.
  const elevenGrids=findNativeElevenColumnGrids(splitNativeBlocks)
    .map(candidate=>({...candidate,analysis:analyzeBlock(candidate.block,resolvedOptions)}));
  const pairedGrids = findPairedNativeCaptionGrids(splitNativeBlocks)
    .map(candidate => ({...candidate,analysis:analyzeBlock(candidate.block,resolvedOptions)}));
  const admitted = createCaptionAnchoredCandidates(splitNativeBlocks)
    .map(candidate => ({
      ...candidate,
      analysis: analyzeBlock(candidate.block, resolvedOptions),
    }))
    .filter(candidate =>
      candidate.analysis.breakdown.alignment.score >= 16 &&
      candidate.analysis.totalScore >= 30,
    );
  const alignedCandidates = createRepeatedColumnGridCandidates(splitNativeBlocks)
    .filter(candidate => !admitted.some(existing =>
      existing.sourceBlock === candidate.sourceBlock))
    .map(candidate => ({
      ...candidate,
      analysis: analyzeBlock(candidate.block, resolvedOptions),
    }))
    .filter(candidate =>
      candidate.analysis.breakdown.alignment.score >= 24 &&
      candidate.analysis.breakdown.spacing.score >= 12 &&
      candidate.analysis.totalScore >= resolvedOptions.tableThreshold,
    );
  const allAdmitted = [...elevenGrids,...pairedGrids, ...admitted, ...alignedCandidates];
  const bySource = new Map<PdfVisualBlock, typeof allAdmitted>();
  const captionAnalyses = new Map<PdfVisualBlock, TableRegionAnalysis>();
  for (const candidate of allAdmitted) {
    const previous = bySource.get(candidate.sourceBlock) ?? [];
    previous.push(candidate);
    bySource.set(candidate.sourceBlock, previous);
    captionAnalyses.set(candidate.block, {
      ...candidate.analysis,
      isTable: true,
      totalScore: Math.max(candidate.analysis.totalScore, resolvedOptions.tableThreshold),
    });
  }

  const proseFragments = new Set<PdfVisualBlock>();
  const splitBlocks = splitNativeBlocks.flatMap(block => {
    const captions = bySource.get(block);
    if (block.type !== "paragraph" || !captions?.length) return [block];
    let cursor = 0;
    const fragments: PdfVisualBlock[] = [];
    const preserveProse = (end: number) => {
      if (end <= cursor) return;
      const lines = block.lines.slice(cursor, end);
      const prose: PdfVisualBlock = {
        ...block,
        id: "caption-prose-" + block.pageNumber + "-" + block.id + "-" + cursor,
        bounds: getBoundsForLines(lines),
        lines,
        text: lines.map(line => line.text).join(" "),
      };
      fragments.push(prose);
      proseFragments.add(prose);
    };
    for (const caption of captions) {
      if (caption.firstLineIndex < cursor) continue;
      preserveProse(caption.firstLineIndex); // includes the published table caption
      fragments.push(caption.block);
      cursor = caption.lastLineIndex + 1;
    }
    preserveProse(block.lines.length); // includes trailing paragraphs and footnotes
    return fragments;
  });

  const candidateBlocks = [
    ...splitBlocks,
    ...crossBlockCandidates,
    ...ocrCrossBlockCandidates,
  ];
  const regions = candidateBlocks.map(block => ({
    block,
    analysis: block.id.startsWith("parallel-native-prose-")
      ? createZeroAnalysis()
      : block.id.startsWith("native-two-col-grid-")
        ? {...analyzeBlock(block,resolvedOptions),isTable:true,
            totalScore:Math.max(resolvedOptions.tableThreshold,
              analyzeBlock(block,resolvedOptions).totalScore)}
    : proseFragments.has(block)
      ? createZeroAnalysis() // never reclassify a retained prose fragment as a table
      : captionAnalyses.get(block) ?? analyzeBlock(block, resolvedOptions),
  }));

  const scoredTableRegions = regions.filter(region =>
    region.analysis.totalScore >= resolvedOptions.possibleTableThreshold,
  );
  const recoveredOcrRegions = scoredTableRegions.filter(region =>
    region.block.id.startsWith("ocr-cross-block-"),
  );
  const tableRegions = scoredTableRegions.filter(region =>
    !isContainedByRecoveredOcrRegion(region, recoveredOcrRegions),
  );

  return { regions, tableRegions };
}

export function applyTableRegionDetection(
  document: {
    pages: {
      blocks: PdfVisualBlock[];
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  },
  options?: TableRegionDetectorOptions,
) {
  const pages =
    document.pages.map((page) => {
      const detection =
        detectTableRegionsForPage(
          page.blocks,
          options,
        );

      return {
        ...page,
        blocks: detection.regions.map(
          ({ block, analysis }) =>
            convertBlockToTableCandidate(
              block,
              analysis,
            ),
        ),
        tableRegionAnalysis:
          detection.regions,
      };
    });

  return {
    ...document,
    pages,
  };
}
