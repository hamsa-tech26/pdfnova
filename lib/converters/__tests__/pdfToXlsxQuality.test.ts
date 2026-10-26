import { describe, expect, it } from "vitest";
import type { LogicalTable } from "../../pdf-engine-v4/model/logicalTable";
import { preparePdfV4XlsxExport } from "../pdfToXlsxQuality";
import { createPdfXlsxWorkbook } from "../pdfToXlsx";
import JSZip from "jszip";

const c = (columnIndex: number, text: string, x: number, width = 24) => ({
  columnIndex, text, bounds: {x,y:10,width,height:12},
  extractionProvenance: {source:"native-pdf" as const, wordCount:0,
    nativeWordCount:0, ocrWordCount:0, unknownWordCount:0, pageNumbers:[1]},
});
function table(pages: number[], rows?: Array<Array<ReturnType<typeof c>>>): LogicalTable {
  const basic = rows ?? [
    [c(0,"Sl No",50),c(1,"Code",200),c(2,"Amount",350)],
    [c(0,"1",50),c(1,"00071",200),c(2,"125.00",350)],
    [c(0,"2",50),c(2,"0",350)],
  ];
  return {
    id:"table-1",pageNumber:pages[0],columnCount:3,
    confidence:0.94,bounds:{x:20,y:0,width:440,height:160},
    extractionProvenance: {source:"native-pdf",pageNumbers:pages,
      nativeWordCount:7,ocrWordCount:0,unknownWordCount:0,wordCount:7},
    rows:basic.map((cells,i)=>({
      id:"row-"+i,rowIndex:i,confidence:0.91,
      provenance:{pageNumber:pages[Math.min(i,pages.length-1)],
        blockId:"b"+i,originalRowIndex:i},
      cells:cells.map((cell,iCell)=>({
        id:"cell-"+i+"-"+iCell, rowIndex:i, words:[],confidence:0.9,...cell,
      })),
    })),
  };
}
function source(tables: LogicalTable[], pageCount = 1) {
  return {
    document: {pages: Array.from({length:pageCount},()=>({}))},
    nativePageTextExtraction: Array.from({length:pageCount},(_,i)=>({
      pageNumber:i+1,textExtraction:{status:"sufficient"},
    })),
    tables,
  };
}

describe("Release 60 XLSX quality and coverage gates", () => {
  it("preserves blank column positions and reports partially filled source rows", async () => {
    const plan = preparePdfV4XlsxExport(source([table([1])]));
    expect(plan.tables[0].rows).toEqual([
      ["Sl No","Code","Amount"],["1","00071","125.00"],["2","","0"],
    ]);
    expect(plan.reviewNotes?.join(" ")).toContain("1 partially filled row(s)");
    expect(plan.reviewNotes?.join(" ")).toContain("For standard V4 exports, extracted cells remain literal text");
    expect(plan.reviewNotes?.join(" ")).toContain("verified eight-column");
    expect(plan.tables[0].numericColumns).toBeUndefined();

    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    const xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve"></t></is></c>');
    expect(xml).toContain("00071");
    expect(xml).not.toContain("<f>");
  });

  it("R94 freezes only complete native one-tier source heading with typed source words",async()=>{
    const t=table([1]);
    for(const cell of t.rows[0].cells){
      cell.words=[{
        id:"native-head-"+cell.columnIndex,
        text:cell.text,pageNumber:1,bounds:{...cell.bounds},
        font:{size:10},rotation:0,
        extractionProvenance:{source:"native-pdf",wordCount:1,
          nativeWordCount:1,ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]},
      } as (typeof cell.words)[number]];
    }
    const plan=preparePdfV4XlsxExport(source([t]));
    expect(plan.tables[0].freezeSourceHeader).toBe(true);
    expect(plan.tables[0].columnWidths).toEqual([10,10,10]);
    expect(plan.tables[0].rows[1]).toEqual(["1","00071","125.00"]);
    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    const xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('ySplit="1" topLeftCell="A2"');
    expect(xml).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(xml).toContain('<col min="1" max="1" width="10" customWidth="1"/>');
    expect(xml).not.toContain("<autoFilter");
    expect(xml).not.toContain("<mergeCells");
    expect(xml).not.toMatch(/<f(?:\\s|>)/);
    expect(plan.reviewNotes?.join(" ")).toContain("NOT independently verified");

    const missingEvidence=table([1]);
    const unmerged=preparePdfV4XlsxExport(source([missingEvidence]));
    expect(unmerged.tables[0].freezeSourceHeader).toBeUndefined();
    const noFreeze=await JSZip.loadAsync(await createPdfXlsxWorkbook(unmerged));
    expect(await noFreeze.file("xl/worksheets/sheet1.xml")!.async("string"))
      .not.toContain('ySplit="1"');
  });

  it("keeps confirmed multi-page continuation as one worksheet with page provenance", () => {
    const t=table([1,2]);
    const plan=preparePdfV4XlsxExport(source([t],2));
    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].rows).toHaveLength(3);
    expect(plan.reviewNotes?.join(" ")).toContain("Pages 1-2");
    expect(plan.reviewNotes?.join(" ")).toContain("multi-page continuation");
  });

  it("exports disjoint tables separately and identifies pages without exported tables", () => {
    const one=table([1]);const other=table([3]);
    const plan=preparePdfV4XlsxExport(source([one,other],3));
    expect(plan.tables.map(t=>t.name)).toEqual(["Table 1","Table 2"]);
    expect(plan.reviewNotes?.join(" ")).toContain("page(s) 2");
  });

  it("rejects unsafely joined nonconsecutive or reordered page provenance", () => {
    const skipped=table([1,3]);
    expect(()=>preparePdfV4XlsxExport(source([skipped],3))).toThrow("nonconsecutive");
    const backwards=table([2,1]);
    expect(()=>preparePdfV4XlsxExport(source([backwards],2))).toThrow("out-of-order");
    const unproven=table([1,2]);
    delete unproven.rows[1].provenance;
    expect(()=>preparePdfV4XlsxExport(source([unproven],2))).toThrow("lacks row-level provenance");
  });

  it("does not drop duplicated source columns by concatenating cell text", () => {
    const duplicate=table([1]);
    duplicate.rows[1].cells.push({
      ...duplicate.rows[1].cells[1], id:"duplicate",text:"INVADER",
    });
    expect(()=>preparePdfV4XlsxExport(source([duplicate]))).toThrow("duplicated");
  });

  it("refuses overlapping populated cells as ambiguous layout rather than inventing merges", () => {
    const overlapping=table([1]);
    overlapping.rows[1].cells[1].bounds={x:190,y:10,width:175,height:12};
    expect(()=>preparePdfV4XlsxExport(source([overlapping]))).toThrow("Overlapping table cells");
  });

  it("allows only source-word-separated short numeric headers in explicit review", () => {
    const recovered=table([1]);
    const header=recovered.rows[0];
    header.provenance!.blockId="native-captioned-short-numeric-1-source-1";
    header.cells[0].bounds={x:50,y:10,width:190,height:12};
    header.cells[1].bounds={x:200,y:10,width:80,height:12};
    for(const cell of header.cells.slice(0,2)){
      cell.words=[{
        id:"native-header-word-"+cell.columnIndex,text:cell.text,pageNumber:1,
        bounds:{x:cell.bounds.x,y:10,width:20,height:12},
        font:{size:9},rotation:0,
        extractionProvenance:{source:"native-pdf"},
      }];
    }
    expect(()=>preparePdfV4XlsxExport(source([recovered])))
      .toThrow("Only unverified new grid candidates");
    const reviewed=preparePdfV4XlsxExport(source([recovered]),
      {allowSelectedCompactGrid:true});
    expect(reviewed.reviewNotes?.join(" ")).toContain("grouped/multilevel header");
    // The bounding boxes still overlap. If actual source words collide,
    // even explicitly reviewed XLSX export must refuse the data.
    header.cells[1].words[0].bounds.x=50;
    expect(()=>preparePdfV4XlsxExport(source([recovered]),
      {allowSelectedCompactGrid:true})).toThrow("Overlapping table cells");
  });

  it("blocks scanned or mixed source pages and even OCR-labeled cells on sufficient pages", () => {
    const mixed=source([table([1])]);
    mixed.nativePageTextExtraction[0].textExtraction.status="low";
    expect(()=>preparePdfV4XlsxExport(mixed)).toThrow("image-only or low-text");
    const ocr=table([1]);
    ocr.rows[1].cells[1].extractionProvenance={
      source:"ocr-tesseract", wordCount:1,nativeWordCount:0,
      ocrWordCount:1,unknownWordCount:0,pageNumbers:[1],
    };
    expect(()=>preparePdfV4XlsxExport(source([ocr]))).toThrow("OCR or mixed-source");
  });

  it("refuses weak tables and protects the 12 table / 25 page scope", () => {
    const weak=table([1]);weak.confidence=0.4;
    expect(()=>preparePdfV4XlsxExport(source([weak]))).toThrow("uncertain");
    expect(()=>preparePdfV4XlsxExport(source([table([1])],26))).toThrow("1–25");
    expect(()=>preparePdfV4XlsxExport(source(Array.from({length:13},()=>table([1])))))
      .toThrow("maximum of 12");
  });
});
