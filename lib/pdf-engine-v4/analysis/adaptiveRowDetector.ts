import type {
  PdfLine,
  PdfVisualBlock,
  PdfWord,
} from "../model/types";
import type { ColumnCandidate } from "./stableColumnDetector";
import { recoverDenseNativeCaptionTenColumnRows } from "./nativeDenseCaptionTenColumnRows";

export type RowDecisionBreakdown = {
  serialNumber: number;
  verticalGap: number;
  leftAlignment: number;
  emptyLeadingColumns: number;
  wrappedText: number;
};

export type LogicalRowCandidate = {
  id: string;
  index: number;
  lines: PdfLine[];
  words: PdfWord[];
  startY: number;
  endY: number;
  isNewRecord: boolean;
  score: number;
  confidence: number;
  breakdown: RowDecisionBreakdown;
  reason: string;
};

export type AdaptiveRowDetectionResult = {
  rows: LogicalRowCandidate[];
  confidence: number;
};

type AdaptiveRowDetectorOptions = {
  newRecordThreshold?: number;
  continuationThreshold?: number;
  serialNumberWeight?: number;
  largeGapWeight?: number;
  leftAlignmentWeight?: number;
  emptyLeadingColumnsPenalty?: number;
  wrappedTextPenalty?: number;
};

const DEFAULT_NEW_RECORD_THRESHOLD = 24;
const DEFAULT_CONTINUATION_THRESHOLD = 8;

const DEFAULT_SERIAL_NUMBER_WEIGHT = 40;
const DEFAULT_LARGE_GAP_WEIGHT = 20;
const DEFAULT_LEFT_ALIGNMENT_WEIGHT = 15;
const DEFAULT_EMPTY_LEADING_COLUMNS_PENALTY = 20;
const DEFAULT_WRAPPED_TEXT_PENALTY = 20;

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
  return `logical-row-${index}`;
}

function isPageNumberNoise(
  line: PdfLine,
) {
  const text =
    line.text
      .trim()
      .replace(/\s+/g, " ");

  return /^page\s+\d+\s*(?:of|\/)\s*\d+$/i.test(
    text,
  );
}

function getBlockLines(
  block: PdfVisualBlock,
): PdfLine[] {
  if (
    block.type === "paragraph" ||
    block.type === "heading"
  ) {
    return [...block.lines]
      .filter(
        (line) =>
          !isPageNumberNoise(line),
      )
      .sort(
        (first, second) =>
          second.bounds.y -
          first.bounds.y,
      );
  }

  return [];
}

function isOcrPunctuationArtifactLine(
  line: PdfLine,
) {
  const words =
    getSortedWords(line);

  if (
    words.length === 0 ||
    words.length > 2
  ) {
    return false;
  }

  return words.every(
    (word) => {
      const text =
        word.text.trim();

      return (
        word.extractionProvenance
          ?.source ===
          "ocr-tesseract" &&
        text.length > 0 &&
        !/[A-Za-z0-9]/.test(
          text,
        )
      );
    },
  );
}

function getSortedWords(line: PdfLine) {
  return [...line.words].sort(
    (first, second) =>
      first.bounds.x -
      second.bounds.x,
  );
}

function getFirstText(line: PdfLine) {
  return (
    getSortedWords(line)[0]?.text.trim() ?? ""
  );
}

function getLeadingSerialText(
  line: PdfLine,
) {
  const words =
    getSortedWords(line);

  let firstNoiseX:
    number | null = null;

  let sawPunctuationNoise =
    false;

  for (const word of words) {
    const text =
  word.text.trim();

const isOcrWord =
  word.extractionProvenance
    ?.source ===
  "ocr-tesseract";

const serialText =
  isOcrWord
    ? text.replace(
        /^[^A-Za-z0-9]+(?=\d)/,
        "",
      )
    : text;

if (
  /^\d+[.)]?(?:\s|$)/.test(
    serialText,
  )
) {
      if (
        firstNoiseX !== null &&
        word.bounds.x -
          firstNoiseX >
          24
      ) {
        return "";
      }

      return serialText;
    }

    const isPunctuationOnly =
      text.length > 0 &&
      !/[A-Za-z0-9]/.test(
        text,
      );

    const isShortOcrGarbage =
      text.length > 0 &&
      text.length <= 2 &&
      !/\d/.test(text) &&
      sawPunctuationNoise;

    const isOcrNoise =
      isOcrWord &&
      (
        isPunctuationOnly ||
        isShortOcrGarbage
      );

    if (!isOcrNoise) {
      break;
    }

    if (firstNoiseX === null) {
      firstNoiseX =
        word.bounds.x;
    }

    if (isPunctuationOnly) {
      sawPunctuationNoise =
        true;
    }
  }

  return "";
}

function getLeadingSerialNumber(
  line: PdfLine,
) {
  const match =
    getLeadingSerialText(
      line,
    ).match(
      /^(\d+)/,
    );

  if (!match) {
    return null;
  }

  const value =
    Number.parseInt(
      match[1],
      10,
    );

  return Number.isFinite(value)
    ? value
    : null;
}

function startsWithSerialNumber(
  line: PdfLine,
) {
  return /^\d+[.)]?(?:\s|$)/.test(
    getLeadingSerialText(
      line,
    ),
  );
}

function startsWithSerialTwo(
  line: PdfLine,
) {
  return /^2[.)]?(?:\s|$)/.test(
    getLeadingSerialText(
      line,
    ),
  );
}

function isOcrConfusedFirstSerial(
  line: PdfLine,
  columns: ColumnCandidate[],
) {
  const firstWord =
    getSortedWords(line)[0];

  if (
    !firstWord ||
    firstWord.extractionProvenance
      ?.source !==
      "ocr-tesseract"
  ) {
    return false;
  }

  const normalizedText =
    firstWord.text
      .trim()
      .toLowerCase();

  const looksLikeOne =
    normalizedText === "il" ||
    normalizedText === "i" ||
    normalizedText === "l";

  if (!looksLikeOne) {
    return false;
  }

  return (
    findNearestColumnIndex(
      firstWord,
      columns,
    ) === 0
  );
}

function normalizeOcrFirstSerialLine(
  line: PdfLine,
): PdfLine {
  const firstWord =
    getSortedWords(line)[0];

  if (!firstWord) {
    return line;
  }

  const words =
    line.words.map(
      (word) =>
        word.id === firstWord.id
          ? {
              ...word,
              text: "1",
            }
          : word,
    );

  return {
    ...line,
    words,
    text:
      [...words]
        .sort(
          (first, second) =>
            first.bounds.x -
            second.bounds.x,
        )
        .map(
          (word) => word.text,
        )
        .join(" "),
  };
}

function getLineCenterY(line: PdfLine) {
  return (
    line.bounds.y +
    line.bounds.height / 2
  );
}

function getVerticalGap(
  previousLine: PdfLine,
  currentLine: PdfLine,
) {
  const previousBottom =
    previousLine.bounds.y;

  const currentTop =
    currentLine.bounds.y +
    currentLine.bounds.height;

  return previousBottom - currentTop;
}

function getAverageLineHeight(
  lines: PdfLine[],
) {
  if (lines.length === 0) {
    return 1;
  }

  return Math.max(
    1,
    average(
      lines.map((line) =>
        Math.max(
          line.bounds.height,
          1,
        ),
      ),
    ),
  );
}

function findNearestColumnIndex(
  word: PdfWord,
  columns: ColumnCandidate[],
) {
  if (columns.length === 0) {
    return -1;
  }

  let nearestIndex = 0;
  let nearestDistance =
    Number.POSITIVE_INFINITY;

  columns.forEach((column, index) => {
    const distance = Math.abs(
      word.bounds.x - column.x,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getPopulatedColumnIndexes(
  line: PdfLine,
  columns: ColumnCandidate[],
) {
  const indexes = new Set<number>();

  for (const word of line.words) {
    const index =
      findNearestColumnIndex(
        word,
        columns,
      );

    if (index >= 0) {
      indexes.add(index);
    }
  }

  return Array.from(indexes).sort(
    (first, second) =>
      first - second,
  );
}

function hasEmptyLeadingColumns(
  line: PdfLine,
  columns: ColumnCandidate[],
) {
  const populatedIndexes =
    getPopulatedColumnIndexes(
      line,
      columns,
    );

  if (populatedIndexes.length === 0) {
    return true;
  }

  const firstPopulated =
    populatedIndexes[0];

  return firstPopulated > 0;
}

function alignsWithPreviousRow(
  previousLines: PdfLine[],
  currentLine: PdfLine,
  columns: ColumnCandidate[],
) {
  if (
    previousLines.length === 0 ||
    columns.length === 0
  ) {
    return false;
  }

  const previousIndexes =
    new Set(
      previousLines.flatMap((line) =>
        getPopulatedColumnIndexes(
          line,
          columns,
        ),
      ),
    );

  const currentIndexes =
    getPopulatedColumnIndexes(
      currentLine,
      columns,
    );

  if (currentIndexes.length === 0) {
    return false;
  }

  const overlapCount =
    currentIndexes.filter((index) =>
      previousIndexes.has(index),
    ).length;

  return (
    overlapCount /
      currentIndexes.length >=
    0.5
  );
}

function isLikelyWrappedText(
  previousLine: PdfLine,
  currentLine: PdfLine,
  columns: ColumnCandidate[],
) {
  const gap =
    getVerticalGap(
      previousLine,
      currentLine,
    );

  const averageHeight =
    getAverageLineHeight([
      previousLine,
      currentLine,
    ]);

  const closeVertically =
    gap <= averageHeight * 0.8;

  const sameAlignment =
    alignsWithPreviousRow(
      [previousLine],
      currentLine,
      columns,
    );

  const noSerial =
    !startsWithSerialNumber(
      currentLine,
    );

  return (
    closeVertically &&
    sameAlignment &&
    noSerial
  );
}

function isLikelyTrailingOcrFooter(
  previousRow:
    | LogicalRowCandidate
    | undefined,
  currentLine: PdfLine,
  nextLine: PdfLine | undefined,
  columns: ColumnCandidate[],
) {
  if (
    !previousRow ||
    nextLine ||
    columns.length === 0 ||
    startsWithSerialNumber(
      currentLine,
    )
  ) {
    return false;
  }

  const isOcrLine =
    currentLine.words.length > 0 &&
    currentLine.words.every(
      (word) =>
        word.extractionProvenance
          ?.source ===
        "ocr-tesseract",
    );

  if (!isOcrLine) {
    return false;
  }

  const previousHasSerial =
    previousRow.lines.some(
      (line) =>
        startsWithSerialNumber(
          line,
        ),
    );

  if (
    !previousHasSerial ||
    !hasEmptyLeadingColumns(
      currentLine,
      columns,
    )
  ) {
    return false;
  }

  const previousLine =
    previousRow.lines[
      previousRow.lines.length - 1
    ];

  if (!previousLine) {
    return false;
  }

  const gap =
    getVerticalGap(
      previousLine,
      currentLine,
    );

  const averageHeight =
    getAverageLineHeight([
      previousLine,
      currentLine,
    ]);

  return (
    gap >
    averageHeight * 1.4
  );
}

function isLikelyInterSerialOcrArtifact(
  previousRow:
    | LogicalRowCandidate
    | undefined,
  currentLine: PdfLine,
  nextLine: PdfLine | undefined,
  columns: ColumnCandidate[],
) {
  if (
    !previousRow ||
    !nextLine ||
    columns.length < 4 ||
    startsWithSerialNumber(
      currentLine,
    )
  ) {
    return false;
  }

  const previousSerialNumber =
    [...previousRow.lines]
      .reverse()
      .map(
        (line) =>
          getLeadingSerialNumber(
            line,
          ),
      )
      .find(
        (value) =>
          value !== null,
      ) ?? null;

  const nextSerialNumber =
    getLeadingSerialNumber(
      nextLine,
    );

  if (
    previousSerialNumber === null ||
    nextSerialNumber === null ||
    nextSerialNumber !==
      previousSerialNumber + 1
  ) {
    return false;
  }

  const isOcrLine =
    currentLine.words.length > 0 &&
    currentLine.words.every(
      (word) =>
        word.extractionProvenance
          ?.source ===
        "ocr-tesseract",
    );

  if (
    !isOcrLine ||
    currentLine.words.length > 3
  ) {
    return false;
  }

  const previousIndexes =
    new Set(
      previousRow.lines.flatMap(
        (line) =>
          getPopulatedColumnIndexes(
            line,
            columns,
          ),
      ),
    );

  const previousRowIsComplete =
    previousIndexes.size >=
    columns.length;

  if (!previousRowIsComplete) {
    return false;
  }

  const hasLeadingPunctuationArtifact =
    currentLine.words.some(
      (word) => {
        const text =
          word.text.trim();

        return (
          findNearestColumnIndex(
            word,
            columns,
          ) === 0 &&
          text.length > 0 &&
          !/[A-Za-z0-9]/.test(
            text,
          )
        );
      },
    );

  return hasLeadingPunctuationArtifact;
}

function isSerialBridgePattern(
  leadingLine: PdfLine,
  serialLine: PdfLine | undefined,
  trailingLine: PdfLine | undefined,
  columns: ColumnCandidate[],
) {
  if (
    !serialLine ||
    !trailingLine ||
    columns.length === 0
  ) {
    return false;
  }

  if (
    startsWithSerialNumber(
      leadingLine,
    ) ||
    !startsWithSerialNumber(
      serialLine,
    ) ||
    startsWithSerialNumber(
      trailingLine,
    )
  ) {
    return false;
  }

  const leadingIndexes =
    getPopulatedColumnIndexes(
      leadingLine,
      columns,
    );

  const serialIndexes =
    getPopulatedColumnIndexes(
      serialLine,
      columns,
    );

  const trailingIndexes =
    getPopulatedColumnIndexes(
      trailingLine,
      columns,
    );

  if (
    leadingIndexes.length === 0 ||
    serialIndexes.length === 0 ||
    trailingIndexes.length === 0
  ) {
    return false;
  }

  const leadingUsesSerialColumn =
    leadingIndexes.includes(0);

  const trailingUsesSerialColumn =
    trailingIndexes.includes(0);

  if (
    leadingUsesSerialColumn ||
    trailingUsesSerialColumn
  ) {
    return false;
  }

  const leadingNonSerialIndexes =
    new Set(
      leadingIndexes.filter(
        (index) => index > 0,
      ),
    );

  const hasSharedContentColumn =
    trailingIndexes.some(
      (index) =>
        index > 0 &&
        leadingNonSerialIndexes.has(
          index,
        ),
    );

  if (!hasSharedContentColumn) {
    return false;
  }

  const averageHeight =
    getAverageLineHeight([
      leadingLine,
      serialLine,
      trailingLine,
    ]);

  const gapBeforeSerial =
    getVerticalGap(
      leadingLine,
      serialLine,
    );

  const gapAfterSerial =
    getVerticalGap(
      serialLine,
      trailingLine,
    );

  const closeBefore =
    gapBeforeSerial <=
    averageHeight * 0.9;

  const closeAfter =
    gapAfterSerial <=
    averageHeight * 0.9;

  return (
    closeBefore &&
    closeAfter
  );
}

function isOcrFirstSerialBridgePattern(
  leadingLine: PdfLine,
  confusedSerialLine:
    | PdfLine
    | undefined,
  nextSerialLine:
    | PdfLine
    | undefined,
  columns: ColumnCandidate[],
) {
  if (
    !confusedSerialLine ||
    !nextSerialLine ||
    columns.length === 0
  ) {
    return false;
  }

  if (
    startsWithSerialNumber(
      leadingLine,
    ) ||
    !isOcrConfusedFirstSerial(
      confusedSerialLine,
      columns,
    ) ||
    !startsWithSerialTwo(
      nextSerialLine,
    )
  ) {
    return false;
  }

  const leadingIndexes =
    getPopulatedColumnIndexes(
      leadingLine,
      columns,
    );

  const confusedSerialIndexes =
    getPopulatedColumnIndexes(
      confusedSerialLine,
      columns,
    );

  const nextSerialIndexes =
    getPopulatedColumnIndexes(
      nextSerialLine,
      columns,
    );

  if (
    leadingIndexes.length === 0 ||
    confusedSerialIndexes.length ===
      0 ||
    nextSerialIndexes.length === 0
  ) {
    return false;
  }

  if (
    leadingIndexes.includes(0) ||
    !confusedSerialIndexes.includes(
      0,
    ) ||
    !nextSerialIndexes.includes(0)
  ) {
    return false;
  }

  const averageHeight =
    getAverageLineHeight([
      leadingLine,
      confusedSerialLine,
      nextSerialLine,
    ]);

  const gapBeforeSerial =
    getVerticalGap(
      leadingLine,
      confusedSerialLine,
    );

  const closeBefore =
    gapBeforeSerial <=
    averageHeight * 0.9;

  return closeBefore;
}

function isSplitMissingSerialRowPattern(
  previousRow: LogicalRowCandidate | undefined,
  firstLine: PdfLine,
  secondLine: PdfLine | undefined,
  nextSerialLine: PdfLine | undefined,
  columns: ColumnCandidate[],
) {
  if (
    !previousRow ||
    !secondLine ||
    !nextSerialLine ||
    columns.length < 4
  ) {
    return false;
  }

    const previousSerialNumber =
    [...previousRow.lines]
      .reverse()
      .map(
        (line) =>
          getLeadingSerialNumber(
            line,
          ),
      )
      .find(
        (value) =>
          value !== null,
      ) ?? null;

  const nextSerialNumber =
    getLeadingSerialNumber(
      nextSerialLine,
    );

  if (
    previousSerialNumber === null ||
    nextSerialNumber === null ||
    nextSerialNumber !==
      previousSerialNumber + 2 ||
    startsWithSerialNumber(
      firstLine,
    ) ||
    startsWithSerialNumber(
      secondLine,
    )
  ) {
    return false;
  }

  const firstIsOcr =
    firstLine.words.length > 0 &&
    firstLine.words.every(
      (word) =>
        word.extractionProvenance?.source ===
        "ocr-tesseract",
    );

  const secondIsOcr =
    secondLine.words.length > 0 &&
    secondLine.words.every(
      (word) =>
        word.extractionProvenance?.source ===
        "ocr-tesseract",
    );

  if (!firstIsOcr || !secondIsOcr) {
    return false;
  }

  const firstIndexes =
    getPopulatedColumnIndexes(
      firstLine,
      columns,
    ).filter((index) => index > 0);

  const secondIndexes =
    getPopulatedColumnIndexes(
      secondLine,
      columns,
    ).filter((index) => index > 0);

  if (
    firstIndexes.length === 0 ||
    secondIndexes.length === 0
  ) {
    return false;
  }

  const combinedIndexes = new Set([
    ...firstIndexes,
    ...secondIndexes,
  ]);

  const availableNonSerialColumns =
    columns.length - 1;

  const hasStrongCombinedCoverage =
    combinedIndexes.size >= 3 &&
    combinedIndexes.size /
      availableNonSerialColumns >=
      0.75;

  if (!hasStrongCombinedCoverage) {
    return false;
  }

  const firstSet = new Set(firstIndexes);
  const secondSet = new Set(secondIndexes);

  const firstAddsContent =
    firstIndexes.some(
      (index) => !secondSet.has(index),
    );

  const secondAddsContent =
    secondIndexes.some(
      (index) => !firstSet.has(index),
    );

  if (
    !firstAddsContent ||
    !secondAddsContent
  ) {
    return false;
  }

  const averageHeight =
    getAverageLineHeight([
      firstLine,
      secondLine,
    ]);

  const gap = getVerticalGap(
    firstLine,
    secondLine,
  );

  return gap <= averageHeight * 0.9;
}

function isStrongMissingSerialRow(
  previousLogicalLines: PdfLine[],
  currentLine: PdfLine,
  columns: ColumnCandidate[],
) {
  if (
    previousLogicalLines.length === 0 ||
    columns.length < 4 ||
    startsWithSerialNumber(
      currentLine,
    ) ||
    !hasEmptyLeadingColumns(
      currentLine,
      columns,
    )
  ) {
    return false;
  }

  const isOcrLine =
    currentLine.words.length > 0 &&
    currentLine.words.every(
      (word) =>
        word.extractionProvenance
          ?.source ===
        "ocr-tesseract",
    );

  if (!isOcrLine) {
    return false;
  }

  const previousHasSerial =
    previousLogicalLines.some(
      (line) =>
        startsWithSerialNumber(
          line,
        ),
    );

  if (!previousHasSerial) {
    return false;
  }

  const populatedIndexes =
    getPopulatedColumnIndexes(
      currentLine,
      columns,
    );

  const populatedNonSerialCount =
    populatedIndexes.filter(
      (index) => index > 0,
    ).length;

  const availableNonSerialColumns =
    columns.length - 1;

  return (
    populatedNonSerialCount >= 3 &&
    populatedNonSerialCount /
      availableNonSerialColumns >=
      0.75
  );
}

function calculateDecision(
  previousLogicalLines: PdfLine[],
  currentLine: PdfLine,
  columns: ColumnCandidate[],
  options: Required<AdaptiveRowDetectorOptions>,
) {
  const breakdown: RowDecisionBreakdown = {
    serialNumber: 0,
    verticalGap: 0,
    leftAlignment: 0,
    emptyLeadingColumns: 0,
    wrappedText: 0,
  };

  if (
    startsWithSerialNumber(
      currentLine,
    )
  ) {
    breakdown.serialNumber =
      options.serialNumberWeight;
  }

  const previousLine =
    previousLogicalLines[
      previousLogicalLines.length - 1
    ];

  if (previousLine) {
    const gap =
      getVerticalGap(
        previousLine,
        currentLine,
      );

    const averageHeight =
      getAverageLineHeight([
        previousLine,
        currentLine,
      ]);

    if (
      gap >
      averageHeight * 1.4
    ) {
      breakdown.verticalGap =
        options.largeGapWeight;
    }

    const currentFirstX =
      getSortedWords(
        currentLine,
      )[0]?.bounds.x ?? 0;

    const previousFirstX =
      getSortedWords(
        previousLine,
      )[0]?.bounds.x ?? 0;

    const tolerance =
      Math.max(
        averageHeight * 0.8,
        8,
      );

    if (
      Math.abs(
        currentFirstX -
          previousFirstX,
      ) <= tolerance
    ) {
      breakdown.leftAlignment =
        options.leftAlignmentWeight;
    }

    if (
      isLikelyWrappedText(
        previousLine,
        currentLine,
        columns,
      )
    ) {
      breakdown.wrappedText =
        -options.wrappedTextPenalty;
    }
  }

  if (
    hasEmptyLeadingColumns(
      currentLine,
      columns,
    )
  ) {
    breakdown.emptyLeadingColumns =
      -options.emptyLeadingColumnsPenalty;
  }

  const strongMissingSerialRow =
  isStrongMissingSerialRow(
    previousLogicalLines,
    currentLine,
    columns,
  );

const baseScore =
  breakdown.serialNumber +
  breakdown.verticalGap +
  breakdown.leftAlignment +
  breakdown.emptyLeadingColumns +
  breakdown.wrappedText;

const score =
  strongMissingSerialRow
    ? Math.max(
        baseScore,
        options.newRecordThreshold,
      )
    : baseScore;

const isNewRecord =
  score >=
  options.newRecordThreshold;

  const confidence =
    clamp(
      Math.abs(score) /
        Math.max(
          options.serialNumberWeight +
            options.largeGapWeight +
            options.leftAlignmentWeight,
          1,
        ),
      0,
      1,
    );

  let reason =
    "Continuation line.";

  if (isNewRecord) {
    reason =
      "Started a new logical row.";
  } else if (
    score <=
    options.continuationThreshold
  ) {
    reason =
      "Merged as wrapped or continuation content.";
  }

  return {
    score,
    confidence,
    isNewRecord,
    breakdown,
    reason,
  };
}

function createLogicalRow(
  line: PdfLine,
  index: number,
  decision: ReturnType<
    typeof calculateDecision
  >,
): LogicalRowCandidate {
  return {
    id: createId(index),
    index,
    lines: [line],
    words: [...line.words],
    startY: getLineCenterY(line),
    endY: getLineCenterY(line),
    isNewRecord:
      decision.isNewRecord,
    score: decision.score,
    confidence:
      decision.confidence,
    breakdown:
      decision.breakdown,
    reason: decision.reason,
  };
}

function appendLineToRow(
  row: LogicalRowCandidate,
  line: PdfLine,
) {
  return {
    ...row,
    lines: [...row.lines, line],
    words: [
      ...row.words,
      ...line.words,
    ],
    endY: getLineCenterY(line),
  };
}

function prependLineToRow(
  row: LogicalRowCandidate,
  line: PdfLine,
) {
  return {
    ...row,
    lines: [
      line,
      ...row.lines,
    ],
    words: [
      ...line.words,
      ...row.words,
    ],
    startY:
      getLineCenterY(line),
  };
}


/**
 * Narrow recovery for publisher-captioned native numeric grids.
 * Do not relax generic OCR/serial row thresholds. Require at least three
 * geometrically distinct rows occupying four or more stable columns.
 */
function detectCaptionGridRows(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
): AdaptiveRowDetectionResult | null {
  if (
    !(block.id.startsWith("caption-table-") ||
      block.id.startsWith("native-captioned-short-numeric-")) ||
    columns.length < 4
  ) return null;
  const lines = getBlockLines(block);
  if (lines.length < 4) return null;
  const numeric = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|\))?$/;
  const occupied = (line: PdfLine) => getPopulatedColumnIndexes(line, columns).length;
  const qualifies = (line: PdfLine) =>
    occupied(line) >= 4 &&
    line.words.filter(word => numeric.test(word.text.trim()) ||
      word.text.trim().toLowerCase() === "na").length >= 2;
  const first = lines.findIndex(qualifies);
  if (first < 0) return null;
  let last = first;
  while (last < lines.length && qualifies(lines[last])) last += 1;
  const dataLines = lines.slice(first, last);
  if (dataLines.length < 3) return null;
  const gaps = dataLines.slice(1).map((line, index) =>
    dataLines[index].bounds.y - line.bounds.y);
  if (gaps.some(gap => gap < 7 || gap > 30)) return null;

  let headerStart = first;
  while (headerStart > 0 && first - headerStart < 7) {
    const preceding = lines[headerStart - 1];
    const gap = preceding.bounds.y - lines[headerStart].bounds.y;
    if (gap < 3 || gap > 20 || preceding.words.length === 0) break;
    headerStart -= 1;
  }
  if (headerStart === first) return null;
  const groups = [lines.slice(headerStart, first), ...dataLines.map(line => [line])];
  const rows = groups.map((group, index): LogicalRowCandidate => {
    const allWords = group.flatMap(line => line.words);
    const typicalSize = [...allWords].map(word => word.font.size)
      .filter(size => Number.isFinite(size) && size > 0)
      .sort((a, b) => a - b)[Math.floor(allWords.length / 2)] ?? 0;
    // Ignore only the small raised superscript immediately adjacent to an
    // ordinary numeric word. Preserve the source PDF's unchanged word model.
    const words = index > 0 ? allWords.filter(word => !(
      /^[1-9]$/.test(word.text.trim()) &&
      typicalSize > 0 && word.font.size < typicalSize * 0.75 &&
      allWords.some(other =>
        other !== word && other.font.size >= typicalSize * 0.95 &&
        /^\d/.test(other.text.trim()) &&
        other.bounds.x >= word.bounds.x + word.bounds.width - 1 &&
        other.bounds.x - (word.bounds.x + word.bounds.width) < 7 &&
        word.bounds.y - other.bounds.y >= 1.5
      )
    )) : allWords;
    const fraction = Math.max(...group.map(occupied)) / columns.length;
    const confidence = clamp(0.7 + fraction * 0.25, 0, 0.95);
    return {
      id: createId(index), index,
      lines: index > 0 ? group.map(line => ({
        ...line,
        words: line.words.filter(word => words.some(accepted => accepted.id === word.id)),
      })) : group,
      words,
      startY: getLineCenterY(group[0]),
      endY: getLineCenterY(group[group.length - 1]),
      isNewRecord: true, score: confidence * 100, confidence,
      breakdown: {
        serialNumber: 0, verticalGap: 0, leftAlignment: 0,
        emptyLeadingColumns: 0, wrappedText: 0,
      },
      reason: "caption-native-numeric-grid",
    };
  });
  return { rows, confidence: average(rows.map(row => row.confidence)) };
}


/**
 * High-specificity single-physical-line rows for native grids that have already
 * passed the repeated-column geometrical gate in tableRegionDetector.
 * Do not apply this shortcut to OCR, ordinary paragraphs or caption tables.
 */
function detectAlignedNativeGridRows(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
): AdaptiveRowDetectionResult | null {
  if (!block.id.startsWith("aligned-grid-") || columns.length < 5) return null;
  const lines = getBlockLines(block);
  if (lines.length < 10 || lines.length > 120) return null;
  if (lines.some(line =>
    line.words.some(word => word.extractionProvenance?.source === "ocr-tesseract")
  )) return null;
  const supports = lines.map(line => getPopulatedColumnIndexes(line, columns).length);
  const minimumColumns = columns.length - 1;
  if (supports.filter(n => n >= minimumColumns).length < Math.max(10, Math.ceil(lines.length * 0.85)))
    return null;
  const gaps = lines.slice(1).map((line,index) =>
    lines[index].bounds.y - line.bounds.y);
  if (gaps.some(gap => gap < 7 || gap > 30)) return null;
  const rows: LogicalRowCandidate[] = lines.map((line,index) => {
    const confidence = clamp(0.7 + (supports[index] / columns.length) * 0.25,0,0.95);
    return {
      id:createId(index),index,lines:[line],words:[...line.words],
      startY:getLineCenterY(line),endY:getLineCenterY(line),
      isNewRecord:true,score:confidence*100,confidence,
      breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
        emptyLeadingColumns:0,wrappedText:0},
      reason:"aligned-native-grid-physical-row",
    };
  });
  return {rows,confidence:average(rows.map(row=>row.confidence))};
}

// A six-physical-line scientific table is admitted here only after the
// independent sparse-leading-column gate in scopedDenseCaptionGridRecovery.
// Do not route OCR or ordinary six-line paragraphs through this shortcut.
function detectDenseCaptionPhysicalRows(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
): AdaptiveRowDetectionResult | null {
  if (!block.id.startsWith("dense-caption-grid-") || block.type!=="paragraph" ||
    block.lines.length!==6 || columns.length!==10) return null;
  const lines=block.lines;
  if (lines.some(line => line.words.some(word =>
    word.extractionProvenance?.source==="ocr-tesseract"))) return null;
  const gaps=lines.slice(1).map((line,i)=>lines[i].bounds.y-line.bounds.y);
  if (gaps.some(gap=>gap<8||gap>26)) return null;
  if (lines.slice(2).some(line =>
    getPopulatedColumnIndexes(line,columns).length<8)) return null;
  const rows=lines.map((line,index)=>createLogicalRow(line,index,{
    score:90,confidence:0.9,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"dense-native-caption-physical-line",
  }));
  return {rows,confidence:0.9};
}

/**
 * Long-text table cells commonly lack serial numbers. The general record
 * heuristic therefore collapses many physical rows into two large records.
 * Only a previously caption-qualified 2-column native region may take this
 * source-line-preserving route. Physical lines are explicitly NOT certified
 * semantic rows; downstream XLSX requires review and user selection.
 */
/**
 * R145 caption-backed scientific grid physical source-line recovery.
 * Do NOT group multi-level headings or wrapped source lines into unproven
 * semantic records. A source physical line is ONLY a reviewable row.
 * The export gate must require deliberate per-table selection and review.
 */
function detectScientificCaptionHeaderPhysicalRows(
  block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
  if(block.type!=="paragraph"||
    !block.id.startsWith("native-caption-header-grid-")||
    columns.length<4||columns.length>8||
    block.lines.length<10||block.lines.length>20)return null;
  if(block.lines.some(l=>l.words.some(w=>
    w.extractionProvenance?.source==="ocr-tesseract")))return null;
  const startX=block.lines.filter(l=>l.words.length>=4)
    .map(l=>Math.min(...l.words.map(w=>w.bounds.x)));
  const anchor=startX[0];
  if(anchor===undefined||startX.filter(x=>Math.abs(x-anchor)<=12).length<5)
    return null;
  const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
    score:82,confidence:0.82,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"native-scientific-caption-physical-line-review",
  }));
  return {rows,confidence:0.82};
}

function detectCaptionedTextPhysicalRows(
  block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
  if(block.type!=="paragraph"||
    !block.id.startsWith("native-captioned-text-grid-")||
    columns.length!==2||block.lines.length<8||block.lines.length>25)return null;
  if(block.lines.some(line=>line.words.some(word=>
    word.extractionProvenance?.source==="ocr-tesseract")))return null;
  const anchors=columns.map(c=>c.x);
  const aligned=block.lines.filter(line=>anchors.every(anchor=>
    line.words.some(word=>Math.abs(word.bounds.x-anchor)<=18))).length;
  if(aligned<8||aligned<Math.ceil(block.lines.length*0.6))return null;
  const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
    score:84,confidence:0.84,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"captioned-native-text-physical-line",
  }));
  return {rows,confidence:0.84};
}

function detectParallelNativePhysicalRows(
 block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
 if(block.type!=="paragraph"||!block.id.startsWith("native-two-col-grid-")||
    columns.length!==2||block.lines.length<34)return null;
 if(block.lines.some(l=>l.words.some(w=>
    w.extractionProvenance?.source==="ocr-tesseract")))return null;
 const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
   score:92,confidence:0.92,isNewRecord:true,
   breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,emptyLeadingColumns:0,wrappedText:0},
   reason:"parallel-native-scientific-physical-row",
 }));
 return {rows,confidence:0.92};
}

function detectPairedNativePhysicalRows(
  block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
  if(block.type!=="paragraph"||!block.id.startsWith("paired-caption-grid-")||
     columns.length!==2||block.lines.length<7||block.lines.length>24)return null;
  if(block.lines.some(line=>line.words.length!==2||line.words.some(word=>
    word.extractionProvenance?.source==="ocr-tesseract")))return null;
  const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
    score:94,confidence:0.94,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"paired-native-caption-physical-row",
  }));
  return {rows,confidence:0.94};
}

function detectInterleavedThreePhysicalRows(
  block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
  if(block.type!=="paragraph"||
    !block.id.startsWith("interleaved-native-three-grid-")||
    columns.length!==3||block.lines.length<24||block.lines.length>34)return null;
  if(block.lines.some(line=>line.words.some(word=>
    word.extractionProvenance?.source==="ocr-tesseract")))return null;
  const gaps=block.lines.slice(1).map((l,i)=>block.lines[i].bounds.y-l.bounds.y);
  if(gaps.some(gap=>gap<8||gap>20))return null;
  const anchors=columns.map(c=>c.x);
  const complete=block.lines.filter(line=>anchors.every(x=>line.words.some(w=>
    Math.abs(w.bounds.x-x)<=11))).length;
  if(complete<Math.ceil(block.lines.length*0.65))return null;
  const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
    score:94,confidence:0.94,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"interleaved-native-three-physical-row",
  }));
  return {rows,confidence:0.94};
}

function detectNativeElevenPhysicalRows(
 block:PdfVisualBlock,columns:ColumnCandidate[],
):AdaptiveRowDetectionResult|null{
 if(block.type!=="paragraph"||!block.id.startsWith("dense-native-eleven-grid-")||
    columns.length!==11||block.lines.length<11||block.lines.length>25)return null;
 if(block.lines.some(line=>line.words.some(w=>
    w.extractionProvenance?.source==="ocr-tesseract")))return null;
 const rows=block.lines.map((line,index)=>createLogicalRow(line,index,{
    score:94,confidence:0.94,isNewRecord:true,
    breakdown:{serialNumber:0,verticalGap:0,leftAlignment:0,
      emptyLeadingColumns:0,wrappedText:0},
    reason:"native-eleven-caption-physical-row",
 }));
 return {rows,confidence:0.94};
}

export function detectAdaptiveRowsV4(
  block: PdfVisualBlock,
  columns: ColumnCandidate[],
  options?: AdaptiveRowDetectorOptions,
): AdaptiveRowDetectionResult {
  const resolvedOptions: Required<AdaptiveRowDetectorOptions> = {
    newRecordThreshold:
      options?.newRecordThreshold ??
      DEFAULT_NEW_RECORD_THRESHOLD,
    continuationThreshold:
      options?.continuationThreshold ??
      DEFAULT_CONTINUATION_THRESHOLD,
    serialNumberWeight:
      options?.serialNumberWeight ??
      DEFAULT_SERIAL_NUMBER_WEIGHT,
    largeGapWeight:
      options?.largeGapWeight ??
      DEFAULT_LARGE_GAP_WEIGHT,
    leftAlignmentWeight:
      options?.leftAlignmentWeight ??
      DEFAULT_LEFT_ALIGNMENT_WEIGHT,
    emptyLeadingColumnsPenalty:
      options?.emptyLeadingColumnsPenalty ??
      DEFAULT_EMPTY_LEADING_COLUMNS_PENALTY,
    wrappedTextPenalty:
      options?.wrappedTextPenalty ??
      DEFAULT_WRAPPED_TEXT_PENALTY,
  };

  const denseTen = recoverDenseNativeCaptionTenColumnRows(block, columns);
  if (denseTen) return denseTen;

  const interleaved=detectInterleavedThreePhysicalRows(block,columns);
  if(interleaved)return interleaved;

  const nativeEleven=detectNativeElevenPhysicalRows(block,columns);
  if(nativeEleven)return nativeEleven;

  const pairedNative=detectPairedNativePhysicalRows(block,columns);
  if(pairedNative)return pairedNative;

  const denseCaptionGrid = detectDenseCaptionPhysicalRows(block, columns);
  if (denseCaptionGrid) return denseCaptionGrid;

  const sourcePhysical=detectScientificCaptionHeaderPhysicalRows(block,columns);
  if(sourcePhysical)return sourcePhysical;

  const captionedText=detectCaptionedTextPhysicalRows(block,columns);
  if(captionedText)return captionedText;

  const parallelRows=detectParallelNativePhysicalRows(block,columns);
  if(parallelRows)return parallelRows;
  const captionGrid = detectCaptionGridRows(block, columns);
  if (captionGrid) return captionGrid;
  const alignedGrid = detectAlignedNativeGridRows(block, columns);
  if (alignedGrid) return alignedGrid;

  const lines =
    getBlockLines(block);

  if (lines.length === 0) {
    return {
      rows: [],
      confidence: 0,
    };
  }

const logicalRows:
  LogicalRowCandidate[] = [];

let pendingLeadingLine:
  PdfLine | undefined;

for (
  let index = 0;
  index < lines.length;
  index += 1
) {
  const line = lines[index];
if (
  isOcrPunctuationArtifactLine(
    line,
  )
) {
  continue;
}

  const nextLine =
    lines[index + 1];

  const lineAfterNext =
    lines[index + 2];

    const splitNextSerialLine =
    lineAfterNext &&
    isOcrPunctuationArtifactLine(
      lineAfterNext,
    )
      ? lines[index + 3]
      : lineAfterNext;

  const previousRow =
    logicalRows[
      logicalRows.length - 1
    ];

    if (
  isLikelyTrailingOcrFooter(
    previousRow,
    line,
    nextLine,
    columns,
  )
) {
  continue;
}

  if (
    isLikelyInterSerialOcrArtifact(
      previousRow,
      line,
      nextLine,
      columns,
    )
  ) {
    continue;
  }

  if (
    !pendingLeadingLine &&
    nextLine &&
    isSplitMissingSerialRowPattern(
      previousRow,
      line,
      nextLine,
      splitNextSerialLine,
      columns,
    )
  ) {
    const splitDecision = calculateDecision(
      previousRow?.lines ?? [],
      line,
      columns,
      resolvedOptions,
    );

    const splitRow = createLogicalRow(
      line,
      logicalRows.length,
      {
        ...splitDecision,
        isNewRecord: true,
      },
    );

    logicalRows.push(
      appendLineToRow(
        splitRow,
        nextLine,
      ),
    );

    // Both physical lines now belong to this row.
    // The loop increment advances to lineAfterNext.
    index += 1;
    continue;
  }

  if (
    previousRow &&
    isOcrFirstSerialBridgePattern(
      line,
      nextLine,
      lineAfterNext,
      columns,
    )
  ) {
    pendingLeadingLine =
      line;

    continue;
  }
  if (
    previousRow &&
    isSerialBridgePattern(
      line,
      nextLine,
      lineAfterNext,
      columns,
    )
  ) {
    pendingLeadingLine =
      line;

    continue;
  }

  const effectiveLine =
    pendingLeadingLine &&
    isOcrConfusedFirstSerial(
      line,
      columns,
    ) &&
    startsWithSerialTwo(
      nextLine,
    )
      ? normalizeOcrFirstSerialLine(
          line,
        )
      : line;
  const previousLines =
    previousRow?.lines ?? [];

  const decision =
    calculateDecision(
      previousLines,
      effectiveLine,
      columns,
      resolvedOptions,
    );

  const hasPendingSerialBridge =
    pendingLeadingLine !== undefined &&
    startsWithSerialNumber(
      effectiveLine,
    );

  if (
    !previousRow ||
    decision.isNewRecord ||
    hasPendingSerialBridge
  ) {
    let newRow =
      createLogicalRow(
        effectiveLine,
        logicalRows.length,
        decision,
      );

    if (
      pendingLeadingLine &&
      startsWithSerialNumber(
        effectiveLine,
      )
    ) {
      newRow =
        prependLineToRow(
          newRow,
          pendingLeadingLine,
        );

      pendingLeadingLine =
        undefined;
    }

    logicalRows.push(
      newRow,
    );

    continue;
  }

  logicalRows[
    logicalRows.length - 1
  ] = appendLineToRow(
    previousRow,
    effectiveLine,
  );
}

  const confidence =
    logicalRows.length === 0
      ? 0
      : average(
          logicalRows.map(
            (row) =>
              row.confidence,
          ),
        );

  return {
    rows: logicalRows,
    confidence,
  };
}
