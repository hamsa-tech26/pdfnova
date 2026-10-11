import type { LogicalRowCandidate } from "./adaptiveRowDetector";
import type { ColumnCandidate } from "./stableColumnDetector";

/**
 * Experimental perspective-row assignment transform. Estimates two independent
 * line trajectories: increasing serial numbers in the first column and one
 * repeated, unambiguous word in the last column. Both MUST be present.
 *
 * Corrects assignment coordinates only. Does NOT dewarp pixels, regenerate
 * missing words, or certify perspective-distorted PDF tables. Intentionally
 * disabled by default pending real-world table-cell validation.
 */
export type PdfV4PerspectiveRowWarp = {
  leftObserved: number;
  leftReference: number;
  scale: number;
};

type Anchor = { row: number; x: number };
type Fit = { meanX: number; predict: (row: number) => number; range: number; rms: number };

function fitAnchors(points: Anchor[], rows: number): Fit | null {
  if (points.length < 6 || points.length < Math.ceil(rows * 0.75)) return null;
  if (points[0].row > 1 || points[points.length - 1].row < rows - 2) return null;
  const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const mr = points.reduce((sum, p) => sum + p.row, 0) / points.length;
  const denom = points.reduce((sum, p) => sum + (p.row - mr) ** 2, 0);
  if (denom <= 0) return null;
  const slope = points.reduce((sum, p) => sum + (p.row - mr) * (p.x - mx), 0) / denom;
  const predict = (row: number) => mx + slope * (row - mr);
  const rms = Math.sqrt(points.reduce((sum, p) =>
    sum + (p.x - predict(p.row)) ** 2, 0) / points.length);
  return { meanX: mx, predict, range: Math.abs(slope * (rows - 1)), rms };
}

function validGeometry(columns: readonly ColumnCandidate[]): {
  ordered: ColumnCandidate[]; gap: number; first: ColumnCandidate; last: ColumnCandidate;
} | null {
  if (columns.length < 3 || columns.length > 20) return null;
  const ordered = [...columns].sort((a, b) => a.x - b.x);
  if (ordered.some(c => !Number.isFinite(c.x) ||
    !Number.isFinite(c.leftBoundary) || !Number.isFinite(c.rightBoundary) ||
    c.confidence < 0.65 || !c.accepted)) return null;
  const gaps = ordered.slice(1).map((c, i) => c.x - ordered[i].x);
  const gap = Math.min(...gaps);
  if (gap < 28 || gaps.some(g => g > gap * 4)) return null;
  return { ordered, gap, first: ordered[0], last: ordered[ordered.length - 1] };
}

/** Returns zero transforms if the evidence does not uniquely justify a warp. */
export function estimatePdfV4PerspectiveRowWarps(
  rows: readonly LogicalRowCandidate[],
  columns: readonly ColumnCandidate[],
): Map<number, PdfV4PerspectiveRowWarp> {
  const rejected = new Map<number, PdfV4PerspectiveRowWarp>();
  if (rows.length < 8 || rows.length > 200 ||
    new Set(rows.map(r => r.index)).size !== rows.length) return rejected;
  const geometry = validGeometry(columns);
  if (!geometry) return rejected;
  const { first, last, gap } = geometry;

  const serialAnchors: Anchor[] = [];
  let previousSerial = -1;
  const tokens = new Map<string, Anchor[]>();
  for (let row = 0; row < rows.length; row++) {
    const words = rows[row].lines.flatMap(line => line.words)
      .filter(w => w.extractionProvenance?.source === "ocr-tesseract" &&
        Number.isFinite(w.bounds.x) && w.bounds.width > 0 && w.text.trim())
      .sort((a, b) => a.bounds.x - b.bounds.x);
    const firstWord = words[0];
    const serial = firstWord && /^['‘’"]?(\d{1,3})[.)]?$/.exec(firstWord.text.trim());
    if (serial) {
      const n = Number(serial[1]);
      if (n <= previousSerial ||
        firstWord.bounds.x < first.leftBoundary - gap * 0.18 ||
        firstWord.bounds.x > first.rightBoundary + gap * 0.18) return rejected;
      previousSerial = n;
      serialAnchors.push({ row, x: firstWord.bounds.x });
    }
    const perRow = new Map<string, number[]>();
    for (const word of words) {
      const name = word.text.trim().toLowerCase();
      if (!/^[a-z][a-z0-9/-]{3,23}$/.test(name) ||
        word.bounds.x < last.leftBoundary - gap * 0.18 ||
        word.bounds.x > last.rightBoundary + gap * 0.18) continue;
      const values = perRow.get(name) ?? [];
      values.push(word.bounds.x);
      perRow.set(name, values);
    }
    for (const [name, values] of perRow) {
      // A token appearing twice in one row cannot identify a single column.
      if (values.length !== 1) continue;
      const points = tokens.get(name) ?? [];
      points.push({ row, x: values[0] });
      tokens.set(name, points);
    }
  }

  const eligible = [...tokens.entries()]
    .filter(([, points]) => points.length >= Math.max(6, Math.ceil(rows.length * 0.75)))
    .sort((a, b) => b[1].length - a[1].length);
  // Two equally plausible recurring right anchors are ambiguous.
  if (eligible.length !== 1) return rejected;
  const leftFit = fitAnchors(serialAnchors, rows.length);
  const rightFit = fitAnchors(eligible[0][1], rows.length);
  if (!leftFit || !rightFit || leftFit.meanX + gap * 1.8 >= rightFit.meanX ||
    leftFit.rms > Math.max(2.5, gap * 0.035) ||
    rightFit.rms > Math.max(2.5, gap * 0.035) ||
    leftFit.range > gap * 0.4 || rightFit.range > gap * 0.75) return rejected;

  const referenceSpan = rightFit.meanX - leftFit.meanX;
  const topSpan = rightFit.predict(0) - leftFit.predict(0);
  const bottomSpan = rightFit.predict(rows.length - 1) - leftFit.predict(rows.length - 1);
  const deformation = Math.abs(bottomSpan - topSpan);
  // A pure translation is handled by the separate drift experiment.
  if (deformation < gap * 0.12 || deformation > gap * 0.72) return rejected;

  const result = new Map<number, PdfV4PerspectiveRowWarp>();
  for (let row = 0; row < rows.length; row++) {
    const leftObserved = leftFit.predict(row);
    const rightObserved = rightFit.predict(row);
    const span = rightObserved - leftObserved;
    const scale = referenceSpan / span;
    if (!Number.isFinite(scale) || scale < 0.82 || scale > 1.18 ||
      Math.abs(leftObserved - leftFit.meanX) > gap * 0.22 ||
      Math.abs(rightObserved - rightFit.meanX) > gap * 0.42) return rejected;
    result.set(rows[row].index, { leftObserved, leftReference: leftFit.meanX, scale });
  }
  return result;
}

export function mapPdfV4PerspectiveAssignmentX(
  observedX: number, warp: PdfV4PerspectiveRowWarp,
): number {
  return warp.leftReference + (observedX - warp.leftObserved) * warp.scale;
}
