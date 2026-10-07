import {
  PDFDocument,
  type LoadOptions,
  type SaveOptions,
} from "pdf-lib";

export async function loadPdfWithoutMetadataMutation(
  bytes: ArrayBuffer | Uint8Array,
  options: LoadOptions = {},
) {
  return PDFDocument.load(
    bytes,
    {
      ...options,
      updateMetadata: false,
    },
  );
}

export function savePdfWithoutFormAppearanceMutation(
  pdf: PDFDocument,
  options: SaveOptions = {},
) {
  return pdf.save({
    ...options,
    updateFieldAppearances: false,
  });
}
