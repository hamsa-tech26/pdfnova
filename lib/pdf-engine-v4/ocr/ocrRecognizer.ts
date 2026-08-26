import {
  createWorker,
} from "tesseract.js";

import type {
  PdfV4PreparedOcrPage,
} from "./ocrPageRenderer";

export type PdfV4OcrRectangle = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfV4OcrWord = {
  text: string;
  confidence: number;
  bounds: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  coordinateSpace:
    "rendered-image-pixels";
  source: "ocr-tesseract";
};

export type PdfV4OcrPageResult = {
  pageNumber: number;
 text: string;
 confidence: number;
 renderedWidth: number;
 renderedHeight: number;
 words: PdfV4OcrWord[];
  language: "eng";
  source: "ocr-tesseract";
};

export type PdfV4OcrRegionResult = {
  pageNumber: number;
  rectangle: PdfV4OcrRectangle;
  text: string;
  confidence: number;
  renderedWidth: number;
  renderedHeight: number;
  words: PdfV4OcrWord[];

  debugImageDataUrl?: string;

  language: "eng";
  source: "ocr-tesseract";
};

export type PdfV4OcrRegionRequest = {
  page: PdfV4PreparedOcrPage;
  rectangle: PdfV4OcrRectangle;
};

function extractPdfV4OcrWords(
  blocks:
    | NonNullable<
        Awaited<
          ReturnType<
            Awaited<
              ReturnType<
                typeof createWorker
              >
            >["recognize"]
          >
        >["data"]["blocks"]
      >
    | null,
): PdfV4OcrWord[] {
  return (
    blocks?.flatMap(
      (block) =>
        block.paragraphs.flatMap(
          (paragraph) =>
            paragraph.lines.flatMap(
              (line) =>
                line.words.map(
                  (word) => ({
                    text: word.text,
                    confidence:
                      word.confidence,
                    bounds: {
                      x0: word.bbox.x0,
                      y0: word.bbox.y0,
                      x1: word.bbox.x1,
                      y1: word.bbox.y1,
                    },
                    coordinateSpace:
                      "rendered-image-pixels" as const,
                    source:
                      "ocr-tesseract" as const,
                  }),
                ),
            ),
        ),
    ) ?? []
  );
}

export async function recognizePdfV4OcrPages(
  pages: PdfV4PreparedOcrPage[],
): Promise<PdfV4OcrPageResult[]> {
  if (pages.length === 0) {
    return [];
  }

  const worker =
    await createWorker("eng"); 

  try {
    const results:
      PdfV4OcrPageResult[] = [];

    for (const page of pages) {
      const recognition =
  await worker.recognize(
    page.imageDataUrl,
    {},
    {
      text: true,
      blocks: true,
    },
  );
const words =
  extractPdfV4OcrWords(
    recognition.data.blocks,
  );

      results.push({
        pageNumber: page.pageNumber,
        text:
          recognition.data.text.trim(),
        confidence:
  recognition.data.confidence,
renderedWidth: page.width,
renderedHeight: page.height,
words,
language: "eng",
        source: "ocr-tesseract",
      });
    }

    return results;
  } finally {
    await worker.terminate();
  }
}
export async function recognizePdfV4OcrRegions(
  requests: PdfV4OcrRegionRequest[],
): Promise<PdfV4OcrRegionResult[]> {
  if (requests.length === 0) {
    return [];
  }

  const worker =
    await createWorker("eng");

  try {
    const results:
      PdfV4OcrRegionResult[] = [];

    for (const request of requests) {
      const recognition =
        await worker.recognize(
          request.page.imageDataUrl,
          {
            rectangle:
              request.rectangle,
          },
          {
            text: true,
            blocks: true,
          },
        );

      const words =
        extractPdfV4OcrWords(
          recognition.data.blocks,
        );

      results.push({
        pageNumber:
          request.page.pageNumber,
        rectangle:
          request.rectangle,
        text:
          recognition.data.text.trim(),
        confidence:
          recognition.data.confidence,
        renderedWidth:
          request.page.width,
        renderedHeight:
          request.page.height,
        words,
        language: "eng",
        source: "ocr-tesseract",
      });
    }

    return results;
  } finally {
    await worker.terminate();
  }
}

export async function recognizePdfV4PreparedOcrPages(
  pages: PdfV4PreparedOcrPage[],
): Promise<PdfV4OcrPageResult[]> {
  return recognizePdfV4OcrPages(
    pages,
  );
}