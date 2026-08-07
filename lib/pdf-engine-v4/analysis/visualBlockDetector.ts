import type {
  PdfBoundingBox,
  PdfDocumentModel,
  PdfHeadingBlock,
  PdfLine,
  PdfPageModel,
  PdfParagraphBlock,
  PdfUnknownBlock,
  PdfVisualBlock,
} from "../model/types";

type LineGroup = {
  lines: PdfLine[];
};

type VisualBlockDetectorOptions = {
  verticalGapMultiplier?: number;
  headingFontMultiplier?: number;
  minimumHeadingLength?: number;
};

const DEFAULT_VERTICAL_GAP_MULTIPLIER = 1.6;
const DEFAULT_HEADING_FONT_MULTIPLIER = 1.2;
const DEFAULT_MINIMUM_HEADING_LENGTH = 2;

function createId(
  prefix: string,
  pageNumber: number,
  index: number,
) {
  return `${prefix}-${pageNumber}-${index}`;
}

function getLineAverageFontSize(line: PdfLine) {
  if (line.words.length === 0) return 0;
  return (
    line.words.reduce(
      (sum, word) => sum + word.font.size,
      0,
    ) / line.words.length
  );
}

function getPageAverageFontSize(page: PdfPageModel) {
  if (page.words.length === 0) return 0;
  return (
    page.words.reduce(
      (sum, word) => sum + word.font.size,
      0,
    ) / page.words.length
  );
}

function getGroupBounds(
  lines: PdfLine[],
): PdfBoundingBox {
  if (lines.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  const minX = Math.min(...lines.map((line) => line.bounds.x));
  const minY = Math.min(...lines.map((line) => line.bounds.y));
  const maxX = Math.max(
    ...lines.map(
      (line) =>
        line.bounds.x + line.bounds.width,
    ),
  );
  const maxY = Math.max(
    ...lines.map(
      (line) =>
        line.bounds.y + line.bounds.height,
    ),
  );

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getAverageLineHeight(lines: PdfLine[]) {
  if (lines.length === 0) return 0;
  return (
    lines.reduce(
      (sum, line) =>
        sum + Math.max(line.bounds.height, 1),
      0,
    ) / lines.length
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

function shouldStartNewGroup(
  currentGroup: PdfLine[],
  nextLine: PdfLine,
  verticalGapMultiplier: number,
) {
  const previousLine =
    currentGroup[currentGroup.length - 1];

  if (!previousLine) return false;

  const verticalGap =
    getVerticalGap(
      previousLine,
      nextLine,
    );

  const averageLineHeight =
    getAverageLineHeight(
      currentGroup,
    );

  const threshold =
    Math.max(
      averageLineHeight *
        verticalGapMultiplier,
      8,
    );

  return verticalGap > threshold;
}

function groupLinesByWhitespace(
  lines: PdfLine[],
  verticalGapMultiplier: number,
): LineGroup[] {
  if (lines.length === 0) return [];

  const sortedLines = [...lines].sort(
    (first, second) =>
      second.bounds.y -
      first.bounds.y,
  );

  const groups: LineGroup[] = [];
  let currentGroup: PdfLine[] = [];

  for (const line of sortedLines) {
    if (currentGroup.length === 0) {
      currentGroup = [line];
      continue;
    }

    if (
      shouldStartNewGroup(
        currentGroup,
        line,
        verticalGapMultiplier,
      )
    ) {
      groups.push({
        lines: currentGroup,
      });

      currentGroup = [line];
      continue;
    }

    currentGroup.push(line);
  }

  if (currentGroup.length > 0) {
    groups.push({
      lines: currentGroup,
    });
  }

  return groups;
}

function joinGroupText(lines: PdfLine[]) {
  return lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeading(
  lines: PdfLine[],
  pageAverageFontSize: number,
  headingFontMultiplier: number,
  minimumHeadingLength: number,
) {
  if (lines.length === 0) return false;
  if (lines.length > 3) return false;

  const text = joinGroupText(lines);

  if (text.length < minimumHeadingLength) {
    return false;
  }

  const averageFontSize =
    lines.reduce(
      (sum, line) =>
        sum +
        getLineAverageFontSize(line),
      0,
    ) / lines.length;

  const hasLargeFont =
    pageAverageFontSize > 0 &&
    averageFontSize >=
      pageAverageFontSize *
        headingFontMultiplier;

  const hasBoldText =
    lines.some((line) =>
      line.words.some(
        (word) => word.font.bold,
      ),
    );

  const looksLikeSentence =
    /[.!?]$/.test(text);

  return (
    (hasLargeFont || hasBoldText) &&
    !looksLikeSentence
  );
}

function createHeadingBlock(
  lines: PdfLine[],
  pageNumber: number,
  index: number,
): PdfHeadingBlock {
  return {
    id: createId(
      "heading",
      pageNumber,
      index,
    ),
    type: "heading",
    pageNumber,
    bounds: getGroupBounds(lines),
    level: 1,
    lines,
    text: joinGroupText(lines),
    confidence: 0.75,
  };
}

function createParagraphBlock(
  lines: PdfLine[],
  pageNumber: number,
  index: number,
): PdfParagraphBlock {
  return {
    id: createId(
      "paragraph",
      pageNumber,
      index,
    ),
    type: "paragraph",
    pageNumber,
    bounds: getGroupBounds(lines),
    lines,
    text: joinGroupText(lines),
    confidence: 0.7,
  };
}

function createUnknownBlock(
  lines: PdfLine[],
  pageNumber: number,
  index: number,
): PdfUnknownBlock {
  return {
    id: createId(
      "unknown",
      pageNumber,
      index,
    ),
    type: "unknown",
    pageNumber,
    bounds: getGroupBounds(lines),
    words: lines.flatMap(
      (line) => line.words,
    ),
    confidence: 0.4,
  };
}

function classifyGroup(
  group: LineGroup,
  page: PdfPageModel,
  index: number,
  options: Required<VisualBlockDetectorOptions>,
): PdfVisualBlock {
  const text =
    joinGroupText(group.lines);

  if (!text) {
    return createUnknownBlock(
      group.lines,
      page.pageNumber,
      index,
    );
  }

  const pageAverageFontSize =
    getPageAverageFontSize(page);

  if (
    isLikelyHeading(
      group.lines,
      pageAverageFontSize,
      options.headingFontMultiplier,
      options.minimumHeadingLength,
    )
  ) {
    return createHeadingBlock(
      group.lines,
      page.pageNumber,
      index,
    );
  }

  return createParagraphBlock(
    group.lines,
    page.pageNumber,
    index,
  );
}

export function detectVisualBlocksForPage(
  page: PdfPageModel,
  options?: VisualBlockDetectorOptions,
): PdfVisualBlock[] {
  const resolvedOptions: Required<VisualBlockDetectorOptions> = {
    verticalGapMultiplier:
      options?.verticalGapMultiplier ??
      DEFAULT_VERTICAL_GAP_MULTIPLIER,
    headingFontMultiplier:
      options?.headingFontMultiplier ??
      DEFAULT_HEADING_FONT_MULTIPLIER,
    minimumHeadingLength:
      options?.minimumHeadingLength ??
      DEFAULT_MINIMUM_HEADING_LENGTH,
  };

  const groups =
    groupLinesByWhitespace(
      page.lines,
      resolvedOptions.verticalGapMultiplier,
    );

  return groups.map(
    (group, index) =>
      classifyGroup(
        group,
        page,
        index,
        resolvedOptions,
      ),
  );
}

export function detectVisualBlocks(
  document: PdfDocumentModel,
  options?: VisualBlockDetectorOptions,
): PdfDocumentModel {
  const pages = document.pages.map(
    (page) => ({
      ...page,
      blocks: detectVisualBlocksForPage(
        page,
        options,
      ),
    }),
  );

  const totalBlocks = pages.reduce(
    (sum, page) =>
      sum + page.blocks.length,
    0,
  );

  return {
    ...document,
    pages,
    confidence:
      totalBlocks > 0
        ? Math.max(
            document.confidence,
            0.7,
          )
        : document.confidence,
  };
}
