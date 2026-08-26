import {
  renderPdfPages,
  type RenderedPdfPage,
} from "../../pdf/render";

export type PdfV4PreparedOcrPage = {
  pageNumber: number;
  imageDataUrl: string;
  width: number;
  height: number;
  source:
    | "pdf-render"
    | "ocr-retry-crop";
};

export async function preparePdfV4OcrPages(
  file: File,
  pageNumbers: number[],
): Promise<PdfV4PreparedOcrPage[]> {
  if (pageNumbers.length === 0) {
    return [];
  }

  const uniquePageNumbers = [
    ...new Set(pageNumbers),
  ].sort((a, b) => a - b);

  const renderedPages: RenderedPdfPage[] =
  await renderPdfPages(file, {
    pageNumbers: uniquePageNumbers,
    scale: 3,
quality: 0.95,
format: "png",
  });

  return renderedPages.map(
    (page) => ({
      pageNumber: page.pageNumber,
      imageDataUrl: page.dataUrl,
      width: page.width,
      height: page.height,
      source: "pdf-render",
    }),
  );
}