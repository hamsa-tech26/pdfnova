import type {
  PdfLine,
  PdfWord,
} from "../model/types";

const LEADING_SERIAL_PATTERN =
  /^(\d+[.)]?)(\s+)(.+)$/;

function createSerialFragments(
  word: PdfWord,
): PdfWord[] {
  const match =
    LEADING_SERIAL_PATTERN.exec(
      word.text,
    );

  if (!match) {
    return [word];
  }

  const serialText =
    match[1] ?? "";

  const separatorText =
    match[2] ?? "";

  const contentText =
    match[3] ?? "";

  if (
    !serialText ||
    !contentText ||
    word.text.length === 0
  ) {
    return [word];
  }

  const averageCharacterWidth =
    word.bounds.width /
    word.text.length;

  const serialWidth =
    averageCharacterWidth *
    serialText.length;

  const contentOffset =
    averageCharacterWidth *
    (
      serialText.length +
      separatorText.length
    );

  const contentX =
    word.bounds.x +
    contentOffset;

  const contentWidth =
    Math.max(
      0,
      word.bounds.width -
        contentOffset,
    );

  const serialWord: PdfWord = {
    ...word,
    id: `${word.id}-serial`,
    text: serialText,
    bounds: {
      ...word.bounds,
      width: serialWidth,
    },
  };

  const contentWord: PdfWord = {
    ...word,
    id: `${word.id}-content`,
    text: contentText,
    bounds: {
      ...word.bounds,
      x: contentX,
      width: contentWidth,
    },
  };

  return [
    serialWord,
    contentWord,
  ];
}

export function createAnalysisWordsV4(
  line: PdfLine,
): PdfWord[] {
  const sortedWords =
    [...line.words].sort(
      (first, second) =>
        first.bounds.x -
        second.bounds.x,
    );

  if (sortedWords.length === 0) {
    return [];
  }

  const firstWord =
    sortedWords[0];

  if (!firstWord) {
    return [];
  }

  const fragments =
    createSerialFragments(
      firstWord,
    );

  return [
    ...fragments,
    ...sortedWords.slice(1),
  ];
}

export function isAnalysisSerialBoundaryV4(
  previousWord: PdfWord,
  currentWord: PdfWord,
) {
  const serialSuffix = "-serial";

  if (
    !previousWord.id.endsWith(
      serialSuffix,
    )
  ) {
    return false;
  }

  const sourceId =
    previousWord.id.slice(
      0,
      -serialSuffix.length,
    );

  return (
    currentWord.id ===
    `${sourceId}-content`
  );
}

export function isAnalysisSerialFragmentV4(
  word: PdfWord,
) {
  return word.id.endsWith(
    "-serial",
  );
}

export function isAnalysisContentFragmentV4(
  word: PdfWord,
) {
  return word.id.endsWith(
    "-content",
  );
}