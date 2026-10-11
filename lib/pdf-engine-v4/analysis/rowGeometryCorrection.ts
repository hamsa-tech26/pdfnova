import type { LogicalRowCandidate } from "./adaptiveRowDetector";
import type { ColumnCandidate } from "./stableColumnDetector";

/**
 * Cautious correction for a near-linear horizontal drift down long, numbered
 * tables (e.g. mildly perspective-skewed scans). Uses only observed serial
 * anchors and never changes source word bounds or invents missing cells.
 *
 * If anchors are sparse, irregular, or distorted beyond tolerance, it refuses
 * correction. This is not a general projective deskew or accuracy certificate.
 */
export function estimatePdfV4RowHorizontalDrift(
  rows: readonly LogicalRowCandidate[],
  columns: readonly ColumnCandidate[],
): Map<number, number> {
  const offsets = new Map<number, number>();
  if (rows.length < 7 || columns.length < 3 || rows.length > 2000) return offsets;

  const sortedColumns = [...columns].sort((a, b) => a.x - b.x);
  const gaps = sortedColumns.slice(1).map((col, i) => col.x - sortedColumns[i].x);
  const minGap = Math.min(...gaps);
  if (!Number.isFinite(minGap) || minGap < 20) return offsets;

  const anchors: { index: number; x: number; serial: number }[] = [];
  for (let index = 0; index < rows.length; index++) {
    const words = rows[index].lines.flatMap(line => line.words)
      .filter(word => Number.isFinite(word.bounds.x))
      .sort((a, b) => a.bounds.x - b.bounds.x);
    const first = words[0];
    if (!first) continue;
    const match = /^['‘’"]?(\d{1,3})[.)]?$/.exec(first.text.trim());
    if (!match) continue;
    const x = first.bounds.x;
    if (x >= sortedColumns[0].leftBoundary - minGap * 0.3 &&
        x <= sortedColumns[0].rightBoundary + minGap * 0.3) {
      anchors.push({ index, x, serial: Number(match[1]) });
    }
  }
  if (anchors.length < 6 || anchors.length < rows.length * 0.6) return offsets;
  if (anchors.some((a, i) => i > 0 && a.serial <= anchors[i-1].serial)) return offsets;

  const n = anchors.length;
  const avgIndex = anchors.reduce((sum, a) => sum + a.index, 0) / n;
  const avgX = anchors.reduce((sum, a) => sum + a.x, 0) / n;
  const denom = anchors.reduce((sum, a) => sum + (a.index - avgIndex) ** 2, 0);
  if (denom <= 0) return offsets;
  const slope = anchors.reduce((sum, a) =>
    sum + (a.index - avgIndex) * (a.x - avgX), 0) / denom;
  const range = Math.abs(slope * (anchors[n-1].index - anchors[0].index));
  const residual = Math.sqrt(anchors.reduce((sum, a) =>
    sum + (a.x - (avgX + slope * (a.index - avgIndex))) ** 2, 0) / n);
  // Reject ambiguous jitter and large projective deformation.
  if (range < Math.max(6, minGap * 0.08) ||
      range > minGap * 0.35 ||
      Math.abs(slope) > minGap * 0.08 ||
      residual > Math.min(3, range * 0.18)) return offsets;
  for (let i = anchors[0].index; i <= anchors[n-1].index; i++) {
    offsets.set(rows[i].index, slope * (i - avgIndex));
  }
  return offsets;
}
