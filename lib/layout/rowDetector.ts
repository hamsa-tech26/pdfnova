import type {
  PdfLine,
  PdfWord,
} from "./types";

export type DetectedRow = {
  index: number;
  y: number;
  minY: number;
  maxY: number;
  words: PdfWord[];
  height: number;
};

export type RowDetectionResult = {
  rows: DetectedRow[];
  confidence: number;
};

type RowCluster = {
  yValues: number[];
  words: PdfWord[];
};

const DEFAULT_ROW_TOLERANCE = 4;
const MIN_ROW_WORDS = 1;

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

function createRowClusters(
  words: PdfWord[],
  tolerance: number,
): RowCluster[] {
  const sortedWords = [...words].sort(
    (first, second) => {
      if (
        Math.abs(first.y - second.y) >
        tolerance
      ) {
        return second.y - first.y;
      }

      return first.x - second.x;
    },
  );

  const clusters: RowCluster[] = [];

  for (const word of sortedWords) {
    const matchingCluster =
      clusters.find((cluster) => {
        const clusterY = average(
          cluster.yValues,
        );

        return (
          Math.abs(clusterY - word.y) <=
          tolerance
        );
      });

    if (matchingCluster) {
      matchingCluster.yValues.push(
        word.y,
      );

      matchingCluster.words.push(
        word,
      );

      continue;
    }

    clusters.push({
      yValues: [word.y],
      words: [word],
    });
  }

  return clusters;
}

function mergeNearbyRows(
  clusters: RowCluster[],
  tolerance: number,
) {
  const sortedClusters = [...clusters].sort(
    (first, second) =>
      average(second.yValues) -
      average(first.yValues),
  );

  const merged: RowCluster[] = [];

  for (const cluster of sortedClusters) {
    const clusterY =
      average(cluster.yValues);

    const previous =
      merged[merged.length - 1];

    if (!previous) {
      merged.push(cluster);
      continue;
    }

    const previousY =
      average(previous.yValues);

    const previousHeight = Math.max(
      ...previous.words.map(
        (word) =>
          word.height > 0
            ? word.height
            : 1,
      ),
    );

    const clusterHeight = Math.max(
      ...cluster.words.map(
        (word) =>
          word.height > 0
            ? word.height
            : 1,
      ),
    );

    const adaptiveTolerance =
      Math.max(
        tolerance,
        Math.min(
          previousHeight,
          clusterHeight,
        ) * 0.35,
      );

    if (
      Math.abs(previousY - clusterY) <=
      adaptiveTolerance
    ) {
      previous.yValues.push(
        ...cluster.yValues,
      );

      previous.words.push(
        ...cluster.words,
      );

      continue;
    }

    merged.push(cluster);
  }

  return merged;
}

function calculateRowConfidence(
  rows: DetectedRow[],
  lines: PdfLine[],
) {
  if (
    rows.length === 0 ||
    lines.length === 0
  ) {
    return 0;
  }

  const matchedLines =
    lines.filter((line) => {
      return rows.some((row) => {
        return (
          Math.abs(row.y - line.y) <=
          Math.max(
            DEFAULT_ROW_TOLERANCE,
            line.height * 0.5,
          )
        );
      });
    }).length;

  return Math.min(
    1,
    matchedLines / lines.length,
  );
}

export function detectRows(
  lines: PdfLine[],
  options?: {
    rowTolerance?: number;
    minimumWords?: number;
  },
): RowDetectionResult {
  const rowTolerance =
    options?.rowTolerance ??
    DEFAULT_ROW_TOLERANCE;

  const minimumWords =
    options?.minimumWords ??
    MIN_ROW_WORDS;

  const words =
    lines.flatMap(
      (line) => line.words,
    );

  if (words.length === 0) {
    return {
      rows: [],
      confidence: 0,
    };
  }

  const initialClusters =
    createRowClusters(
      words,
      rowTolerance,
    );

  const mergedClusters =
    mergeNearbyRows(
      initialClusters,
      rowTolerance,
    );

  const rows = mergedClusters
    .filter(
      (cluster) =>
        cluster.words.length >=
        minimumWords,
    )
    .map((cluster, index) => {
      const sortedWords =
        [...cluster.words].sort(
          (first, second) =>
            first.x - second.x,
        );

      const yValues =
        cluster.yValues;

      const rowHeight =
        Math.max(
          ...sortedWords.map(
            (word) =>
              word.height > 0
                ? word.height
                : 1,
          ),
        );

      return {
        index,
        y: average(yValues),
        minY:
          Math.min(...yValues) -
          rowTolerance,
        maxY:
          Math.max(...yValues) +
          rowTolerance,
        words: sortedWords,
        height: rowHeight,
      };
    })
    .sort(
      (first, second) =>
        second.y - first.y,
    )
    .map((row, index) => ({
      ...row,
      index,
    }));

  const confidence =
    calculateRowConfidence(
      rows,
      lines,
    );

  return {
    rows,
    confidence,
  };
}