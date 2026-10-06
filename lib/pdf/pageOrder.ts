import { degrees, PDFDocument } from "pdf-lib";
import { hasPdfXfa } from "./formFields";

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


export function removePdfPagesInPlace(
  pdf: PDFDocument,
  indices: number[],
) {
  const pageCount =
    pdf.getPageCount();

  const unique = [
    ...new Set(indices),
  ];

  if (
    unique.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= pageCount,
    )
  ) {
    throw new Error(
      `Use page numbers from 1 to ${pageCount}.`,
    );
  }

  if (unique.length === 0) {
    throw new Error(
      "Select at least one page to delete.",
    );
  }

  if (
    unique.length >= pageCount
  ) {
    throw new Error(
      "You cannot delete every page. Keep at least one page.",
    );
  }

  if (hasPdfXfa(pdf)) {
    throw new Error(
      "This PDF contains XFA form data. Page deletion is disabled because changing the page tree could disconnect the XFA structure.",
    );
  }

  const deletedPageRefs =
    new Set(
      unique.map((index) =>
        pdf
          .getPage(index)
          .ref.toString(),
      ),
    );

  if (pdf.catalog.AcroForm()) {
    const form =
      pdf.getForm();

    for (
      const field of
      form.getFields()
    ) {
      const widgetPageRefs =
        field.acroField
          .getWidgets()
          .map((widget) =>
            widget.P()?.toString(),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      if (
        widgetPageRefs.length >
          0 &&
        widgetPageRefs.every(
          (pageRef) =>
            deletedPageRefs.has(
              pageRef,
            ),
        )
      ) {
        form.removeField(field);
      }
    }
  }

  unique
    .sort((a, b) => b - a)
    .forEach((index) =>
      pdf.removePage(index),
    );
}

export type PdfPageOrganization = {
  originalPageIndex: number;
  rotationDelta?: number;
};

export function organizePdfPagesInPlace(
  pdf: PDFDocument,
  entries: PdfPageOrganization[],
) {
  const originalPageCount =
    pdf.getPageCount();

  if (entries.length === 0) {
    throw new Error(
      "The PDF must keep at least one page.",
    );
  }

  const requestedIndices =
    entries.map(
      (entry) =>
        entry.originalPageIndex,
    );

  if (
    requestedIndices.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >=
          originalPageCount,
    ) ||
    new Set(
      requestedIndices,
    ).size !==
      requestedIndices.length
  ) {
    throw new Error(
      "The organized page list contains invalid or duplicate source pages.",
    );
  }

  const kept =
    new Set(
      requestedIndices,
    );

  const deletedIndices =
    Array.from(
      {
        length:
          originalPageCount,
      },
      (_, index) => index,
    ).filter(
      (index) =>
        !kept.has(index),
    );

  if (
    deletedIndices.length > 0
  ) {
    removePdfPagesInPlace(
      pdf,
      deletedIndices,
    );
  }

  const remainingOriginalIndices =
    Array.from(
      {
        length:
          originalPageCount,
      },
      (_, index) => index,
    ).filter((index) =>
      kept.has(index),
    );

  const order =
    requestedIndices.map(
      (originalIndex) =>
        remainingOriginalIndices.indexOf(
          originalIndex,
        ),
    );

  reorderPdfPagesInPlace(
    pdf,
    order,
  );

  entries.forEach(
    (entry, index) => {
      const delta =
        entry.rotationDelta ??
        0;

      if (
        !Number.isFinite(delta) ||
        delta % 90 !== 0
      ) {
        throw new Error(
          "Page rotations must use 90-degree steps.",
        );
      }

      if (delta === 0) {
        return;
      }

      const page =
        pdf.getPage(index);

      const current =
        page.getRotation()
          .angle;

      page.setRotation(
        degrees(
          ((current + delta) %
            360 +
            360) %
            360,
        ),
      );
    },
  );
}
