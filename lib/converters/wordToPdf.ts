import mammoth from "mammoth";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const PAGE_MARGIN = 45;

const BODY_FONT_SIZE = 11;
const BODY_LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 7;

const TABLE_FONT_SIZE = 10;
const TABLE_LINE_HEIGHT = 14;
const TABLE_CELL_PADDING = 5;
const TABLE_GAP = 10;

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function splitLongWord(
  word: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const parts: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (
      current &&
      font.widthOfTextAtSize(
        candidate,
        fontSize,
      ) > maxWidth
    ) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [""];
  }

  const words = normalized
    .split(/\s+/)
    .filter(Boolean);

  const wrappedLines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const wordParts =
      font.widthOfTextAtSize(
        word,
        fontSize,
      ) > maxWidth
        ? splitLongWord(
            word,
            font,
            fontSize,
            maxWidth,
          )
        : [word];

    for (const wordPart of wordParts) {
      const testLine = currentLine
        ? `${currentLine} ${wordPart}`
        : wordPart;

      const testWidth =
        font.widthOfTextAtSize(
          testLine,
          fontSize,
        );

      if (testWidth <= maxWidth) {
        currentLine = testLine;
        continue;
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }

      currentLine = wordPart;
    }
  }

  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines.length > 0
    ? wrappedLines
    : [""];
}

function getDirectListItemText(
  item: Element,
) {
  const clone =
    item.cloneNode(true) as Element;

  clone
    .querySelectorAll(
      "ul, ol, table",
    )
    .forEach((nested) =>
      nested.remove(),
    );

  return normalizeText(
    clone.textContent ?? "",
  );
}

export async function convertWordToPdf(
  file: File,
): Promise<Uint8Array> {
  if (typeof DOMParser === "undefined") {
    throw new Error(
      "Word to PDF conversion is only available in the browser.",
    );
  }

  const arrayBuffer =
    await file.arrayBuffer();

  const result =
    await mammoth.convertToHtml({
      arrayBuffer,
    });

  const html = result.value.trim();

  if (!html) {
    throw new Error(
      "The Word document does not contain readable content.",
    );
  }

  const parser = new DOMParser();

  const htmlDocument =
    parser.parseFromString(
      html,
      "text/html",
    );

  const documentText =
    normalizeText(
      htmlDocument.body.textContent ?? "",
    );

  if (!documentText) {
    throw new Error(
      "The Word document does not contain readable text.",
    );
  }

  const pdf =
    await PDFDocument.create();

  const regularFont =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await pdf.embedFont(
      StandardFonts.HelveticaBold,
    );

  let page: PDFPage =
    pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

  let pageWidth = A4_WIDTH;
  let pageHeight = A4_HEIGHT;

  let yPosition =
    pageHeight - PAGE_MARGIN;

  function createNewPage() {
    page = pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

    const pageSize =
      page.getSize();

    pageWidth = pageSize.width;
    pageHeight = pageSize.height;

    yPosition =
      pageHeight - PAGE_MARGIN;
  }

  function ensureSpace(
    requiredHeight: number,
  ) {
    if (
      yPosition - requiredHeight <
      PAGE_MARGIN
    ) {
      createNewPage();
      return true;
    }

    return false;
  }

  function drawTextBlock(
    text: string,
    options: {
      font?: PDFFont;
      fontSize?: number;
      lineHeight?: number;
      gapAfter?: number;
      indent?: number;
    } = {},
  ) {
    const normalized =
      normalizeText(text);

    if (!normalized) {
      yPosition -= PARAGRAPH_GAP;
      return;
    }

    const font =
      options.font ?? regularFont;

    const fontSize =
      options.fontSize ??
      BODY_FONT_SIZE;

    const lineHeight =
      options.lineHeight ??
      BODY_LINE_HEIGHT;

    const gapAfter =
      options.gapAfter ??
      PARAGRAPH_GAP;

    const indent =
      options.indent ?? 0;

    const maxTextWidth =
      pageWidth -
      PAGE_MARGIN * 2 -
      indent;

    const lines = wrapText(
      normalized,
      font,
      fontSize,
      maxTextWidth,
    );

    for (const line of lines) {
      ensureSpace(lineHeight);

      page.drawText(line, {
        x: PAGE_MARGIN + indent,
        y: yPosition,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;
    }

    yPosition -= gapAfter;
  }

  function getTableRows(
    table: Element,
  ) {
    return Array.from(
      table.querySelectorAll("tr"),
    ).filter(
      (row) =>
        row.closest("table") ===
        table,
    );
  }

  function getRowCells(
    row: Element,
  ) {
    return Array.from(
      row.children,
    ).filter((child) => {
      const tag =
        child.tagName.toLowerCase();

      return (
        tag === "td" ||
        tag === "th"
      );
    });
  }

  function isHeaderRow(
    row: Element,
  ) {
    const cells =
      getRowCells(row);

    if (cells.length === 0) {
      return false;
    }

    if (
      row.parentElement?.tagName
        .toLowerCase() === "thead"
    ) {
      return true;
    }

    return cells.every(
      (cell) =>
        cell.tagName.toLowerCase() ===
        "th",
    );
  }

  function drawTableRow(
    row: Element,
    columnCount: number,
    columnWidth: number,
    forceHeader = false,
  ) {
    const cells =
      getRowCells(row);

    const cellData =
      Array.from(
        { length: columnCount },
        (_, index) => {
          const cell =
            cells[index];

          const isHeader =
            forceHeader ||
            cell?.tagName
              .toLowerCase() === "th";

          const font = isHeader
            ? boldFont
            : regularFont;

          const text = cell
            ? normalizeText(
                cell.textContent ?? "",
              )
            : "";

          const lines = wrapText(
            text,
            font,
            TABLE_FONT_SIZE,
            columnWidth -
              TABLE_CELL_PADDING * 2,
          );

          return {
            text,
            lines,
            font,
          };
        },
      );

    const maximumLines =
      Math.max(
        1,
        ...cellData.map(
          (cell) =>
            Math.max(
              1,
              cell.lines.length,
            ),
        ),
      );

    const rowHeight =
      maximumLines *
        TABLE_LINE_HEIGHT +
      TABLE_CELL_PADDING * 2;

    ensureSpace(rowHeight);

    const rowTop = yPosition;
    const rowBottom =
      rowTop - rowHeight;

    for (
      let columnIndex = 0;
      columnIndex < columnCount;
      columnIndex += 1
    ) {
      const x =
        PAGE_MARGIN +
        columnIndex * columnWidth;

      page.drawRectangle({
        x,
        y: rowBottom,
        width: columnWidth,
        height: rowHeight,
        borderWidth: 0.75,
        borderColor: rgb(
          0.55,
          0.55,
          0.55,
        ),
      });

      const cell =
        cellData[columnIndex];

      if (!cell.text) {
        continue;
      }

      let textY =
        rowTop -
        TABLE_CELL_PADDING -
        TABLE_FONT_SIZE;

      for (
        const line of cell.lines
      ) {
        page.drawText(line, {
          x:
            x +
            TABLE_CELL_PADDING,
          y: textY,
          size: TABLE_FONT_SIZE,
          font: cell.font,
          color: rgb(0, 0, 0),
        });

        textY -=
          TABLE_LINE_HEIGHT;
      }
    }

    yPosition = rowBottom;
  }

  function drawTable(
    table: Element,
  ) {
    const rows =
      getTableRows(table);

    if (rows.length === 0) {
      return;
    }

    const columnCount =
      Math.max(
        ...rows.map(
          (row) =>
            getRowCells(row)
              .length,
        ),
      );

    if (columnCount <= 0) {
      return;
    }

    const tableWidth =
      pageWidth -
      PAGE_MARGIN * 2;

    const columnWidth =
      tableWidth /
      columnCount;

    const firstRow =
      rows[0];

    const firstRowIsHeader =
      isHeaderRow(firstRow);

    for (
      let rowIndex = 0;
      rowIndex < rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex];

      const cells =
        getRowCells(row);

      const estimatedLines =
        Math.max(
          1,
          ...cells.map(
            (cell) =>
              wrapText(
                normalizeText(
                  cell.textContent ??
                    "",
                ),
                regularFont,
                TABLE_FONT_SIZE,
                columnWidth -
                  TABLE_CELL_PADDING *
                    2,
              ).length,
          ),
        );

      const estimatedHeight =
        estimatedLines *
          TABLE_LINE_HEIGHT +
        TABLE_CELL_PADDING * 2;

      const movedToNewPage =
        ensureSpace(
          estimatedHeight,
        );

      if (
        movedToNewPage &&
        rowIndex > 0 &&
        firstRowIsHeader
      ) {
        drawTableRow(
          firstRow,
          columnCount,
          columnWidth,
          true,
        );
      }

      drawTableRow(
        row,
        columnCount,
        columnWidth,
        isHeaderRow(row),
      );
    }

    yPosition -= TABLE_GAP;
  }

  function processList(
    list: Element,
  ) {
    const ordered =
      list.tagName.toLowerCase() ===
      "ol";

    const items =
      Array.from(
        list.children,
      ).filter(
        (child) =>
          child.tagName
            .toLowerCase() ===
          "li",
      );

    items.forEach(
      (item, index) => {
        const itemText =
          getDirectListItemText(
            item,
          );

        if (itemText) {
          const prefix = ordered
            ? `${index + 1}. `
            : "- ";

          drawTextBlock(
            `${prefix}${itemText}`,
            {
              indent: 12,
              gapAfter: 3,
            },
          );
        }

        Array.from(
          item.children,
        )
          .filter((child) =>
            ["ul", "ol"].includes(
              child.tagName.toLowerCase(),
            ),
          )
          .forEach((nested) =>
            processList(nested),
          );
      },
    );

    yPosition -= 3;
  }

  function processElement(
    element: Element,
  ) {
    const tag =
      element.tagName
        .toLowerCase();

    if (tag === "table") {
      drawTable(element);
      return;
    }

    if (
      tag === "ul" ||
      tag === "ol"
    ) {
      processList(element);
      return;
    }

    if (tag === "h1") {
      drawTextBlock(
        element.textContent ?? "",
        {
          font: boldFont,
          fontSize: 18,
          lineHeight: 22,
          gapAfter: 10,
        },
      );
      return;
    }

    if (tag === "h2") {
      drawTextBlock(
        element.textContent ?? "",
        {
          font: boldFont,
          fontSize: 16,
          lineHeight: 20,
          gapAfter: 9,
        },
      );
      return;
    }

    if (tag === "h3") {
      drawTextBlock(
        element.textContent ?? "",
        {
          font: boldFont,
          fontSize: 14,
          lineHeight: 18,
          gapAfter: 8,
        },
      );
      return;
    }

    if (
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      drawTextBlock(
        element.textContent ?? "",
        {
          font: boldFont,
          fontSize: 12,
          lineHeight: 16,
          gapAfter: 7,
        },
      );
      return;
    }

    if (
      tag === "p" ||
      tag === "blockquote"
    ) {
      drawTextBlock(
        element.textContent ?? "",
      );
      return;
    }

    const children =
      Array.from(
        element.children,
      );

    if (children.length > 0) {
      children.forEach(
        processElement,
      );
      return;
    }

    const text =
      normalizeText(
        element.textContent ?? "",
      );

    if (text) {
      drawTextBlock(text);
    }
  }

  const bodyChildren =
    Array.from(
      htmlDocument.body.children,
    );

  for (
    const element of bodyChildren
  ) {
    processElement(element);
  }

  return pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
}
