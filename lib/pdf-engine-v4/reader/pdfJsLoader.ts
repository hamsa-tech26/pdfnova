export type PdfJsModule = typeof import(
  "pdfjs-dist/legacy/build/pdf.mjs"
);

export async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjsLib = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  if (
    !pdfjsLib.GlobalWorkerOptions
      .workerSrc
  ) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
  }

  return pdfjsLib;
}