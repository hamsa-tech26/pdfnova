import type {
  PdfLine,
  PdfWord,
} from "./types";

export type DetectedColumn = {
  index: number;
  x: number;
  minX: number;
  maxX: number;
  support: number;
};

export type ColumnDetectionResult = {
  columns: DetectedColumn[];
  confidence: number;
};

type ColumnCluster = {
  values: number[];
  words: PdfWord[];
};

const DEFAULT_CLUSTER_TOLERANCE = 18;
const MIN_COLUMN_SUPPORT = 3;

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

function getLineStartCandidates(
  lines: PdfLine[],
) {
  return lines.flatMap((line) => {
    return line.words.map((word) => ({
      x: word.x,
      word,
    }));
  });
}

function createClusters(
  words: PdfWord[],
  tolerance: number,
): ColumnCluster[] {
  const sortedWords = [...words].sort(
    (first, second) =>
      first.x - second.x,
  );

  const clusters: ColumnCluster[] = [];

  for (const word of sortedWords) {
    const matchingCluster =
      clusters.find((cluster) => {
        const clusterAverage = average(
          cluster.values,
        );

        return (
          Math.abs(
            clusterAverage - word.x,
          ) <= tolerance
        );
      });

    if (matchingCluster) {
      matchingCluster.values.push(word.x);
      matchingCluster.words.push(word);
      continue;
    }

    clusters.push({
      values: [word.x],
      words: [word],
    });
  }

  return clusters;
}

function countDistinctLines(
  words: PdfWord[],
) {
  const distinctYValues: number[] = [];
  const tolerance = 3;

  for (const word of words) {
    const exists =
      distinctYValues.some(
        (y) =>
          Math.abs(y - word.y) <=
          tolerance,
      );

    if (!exists) {
      distinctYValues.push(word.y);
    }
  }

  return distinctYValues.length;
}

function mergeNearbyClusters(
  clusters: ColumnCluster[],
  tolerance: number,
) {
  const sortedClusters = [...clusters].sort(
    (first, second) =>
      average(first.values) -
      average(second.values),
  );

  const merged: ColumnCluster[] = [];

  for (const cluster of sortedClusters) {
    const clusterX = average(
      cluster.values,
    );

    const previous =
      merged[merged.length - 1];

    if (!previous) {
      merged.push(cluster);
      continue;
    }

    const previousX = average(
      previous.values,
    );

    if (
      Math.abs(
        clusterX - previousX,
      ) <= tolerance
    ) {
      previous.values.push(
        ...cluster.values,
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

function removeWeakColumns(
  clusters: ColumnCluster[],
  minimumSupport: number,
) {
  return clusters.filter((cluster) => {
    const support =
      countDistinctLines(
        cluster.words,
      );

    return support >= minimumSupport;
  });
}

function calculateConfidence(
  columns: DetectedColumn[],
  lines: PdfLine[],
) {
  if (
    columns.length < 2 ||
    lines.length === 0
  ) {
    return 0;
  }

  const supportedLines =
    lines.filter((line) => {
      let matchedColumns = 0;

      for (const column of columns) {
        const hasWord =
          line.words.some((word) => {
            return (
              word.x >= column.minX &&
              word.x <= column.maxX
            );
          });

        if (hasWord) {
          matchedColumns += 1;
        }
      }

      return matchedColumns >= 2;
    }).length;

  return Math.min(
    1,
    supportedLines / lines.length,
  );
}

export function detectStableColumns(
  lines: PdfLine[],
  options?: {
    clusterTolerance?: number;
    minimumSupport?: number;
  },
): ColumnDetectionResult {
  const clusterTolerance =
    options?.clusterTolerance ??
    DEFAULT_CLUSTER_TOLERANCE;

  const minimumSupport =
    options?.minimumSupport ??
    MIN_COLUMN_SUPPORT;

  const candidates =
    getLineStartCandidates(lines);

  if (candidates.length === 0) {
    return {
      columns: [],
      confidence: 0,
    };
  }

  const initialClusters =
    createClusters(
      candidates.map(
        (candidate) =>
          candidate.word,
      ),
      clusterTolerance,
    );

  const mergedClusters =
    mergeNearbyClusters(
      initialClusters,
      clusterTolerance * 0.65,
    );

  const strongClusters =
    removeWeakColumns(
      mergedClusters,
      minimumSupport,
    );

  const columns =
    strongClusters
      .map((cluster, index) => {
        const xValues =
          cluster.values;

        const centerX =
          average(xValues);

        return {
          index,
          x: centerX,
          minX:
            Math.min(...xValues) -
            clusterTolerance,
          maxX:
            Math.max(...xValues) +
            clusterTolerance,
          support:
            countDistinctLines(
              cluster.words,
            ),
        };
      })
      .sort(
        (first, second) =>
          first.x - second.x,
      )
      .map((column, index) => ({
        ...column,
        index,
      }));

  const confidence =
    calculateConfidence(
      columns,
      lines,
    );

  return {
    columns,
    confidence,
  };
}