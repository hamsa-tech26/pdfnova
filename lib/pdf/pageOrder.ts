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


function prepareFormForPageRemoval(
  pdf: PDFDocument,
  deletedPageRefs: Set<string>,
) {
  if (!pdf.catalog.AcroForm()) {
    return;
  }

  const form = pdf.getForm();

  for (const field of form.getFields()) {
    const widgets =
      field.acroField.getWidgets();

    if (widgets.length === 0) {
      continue;
    }

    const widgetPageRefs =
      widgets.map((widget) =>
        widget.P()?.toString(),
      );

    if (
      widgetPageRefs.some(
        (pageRef) => !pageRef,
      )
    ) {
      throw new Error(
        `Form field ${field.getName()} has a widget without an explicit page reference. Kukureku will not delete pages because that could leave a broken form field.`,
      );
    }

    const deletedWidgetCount =
      widgetPageRefs.filter(
        (pageRef) =>
          deletedPageRefs.has(
            pageRef as string,
          ),
      ).length;

    if (
      deletedWidgetCount === 0
    ) {
      continue;
    }

    if (
      deletedWidgetCount ===
      widgetPageRefs.length
    ) {
      form.removeField(field);
      continue;
    }

    throw new Error(
      `Form field ${field.getName()} spans both deleted and retained pages. Kukureku will not delete those pages because that could leave a broken form field.`,
    );
  }
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

  prepareFormForPageRemoval(
    pdf,
    deletedPageRefs,
  );

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

  for (const entry of entries) {
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
  }

  const originalPages = [
    ...pdf.getPages(),
  ];

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
    if (hasPdfXfa(pdf)) {
      throw new Error(
        "This PDF contains XFA form data. Page deletion is disabled because changing the page tree could disconnect the XFA structure.",
      );
    }

    const deletedPageRefs =
      new Set(
        deletedIndices.map(
          (index) =>
            originalPages[
              index
            ].ref.toString(),
        ),
      );

    prepareFormForPageRemoval(
      pdf,
      deletedPageRefs,
    );
  }

  for (
    let index =
      originalPageCount - 1;
    index >= 0;
    index -= 1
  ) {
    pdf.removePage(index);
  }

  entries.forEach(
    (entry) => {
      const page =
        originalPages[
          entry.originalPageIndex
        ];

      const delta =
        entry.rotationDelta ??
        0;

      if (delta !== 0) {
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
      }

      pdf.addPage(page);
    },
  );
}

