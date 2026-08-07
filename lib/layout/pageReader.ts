import type {
  PdfLine,
  PdfPageLayout,
  PdfWord,
} from "./types";

type PdfJsTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
};

type PdfJsModule = typeof import(
  "pdfjs-dist/legacy/build/pdf.mjs"
);

const LINE_TOLERANCE = 3;

function isPdfJsTextItem(
  item: unknown,
): item is PdfJsTextItem {
  if (
    typeof item !== "object" ||
    item === null
  ) {
    return false;
  }

  const candidate = item as {
    str?: unknown;
    transform?: unknown;
    width?: unknown;
    height?: unknown;
  };

  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    candidate.transform.length >= 6 &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjsLib = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  if (
    !pdfjsLib.GlobalWorkerOptions.workerSrc
  ) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
  }

  return pdfjsLib;
}

function estimateFontSize(
  transform: number[],
  fallbackHeight: number,
) {
  const scaleX = transform[0] ?? 0;
  const scaleY = transform[3] ?? 0;

  const estimatedSize = Math.max(
    Math.abs(scaleX),
    Math.abs(scaleY),
    fallbackHeight,
  );

  return Number.isFinite(estimatedSize)
    ? estimatedSize
    : fallbackHeight;
}

function groupWordsIntoLines(
  words: PdfWord[],
): PdfLine[] {
  const sortedWords = [...words].sort(
    (first, second) => {
      if (
        Math.abs(first.y - second.y) >
        LINE_TOLERANCE
      ) {
        return second.y - first.y;
      }

      return first.x - second.x;
    },
  );

  const lines: PdfLine[] = [];

  for (const word of sortedWords) {
    const matchingLine = lines.find(
      (line) =>
        Math.abs(line.y - word.y) <=
        LINE_TOLERANCE,
    );

    if (matchingLine) {
      matchingLine.words.push(word);
      matchingLine.height = Math.max(
        matchingLine.height,
        word.height,
      );
      continue;
    }

    lines.push({
      words: [word],
      y: word.y,
      height: word.height,
    });
  }

  return lines
    .sort(
      (first, second) =>
        second.y - first.y,
    )
    .map((line) => ({
      ...line,
      words: [...line.words].sort(
        (first, second) =>
          first.x - second.x,
      ),
    }));
}

export async function readPdfPages(
  file: File,
): Promise<PdfPageLayout[]> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF layout analysis must run inside the browser.",
    );
  }

  const pdfjsLib = await loadPdfJs();
  const arrayBuffer =
    await file.arrayBuffer();

  const loadingTask =
    pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    });

  const pdf = await loadingTask.promise;
  const pageLayouts: PdfPageLayout[] = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdf.getPage(pageNumber);

      const textContent =
        await page.getTextContent();

      const words: PdfWord[] =
        textContent.items.reduce<PdfWord[]>(
          (result, item) => {
            if (!isPdfJsTextItem(item)) {
              return result;
            }

            const text = item.str
              .replace(/\s+/g, " ")
              .trim();

            if (!text) {
              return result;
            }

            const transform =
              Array.from(item.transform);

            const x = transform[4] ?? 0;
            const y = transform[5] ?? 0;

            const fontSize =
              estimateFontSize(
                transform,
                item.height,
              );

            result.push({
              text,
              x,
              y,
              width: item.width,
              height: item.height,
              fontSize,
              pageNumber,
            });

            return result;
          },
          [],
        );

      const lines =
        groupWordsIntoLines(words);

      pageLayouts.push({
        pageNumber,
        words,
        lines,
        paragraphs: [],
        tables: [],
      });

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return pageLayouts;
}