export type RenderedPdfPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

type RenderPdfPagesOptions = {
  scale?: number;
  quality?: number;
  pageNumbers?: number[];
};

export async function renderPdfPages(
  file: File,
  options: RenderPdfPagesOptions = {},
): Promise<RenderedPdfPage[]> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser.");
  }

  const pdfjsLib = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const {
    scale = 1.5,
    quality = 0.9,
    pageNumbers,
  } = options;

  const fileBytes = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(fileBytes),
  });

  const pdf = await loadingTask.promise;

  try {
    const pagesToRender =
      pageNumbers && pageNumbers.length > 0
        ? pageNumbers
        : Array.from(
            { length: pdf.numPages },
            (_, index) => index + 1,
          );

    const renderedPages: RenderedPdfPage[] = [];

    for (const pageNumber of pagesToRender) {
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        continue;
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Canvas is not supported in this browser.",
        );
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL(
        "image/jpeg",
        quality,
      );

      renderedPages.push({
        pageNumber,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      });

      page.cleanup();

      canvas.width = 0;
      canvas.height = 0;
    }

    return renderedPages;
  } finally {
    await loadingTask.destroy();
  }
}