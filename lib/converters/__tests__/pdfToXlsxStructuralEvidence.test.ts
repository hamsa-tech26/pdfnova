import {describe,it,expect} from "vitest";
import JSZip from "jszip";
import type {LogicalTable,LogicalCell} from "../../pdf-engine-v4/model/logicalTable";
import {classifySourceCell,inspectTableStructuralEvidence,
  isScientificReviewOnlyTable} from "../pdfToXlsxStructuralEvidence";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../pdfToXlsxSelection";
import {preparePdfV4XlsxExport} from "../pdfToXlsxQuality";
import {buildPdfTablePreview,inspectPdfTableCell} from "../pdfToXlsxPreview";
import {createPdfXlsxWorkbook} from "../pdfToXlsx";

function fixture():LogicalTable{
  const make=(text:string,col:number,row:number):LogicalCell=>({
    id:"cell-"+row+"-"+col,rowIndex:row,columnIndex:col,text,words:[],
    confidence:.95,bounds:{x:20+col*80,y:400-row*18,width:30,height:10},
    extractionProvenance:{source:"native-pdf",wordCount:1,
      nativeWordCount:1,ocrWordCount:0,unknownWordCount:0,pageNumbers:[2]},
  });
  return {id:"source-grid",pageNumber:2,columnCount:3,confidence:.95,
    bounds:{x:20,y:330,width:230,height:80},
    rows:[
      {id:"head",rowIndex:0,confidence:.9,
        provenance:{pageNumber:2,blockId:"regular-grid",originalRowIndex:0},
        cells:[make("Name",0,0),make("ID",1,0),make("",2,0)]},
      {id:"first",rowIndex:1,confidence:.9,
        provenance:{pageNumber:2,blockId:"regular-grid",originalRowIndex:1},
        cells:[make("Alpha",0,1),make("00071",2,1)]},
      {id:"second",rowIndex:2,confidence:.9,
        provenance:{pageNumber:2,blockId:"regular-grid",originalRowIndex:2},
        cells:[make("Beta",0,2),make("=SUM(1,1)",1,2),make("21",2,2)]},
    ]};
}
function source(t:LogicalTable){
  return {tables:[t],document:{pages:[{},{},{}]},
    nativePageTextExtraction:[1,2,3].map(pageNumber=>({
      pageNumber,textExtraction:{status:"sufficient"},
    }))};
}
describe("R151 source cell audit and untouched spreadsheet alignment",()=>{
  it("distinguishes an empty extracted cell from no source cell at a position",()=>{
    const t=fixture(),e=inspectTableStructuralEvidence(t);
    expect(e).toMatchObject({rowCount:3,columnCount:3,
      missingSourcePositions:1,explicitlyEmptySourceCells:1,
      firstRowUnverifiedPositions:1,incompleteRows:2});
    expect(classifySourceCell(t.rows[0],2)).toBe("empty-source-cell");
    expect(classifySourceCell(t.rows[1],1)).toBe("no-detected-source-cell");
    expect(classifySourceCell(t.rows[1],2)).toBe("source-text");
    expect(isScientificReviewOnlyTable(t)).toBe(false);
  });
  it("keeps source column B absent and the leading-zero ID in C2, without formula execution",async()=>{
    const src=source(fixture());
    const plan=prepareSelectedPdfV4XlsxExport(src,0);
    expect(plan.tables[0].rows[1]).toEqual(["Alpha","","00071"]);
    expect(plan.reviewNotes?.join(" ")).toContain("SOURCE POSITION AUDIT");
    expect(plan.reviewNotes?.join(" ")).toContain("HEADER REVIEW");
    const preview=buildPdfTablePreview(src,0);
    expect(preview.cellEvidence[0][2]).toBe("empty-source-cell");
    expect(preview.cellEvidence[1][1]).toBe("no-detected-source-cell");
    expect(inspectPdfTableCell(src,0,1,1)).toMatchObject({
      address:"B2",value:"",evidence:"no-detected-source-cell",sourcePage:2});
    expect(inspectPdfTableCell(src,0,1,2)).toMatchObject({
      address:"C2",value:"00071",evidence:"source-text",sourcePage:2});
    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    const sheet=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('<c r="B2" t="inlineStr">');
    expect(sheet).toContain('<c r="C2" t="inlineStr"><is><t xml:space="preserve">00071</t>');
    expect(sheet).toContain("=SUM(1,1)");
    expect(sheet).not.toContain("<f>");
    const notes=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(notes).toContain("SOURCE POSITION AUDIT");
  });
  it("does not promote unverified scientific table or infer absent header labels",()=>{
    const t=fixture();
    t.rows.forEach(r=>r.provenance!.blockId="native-compact-grid-2-original");
    expect(isScientificReviewOnlyTable(t)).toBe(true);
    expect(inspectTableStructuralEvidence(t).firstRowUnverifiedPositions).toBe(1);
    expect(()=>inspectTableStructuralEvidence({...t,columnCount:300})).toThrow("Invalid bounded");
  });
  it("requires review even when only the guarded table ID survives row-provenance changes",()=>{
    const sourceIds=[
      "native-rotated-invoice-grid-2", "native-usda-panel-2",
      "native-fbi-nics-grid-2", "native-nrel-fuel-savings-2",
    ];
    for(const id of sourceIds){
      const t=fixture();
      t.id=id; // Rows deliberately retain their unrelated 'regular-grid' block ID.
      expect(isScientificReviewOnlyTable(t)).toBe(true);
      const document=source(t);
      expect(()=>preparePdfV4XlsxExport(document)).toThrow(/choose an individual table/);
      const choice=inspectPdfV4XlsxChoices(document)[0];
      expect(choice).toMatchObject({eligible:true});
      expect(choice.reason).toContain("REVIEW ONLY");
      const selected=prepareSelectedPdfV4XlsxExport(document,0);
      expect(selected.reviewNotes?.join(" ")).toContain("HIGH REVIEW PRIORITY");
    }
    expect(isScientificReviewOnlyTable(fixture())).toBe(false);
  });
});
