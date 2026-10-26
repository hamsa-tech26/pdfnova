import { describe, expect, it } from "vitest";
import type { PdfLine, PdfParagraphBlock, PdfWord } from "../../model/types";
import { findNativeCaptionedShortNumericGrids } from "../nativeCaptionedShortNumericGrid";

const anchors = [48, 115, 181, 247, 316, 385, 454];

function makeLine(index: number, y: number, contents: string[]): PdfLine {
  const words: PdfWord[] = contents.map((content, column) => ({
    id: "word-" + index + "-" + column,
    text: content,
    pageNumber: 1,
    bounds: {
      x: anchors[column],
      y,
      width: Math.max(8, Math.min(52, content.length * 4)),
      height: 10,
    },
    font: { size: 9 },
    rotation: 0,
    extractionProvenance: { source: "native-pdf" },
  }));
  return {
    id: "line-" + index,
    pageNumber: 1,
    words,
    bounds: {
      x: 48,
      y,
      width: Math.max(...words.map(word => word.bounds.x + word.bounds.width)) - 48,
      height: 10,
    },
    text: words.map(word => word.text).join(" "),
  };
}

function makeSource(): PdfParagraphBlock {
  const contents = [
    ["Table 2-1. Vehicle fuel savings"],
    ["Cycle Name", "KI", "Distance"],
    ["Improved Speed", "Decreased Accel"],
    ["Eliminate Stops", "Decreased Idle"],
    ["Savings", "Percent Fuel"],
    ["Data source"],
    ["2012_2", "3.30", "1.3", "5.9%", "9.5%", "29.2%", "17.4%"],
    ["2145_1", "0.68", "11.2", "2.4%", "0.1%", "9.5%", "2.7%"],
    ["4234_1", "0.59", "58.7", "8.5%", "1.3%", "8.5%", "3.3%"],
    ["2032_2", "0.17", "57.8", "21.7%", "0.3%", "2.7%", "1.2%"],
    ["4171_1", "0.07", "173.9", "58.1%", "1.6%", "2.1%", "0.5%"],
  ];
  const ys = [800, 780, 768, 756, 744, 732, 710, 694, 678, 662, 646];
  const lines = contents.map((values, index) => makeLine(index, ys[index], values));
  return {
    id: "source",
    type: "paragraph",
    pageNumber: 1,
    lines,
    text: lines.map(line => line.text).join(" "),
    bounds: { x: 48, y: 646, width: 480, height: 164 },
    confidence: 0.9,
  };
}

describe("source-captioned native short numeric grid guardrails", () => {
  it("isolates the exact header and five numeric rows while preserving each source word", () => {
    const source = makeSource();
    const matches = findNativeCaptionedShortNumericGrids([source]);
    expect(matches).toHaveLength(1);
    expect(matches[0].firstLineIndex).toBe(1);
    expect(matches[0].lastLineIndex).toBe(10);
    expect(matches[0].block.lines).toHaveLength(10);
    const actualWords = matches[0].block.lines.flatMap(line => line.words);
    const expectedWords = source.lines.slice(1).flatMap(line => line.words);
    expect(actualWords).toEqual(expectedWords);
    expect(new Set(actualWords.map(word => word.id)).size).toBe(actualWords.length);
    expect(actualWords.some(word => word.text.startsWith("Table 2-1"))).toBe(false);
  });

  it("requires the caption and at least five separate physical numeric rows", () => {
    const uncaptioned = makeSource();
    uncaptioned.lines[0].text = "Discussion of numerical performance";
    expect(findNativeCaptionedShortNumericGrids([uncaptioned])).toHaveLength(0);
    const tooShort = makeSource();
    tooShort.lines.pop();
    expect(findNativeCaptionedShortNumericGrids([tooShort])).toHaveLength(0);
  });

  it("rejects OCR, missing provenance and broken native column alignment", () => {
    const ocr = makeSource();
    ocr.lines[8].words[4].extractionProvenance = { source: "ocr-tesseract" };
    expect(findNativeCaptionedShortNumericGrids([ocr])).toHaveLength(0);
    const unknown = makeSource();
    delete unknown.lines[8].words[4].extractionProvenance;
    expect(findNativeCaptionedShortNumericGrids([unknown])).toHaveLength(0);
    const drifting = makeSource();
    drifting.lines[8].words[4].bounds.x += 18;
    expect(findNativeCaptionedShortNumericGrids([drifting])).toHaveLength(0);
  });

  it("refuses prose, values in wrong columns and caption-like body text", () => {
    const narrative = makeSource();
    narrative.lines[7].words[5].text = "many words from a paragraph";
    expect(findNativeCaptionedShortNumericGrids([narrative])).toHaveLength(0);
    const crowded = makeSource();
    crowded.lines[9].words[5].bounds.x = crowded.lines[9].words[4].bounds.x + 3;
    expect(findNativeCaptionedShortNumericGrids([crowded])).toHaveLength(0);
    const caption = makeSource();
    caption.lines[0].words[0].extractionProvenance = { source: "ocr-tesseract" };
    expect(findNativeCaptionedShortNumericGrids([caption])).toHaveLength(0);
  });
});
