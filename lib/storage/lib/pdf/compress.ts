import { PDFDocument } from "pdf-lib";

export type CompressionLevel = "low" | "medium" | "high";

type CompressPdfResult = {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
};

export async function compressPdf(
  file: File,
  level: CompressionLevel,
): Promise<CompressPdfResult> {
  const originalBytes = await file.arrayBuffer();

  const pdf = await PDFDocument.load(originalBytes, {
    updateMetadata: false,
  });

  const useObjectStreams = level !== "low";

  const compressedBytes = await pdf.save({
    useObjectStreams,
    addDefaultPage: false,
    objectsPerTick: level === "high" ? 100 : 50,
  });

  const originalSize = file.size;
  const compressedSize = compressedBytes.byteLength;

  const reductionPercent =
    originalSize > 0
      ? Math.max(
          0,
          Math.round(
            ((originalSize - compressedSize) / originalSize) * 100,
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