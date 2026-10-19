import {describe,it,expect} from "vitest";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {buildPdfTablePreview,inspectPdfTableCell,parsePdfTableCellAddress,
  pdfTableCellAddress,PREVIEW_MAX_ROWS,PREVIEW_MAX_COLUMNS,PREVIEW_MAX_CHARACTERS}
  from "../pdfToXlsxPreview";
import {prepareSelectedPdfV4XlsxExport} from "../pdfToXlsxSelection";

const makeTable=(count:number,width:number):LogicalTable=>({
  id:"native",pageNumber:3,columnCount:width,confidence:0.96,
  bounds:{x:30,y:20,width:450,height:400},
  extractionProvenance:{source:"native-pdf",pageNumbers:[3],wordCount:200,
    nativeWordCount:200,ocrWordCount:0,unknownWordCount:0},
  rows:Array.from({length:count},(_,r)=>({
    id:"row-"+r,rowIndex:r,confidence:0.95,
    provenance:{pageNumber:3,blockId:"native-block",originalRowIndex:r},
    cells:Array.from({length:width},(_,c)=>({
      id:"cell-"+r+"-"+c,rowIndex:r,columnIndex:c,
      text:r===1&&c===1?"=HYPERLINK(1)":
        r===2&&c===2?"00071":
        r===0&&c===0?"X".repeat(PREVIEW_MAX_CHARACTERS+20):
        "R"+r+"C"+c,
      words:[],confidence:0.94,
      bounds:{x:35+c*30,y:500-r*15,width:23,height:10},
      extractionProvenance:{source:"native-pdf",pageNumbers:[3],wordCount:1,
        nativeWordCount:1,ocrWordCount:0,unknownWordCount:0},
    })),
  })),
});
const source=(table:LogicalTable)=>({
  document:{pages:[{},{},{},{}]},
  nativePageTextExtraction:Array.from({length:4},(_,i)=>({
    pageNumber:i+1,textExtraction:{status:"sufficient"},
  })),
  tables:[table],
});
describe("Release 82 bounded exact-XLSX source table preview",()=>{
  it("renders only first 12x8 cells and never truncates actual workbook values",()=>{
    const doc=source(makeTable(23,11));
    const preview=buildPdfTablePreview(doc,0);
    expect(preview).toMatchObject({sourcePages:[3],totalRows:23,totalColumns:11,
      visibleRows:PREVIEW_MAX_ROWS,visibleColumns:PREVIEW_MAX_COLUMNS});
    expect(preview.rows).toHaveLength(12);
    expect(preview.rows[0]).toHaveLength(8);
    expect(preview.trimmedCells).toBe(1);
    expect(preview.rows[0][0]).toHaveLength(PREVIEW_MAX_CHARACTERS+1);
    const workbook=prepareSelectedPdfV4XlsxExport(doc,0);
    expect(workbook.tables[0].rows[0][0]).toHaveLength(PREVIEW_MAX_CHARACTERS+20);
    expect(workbook.tables[0].rows[12]).toHaveLength(11);
    expect(preview.rows[1][1]).toBe("=HYPERLINK(1)");
    expect(preview.rows[2][2]).toBe("00071");
  });
  it("follows export-plan cell text without changing source data or numeric strings",()=>{
    const table=makeTable(3,3),doc=source(table);
    table.rows[0].cells[0].text="Short header";
    table.rows[1].cells[2].text="";
    const old=JSON.stringify(table);
    const preview=buildPdfTablePreview(doc,0);
    const exported=prepareSelectedPdfV4XlsxExport(doc,0);
    expect(preview.rows).toEqual(exported.tables[0].rows);
    expect(preview.rows[1][2]).toBe("");
    expect(JSON.stringify(table)).toBe(old);
  });
  it("R97 pages through all 23 rows without changing actual XLSX or CSV values",()=>{
    const t=makeTable(23,11),doc=source(t),old=JSON.stringify(t);
    const page2=buildPdfTablePreview(doc,0,{rowStart:12});
    expect(page2).toMatchObject({rowStart:12,rowEnd:23,columnStart:0,
      columnEnd:8,visibleRows:11,visibleColumns:8});
    expect(page2.rows[0][0]).toBe("R12C0");
    expect(page2.rows[10][7]).toBe("R22C7");
    expect(page2.visibleRowPages).toEqual(Array(11).fill(3));
    expect(JSON.stringify(t)).toBe(old);
    expect(prepareSelectedPdfV4XlsxExport(doc,0).tables[0].rows[22][10]).toBe("R22C10");
  });
  it("R98 slides across late columns with stable absolute cell addresses",()=>{
    const doc=source(makeTable(23,11));
    const slice=buildPdfTablePreview(doc,0,{rowStart:12,columnStart:8});
    expect(slice).toMatchObject({rowStart:12,rowEnd:23,columnStart:8,
      columnEnd:11,visibleRows:11,visibleColumns:3,pairedHeaderLayout:false});
    expect(slice.rows[0]).toEqual(["R12C8","R12C9","R12C10"]);
    expect(pdfTableCellAddress(12,9)).toBe("J13");
    expect(pdfTableCellAddress(1999,127)).toBe("DX2000");
    expect(()=>pdfTableCellAddress(2000,0)).toThrow(/Invalid/);
  });
  it("R99 rejects fake, out-of-bounds and malformed Excel cell addresses",()=>{
    expect(parsePdfTableCellAddress("j13",23,11)).toEqual({rowIndex:12,columnIndex:9});
    expect(parsePdfTableCellAddress("K23",23,11)).toEqual({rowIndex:22,columnIndex:10});
    for(const input of ["J0","K24","L13","Z1","A01","A-1","A1:B2",
      "=HYPERLINK(1)","A 1","A1 ","AAA9999"]){
      // Trailing whitespace is benign, not a range or injected coordinate.
      if(input==="A1 ")expect(parsePdfTableCellAddress(input,23,11))
        .toEqual({rowIndex:0,columnIndex:0});
      else expect(parsePdfTableCellAddress(input,23,11)).toBeNull();
    }
    expect(parsePdfTableCellAddress("A1",2001,1)).toBeNull();
  });
  it("R100 exact-cell inspection preserves long text, formulas and source page attribution",()=>{
    const t=makeTable(23,11);
    t.rows.slice(12).forEach(r=>{
      if(r.provenance)r.provenance.pageNumber=4;
    });
    const doc=source(t);
    const initial=buildPdfTablePreview(doc,0);
    expect(initial.sourcePages).toEqual([3,4]);
    expect(initial.rows[0][0]).toHaveLength(PREVIEW_MAX_CHARACTERS+1);
    const exact=inspectPdfTableCell(doc,0,0,0);
    expect(exact).toEqual({address:"A1",value:"X".repeat(PREVIEW_MAX_CHARACTERS+20),
      sourcePage:3});
    expect(inspectPdfTableCell(doc,0,1,1)).toEqual({
      address:"B2",value:"=HYPERLINK(1)",sourcePage:3,
    });
    expect(inspectPdfTableCell(doc,0,12,9)).toEqual({
      address:"J13",value:"R12C9",sourcePage:4,
    });
    expect(buildPdfTablePreview(doc,0,{rowStart:12,columnStart:8})
      .visibleRowPages).toEqual(Array(11).fill(4));
    expect(()=>inspectPdfTableCell(doc,0,23,0)).toThrow(/outside/);
    expect(()=>inspectPdfTableCell(doc,0,0,11)).toThrow(/outside/);
  });
  it("R101 navigational requests retain all fail-closed source checks",()=>{
    const doc=source(makeTable(23,11));
    for(const window of [{rowStart:-1},{rowStart:23},{columnStart:11},
      {columnStart:-1},{rowStart:1.5},{columnStart:Infinity},
      {columnStart:NaN}]){
      expect(()=>buildPdfTablePreview(doc,0,window)).toThrow(/offset/);
    }
    const weak=makeTable(23,11);
    weak.confidence=0.2;
    expect(()=>buildPdfTablePreview(source(weak),0,{rowStart:12,columnStart:8}))
      .toThrow(/uncertain/);
    expect(()=>inspectPdfTableCell(source(weak),0,12,9)).toThrow(/uncertain/);
  });
  it("never previews rejected duplicate or OCR-source candidates",()=>{
    const weak=makeTable(3,3);
    weak.rows[1].cells.push({...weak.rows[1].cells[1],id:"clash"});
    expect(()=>buildPdfTablePreview(source(weak),0)).toThrow("duplicated");
    const ocr=makeTable(3,3);
    ocr.rows[1].cells[1].extractionProvenance={
      source:"ocr-tesseract",pageNumbers:[3],wordCount:1,
      nativeWordCount:0,ocrWordCount:1,unknownWordCount:0,
    };
    expect(()=>buildPdfTablePreview(source(ocr),0)).toThrow("OCR or mixed-source");
  });
  it("R110 clips preview on whole Unicode characters without corrupting exact XLSX",()=>{
    const t=makeTable(3,3),doc=source(t);
    const full="X".repeat(PREVIEW_MAX_CHARACTERS-1)+"😀"+"TAIL";
    t.rows[0].cells[0].text=full;
    const preview=buildPdfTablePreview(doc,0);
    expect(preview.trimmedCells).toBe(1);
    expect(preview.rows[0][0]).toBe("X".repeat(PREVIEW_MAX_CHARACTERS-1)+"😀…");
    expect(preview.rows[0][0]).not.toContain("\uFFFD");
    expect(inspectPdfTableCell(doc,0,0,0).value).toBe(full);
    expect(prepareSelectedPdfV4XlsxExport(doc,0).tables[0].rows[0][0]).toBe(full);
  });

  it("R111 refuses scanned and mixed-page XLSX preview, cell inspection and download consistently",()=>{
    const scanned=source(makeTable(3,3));
    scanned.nativePageTextExtraction[2].textExtraction.status="none";
    expect(()=>buildPdfTablePreview(scanned,0)).toThrow(/Scanned and mixed PDFs/);
    expect(()=>inspectPdfTableCell(scanned,0,0,0)).toThrow(/Scanned and mixed PDFs/);
    expect(()=>prepareSelectedPdfV4XlsxExport(scanned,0)).toThrow(/Scanned and mixed PDFs/);
    const low=source(makeTable(3,3));
    low.nativePageTextExtraction[2].textExtraction.status="low";
    expect(()=>buildPdfTablePreview(low,0)).toThrow(/Scanned and mixed PDFs/);
    expect(()=>prepareSelectedPdfV4XlsxExport(low,0)).toThrow(/Scanned and mixed PDFs/);
    const mixedCell=source(makeTable(3,3));
    mixedCell.tables[0].rows[1].cells[1].extractionProvenance={
      source:"ocr-tesseract",pageNumbers:[3],wordCount:1,
      nativeWordCount:0,ocrWordCount:1,unknownWordCount:0,
    };
    expect(()=>buildPdfTablePreview(mixedCell,0)).toThrow(/OCR or mixed-source/);
    expect(()=>prepareSelectedPdfV4XlsxExport(mixedCell,0)).toThrow(/OCR or mixed-source/);
  });

});
