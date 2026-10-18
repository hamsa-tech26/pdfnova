import {describe,it,expect} from "vitest";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {buildPdfTablePreview,PREVIEW_MAX_ROWS,PREVIEW_MAX_COLUMNS,PREVIEW_MAX_CHARACTERS}
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
});
