export type PdfPositionedTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfDetectedTableCell = {
  text: string;
  x: number;
  width: number;
};

export type PdfDetectedTableRow = {
  y: number;
  cells: PdfDetectedTableCell[];
};

export type PdfDetectedTable = {
  rows: PdfDetectedTableRow[];
  columnStarts: number[];
};

type PositionedLine = {
  y: number;
  items: PdfPositionedTextItem[];
};

const DEFAULT_VERTICAL_TOLERANCE = 3;
const DEFAULT_COLUMN_TOLERANCE = 18;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function groupItemsByLine(
  items: PdfPositionedTextItem[],
  verticalTolerance = DEFAULT_VERTICAL_TOLERANCE,
): PositionedLine[] {
  const sortedItems = [...items].sort((first, second) => {
    if (
      Math.abs(first.y - second.y) >
      verticalTolerance
    ) {
      return second.y - first.y;
    }

    return first.x - second.x;
  });

  const lines: PositionedLine[] = [];

  for (const item of sortedItems) {
    const matchingLine = lines.find(
      (line) =>
        Math.abs(line.y - item.y) <=
        verticalTolerance,
    );

    if (matchingLine) {
      matchingLine.items.push(item);
      continue;
    }

    lines.push({
      y: item.y,
      items: [item],
    });
  }

  return lines
    .sort((first, second) => second.y - first.y)
    .map((line) => ({
      ...line,
      items: [...line.items].sort(
        (first, second) => first.x - second.x,
      ),
    }));
}

function estimateCharacterWidth(
  item: PdfPositionedTextItem,
) {
  if (!item.text) {
    return 4;
  }

  return Math.max(
    2,
    item.width / item.text.length,
  );
}

function splitLineIntoCells(
  items: PdfPositionedTextItem[],
): PdfDetectedTableCell[] {
  if (items.length === 0) {
    return [];
  }

  const cells: PdfDetectedTableCell[] = [];
  let currentText = items[0].text;
  let currentX = items[0].x;
  let currentEndX =
    items[0].x + items[0].width;

  for (
    let index = 1;
    index < items.length;
    index += 1
  ) {
    const item = items[index];
    const previousItem = items[index - 1];

    const gap = item.x - currentEndX;

    const estimatedCharacterWidth =
      estimateCharacterWidth(previousItem);

    const isNewCell =
      gap >
      Math.max(
        estimatedCharacterWidth * 2.2,
        10,
      );

    if (isNewCell) {
      cells.push({
        text: normalizeText(currentText),
        x: currentX,
        width: Math.max(
          0,
          currentEndX - currentX,
        ),
      });

      currentText = item.text;
      currentX = item.x;
      currentEndX = item.x + item.width;
      continue;
    }

    const needsSpace =
      gap > estimatedCharacterWidth * 0.35;

    currentText += needsSpace
      ? ` ${item.text}`
      : item.text;

    currentEndX = Math.max(
      currentEndX,
      item.x + item.width,
    );
  }

  cells.push({
    text: normalizeText(currentText),
    x: currentX,
    width: Math.max(
      0,
      currentEndX - currentX,
    ),
  });

  return cells.filter((cell) => cell.text);
}

function mergeNearbyColumnStarts(
  values: number[],
  tolerance = DEFAULT_COLUMN_TOLERANCE,
) {
  const sortedValues = [...values].sort(
    (first, second) => first - second,
  );

  const clusters: number[][] = [];

  for (const value of sortedValues) {
    const matchingCluster = clusters.find(
      (cluster) => {
        const average =
          cluster.reduce(
            (sum, current) => sum + current,
            0,
          ) / cluster.length;

        return (
          Math.abs(average - value) <=
          tolerance
        );
      },
    );

    if (matchingCluster) {
      matchingCluster.push(value);
    } else {
      clusters.push([value]);
    }
  }

  return clusters.map((cluster) => {
    return (
      cluster.reduce(
        (sum, current) => sum + current,
        0,
      ) / cluster.length
    );
  });
}

function alignCellsToColumns(
  cells: PdfDetectedTableCell[],
  columnStarts: number[],
) {
  const alignedCells = columnStarts.map(() => "");

  for (const cell of cells) {
    let closestColumnIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    columnStarts.forEach(
      (columnStart, columnIndex) => {
        const distance = Math.abs(
          columnStart - cell.x,
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestColumnIndex = columnIndex;
        }
      },
    );

    alignedCells[closestColumnIndex] = normalizeText(
      [
        alignedCells[closestColumnIndex],
        cell.text,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return alignedCells;
}

export function detectPdfTable(
  items: PdfPositionedTextItem[],
): PdfDetectedTable | null {
  const nonEmptyItems = items.filter(
    (item) => normalizeText(item.text),
  );

  if (nonEmptyItems.length < 6) {
    return null;
  }

  const lines = groupItemsByLine(nonEmptyItems);

  const candidateRows = lines
    .map((line) => ({
      y: line.y,
      cells: splitLineIntoCells(line.items),
    }))
    .filter((row) => row.cells.length >= 2);

  if (candidateRows.length < 3) {
    return null;
  }

  const columnStarts =
    mergeNearbyColumnStarts(
      candidateRows.flatMap((row) =>
        row.cells.map((cell) => cell.x),
      ),
    );

  if (columnStarts.length < 2) {
    return null;
  }

  const rows = candidateRows.map((row) => {
    const alignedCellTexts =
      alignCellsToColumns(
        row.cells,
        columnStarts,
      );

    return {
      y: row.y,
      cells: alignedCellTexts.map(
        (text, index) => ({
          text,
          x: columnStarts[index],
          width:
            index <
            columnStarts.length - 1
              ? Math.max(
                  0,
                  columnStarts[index + 1] -
                    columnStarts[index],
                )
              : 0,
        }),
      ),
    };
  });

  const meaningfulRows = rows.filter(
    (row) =>
      row.cells.filter((cell) => cell.text)
        .length >= 2,
  );

  if (meaningfulRows.length < 3) {
    return null;
  }

  return {
    rows: meaningfulRows,
    columnStarts,
  };
}