import type {
  PdfLine,
  PdfVisualBlock,
  PdfWord,
} from "../model/types";

export type ColumnCandidate = {
  id: string;
  x: number;
  minX: number;
  maxX: number;
  leftBoundary: number;
  rightBoundary: number;
  occurrences: number;
  distinctLineCount: number;
  averageDeviation: number;
  stability: number;
  confidence: number;
  accepted: boolean;
  reason: string;
};

export type StableColumnDetectionResult = {
  columns: ColumnCandidate[];
  rejectedCandidates: ColumnCandidate[];
  adaptiveTolerance: number;
  confidence: number;
};

type StableColumnDetectorOptions = {
  minimumDistinctLines?: number;
  minimumSupportRatio?: number;
  minimumStability?: number;
  toleranceMultiplier?: number;
};

type LineSegment = {
  x: number;
  words: PdfWord[];
  lineId: string;
};

type CandidateCluster = {
  values: number[];
  words: PdfWord[];
  lineIds: Set<string>;
};

const DEFAULT_MINIMUM_DISTINCT_LINES = 3;
const DEFAULT_MINIMUM_SUPPORT_RATIO = 0.12;
const DEFAULT_MINIMUM_STABILITY = 0.5;
const DEFAULT_TOLERANCE_MULTIPLIER = 1.35;

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

function createId(index: number) {
  return `column-candidate-${index}`;
}

function getBlockLines(
  block: PdfVisualBlock,
): PdfLine[] {
  if (
    block.type === "paragraph" ||
    block.type === "heading"
  ) {
    return [...block.lines];
  }

  return [];
}

function getAverageCharacterWidth(
  words: PdfWord[],
) {
  const characterWidths = words
    .filter(
      (word) =>
        word.text.length > 0 &&
        word.bounds.width > 0,
    )
    .map(
      (word) =>
        word.bounds.width /
        word.text.length,
    )
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0,
    );

  return characterWidths.length > 0
    ? average(characterWidths)
    : 6;
}

function createAdaptiveTolerance(
  words: PdfWord[],
  multiplier: number,
) {
  const averageCharacterWidth =
    getAverageCharacterWidth(words);

  return clamp(
    averageCharacterWidth * multiplier,
    4,
    12,
  );
}

function splitLineIntoSegments(
  line: PdfLine,
  averageCharacterWidth: number,
): LineSegment[] {
  const sortedWords = [...line.words].sort(
    (first, second) =>
      first.bounds.x -
      second.bounds.x,
  );

  if (sortedWords.length === 0) {
    return [];
  }

  const segments: LineSegment[] = [];
  let currentWords: PdfWord[] = [
    sortedWords[0],
  ];

  for (
    let index = 1;
    index < sortedWords.length;
    index += 1
  ) {
    const previousWord =
      sortedWords[index - 1];

    const currentWord =
      sortedWords[index];

    const previousEndX =
      previousWord.bounds.x +
      previousWord.bounds.width;

    const gap =
      currentWord.bounds.x -
      previousEndX;

    const previousCharacterWidth =
      previousWord.text.length > 0
        ? previousWord.bounds.width /
          previousWord.text.length
        : averageCharacterWidth;

    const gapThreshold = Math.max(
      averageCharacterWidth * 2.2,
      previousCharacterWidth * 2.4,
      10,
    );

    if (gap > gapThreshold) {
      segments.push({
        x:
          currentWords[0]?.bounds.x ??
          0,
        words: currentWords,
        lineId: line.id,
      });

      currentWords = [currentWord];
      continue;
    }

    currentWords.push(currentWord);
  }

  if (currentWords.length > 0) {
    segments.push({
      x:
        currentWords[0]?.bounds.x ??
        0,
      words: currentWords,
      lineId: line.id,
    });
  }

  return segments;
}

function createLineSegments(
  lines: PdfLine[],
  words: PdfWord[],
) {
  const averageCharacterWidth =
    getAverageCharacterWidth(words);

  return lines.flatMap((line) =>
    splitLineIntoSegments(
      line,
      averageCharacterWidth,
    ),
  );
}

function clusterSegmentStarts(
  segments: LineSegment[],
  tolerance: number,
) {
  const sortedSegments =
    [...segments].sort(
      (first, second) =>
        first.x - second.x,
    );

  const clusters: CandidateCluster[] = [];

  for (const segment of sortedSegments) {
    let bestCluster:
      | CandidateCluster
      | undefined;

    let bestDistance =
      Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const center =
        average(cluster.values);

      const distance =
        Math.abs(
          center - segment.x,
        );

      if (
        distance <= tolerance &&
        distance < bestDistance
      ) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    }

    if (bestCluster) {
      bestCluster.values.push(
        segment.x,
      );

      bestCluster.words.push(
        ...segment.words,
      );

      bestCluster.lineIds.add(
        segment.lineId,
      );

      continue;
    }

    clusters.push({
      values: [segment.x],
      words: [...segment.words],
      lineIds: new Set([
        segment.lineId,
      ]),
    });
  }

  return clusters;
}

function calculateAverageDeviation(
  values: number[],
) {
  if (values.length === 0) {
    return 0;
  }

  const center = average(values);

  return average(
    values.map((value) =>
      Math.abs(value - center),
    ),
  );
}

function calculateStability(
  averageDeviation: number,
  tolerance: number,
) {
  if (tolerance <= 0) {
    return 0;
  }

  return clamp(
    1 -
      averageDeviation /
        Math.max(tolerance, 1),
    0,
    1,
  );
}

function createCandidate(
  cluster: CandidateCluster,
  index: number,
  totalLineCount: number,
  tolerance: number,
  options: Required<StableColumnDetectorOptions>,
): ColumnCandidate {
  const x = average(cluster.values);

  const distinctLineCount =
    cluster.lineIds.size;

  const supportRatio =
    totalLineCount > 0
      ? distinctLineCount /
        totalLineCount
      : 0;

  const averageDeviation =
    calculateAverageDeviation(
      cluster.values,
    );

  const stability =
    calculateStability(
      averageDeviation,
      tolerance,
    );

  const supportConfidence =
    clamp(
      supportRatio /
        Math.max(
          options.minimumSupportRatio,
          0.01,
        ),
      0,
      1,
    );

  const lineConfidence =
    clamp(
      distinctLineCount /
        Math.max(
          options.minimumDistinctLines,
          1,
        ),
      0,
      1,
    );

  const confidence =
    clamp(
      stability * 0.45 +
        supportConfidence * 0.35 +
        lineConfidence * 0.2,
      0,
      1,
    );

  const accepted =
    distinctLineCount >=
      options.minimumDistinctLines &&
    supportRatio >=
      options.minimumSupportRatio &&
    stability >=
      options.minimumStability;

  let reason =
    "Accepted as a stable logical column.";

  if (
    distinctLineCount <
    options.minimumDistinctLines
  ) {
    reason =
      "Rejected because too few distinct lines support this position.";
  } else if (
    supportRatio <
    options.minimumSupportRatio
  ) {
    reason =
      "Rejected because the support ratio is too low.";
  } else if (
    stability <
    options.minimumStability
  ) {
    reason =
      "Rejected because the alignment varies too much.";
  }

  return {
    id: createId(index),
    x,
    minX:
      Math.min(...cluster.values),
    maxX:
      Math.max(...cluster.values),
    leftBoundary:
      Number.NEGATIVE_INFINITY,
    rightBoundary:
      Number.POSITIVE_INFINITY,
    occurrences:
      cluster.values.length,
    distinctLineCount,
    averageDeviation,
    stability,
    confidence,
    accepted,
    reason,
  };
}

function mergeCandidates(
  first: ColumnCandidate,
  second: ColumnCandidate,
  index: number,
): ColumnCandidate {
  const firstWeight = Math.max(
    first.distinctLineCount,
    1,
  );

  const secondWeight = Math.max(
    second.distinctLineCount,
    1,
  );

  const totalWeight =
    firstWeight + secondWeight;

  const x =
    (first.x * firstWeight +
      second.x * secondWeight) /
    totalWeight;

  return {
    id: createId(index),
    x,
    minX: Math.min(
      first.minX,
      second.minX,
    ),
    maxX: Math.max(
      first.maxX,
      second.maxX,
    ),
    leftBoundary:
      Number.NEGATIVE_INFINITY,
    rightBoundary:
      Number.POSITIVE_INFINITY,
    occurrences:
      first.occurrences +
      second.occurrences,
    distinctLineCount: Math.max(
      first.distinctLineCount,
      second.distinctLineCount,
    ),
    averageDeviation:
      (first.averageDeviation *
        firstWeight +
        second.averageDeviation *
          secondWeight) /
      totalWeight,
    stability: Math.max(
      first.stability,
      second.stability,
    ),
    confidence: Math.max(
      first.confidence,
      second.confidence,
    ),
    accepted: true,
    reason:
      "Accepted after merging nearby alignment bands into one logical column.",
  };
}

function isSerialNumberColumn(
  column: ColumnCandidate,
  lines: PdfLine[],
  tolerance: number,
) {
  let numericMatches = 0;

  for (const line of lines) {
    const firstWord = [...line.words].sort(
      (first, second) =>
        first.bounds.x - second.bounds.x,
    )[0];

    if (
      firstWord &&
      /^\d+[.)]?$/.test(firstWord.text.trim()) &&
      Math.abs(firstWord.bounds.x - column.x) <= tolerance
    ) {
      numericMatches += 1;
    }
  }

  return numericMatches >= 5;
}

function consolidateNearbyColumns(
  columns: ColumnCandidate[],
  tolerance: number,
  lines: PdfLine[],
) {
  if (columns.length <= 1) {
    return columns;
  }

  const sortedColumns =
    [...columns].sort(
      (first, second) =>
        first.x - second.x,
    );

  // Normal merge distance for ordinary
  // alignment variations.
  const consolidationDistance =
    clamp(
      tolerance * 2.8,
      12,
      18,
    );

  // A slightly wider distance is allowed
  // only when one candidate has very weak
  // line support compared with its neighbour.
  //
  // This catches secondary alignments created
  // by wrapped cell text such as:
  //
  // "Khedacherra Doganga S.B"
  // "School"
  //
  // without globally widening column merging.
  const sparseAlignmentDistance =
    clamp(
      tolerance * 6,
      28,
      36,
    );

  const consolidated:
    ColumnCandidate[] = [];

  for (const column of sortedColumns) {
    const previous =
      consolidated[
        consolidated.length - 1
      ];

    if (!previous) {
      consolidated.push({
        ...column,
      });

      continue;
    }

    const gap =
      column.x - previous.x;

    const previousIsSerial =
      isSerialNumberColumn(
        previous,
        lines,
        consolidationDistance,
      );

    const currentIsSerial =
      isSerialNumberColumn(
        column,
        lines,
        consolidationDistance,
      );

    const weakerSupport =
      Math.min(
        previous.distinctLineCount,
        column.distinctLineCount,
      );

    const strongerSupport =
      Math.max(
        previous.distinctLineCount,
        column.distinctLineCount,
      );

    const supportRatio =
      weakerSupport /
      Math.max(
        strongerSupport,
        1,
      );

    const isSparseSecondaryAlignment =
      weakerSupport <= 4 &&
      strongerSupport >= 8 &&
      supportRatio <= 0.4;

    const shouldMergeNormally =
      gap <= consolidationDistance;

    const shouldMergeSparseAlignment =
      gap <= sparseAlignmentDistance &&
      isSparseSecondaryAlignment;

    if (
      (
        shouldMergeNormally ||
        shouldMergeSparseAlignment
      ) &&
      !previousIsSerial &&
      !currentIsSerial
    ) {
      consolidated[
        consolidated.length - 1
      ] = mergeCandidates(
        previous,
        column,
        consolidated.length - 1,
      );

      continue;
    }

    consolidated.push({
      ...column,
    });
  }

  return consolidated.map(
    (column, index) => ({
      ...column,
      id: createId(index),
    }),
  );
}

function assignColumnBoundaries(
  columns: ColumnCandidate[],
  block: PdfVisualBlock,
) {
  const sortedColumns =
    [...columns].sort(
      (first, second) =>
        first.x - second.x,
    );

  return sortedColumns.map(
    (column, index) => {
      const previous =
        sortedColumns[index - 1];

      const next =
        sortedColumns[index + 1];

      const blockLeft =
        block.bounds.x;

      const blockRight =
        block.bounds.x +
        block.bounds.width;

      return {
        ...column,
        leftBoundary: previous
          ? (previous.x + column.x) / 2
          : blockLeft,
        rightBoundary: next
          ? (column.x + next.x) / 2
          : blockRight,
      };
    },
  );
}

export function detectStableColumnsV4(
  block: PdfVisualBlock,
  options?: StableColumnDetectorOptions,
): StableColumnDetectionResult {
  const resolvedOptions: Required<StableColumnDetectorOptions> = {
    minimumDistinctLines:
      options?.minimumDistinctLines ??
      DEFAULT_MINIMUM_DISTINCT_LINES,
    minimumSupportRatio:
      options?.minimumSupportRatio ??
      DEFAULT_MINIMUM_SUPPORT_RATIO,
    minimumStability:
      options?.minimumStability ??
      DEFAULT_MINIMUM_STABILITY,
    toleranceMultiplier:
      options?.toleranceMultiplier ??
      DEFAULT_TOLERANCE_MULTIPLIER,
  };

  const lines =
    getBlockLines(block);

  const words =
    lines.flatMap(
      (line) => line.words,
    );

  if (
    lines.length === 0 ||
    words.length === 0
  ) {
    return {
      columns: [],
      rejectedCandidates: [],
      adaptiveTolerance: 0,
      confidence: 0,
    };
  }

  const adaptiveTolerance =
    createAdaptiveTolerance(
      words,
      resolvedOptions.toleranceMultiplier,
    );

  const segments =
    createLineSegments(
      lines,
      words,
    );

  const clusters =
    clusterSegmentStarts(
      segments,
      adaptiveTolerance,
    );

  const candidates =
    clusters.map(
      (cluster, index) =>
        createCandidate(
          cluster,
          index,
          lines.length,
          adaptiveTolerance,
          resolvedOptions,
        ),
    );

  const initiallyAccepted =
    candidates.filter(
      (candidate) =>
        candidate.accepted,
    );

  const consolidatedColumns =
    consolidateNearbyColumns(
      initiallyAccepted,
      adaptiveTolerance,
      lines,
    );

  const columns =
    assignColumnBoundaries(
      consolidatedColumns,
      block,
    );

  const rejectedCandidates =
    candidates
      .filter(
        (candidate) =>
          !candidate.accepted,
      )
      .sort(
        (first, second) =>
          first.x - second.x,
      );

  const confidence =
    columns.length === 0
      ? 0
      : average(
          columns.map(
            (column) =>
              column.confidence,
          ),
        );

  return {
    columns,
    rejectedCandidates,
    adaptiveTolerance,
    confidence,
  };
}
