import type {PdfVisualBlock} from "../model/types";
import type {StableColumnDetectionResult} from "./stableColumnDetector";

/**
 * A narrowly scoped rescue for a six-physical-line native PDF table whose
 * first column is sparse (two data rows) and is rejected by the ordinary
 * three-line stable-column gate. Preserve the normal threshold everywhere
 * else: this requires a confirmed caption table, a dense nine-column body,
 * evidence in four distinct physical rows and a stable rejected left anchor.
 *
 * Structural repair only: this does not attest to exact publisher cell text.
 */
export function recoverSparseLeftNativeCaptionColumn(
  block: PdfVisualBlock,
  detection: StableColumnDetectionResult,
): StableColumnDetectionResult | null {
  if (
    block.type !== "paragraph" ||
    !block.id.startsWith("caption-table-") ||
    block.lines.length !== 6 ||
    detection.columns.length !== 9
  ) return null;

  const lines = block.lines;
  if (lines.some(line => line.words.some(word =>
    word.extractionProvenance?.source === "ocr-tesseract"
  ))) return null;

  if (
    lines[0].words.length < 4 ||
    lines[1].words.length < 6 ||
    lines.slice(2).some(line => line.words.length < 8)
  ) return null;

  const gaps = lines.slice(1).map((line, index) =>
    lines[index].bounds.y - line.bounds.y
  );
  if (gaps.some(gap => gap < 8 || gap > 26)) return null;

  const accepted = [...detection.columns].sort((a,b)=>a.x-b.x);
  if (accepted[accepted.length - 1].x - accepted[0].x < 320) return null;
  const alignedBodyRows = lines.slice(2).filter(line =>
    accepted.filter(column => line.words.some(word =>
      Math.abs(word.bounds.x - column.x) <= 13
    )).length >= 7
  );
  if (alignedBodyRows.length !== 4) return null;

  const firstAcceptedX = accepted[0].x;
  const sparse = detection.rejectedCandidates.filter(candidate => {
    if (
      candidate.reason !==
        "Rejected because too few distinct lines support this position." ||
      candidate.distinctLineCount !== 2 ||
      candidate.stability < 0.95 ||
      candidate.x < firstAcceptedX - 110 ||
      candidate.x > firstAcceptedX - 35
    ) return false;
    const sourceLines = lines.filter(line => line.words.some(word =>
      Math.abs(word.bounds.x - candidate.x) <= 7
    ));
    return sourceLines.length === 2 &&
      sourceLines.every(line => lines.slice(2).includes(line));
  });
  if (sparse.length !== 1) return null;

  const recovered = sparse[0];
  const columns = [
    {...recovered, accepted:true, reason:"Recovered sparse first column from verified six-line native caption grid."},
    ...accepted,
  ].sort((a,b)=>a.x-b.x).map((column,index,ordered)=>({
    ...column,
    id:"column-candidate-"+index,
    leftBoundary:index===0?block.bounds.x:(ordered[index-1].x+column.x)/2,
    rightBoundary:index===ordered.length-1
      ?block.bounds.x+block.bounds.width
      :(column.x+ordered[index+1].x)/2,
  }));

  return {
    ...detection,
    columns,
    rejectedCandidates:detection.rejectedCandidates.filter(x=>x.id!==recovered.id),
  };
}
