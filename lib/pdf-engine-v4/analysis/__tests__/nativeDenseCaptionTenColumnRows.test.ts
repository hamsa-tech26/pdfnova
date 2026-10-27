import { describe, expect, it } from "vitest";
import type { PdfLine, PdfParagraphBlock, PdfWord } from "../../model/types";
import type { ColumnCandidate } from "../stableColumnDetector";
import { detectAdaptiveRowsV4 } from "../adaptiveRowDetector";
import { recoverDenseNativeCaptionTenColumnRows } from "../nativeDenseCaptionTenColumnRows";
import { buildSmartTableV4 } from "../smartCellBuilder";
import { isScientificReviewOnlyTable } from "../../../converters/pdfToXlsxStructuralEvidence";

const columns: ColumnCandidate[] = Array.from({ length: 10 }, (_, index) => {
  const x = index ? 220 + (index - 1) * 40 : 40;
  return {
    id: `c${index}`, x, minX: x, maxX: x,
    leftBoundary: index === 0 ? 20 : index === 1 ? 130 : x - 20,
    rightBoundary: index === 0 ? 130 : index === 9 ? 580 : x + 20,
    occurrences: 30, distinctLineCount: 30, averageDeviation: 0,
    stability: 1, confidence: 1, accepted: true, reason: "synthetic test",
  };
});

function word(text: string, x: number, y: number, id: string, source: "native-pdf" | "ocr-tesseract" = "native-pdf"): PdfWord {
  return {
    id, text, pageNumber: 1, bounds: { x, y, width: 9, height: 7 },
    font: { name: "Test", size: 9 }, rotation: 0,
    extractionProvenance: { source, confidence: source === "native-pdf" ? 1 : 90 },
  };
}
function line(index: number, y: number, words: PdfWord[]): PdfLine {
  return {
    id: `line-${index}`, pageNumber: 1, words,
    bounds: { x: Math.min(...words.map(w => w.bounds.x)), y,
      width: Math.max(...words.map(w => w.bounds.x + w.bounds.width)) - Math.min(...words.map(w => w.bounds.x)), height: 7 },
    text: words.map(w => w.text).join(" "),
  };
}
function fixture(): PdfParagraphBlock {
  const lines: PdfLine[] = [];
  for (let i = 0; i < 5; i++) lines.push(line(i, 700 - 10 * i, [word(`Header-${i}`, 40, 700 - 10 * i, `h${i}`)]));
  for (let i = 0; i < 30; i++) {
    const y = 650 - 10 * i;
    if (i === 9) lines.push(line(100, y + 3, [word("1", 170, y + 3, "raised-footnote")]));
    lines.push(line(i + 5, y, [word(`Record-${i}`, 40, y, `label-${i}`),
      ...Array.from({ length: 9 }, (_, j) => word(String(i * 100 + j), 220 + j * 40, y, `value-${i}-${j}`))]));
  }
  return {
    id: "caption-table-1-synthetic", type: "paragraph", pageNumber: 1,
    lines, bounds: { x: 20, y: 350, width: 570, height: 357 },
    text: "synthetic", confidence: 1,
  };
}

describe("Task149 dense native caption row recovery", () => {
  it("keeps 30 separate source numeric records and assigns raised label footnotes left", () => {
    const block = fixture();
    const result = detectAdaptiveRowsV4(block, columns);
    expect(result.rows).toHaveLength(31);
    expect(result.rows[0].reason).toBe("native-dense-caption-ten-header-review");
    const built = buildSmartTableV4(1, result.rows, columns, { sourceBlockId: "native-caption-header-grid-dense-ten-test" });
    expect(built.table?.rows).toHaveLength(31);
    const withPipelineProvenance = {
      ...built.table!,
      rows: built.table!.rows.map(row => ({
        ...row, provenance: { pageNumber: 1, blockId: "native-caption-header-grid-dense-ten-test", originalRowIndex: row.rowIndex },
      })),
    };
    expect(isScientificReviewOnlyTable(withPipelineProvenance)).toBe(true);
    expect(built.table?.rows[10].cells[0].text).toContain("1");
    expect(built.table?.rows[10].cells[1].text).toBe("900");
    expect(built.table?.rows[30].cells[9].text).toBe("2908");
  });

  it("refuses OCR, missing columns, noncaption source and shifted numeric cells", () => {
    const block = fixture();
    expect(recoverDenseNativeCaptionTenColumnRows(block, columns.slice(1))).toBeNull();
    expect(recoverDenseNativeCaptionTenColumnRows({ ...block, id: "paragraph-1" }, columns)).toBeNull();
    const withOcr = fixture();
    withOcr.lines[7].words[2].extractionProvenance!.source = "ocr-tesseract";
    expect(recoverDenseNativeCaptionTenColumnRows(withOcr, columns)).toBeNull();
    const shifted = fixture();
    shifted.lines[12].words[5].bounds.x = 40;
    expect(recoverDenseNativeCaptionTenColumnRows(shifted, columns)).toBeNull();
  });
});
