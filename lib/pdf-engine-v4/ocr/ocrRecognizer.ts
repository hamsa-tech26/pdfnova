import {
  createWorker,
  PSM,
} from "tesseract.js";

import {
  forEachRenderedPdfPage,
} from "../../pdf/render";

import {
  estimatePdfV4DeskewRadiansFromBlocks,
} from "./ocrSkewEstimator";

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
  sourceBounds?: {
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
 detectedSkewRadians: number | null;
  alternateRecognition?: { text: string; confidence: number; mode: "sparse-text" };
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

const PDF_V4_OCR_ORIENTATION_LOW_CONFIDENCE =
  60;

const PDF_V4_OCR_ORIENTATION_STRONG_CONFIDENCE =
  90;

const PDF_V4_OCR_ORIENTATION_STRONG_WORD_COUNT =
  20;

const PDF_V4_OCR_ORIENTATION_ROTATIONS = [
  -Math.PI / 2,
  Math.PI / 2,
  Math.PI,
] as const;

export type PdfV4OcrRecognitionOptions = {
  rotateAuto?: boolean;
  allowQuarterTurnFallback?: boolean;
};

type PdfV4OcrWorker =
  Awaited<
    ReturnType<
      typeof createWorker
    >
  >;

async function recognizePdfV4OcrPageWithWorker(
  worker: PdfV4OcrWorker,
  page: PdfV4PreparedOcrPage,
  options:
    PdfV4OcrRecognitionOptions = {},
): Promise<PdfV4OcrPageResult> {
  const rotateAuto =
    options.rotateAuto ?? true;

  const allowQuarterTurnFallback =
    options.allowQuarterTurnFallback ??
    true;

  let recognition =
    await worker.recognize(
      page.imageDataUrl,
      rotateAuto
        ? { rotateAuto: true }
        : {},
      {
        text: true,
        blocks: true,
      },
    );

  let detectedSkewRadians =
    recognition.data.rotateRadians;

  if (
    rotateAuto &&
    recognition.data.confidence >=
      PDF_V4_OCR_ORIENTATION_LOW_CONFIDENCE &&
    recognition.data.confidence <
      PDF_V4_OCR_ORIENTATION_STRONG_CONFIDENCE &&
    (
      detectedSkewRadians === null ||
      Math.abs(
        detectedSkewRadians,
      ) < 0.005
    )
  ) {
    const rawRecognition =
      await worker.recognize(
        page.imageDataUrl,
        {
          rotateAuto: false,
        },
        {
          text: true,
          blocks: true,
        },
      );

    const estimatedDeskewRadians =
      estimatePdfV4DeskewRadiansFromBlocks(
        rawRecognition.data.blocks,
      );

    if (
      estimatedDeskewRadians !== null
    ) {
      detectedSkewRadians =
        estimatedDeskewRadians;
    }
  }

  let words =
    extractPdfV4OcrWords(
      recognition.data.blocks,
    );

  if (
    allowQuarterTurnFallback &&
    recognition.data.confidence <
      PDF_V4_OCR_ORIENTATION_LOW_CONFIDENCE
  ) {
    for (
      const rotateRadians of
        PDF_V4_OCR_ORIENTATION_ROTATIONS
    ) {
      const rotatedRecognition =
        await worker.recognize(
          page.imageDataUrl,
          { rotateRadians },
          {
            text: true,
            blocks: true,
          },
        );

      const rotatedWords =
        extractPdfV4OcrWords(
          rotatedRecognition.data.blocks,
        );

      const acceptableOrientation =
        rotatedRecognition.data.confidence >=
        PDF_V4_OCR_ORIENTATION_LOW_CONFIDENCE;

      const betterOrientation =
        rotatedRecognition.data.confidence >
          recognition.data.confidence ||
        (
          rotatedRecognition.data.confidence ===
            recognition.data.confidence &&
          rotatedWords.length >
            words.length
        );

      if (
        acceptableOrientation &&
        betterOrientation
      ) {
        recognition =
          rotatedRecognition;

        words =
          rotatedWords;

        detectedSkewRadians =
          rotateRadians;
      }

      if (
        recognition.data.confidence >=
          PDF_V4_OCR_ORIENTATION_STRONG_CONFIDENCE &&
        words.length >=
          PDF_V4_OCR_ORIENTATION_STRONG_WORD_COUNT
      ) {
        break;
      }
    }
  }

  // A bounded second OCR segmentation can recover isolated page headings.
  // Never silently replace the primary transcript with an unverified guess.
  let alternateRecognition: PdfV4OcrPageResult["alternateRecognition"];
  if (recognition.data.confidence < 80 && words.length < 3000) {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const sparse = await worker.recognize(page.imageDataUrl, { rotateAuto: false },
        { text: true, blocks: true });
      const sparseWords = extractPdfV4OcrWords(sparse.data.blocks);
      const sparseText = sparse.data.text.trim();
      if (sparseText && sparseText !== recognition.data.text.trim() &&
          Number.isFinite(sparse.data.confidence) &&
          sparse.data.confidence >= Math.max(50, recognition.data.confidence - 8) &&
          sparseWords.length >= Math.max(3, Math.floor(words.length * 0.75))) {
        alternateRecognition = {
          text: sparseText, confidence: sparse.data.confidence, mode: "sparse-text",
        };
      }
    } catch {
      // A failed alternative must not invalidate the successful primary OCR.
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    }
  }

  return {
    pageNumber:
      page.pageNumber,
    alternateRecognition,
    text:
      recognition.data.text.trim(),
    confidence:
      recognition.data.confidence,
    renderedWidth:
      page.width,
    renderedHeight:
      page.height,
    words,
    detectedSkewRadians,
    language: "eng",
    source: "ocr-tesseract",
  };
}

export async function recognizePdfV4OcrPages(
  pages: PdfV4PreparedOcrPage[],
  options:
    PdfV4OcrRecognitionOptions = {},
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
      results.push(
        await recognizePdfV4OcrPageWithWorker(
          worker,
          page,
          options,
        ),
      );
    }

    return results;
  } finally {
    await worker.terminate();
  }
}

export async function recognizePdfV4OcrFilePages(
  file: File,
  pageNumbers: number[],
  options:
    PdfV4OcrRecognitionOptions = {},
  onProgress?: (
    completedPages: number,
    totalPages: number,
  ) => void,
): Promise<PdfV4OcrPageResult[]> {
  const uniquePageNumbers = [
    ...new Set(
      pageNumbers.filter(
        (pageNumber) =>
          Number.isInteger(
            pageNumber,
          ) &&
          pageNumber > 0,
      ),
    ),
  ].sort((a, b) => a - b);

  if (
    uniquePageNumbers.length ===
    0
  ) {
    return [];
  }

  const worker =
    await createWorker("eng");

  try {
    const results:
      PdfV4OcrPageResult[] = [];

    await forEachRenderedPdfPage(
      file,
      {
        pageNumbers:
          uniquePageNumbers,
        scale: 3,
        quality: 0.95,
        format: "png",
        maxDimension: 2800,
      },
      async (renderedPage) => {
        const preparedPage:
          PdfV4PreparedOcrPage = {
            pageNumber:
              renderedPage.pageNumber,
            imageDataUrl:
              renderedPage.dataUrl,
            width:
              renderedPage.width,
            height:
              renderedPage.height,
            source:
              "pdf-render",
          };

        results.push(
          await recognizePdfV4OcrPageWithWorker(
            worker,
            preparedPage,
            options,
          ),
        );

        onProgress?.(
          results.length,
          uniquePageNumbers.length,
        );
      },
    );

    if (
      results.length !==
      uniquePageNumbers.length
    ) {
      throw new Error(
        "One or more PDF pages could not be rendered for OCR.",
      );
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
  if (pages.length === 0) {
    return [];
  }

  const worker =
    await createWorker("eng");

  await worker.setParameters({
    tessedit_pageseg_mode:
      PSM.SINGLE_BLOCK
  });

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
        pageNumber:
          page.pageNumber,
        text:
          recognition.data.text.trim(),
        confidence:
          recognition.data.confidence,
        renderedWidth:
          page.width,
        renderedHeight:
          page.height,
        words,
detectedSkewRadians: null,
language: "eng",
        source: "ocr-tesseract",
      });
    }

    return results;
  } finally {
    await worker.terminate();
  }
}