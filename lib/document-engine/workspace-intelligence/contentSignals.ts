export type PdfPageContentSignal = {
  pageNumber: number;
  text: string;
  normalizedText: string;
  selectableTextChars: number;
  source?: "native" | "ocr-tesseract";
  confidence?: number;
};

export type PdfContentSignal = {
  fileName: string;
  fileSize: number;
  sha256: string;
  pageCount: number;
  selectableTextChars: number;
  rawText?: string;
  pages?: PdfPageContentSignal[];
  normalizedText: string;
  normalizedLines: string[];
};

export type PdfContentRelationship =
  | "exact-duplicate"
  | "probable-revision"
  | "related"
  | "distinct"
  | "unverified";

export type PdfContentComparison = {
  relationship: PdfContentRelationship;
  exactDuplicate: boolean;
  textComparable: boolean;
  textSimilarity: number | null;
  pageCountDelta: number;
  commonLineCount: number;
  leftOnlyLineCount: number;
  rightOnlyLineCount: number;
};

function normalizeLine(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeComparableText(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(
  value: string,
) {
  const words =
    normalizeComparableText(
      value,
    ).split(" ").filter(Boolean);

  if (words.length === 0) {
    return new Set<string>();
  }

  if (words.length < 3) {
    return new Set(words);
  }

  const result =
    new Set<string>();

  for (
    let index = 0;
    index <=
    words.length - 3;
    index += 1
  ) {
    result.add(
      words
        .slice(
          index,
          index + 3,
        )
        .join(" "),
    );
  }

  return result;
}

export function textSimilarity(
  left: string,
  right: string,
) {
  const leftSet =
    shingles(left);
  const rightSet =
    shingles(right);

  if (
    leftSet.size === 0 ||
    rightSet.size === 0
  ) {
    return null;
  }

  let common = 0;

  for (const item of leftSet) {
    if (rightSet.has(item)) {
      common += 1;
    }
  }

  return (
    (2 * common) /
    (leftSet.size +
      rightSet.size)
  );
}

export function comparePdfContentSignals(
  left: PdfContentSignal,
  right: PdfContentSignal,
): PdfContentComparison {
  const exactDuplicate =
    left.sha256 === right.sha256;
  const similarity =
    textSimilarity(
      left.normalizedText,
      right.normalizedText,
    );
  const textComparable =
    similarity !== null;

  const leftLines =
    new Set(
      left.normalizedLines,
    );
  const rightLines =
    new Set(
      right.normalizedLines,
    );

  let commonLineCount = 0;

  for (const line of leftLines) {
    if (rightLines.has(line)) {
      commonLineCount += 1;
    }
  }

  const leftOnlyLineCount =
    leftLines.size -
    commonLineCount;
  const rightOnlyLineCount =
    rightLines.size -
    commonLineCount;

  let relationship:
    PdfContentRelationship;

  if (exactDuplicate) {
    relationship =
      "exact-duplicate";
  } else if (!textComparable) {
    relationship =
      "unverified";
  } else if (
    similarity >= 0.82
  ) {
    relationship =
      "probable-revision";
  } else if (
    similarity >= 0.45
  ) {
    relationship = "related";
  } else {
    relationship = "distinct";
  }

  return {
    relationship,
    exactDuplicate,
    textComparable,
    textSimilarity:
      similarity,
    pageCountDelta:
      right.pageCount -
      left.pageCount,
    commonLineCount,
    leftOnlyLineCount,
    rightOnlyLineCount,
  };
}

async function sha256Hex(
  bytes: ArrayBuffer,
) {
  if (
    !globalThis.crypto?.subtle
  ) {
    throw new Error(
      "Local SHA-256 is unavailable in this browser.",
    );
  }

  const digest =
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      bytes,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((value) =>
      value
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

async function loadPdfJs() {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  if (
    !pdfjs.GlobalWorkerOptions
      .workerSrc
  ) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
  }

  return pdfjs;
}

export async function createPdfContentSignal(
  file: File,
): Promise<PdfContentSignal> {
  if (
    typeof window === "undefined"
  ) {
    throw new Error(
      "Document comparison must run inside the browser.",
    );
  }

  const bytes =
    await file.arrayBuffer();
  const sha256 =
    await sha256Hex(
      bytes.slice(0),
    );
  const pdfjs =
    await loadPdfJs();
  const task =
    pdfjs.getDocument({
      data: new Uint8Array(
        bytes,
      ),
    });
  const pdf =
    await task.promise;
  const pageTexts: string[] =
    [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <=
      pdf.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdf.getPage(
          pageNumber,
        );
      const content =
        await page.getTextContent();
      const fragments: string[] =
        [];

      for (
        const item of content.items
      ) {
        if (
          "str" in item &&
          typeof item.str ===
            "string"
        ) {
          fragments.push(
            item.str +
              (
                "hasEOL" in item &&
                item.hasEOL
                  ? "\n"
                  : " "
              ),
          );
        }
      }

      pageTexts.push(
        fragments
          .join("")
          .replace(
            /[ \t]+/g,
            " ",
          )
          .replace(
            / *\n */g,
            "\n",
          )
          .trim(),
      );

      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  const pages =
    pageTexts.map(
      (text, index) => {
        const normalizedText =
          normalizeComparableText(
            text,
          );

        return {
          pageNumber:
            index + 1,
          text,
          normalizedText,
          selectableTextChars:
            normalizedText.length,
          source:
            "native" as const,
        };
      },
    );
  const rawText =
    pageTexts.join("\n");
  const normalizedText =
    normalizeComparableText(
      rawText,
    );
  const normalizedLines =
    pageTexts
      .flatMap((page) =>
        page.split(/\n+/),
      )
      .map(normalizeLine)
      .filter(Boolean);

  return {
    fileName:
      file.name,
    fileSize:
      file.size,
    sha256,
    pageCount:
      pageTexts.length,
    selectableTextChars:
      normalizedText.length,
    rawText,
    pages,
    normalizedText,
    normalizedLines:
      [
        ...new Set(
          normalizedLines,
        ),
      ],
  };
}
