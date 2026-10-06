import { PDFDocument } from "pdf-lib";
import { forEachRenderedPdfPage } from "@/lib/pdf/render";

export type CompressionLevel = "low" | "medium" | "high";

type CompressPdfResult = {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
};

type VisualCompressionProfile = {
  scale: number;
  quality: number;
};

function getQpdfArgs(
  level: CompressionLevel,
  inputName: string,
  outputName: string,
) {
  const commonArgs = [
    "--object-streams=generate",
    "--recompress-flate",
  ];

  if (level === "low") {
    return [
      ...commonArgs,
      "--compression-level=6",
      "--",
      inputName,
      outputName,
    ];
  }

  if (level === "medium") {
    return [
      ...commonArgs,
      "--compression-level=7",
      "--optimize-images",
      "--",
      inputName,
      outputName,
    ];
  }

  return [
    ...commonArgs,
    "--compression-level=9",
    "--optimize-images",
    "--",
    inputName,
    outputName,
  ];
}

function getVisualCompressionProfile(
  level: CompressionLevel,
): VisualCompressionProfile {
  if (level === "medium") {
    return {
      scale: 1.35,
      quality: 0.78,
    };
  }

  return {
    scale: 1.15,
    quality: 0.65,
  };
}

async function compressWithQpdf(
  inputBytes: Uint8Array,
  level: CompressionLevel,
): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF compression is only available in the browser.",
    );
  }

  const { createQpdfRunner } = await import("qpdf-run");

  const origin = window.location.origin;

  const qpdf = await createQpdfRunner({
    workerUrl: `${origin}/qpdf/worker.js`,
    qpdfJsUrl: `${origin}/qpdf/qpdf.js`,
    wasmUrl: `${origin}/qpdf/qpdf.wasm`,
    timeoutMs: 120000,
  });

  const inputName = "input.pdf";
  const outputName = "compressed.pdf";

  try {
    return await qpdf.runOne({
      input: inputBytes,
      inputName,
      outputName,
      args: getQpdfArgs(
        level,
        inputName,
        outputName,
      ),
    });
  } finally {
    await qpdf.destroy();
  }
}

async function compressWithPdfLib(
  inputBytes: Uint8Array,
  level: CompressionLevel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(inputBytes, {
    updateMetadata: false,
  });

  return pdf.save({
    useObjectStreams: level !== "low",
    addDefaultPage: false,
    objectsPerTick: level === "high" ? 100 : 50,
  });
}

async function isImageOnlyPdf(
  file: File,
): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const pdfjsLib = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(
    await file.arrayBuffer(),
  );

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
  });

  const pdf = await loadingTask.promise;

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);

      const [textContent, annotations] =
        await Promise.all([
          page.getTextContent(),
          page.getAnnotations(),
        ]);

      const extractedText = textContent.items
        .map((item) =>
          "str" in item ? item.str : "",
        )
        .join("")
        .trim();

      if (
        extractedText.length > 20 ||
        annotations.length > 0
      ) {
        page.cleanup();
        return false;
      }

      page.cleanup();
    }

    return true;
  } finally {
    await loadingTask.destroy();
  }
}

async function compressVisualPdf(
  file: File,
  level: CompressionLevel,
): Promise<Uint8Array> {
  const profile =
    getVisualCompressionProfile(level);

  const outputPdf = await PDFDocument.create();

  await forEachRenderedPdfPage(
    file,
    {
      scale: profile.scale,
      quality: profile.quality,
      format: "jpeg",
      maxDimension: 2800,
    },
    async (renderedPage) => {
      const response = await fetch(
        renderedPage.dataUrl,
      );

      const jpegBytes = new Uint8Array(
        await response.arrayBuffer(),
      );

      const image =
        await outputPdf.embedJpg(jpegBytes);

      const pageWidth =
        renderedPage.width / profile.scale;

      const pageHeight =
        renderedPage.height / profile.scale;

      const page = outputPdf.addPage([
        pageWidth,
        pageHeight,
      ]);

      page.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    },
  );

  return outputPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick:
      level === "high" ? 100 : 50,
  });
}

export async function compressPdf(
  file: File,
  level: CompressionLevel,
): Promise<CompressPdfResult> {
  const originalBytes = new Uint8Array(
    await file.arrayBuffer(),
  );

  let candidateBytes: Uint8Array;

  try {
    const shouldUseVisualCompression =
      level !== "low" &&
      (await isImageOnlyPdf(file));

    if (shouldUseVisualCompression) {
      candidateBytes =
        await compressVisualPdf(
          file,
          level,
        );
    } else {
      candidateBytes =
        await compressWithQpdf(
          originalBytes,
          level,
        );
    }
  } catch (compressionError) {
    console.warn(
      "Primary PDF compression failed. Falling back to pdf-lib.",
      compressionError,
    );

    candidateBytes =
      await compressWithPdfLib(
        originalBytes,
        level,
      );
  }

  const compressedBytes =
    candidateBytes.byteLength <
    originalBytes.byteLength
      ? candidateBytes
      : originalBytes;

  const originalSize =
    originalBytes.byteLength;

  const compressedSize =
    compressedBytes.byteLength;

  const reductionPercent =
    originalSize > 0
      ? Math.max(
          0,
          Math.round(
            ((originalSize -
              compressedSize) /
              originalSize) *
              100,
          ),
        )
      : 0;

  return {
    bytes: compressedBytes,
    originalSize,
    compressedSize,
    reductionPercent,
  };
}