import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  detectPdfTable,
  type PdfPositionedTextItem,
} from "./pdfTableDetection";

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type TextLine = {
  y: number;
  items: PdfTextItem[];
};

function groupItemsIntoLines(
  items: PdfTextItem[],
): TextLine[] {
  const lines: TextLine[] = [];
  const verticalTolerance = 3;

  const sortedItems = [...items].sort(
    (first, second) => {
      const firstY = first.transform[5];
      const secondY = second.transform[5];

      if (
        Math.abs(firstY - secondY) >
        verticalTolerance
      ) {
        return secondY - firstY;
      }

      return (
        first.transform[4] -
        second.transform[4]
      );
    },
  );

  for (const item of sortedItems) {
    const itemY = item.transform[5];

    const matchingLine = lines.find(
      (line) =>
        Math.abs(line.y - itemY) <=
        verticalTolerance,
    );

    if (matchingLine) {
      matchingLine.items.push(item);
    } else {
      lines.push({
        y: itemY,
        items: [item],
      });
    }
  }

  return lines
    .sort(
      (first, second) =>
        second.y - first.y,
    )
    .map((line) => ({
      ...line,
      items: line.items.sort(
        (first, second) =>
          first.transform[4] -
          second.transform[4],
      ),
    }));
}

function buildLineText(
  items: PdfTextItem[],
) {
  let text = "";

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item = items[index];
    const previousItem = items[index - 1];

    if (previousItem) {
      const previousEndX =
        previousItem.transform[4] +
        previousItem.width;

      const currentStartX =
        item.transform[4];

      const gap =
        currentStartX - previousEndX;

      const estimatedCharacterWidth =
        previousItem.str.length > 0
          ? previousItem.width /
            previousItem.str.length
          : 4;

      if (
        gap >
        estimatedCharacterWidth * 0.45
      ) {
        text += " ";
      }
    }

    text += item.str;
  }

  return text
    .replace(/\s+/g, " ")
    .trim();
}

function isPdfTextItem(
  item: unknown,
): item is PdfTextItem {
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

async function loadPdfJs() {
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

export async function convertPdfToWord(
  file: File,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF to Word conversion must run inside the browser.",
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

  const documentChildren: Array<Paragraph | Table> = [];
  let extractedCharacterCount = 0;

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

      const extractedItems = textContent.items.reduce<
        {
          textItems: PdfTextItem[];
          positionedItems: PdfPositionedTextItem[];
        }
      >(
        (result, item) => {
          if (
            !("str" in item) ||
            typeof item.str !== "string" ||
            !Array.isArray(item.transform)
          ) {
            return result;
          }

          const width =
            typeof item.width === "number"
              ? item.width
              : 0;

          const height =
            typeof item.height === "number"
              ? item.height
              : 0;

          const transform =
            Array.from(item.transform);

          result.textItems.push({
            str: item.str,
            transform,
            width,
            height,
          });

          result.positionedItems.push({
            text: item.str,
            x: transform[4] ?? 0,
            y: transform[5] ?? 0,
            width,
            height,
          });

          return result;
        },
        {
          textItems: [],
          positionedItems: [],
        },
      );

      const textItems =
        extractedItems.textItems;

      const positionedItems =
        extractedItems.positionedItems;

           const detectedTable =
        detectPdfTable(positionedItems);

      if (detectedTable) {
        const tableRows = detectedTable.rows.map(
          (row) =>
            new TableRow({
              children: row.cells.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cell.text || "",
                            size: 20,
                          }),
                        ],
                        spacing: {
                          after: 40,
                        },
                      }),
                    ],
                  }),
              ),
            }),
        );

        const tableText =
          detectedTable.rows
            .flatMap((row) =>
              row.cells.map((cell) => cell.text),
            )
            .join("");

        extractedCharacterCount +=
          tableText.length;

        documentChildren.push(
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          }),
        );
      } else {
        const lines =
          groupItemsIntoLines(textItems);

        for (const line of lines) {
          const lineText =
            buildLineText(line.items);

          if (!lineText) {
            continue;
          }

          extractedCharacterCount +=
            lineText.length;

          documentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: lineText,
                  size: 22,
                }),
              ],
              spacing: {
                after: 120,
              },
            }),
          );
        }
      }

      if (pageNumber < pdf.numPages) {
        documentChildren.push(
          new Paragraph({
            pageBreakBefore: true,
            children: [
              new TextRun({
                text: "",
              }),
            ],
          }),
        );
      }

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  if (extractedCharacterCount === 0) {
    throw new Error(
      "No selectable text was found. This PDF may be scanned or image-based and requires OCR.",
    );
  }

  const wordDocument =
    new Document({
      sections: [
        {
          properties: {},
          children: documentChildren,
        },
      ],
    });

  return Packer.toBlob(wordDocument);
}