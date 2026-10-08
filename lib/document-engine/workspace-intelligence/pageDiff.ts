import {
  textSimilarity,
  type PdfContentSignal,
} from "./contentSignals";

export type PageDifferenceStatus =
  | "unchanged"
  | "changed"
  | "added"
  | "removed"
  | "not-verifiable";

export type PageLevelDifference = {
  pageNumber: number;
  status: PageDifferenceStatus;
  similarity: number | null;
  addedFragments: string[];
  removedFragments: string[];
  numericChanges: Array<{
    before: string;
    after: string;
  }>;
};

export type PageLevelDiffReport = {
  pages: PageLevelDifference[];
  summary: {
    unchanged: number;
    changed: number;
    added: number;
    removed: number;
    notVerifiable: number;
  };
  coverage: {
    mode:
      "same-page-number-selectable-text";
    alignsReorderedPages: false;
    ocrIncluded: false;
    notes: string[];
  };
};

function fragments(
  text: string,
) {
  return text
    .split(
      /(?<=[.!?;:])\s+|\s{2,}/,
    )
    .map(
      (value) =>
        value
          .replace(
            /\s+/g,
            " ",
          )
          .trim(),
    )
    .filter(
      (value) =>
        value.length >= 12,
    );
}

function key(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function numberLike(
  text: string,
) {
  return (
    text.match(
      /(?:₹|\bRs\.?|\bINR|\$)?\s*\b\d[\d,]*(?:\.\d+)?\b|\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/gi,
    ) ?? []
  )
    .map(
      (value) =>
        value.trim(),
    )
    .slice(0, 12);
}

export function createPageLevelDiff(
  left: PdfContentSignal,
  right: PdfContentSignal,
): PageLevelDiffReport {
  const leftPages =
    left.pages ?? [];
  const rightPages =
    right.pages ?? [];
  const maxPages =
    Math.max(
      leftPages.length,
      rightPages.length,
    );
  const pages: PageLevelDifference[] =
    [];

  for (
    let index = 0;
    index < maxPages;
    index += 1
  ) {
    const leftPage =
      leftPages[index];
    const rightPage =
      rightPages[index];
    const pageNumber =
      index + 1;

    if (
      !leftPage &&
      rightPage
    ) {
      pages.push({
        pageNumber,
        status: "added",
        similarity: null,
        addedFragments:
          fragments(
            rightPage.text,
          ).slice(0, 4),
        removedFragments: [],
        numericChanges: [],
      });
      continue;
    }

    if (
      leftPage &&
      !rightPage
    ) {
      pages.push({
        pageNumber,
        status:
          "removed",
        similarity: null,
        addedFragments: [],
        removedFragments:
          fragments(
            leftPage.text,
          ).slice(0, 4),
        numericChanges: [],
      });
      continue;
    }

    if (
      !leftPage ||
      !rightPage
    ) {
      continue;
    }

    const similarity =
      textSimilarity(
        leftPage.normalizedText,
        rightPage.normalizedText,
      );

    if (
      similarity === null
    ) {
      pages.push({
        pageNumber,
        status:
          "not-verifiable",
        similarity,
        addedFragments: [],
        removedFragments: [],
        numericChanges: [],
      });
      continue;
    }

    const leftFragments =
      fragments(
        leftPage.text,
      );
    const rightFragments =
      fragments(
        rightPage.text,
      );
    const leftKeys =
      new Set(
        leftFragments.map(
          key,
        ),
      );
    const rightKeys =
      new Set(
        rightFragments.map(
          key,
        ),
      );
    const removedFragments =
      leftFragments.filter(
        (fragment) =>
          !rightKeys.has(
            key(fragment),
          ),
      );
    const addedFragments =
      rightFragments.filter(
        (fragment) =>
          !leftKeys.has(
            key(fragment),
          ),
      );
    const beforeNumbers =
      numberLike(
        leftPage.text,
      );
    const afterNumbers =
      numberLike(
        rightPage.text,
      );
    const numericChanges: Array<{
      before: string;
      after: string;
    }> = [];

    const pairCount =
      Math.min(
        beforeNumbers.length,
        afterNumbers.length,
      );

    for (
      let numberIndex = 0;
      numberIndex <
      pairCount;
      numberIndex += 1
    ) {
      if (
        beforeNumbers[
          numberIndex
        ] !==
        afterNumbers[
          numberIndex
        ]
      ) {
        numericChanges.push({
          before:
            beforeNumbers[
              numberIndex
            ],
          after:
            afterNumbers[
              numberIndex
            ],
        });
      }
    }

    pages.push({
      pageNumber,
      status:
        similarity >= 0.985
          ? "unchanged"
          : "changed",
      similarity,
      addedFragments:
        addedFragments.slice(
          0,
          4,
        ),
      removedFragments:
        removedFragments.slice(
          0,
          4,
        ),
      numericChanges:
        numericChanges.slice(
          0,
          5,
        ),
    });
  }

  const count = (
    status: PageDifferenceStatus,
  ) =>
    pages.filter(
      (page) =>
        page.status ===
        status,
    ).length;

  return {
    pages,
    summary: {
      unchanged:
        count(
          "unchanged",
        ),
      changed:
        count("changed"),
      added:
        count("added"),
      removed:
        count("removed"),
      notVerifiable:
        count(
          "not-verifiable",
        ),
    },
    coverage: {
      mode:
        "same-page-number-selectable-text",
      alignsReorderedPages:
        false,
      ocrIncluded: false,
      notes: [
        "Pages are compared by page number; reordered pages are not automatically aligned in V1.",
        "Only selectable text is compared. Image-only differences require another supported inspection path.",
      ],
    },
  };
}
