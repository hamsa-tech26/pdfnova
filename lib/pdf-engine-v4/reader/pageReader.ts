import type {
  PdfBoundingBox,
  PdfDocumentModel,
  PdfEngineMetadata,
  PdfFontInfo,
  PdfLine,
  PdfPageModel,
  PdfWord,
} from "../model/types";

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
    fontName?: unknown;
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

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
  }

  return pdfjsLib;
}

function createId(
  prefix: string,
  pageNumber: number,
  index: number,
) {
  return `${prefix}-${pageNumber}-${index}`;
}

function estimateFontSize(
  transform: number[],
  fallbackHeight: number,
) {
  const scaleX = Math.abs(transform[0] ?? 0);
  const scaleY = Math.abs(transform[3] ?? 0);

  const estimatedSize = Math.max(
    scaleX,
    scaleY,
    fallbackHeight,
  );

  return Number.isFinite(estimatedSize)
    ? estimatedSize
    : fallbackHeight;
}

function createBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): PdfBoundingBox {
  return { x, y, width, height };
}

function createFontInfo(
  item: PdfJsTextItem,
  transform: number[],
): PdfFontInfo {
  const fontName =
    typeof item.fontName === "string"
      ? item.fontName
      : undefined;

  const normalizedFontName =
    fontName?.toLowerCase() ?? "";

  return {
    name: fontName,
    size: estimateFontSize(
      transform,
      item.height,
    ),
    bold:
      normalizedFontName.includes("bold") ||
      normalizedFontName.includes("black") ||
      normalizedFontName.includes("heavy"),
    italic:
      normalizedFontName.includes("italic") ||
      normalizedFontName.includes("oblique"),
  };
}

function getLineBounds(
  words: PdfWord[],
): PdfBoundingBox {
  if (words.length === 0) {
    return createBounds(0, 0, 0, 0);
  }

  const minX = Math.min(...words.map((word) => word.bounds.x));
  const minY = Math.min(...words.map((word) => word.bounds.y));
  const maxX = Math.max(
    ...words.map(
      (word) =>
        word.bounds.x + word.bounds.width,
    ),
  );
  const maxY = Math.max(
    ...words.map(
      (word) =>
        word.bounds.y + word.bounds.height,
    ),
  );

  return createBounds(
    minX,
    minY,
    maxX - minX,
    maxY - minY,
  );
}

function joinLineWords(
  words: PdfWord[],
) {
  const sortedWords = [...words].sort(
    (first, second) =>
      first.bounds.x - second.bounds.x,
  );

  let text = "";

  for (
    let index = 0;
    index < sortedWords.length;
    index += 1
  ) {
    const word = sortedWords[index];
    const previousWord =
      sortedWords[index - 1];

    if (previousWord) {
      const previousEndX =
        previousWord.bounds.x +
        previousWord.bounds.width;

      const gap =
        word.bounds.x - previousEndX;

      const estimatedCharacterWidth =
        previousWord.text.length > 0
          ? previousWord.bounds.width /
            previousWord.text.length
          : 4;

      if (
        gap >
        estimatedCharacterWidth * 0.35
      ) {
        text += " ";
      }
    }

    text += word.text;
  }

  return text
    .replace(/\s+/g, " ")
    .trim();
}

function groupWordsIntoLines(
  words: PdfWord[],
  pageNumber: number,
): PdfLine[] {
  const sortedWords = [...words].sort(
    (first, second) => {
      if (
        Math.abs(
          first.bounds.y - second.bounds.y,
        ) > LINE_TOLERANCE
      ) {
        return (
          second.bounds.y -
          first.bounds.y
        );
      }

      return (
        first.bounds.x -
        second.bounds.x
      );
    },
  );

  const groups: PdfWord[][] = [];

  for (const word of sortedWords) {
    const matchingGroup = groups.find(
      (group) => {
        const referenceWord = group[0];

        return (
          Math.abs(
            referenceWord.bounds.y -
              word.bounds.y,
          ) <= LINE_TOLERANCE
        );
      },
    );

    if (matchingGroup) {
      matchingGroup.push(word);
      continue;
    }

    groups.push([word]);
  }

  return groups.map((group, index) => {
    const sortedGroup = [...group].sort(
      (first, second) =>
        first.bounds.x -
        second.bounds.x,
    );

    return {
      id: createId(
        "line",
        pageNumber,
        index,
      ),
      pageNumber,
      words: sortedGroup,
      bounds: getLineBounds(sortedGroup),
      text: joinLineWords(sortedGroup),
    };
  });
}

async function readMetadata(
  pdf: Awaited<
    ReturnType<PdfJsModule["getDocument"]>
  >["promise"] extends Promise<infer T>
    ? T
    : never,
  file: File,
): Promise<PdfEngineMetadata> {
  try {
    const metadataResult =
      await pdf.getMetadata();

    const info = metadataResult.info as {
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
    };

    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      title: info.Title || undefined,
      author: info.Author || undefined,
      subject: info.Subject || undefined,
      keywords: info.Keywords
        ? info.Keywords.split(",")
            .map((keyword) =>
              keyword.trim(),
            )
            .filter(Boolean)
        : undefined,
    };
  } catch {
    return {
      fileName: file.name,
      pageCount: pdf.numPages,
    };
  }
}

export async function readPdfDocumentV4(
  file: File,
): Promise<PdfDocumentModel> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF Engine V4 must run inside the browser.",
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
  const pages: PdfPageModel[] = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdf.getPage(pageNumber);

      const viewport =
        page.getViewport({
          scale: 1,
        });

      const textContent =
        await page.getTextContent();

      const words: PdfWord[] = [];

      textContent.items.forEach(
        (item, index) => {
          if (!isPdfJsTextItem(item)) {
            return;
          }

          const text = item.str
            .replace(/\s+/g, " ")
            .trim();

          if (!text) {
            return;
          }

          const transform =
            Array.from(item.transform);

          const x = transform[4] ?? 0;
          const y = transform[5] ?? 0;

          words.push({
            id: createId(
              "word",
              pageNumber,
              index,
            ),
            text,
            pageNumber,
            bounds: createBounds(
              x,
              y,
              item.width,
              item.height,
            ),
            font: createFontInfo(
              item,
              transform,
            ),
            rotation: 0,
          });
        },
      );

      const lines =
        groupWordsIntoLines(
          words,
          pageNumber,
        );

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        words,
        lines,
        blocks: [],
      });

      page.cleanup();
    }

    const metadata =
      await readMetadata(pdf, file);

    const totalWords = pages.reduce(
      (sum, page) =>
        sum + page.words.length,
      0,
    );

    return {
      metadata,
      pages,
      confidence:
        totalWords > 0 ? 1 : 0,
    };
  } finally {
    await loadingTask.destroy();
  }
}
