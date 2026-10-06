export type RenderedPdfPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

export type RenderPdfPagesOptions = {
  scale?: number;
  quality?: number;
  pageNumbers?: number[];
  format?: "jpeg" | "png";
  maxDimension?: number;
};

export function calculatePdfRenderScale({
  pageWidth,
  pageHeight,
  requestedScale,
  maxDimension,
}: {
  pageWidth: number;
  pageHeight: number;
  requestedScale: number;
  maxDimension?: number;
}) {
  const values = [
    pageWidth,
    pageHeight,
    requestedScale,
  ];

  if (
    values.some(
      (value) =>
        !Number.isFinite(value) ||
        value <= 0,
    )
  ) {
    throw new Error(
      "PDF render dimensions and scale must be finite numbers greater than zero.",
    );
  }

  if (
    maxDimension === undefined
  ) {
    return requestedScale;
  }

  if (
    !Number.isFinite(
      maxDimension,
    ) ||
    maxDimension <= 0
  ) {
    throw new Error(
      "PDF render maximum dimension must be a finite number greater than zero.",
    );
  }

  const longestSide =
    Math.max(
      pageWidth,
      pageHeight,
    );

  return Math.min(
    requestedScale,
    maxDimension /
      longestSide,
  );
}

export async function forEachRenderedPdfPage(
  file: File,
  options: RenderPdfPagesOptions,
  onPage: (
    page: RenderedPdfPage,
  ) => void | Promise<void>,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "PDF rendering is only available in the browser.",
    );
  }

  const pdfjsLib = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

  const {
    scale = 1.5,
    quality = 0.9,
    pageNumbers,
    format = "jpeg",
    maxDimension,
  } = options;

  const fileBytes =
    await file.arrayBuffer();

  const loadingTask =
    pdfjsLib.getDocument({
      data: new Uint8Array(
        fileBytes,
      ),
    });

  const pdf =
    await loadingTask.promise;

  try {
    const pagesToRender =
      pageNumbers &&
      pageNumbers.length > 0
        ? pageNumbers
        : Array.from(
            {
              length:
                pdf.numPages,
            },
            (_, index) =>
              index + 1,
          );

    for (
      const pageNumber of
      pagesToRender
    ) {
      if (
        pageNumber < 1 ||
        pageNumber >
          pdf.numPages
      ) {
        continue;
      }

      const page =
        await pdf.getPage(
          pageNumber,
        );

      try {
        const baseViewport =
          page.getViewport({
            scale: 1,
          });

        const effectiveScale =
          calculatePdfRenderScale({
            pageWidth:
              baseViewport.width,
            pageHeight:
              baseViewport.height,
            requestedScale:
              scale,
            maxDimension,
          });

        const viewport =
          page.getViewport({
            scale:
              effectiveScale,
          });

        const canvas =
          document.createElement(
            "canvas",
          );

        const context =
          canvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "Canvas is not supported in this browser.",
          );
        }

        canvas.width =
          Math.ceil(
            viewport.width,
          );

        canvas.height =
          Math.ceil(
            viewport.height,
          );

        try {
          await page.render({
            canvas,
            canvasContext:
              context,
            viewport,
            background:
              format ===
              "jpeg"
                ? "#FFFFFF"
                : undefined,
          }).promise;

          const dataUrl =
            format === "png"
              ? canvas.toDataURL(
                  "image/png",
                )
              : canvas.toDataURL(
                  "image/jpeg",
                  quality,
                );

          await onPage({
            pageNumber,
            dataUrl,
            width:
              canvas.width,
            height:
              canvas.height,
          });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }
}

export async function renderPdfPages(
  file: File,
  options: RenderPdfPagesOptions = {},
): Promise<RenderedPdfPage[]> {
  const renderedPages:
    RenderedPdfPage[] = [];

  await forEachRenderedPdfPage(
    file,
    options,
    (page) => {
      renderedPages.push(
        page,
      );
    },
  );

  return renderedPages;
}
