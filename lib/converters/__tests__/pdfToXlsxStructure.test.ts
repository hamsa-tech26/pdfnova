import { describe, expect, it } from "vitest";
import type { LogicalTable } from "../../pdf-engine-v4/model/logicalTable";
import { preparePdfV4XlsxExport } from "../pdfToXlsxQuality";

/** Fictional geometry-based 3-page regression, never sourced from user data. */
const xs = [40, 70, 120, 220, 335, 465, 590, 710, 810];

function makePage(page: number, offset = 0): LogicalTable {
  const rows = Array.from({ length: 8 }, (_, j) => {
    const serial = (page - 1) * 8 + j + 1;
    const values = [
      String(serial), String(7000 + serial), "Northfield",
      "Unit Delta", "Sector " + (j % 2 ? "B" : "A"),
      "Block " + serial, String(40 + serial), String(30 + serial), "N",
    ];
    const words = values.map((text, k) => ({
      id: "native-" + page + "-" + serial + "-" + k,
      text, pageNumber: page,
      bounds: { x: xs[k] + (k === 6 && j % 2 ? 2 : 0) + offset,
        y: 600 - j * 24, width: Math.min(33, text.length * 4), height: 10 },
      font: { size: 10 }, rotation: 0,
      extractionProvenance: { source: "native-pdf" as const, wordCount:1,
        nativeWordCount:1, ocrWordCount:0, unknownWordCount:0, pageNumbers:[page] },
    }));
    const pieces = [words.slice(0, 4), words.slice(4, 6),
      words.slice(6, 7), words.slice(7, 8), words.slice(8)];
    return {
      id: "row-" + serial, rowIndex: j,
      confidence: 0.96, provenance: { pageNumber: page,
        blockId: "b" + page, originalRowIndex: j },
      cells: pieces.map((chunk, columnIndex) => ({
        id: "cell-" + serial + "-" + columnIndex,
        rowIndex: j, columnIndex,
        text: chunk.map(w => w.text).join(" "),
        words: chunk, bounds: { x: chunk[0].bounds.x, y: words[0].bounds.y,
          width: 110, height: 10 }, confidence: 0.9,
        extractionProvenance: { source: "native-pdf" as const,
          wordCount:chunk.length, nativeWordCount:chunk.length,
          ocrWordCount:0, unknownWordCount:0, pageNumbers:[page] },
      })),
    };
  });
  // The source's first page has a two-line heading, which is not a data
  // record and must not be carried into the reconstructed worksheet as data.
  const headerRows = page === 1 ? [0, 1].map(h => ({
    ...rows[0], id: "source-header-" + h, rowIndex: -2 + h,
    cells: rows[0].cells.map((cell, k) => ({
      ...cell, id: "source-heading-" + h + "-" + k,
      text: "Heading " + (k + 1), words: [],
    })),
  })) : [];
  return {
    id: "table-" + page, pageNumber: page,
    columnCount: 5, rows: [...headerRows, ...rows],
    confidence: 0.92, bounds: { x: 30, y: 140, width: 870, height: 450 },
    extractionProvenance: { source: "native-pdf", pageNumbers: [page],
      wordCount: 72, nativeWordCount: 72, ocrWordCount: 0,
      unknownWordCount: 0 },
  };
}

function nativeSource(tables: LogicalTable[]) {
  return {
    document: { pages: [{}, {}, {}] },
    nativePageTextExtraction: [1,2,3].map(pageNumber => ({
      pageNumber, textExtraction: { status: "sufficient" },
    })),
    tables,
  };
}

describe("Test 3 conservative 8-column multi-page recovery", () => {
  it("recovers eight fields and all 24 records from collapsed five-column native text", () => {
    const plan = preparePdfV4XlsxExport(nativeSource([
      makePage(1), makePage(2), makePage(3),
    ]));
    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].rows).toHaveLength(25);
    expect(plan.tables[0].rows[0]).toHaveLength(8);
    expect(plan.tables[0].rows[1]).toEqual([
      "7001","Northfield","Unit Delta","Sector A","Block 1","41","31","N",
    ]);
    expect(plan.tables[0].rows[24]).toEqual([
      "7024","Northfield","Unit Delta","Sector B","Block 24","64","54","N",
    ]);
    expect(plan.reviewNotes?.join(" ")).toContain("original PDF");
    expect(plan.reviewNotes?.join(" ")).toContain("placeholders");
    expect(plan.reviewNotes?.join(" ")).toContain("1, 2, 3");
  });

  it("withholds a misleading XLSX when native positions are inconsistent", () => {
    const shifted = makePage(2, 35);
    expect(() => preparePdfV4XlsxExport(nativeSource([
      makePage(1), shifted, makePage(3),
    ]))).toThrow(/columns are merged/);
  });

  it("refuses collapsed text when there are no reliable source words", () => {
    const t = makePage(1);
    t.rows.forEach(r => r.cells.forEach(c => { c.words = []; }));
    expect(() => preparePdfV4XlsxExport({
      document: { pages: [{}] },
      nativePageTextExtraction: [{ pageNumber: 1,
        textExtraction: { status: "sufficient" } }],
      tables: [t],
    })).toThrow(/columns are merged/);
  });

  it("rejects incomplete document coverage before attempting recovery", () => {
    expect(() => preparePdfV4XlsxExport(nativeSource([
      makePage(1), makePage(2),
    ]))).toThrow(/columns are merged/);
  });

  it("refuses to omit a non-record row on continuation pages", () => {
    const page2 = makePage(2);
    const extra = { ...page2.rows[0], id: "anomalous-source-row",
      cells: page2.rows[0].cells.map(c => ({ ...c,
        id: c.id + "-extra", text: "UNMAPPED FIELD", words: [] })) };
    page2.rows.push(extra);
    expect(() => preparePdfV4XlsxExport(nativeSource([
      makePage(1), page2, makePage(3),
    ]))).toThrow(/columns are merged/);
  });

  it("refuses sequence gaps rather than silently joining incomplete pages", () => {
    const t3 = makePage(3);
    t3.rows[0].cells[0].text = "999 7020 Northfield Unit Delta";
    t3.rows[0].cells[0].words[0].text = "999";
    expect(() => preparePdfV4XlsxExport(nativeSource([
      makePage(1), makePage(2), t3,
    ]))).toThrow(/columns are merged/);
  });
});
