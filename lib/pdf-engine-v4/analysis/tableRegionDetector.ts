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
    !looksLikeSentence
  );
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

export function detectTableRegionsForPage(
  blocks: PdfVisualBlock[],
  options?: TableRegionDetectorOptions,
): TableRegionDetectionResult {
  const resolvedOptions: Required<TableRegionDetectorOptions> = {
    tableThreshold:
      options?.tableThreshold ??
      DEFAULT_TABLE_THRESHOLD,
    possibleTableThreshold:
      options?.possibleTableThreshold ??
      DEFAULT_POSSIBLE_TABLE_THRESHOLD,
    xAlignmentTolerance:
      options?.xAlignmentTolerance ??
      DEFAULT_X_ALIGNMENT_TOLERANCE,
  };

  const regions =
    blocks.map((block) => ({
      block,
      analysis: analyzeBlock(
        block,
        resolvedOptions,
      ),
    }));

  const tableRegions =
    regions.filter(
      (region) =>
        region.analysis.totalScore >=
        resolvedOptions.possibleTableThreshold,
    );

  return {
    regions,
    tableRegions,
  };
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
