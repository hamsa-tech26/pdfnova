import { PDFDocument } from "pdf-lib";

export function validatePdfPageOrder(
  order: number[],
  pageCount: number,
) {
  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1
  ) {
    throw new Error(
      "The PDF must contain at least one page.",
    );
  }

  if (order.length !== pageCount) {
    throw new Error(
      `The page order must contain all ${pageCount} pages exactly once.`,
    );
  }

  if (
    order.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= pageCount,
    ) ||
    new Set(order).size !==
      pageCount
  ) {
    throw new Error(
      `Use each page from 1 to ${pageCount} exactly once.`,
    );
  }
}

export function reorderPdfPagesInPlace(
  pdf: PDFDocument,
  order: number[],
) {
  const pageCount =
    pdf.getPageCount();

  validatePdfPageOrder(
    order,
    pageCount,
  );

  const originalPages = [
    ...pdf.getPages(),
  ];

  for (
    let index = pageCount - 1;
    index >= 0;
    index -= 1
  ) {
    pdf.removePage(index);
  }

  for (const originalIndex of order) {
    pdf.addPage(
      originalPages[
        originalIndex
      ],
    );
  }
}

export function reversePdfPagesInPlace(
  pdf: PDFDocument,
) {
  const pageCount =
    pdf.getPageCount();

  reorderPdfPagesInPlace(
    pdf,
    Array.from(
      { length: pageCount },
      (_, index) =>
        pageCount - 1 - index,
    ),
  );
}
