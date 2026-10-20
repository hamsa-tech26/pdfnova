import {describe,it,expect} from "vitest";
import JSZip from "jszip";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {preparePdfV4XlsxExport} from "../pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../pdfToXlsxSelection";
import {serializeTableCsv} from "../tableExport";import {createPdfXlsxWorkbook} from "../pdfToXlsx";

function table(page:number,id:string):LogicalTable{
  const values=[["Item","ID","Amount"],["A","00071","19"],["B","00072","21"]];
  return {id,pageNumber:page,columnCount:3,confidence:0.95,
    bounds:{x:20,y:20,width:440,height:70},
    extractionProvenance:{source:"native-pdf",pageNumbers:[page],
      nativeWordCount:9,ocrWordCount:0,unknownWordCount:0,wordCount:9},
    rows:values.map((cells,index)=>({
      id:id+"-row-"+index,rowIndex:index,confidence:0.9,
      provenance:{pageNumber:page,blockId:id,originalRowIndex:index},
      cells:cells.map((text,columnIndex)=>({
        id:id+"-cell-"+index+"-"+columnIndex,rowIndex:index,columnIndex,
        words:[],text,confidence:0.9,
        bounds:{x:50+columnIndex*145,y:70-index*15,width:30,height:11},
        extractionProvenance:{source:"native-pdf",wordCount:1,nativeWordCount:1,
          ocrWordCount:0,unknownWordCount:0,pageNumbers:[page]},
      })),
    })),
  };
}
function source(tables:LogicalTable[],pages=7){
  return {document:{pages:Array.from({length:pages},()=>({}))},
    nativePageTextExtraction:Array.from({length:pages},(_,i)=>({
      pageNumber:i+1,textExtraction:{status:"sufficient"},
    })),tables};
}

describe("Release 81 selective native PDF table export",()=>{
  it("exports a good table while a one-row neighbor stays disabled and the all-table path refuses",async()=>{
    const good=table(4,"good");const invalid=table(5,"bad");
    invalid.rows=invalid.rows.slice(0,1);
    const document=source([invalid,good]);
    expect(()=>preparePdfV4XlsxExport(document)).toThrow("uncertain");
    const choices=inspectPdfV4XlsxChoices(document);
    expect(choices).toHaveLength(2);
    expect(choices[0]).toMatchObject({index:0,pageLabel:"Page 5",rows:1,eligible:false});
    expect(choices[1]).toMatchObject({index:1,pageLabel:"Page 4",rows:3,columns:3,eligible:true});
    const plan=prepareSelectedPdfV4XlsxExport(document,1);
    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].rows).toEqual([["Item","ID","Amount"],["A","00071","19"],["B","00072","21"]]);
    expect(plan.reviewNotes?.join(" ")).toContain("SELECTIVE EXPORT");
    expect(plan.reviewNotes?.join(" ")).toContain("1 other candidate(s)");
    expect(plan.reviewNotes?.join(" ")).toContain("Page 4");
    expect(plan.tables[0].numericColumns).toBeUndefined();
    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    expect(Object.keys(zip.files).filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p))).toHaveLength(2);
    const sheet=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('<dimension ref="A1:C3"/>');
    expect(sheet).toContain("00071");
    expect(sheet).not.toContain("<f>");
    const review=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(review).toContain("SELECTIVE EXPORT");
    expect(review).toContain("UNVERIFIED");
  });
  it("R95 selective CSV preserves columns and escapes formula-like values with the XLSX quality gate",()=>{
    const t=table(1,"csv");
    t.rows[1].cells[2].text="=HYPERLINK(1)";
    const plan=prepareSelectedPdfV4XlsxExport(source([t]),0);
    const output=serializeTableCsv(plan.tables[0].rows);
    expect(output).toContain('"00071"');
    expect(output).toContain('"\'=HYPERLINK(1)"');
    expect(output.split("\r\n").filter(Boolean)).toHaveLength(3);
    expect(output).not.toContain('<f>');
    expect(plan.reviewNotes?.join(" ")).toContain("SELECTIVE EXPORT");
    expect(plan.tables[0].rows[1][2]).toBe("=HYPERLINK(1)");
  });

  it("never marks a weak or duplicated-cell candidate eligible",()=>{
    const weak=table(1,"weak");weak.confidence=0.2;
    const duplicate=table(2,"dup");
    duplicate.rows[1].cells.push({...duplicate.rows[1].cells[1],id:"duplicate"});
    const doc=source([weak,duplicate]);
    expect(inspectPdfV4XlsxChoices(doc).map(c=>c.eligible)).toEqual([false,false]);
    expect(()=>prepareSelectedPdfV4XlsxExport(doc,0)).toThrow("uncertain");
    expect(()=>prepareSelectedPdfV4XlsxExport(doc,1)).toThrow("duplicated");
  });
  it("still blocks scanned source pages and OCR-backed cells",()=>{
    const doc=source([table(3,"native")]);
    doc.nativePageTextExtraction[0].textExtraction.status="low";
    expect(inspectPdfV4XlsxChoices(doc)[0].eligible).toBe(false);
    expect(()=>prepareSelectedPdfV4XlsxExport(doc,0)).toThrow("image-only");
    const t=table(3,"ocr");
    t.rows[1].cells[0].extractionProvenance={
      source:"ocr-tesseract",wordCount:1,nativeWordCount:0,
      ocrWordCount:1,unknownWordCount:0,pageNumbers:[3],
    };
    expect(()=>prepareSelectedPdfV4XlsxExport(source([t]),0)).toThrow("OCR or mixed-source");
  });
  it("refuses invalid indices, missing provenance and nonconsecutive page continuation",()=>{
    const src=source([table(1,"ok")]);
    for(const i of [-1,1,1.2,NaN,Infinity]){
      expect(()=>prepareSelectedPdfV4XlsxExport(src,i)).toThrow("Select a detected table");
    }
    const bad=table(1,"bad");
    bad.rows[0].provenance={pageNumber:1,blockId:"a",originalRowIndex:0};
    bad.rows[1].provenance={pageNumber:3,blockId:"b",originalRowIndex:1};
    bad.rows[2].provenance={pageNumber:3,blockId:"b",originalRowIndex:2};
    expect(()=>prepareSelectedPdfV4XlsxExport(source([bad]),0)).toThrow("nonconsecutive");
  });
  it("supports selection beyond 12 candidates without weakening the all-table cap",()=>{
    const thirteen=source(Array.from({length:13},(_,i)=>table(1,"t"+i)));
    expect(()=>preparePdfV4XlsxExport(thirteen)).toThrow("maximum of 12");
    expect(inspectPdfV4XlsxChoices(thirteen)).toHaveLength(13);
    expect(prepareSelectedPdfV4XlsxExport(thirteen,12).tables).toHaveLength(1);
    expect(()=>inspectPdfV4XlsxChoices(source(Array.from({length:101},(_,i)=>table(1,"t"+i)))))
      .toThrow("limit: 100");
  });
});

describe("R134 compact scientific native-grid export isolation",()=>{
  it("refuses silent all-table export but permits explicitly selected table with warnings",async()=>{
    const t=table(2,"compact");
    for(const row of t.rows)row.provenance!.blockId="native-compact-grid-2-source-2";
    const doc=source([t]);
    expect(()=>preparePdfV4XlsxExport(doc)).toThrow(/choose an individual table/);
    const choices=inspectPdfV4XlsxChoices(doc);
    expect(choices).toHaveLength(1);
    expect(choices[0].eligible).toBe(true);
    const plan=prepareSelectedPdfV4XlsxExport(doc,0);
    expect(plan.reviewNotes?.join(" ")).toContain("HIGH REVIEW PRIORITY");
    expect(plan.reviewNotes?.join(" ")).toContain("EVERY cell");
    expect(plan.tables[0].rows[1][1]).toBe("00071");
    const workbook=await createPdfXlsxWorkbook(plan);
    const zip=await JSZip.loadAsync(workbook);
    expect(await zip.file("xl/worksheets/sheet1.xml")!.async("string")).toContain("00071");
  });
  it("preserves original provenance and OCR/confidence safeguards for compact grids",()=>{
    const t=table(2,"compact");
    for(const row of t.rows)row.provenance!.blockId="native-compact-grid-2-source-2";
    t.confidence=0.4;
    expect(inspectPdfV4XlsxChoices(source([t]))[0].eligible).toBe(false);
    expect(()=>prepareSelectedPdfV4XlsxExport(source([t]),0)).toThrow(/uncertain/);
  });
});

describe("captioned text tables must not silently export a truncated two-row reconstruction",()=>{
  it("rejects an under-recovered captioned region even after manual selection",()=>{
    const t=table(4,"caption");
    for(const row of t.rows)row.provenance!.blockId="native-captioned-text-grid-4-source-3";
    const doc=source([t]);
    expect(inspectPdfV4XlsxChoices(doc)[0].eligible).toBe(false);
    expect(()=>prepareSelectedPdfV4XlsxExport(doc,0)).toThrow(/too few reconstructed physical lines/);
    expect(()=>preparePdfV4XlsxExport(doc)).toThrow(/choose an individual table/);
  });
  it("documents physical-line limitations for a source-complete selected table",()=>{
    const t=table(4,"caption-complete");
    const base=t.rows.map(r=>({...r,cells:r.cells.map(c=>({...c}))}));
    t.rows=Array.from({length:9},(_,i)=>({
      ...base[i%base.length],id:"row-"+i,rowIndex:i,
      provenance:{pageNumber:4,blockId:"native-captioned-text-grid-4-source-3",originalRowIndex:i},
      cells:base[i%base.length].cells.map(c=>({...c,
        id:"cell-"+i+"-"+c.columnIndex,rowIndex:i,
        bounds:{...c.bounds,y:190-i*13}})),
    }));
    const plan=prepareSelectedPdfV4XlsxExport(source([t]),0);
    expect(plan.tables[0].rows).toHaveLength(9);
    expect(plan.reviewNotes?.join(" ")).toContain("physical text line");
    expect(plan.reviewNotes?.join(" ")).toContain("no row continuation");
    expect(plan.reviewNotes?.join(" ")).toContain("HIGH REVIEW PRIORITY");
  });
});

describe("R134 no regression of established all-table native XLSX exports",()=>{
  it("exports proven existing tables and clearly omits unverified new candidate",()=>{
    const existing=table(2,"established");
    const newGrid=table(4,"review");
    for(const row of newGrid.rows)
      row.provenance!.blockId="native-compact-grid-4-source-8";
    const doc=source([existing,newGrid]);
    const workbook=preparePdfV4XlsxExport(doc);
    expect(workbook.tables).toHaveLength(1);
    expect(workbook.tables[0].rows[1][1]).toBe("00071");
    expect(workbook.reviewNotes?.join(" ")).toContain("newly recovered, unverified");
    expect(workbook.reviewNotes?.join(" ")).toContain("omitted");
    expect(prepareSelectedPdfV4XlsxExport(doc,1).tables).toHaveLength(1);
  });
  it("refuses unattended export when every detected table needs review",()=>{
    const newGrid=table(2,"unverified");
    for(const row of newGrid.rows)
      row.provenance!.blockId="native-compact-grid-2-source-8";
    expect(()=>preparePdfV4XlsxExport(source([newGrid])))
      .toThrow(/choose an individual table/);
  });
});

describe("R145 scientific native caption/header source review isolation",()=>{
  function fixture(){
    const t=table(4,"native-scientific");
    const base=t.rows.map(r=>({...r,cells:r.cells.map(c=>({...c}))}));
    t.rows=Array.from({length:12},(_,i)=>({
      ...base[i%base.length],id:"native-scientific-row-"+i,rowIndex:i,
      provenance:{pageNumber:4,
        blockId:"native-caption-header-grid-4-original-paragraph-3",
        originalRowIndex:i},
      cells:base[i%base.length].cells.map(c=>({...c,
        id:"native-scientific-cell-"+i+"-"+c.columnIndex,rowIndex:i,
        bounds:{...c.bounds,y:190-i*13}})),
    }));
    return t;
  }
  it("will never silently add new scientific source rows to unattended XLSX",()=>{
    const newGrid=fixture();
    expect(()=>preparePdfV4XlsxExport(source([newGrid])))
      .toThrow(/choose an individual table/);
    const old=table(2,"established");
    const plan=preparePdfV4XlsxExport(source([old,newGrid]));
    expect(plan.tables).toHaveLength(1);
    expect(plan.reviewNotes?.join(" ")).toContain("omitted");
    expect(plan.tables[0].rows[1][1]).toBe("00071");
  });
  it("allows only deliberate reviewed selection with physical-row warnings",()=>{
    const t=fixture();
    const plan=prepareSelectedPdfV4XlsxExport(source([t]),0);
    expect(plan.tables[0].rows).toHaveLength(12);
    const notes=plan.reviewNotes?.join(" ")??"";
    expect(notes).toContain("HIGH REVIEW PRIORITY");
    expect(notes).toContain("multi-tier scientific headings");
    expect(notes).toContain("physical text line");
    expect(notes).toContain("footnotes");
    expect(notes).toContain("NOT added as Excel data cells");
    const short=fixture();
    short.rows=short.rows.slice(0,2);
    expect(()=>prepareSelectedPdfV4XlsxExport(source([short]),0))
      .toThrow(/too few reconstructed physical lines/);
  });
});

describe("R147 image paint proximity must not silently certify incomplete native scientific rows",()=>{
  function physicalSource(paints:unknown[]){
    const t=table(4,"raster-adjacent");
    t.bounds={x:60,y:220,width:420,height:140};
    const original=t.rows;
    t.rows=Array.from({length:12},(_,i)=>({
      ...original[i%original.length],id:"r147-row-"+i,rowIndex:i,
      provenance:{pageNumber:4,
        blockId:"native-caption-header-grid-4-original-paragraph-3",
        originalRowIndex:i},
      cells:original[i%original.length].cells.map(c=>({
        ...c,id:"r147-"+i+"-"+c.columnIndex,rowIndex:i,
        bounds:{...c.bounds,y:348-i*10},
      })),
    }));
    const doc=source([t]);
    // Source image-paint metadata is optional and never contains image bytes.
    doc.document.pages[3]={imagePaintRegions:paints};
    return doc;
  }
  it("warns on a wide raster paint directly below the native grid, without OCR or inserted cells",async()=>{
    const doc=physicalSource([{bounds:{x:58,y:100,width:230,height:80}}]);
    expect(()=>preparePdfV4XlsxExport(doc)).toThrow(/choose an individual table/);
    const choices=inspectPdfV4XlsxChoices(doc);
    expect(choices[0].eligible).toBe(true);
    expect(choices[0].reason).toContain("REVIEW ONLY");
    expect(choices[0].reason).toContain("adjacent PDF images");
    const plan=prepareSelectedPdfV4XlsxExport(doc,0);
    const notes=plan.reviewNotes?.join(" ")??"";
    expect(notes).toContain("POSSIBLE RASTER CONTINUATION");
    expect(notes).toContain("page(s) 4");
    expect(notes).toContain("may be unrelated");
    expect(notes).toContain("no image data, OCR cells");
    expect(plan.tables[0].rows).toHaveLength(12);
    expect(plan.tables[0].rows[1][1]).toBe("00071");
    // R149: the warning must survive workbook serialization, rather than
    // only appearing in an ephemeral UI plan.
    const workbook=await createPdfXlsxWorkbook(plan);
    const zip=await JSZip.loadAsync(workbook);
    const reviewSheet=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(reviewSheet).toContain("POSSIBLE RASTER CONTINUATION");
    expect(reviewSheet).toContain("page(s) 4");
    expect(reviewSheet).not.toContain("<f>");
    expect(inspectPdfV4XlsxChoices(source([table(2,"ordinary")]))[0].reason)
      .toContain("Passes automatic export checks.");
  });
  it("does not invent missing raster content from decorative, distant or invalid paints",()=>{
    const examples=[
      {bounds:{x:58,y:20,width:230,height:75}},
      {bounds:{x:58,y:430,width:230,height:75}},
      {bounds:{x:490,y:100,width:120,height:80}},
      {bounds:{x:Number.NaN,y:100,width:230,height:80}},
      {bounds:{x:58,y:100,width:4,height:5}},
      null,
    ];
    const plan=prepareSelectedPdfV4XlsxExport(physicalSource(examples),0);
    expect(plan.reviewNotes?.join(" ")).not.toContain("POSSIBLE RASTER CONTINUATION");
    expect(plan.tables[0].rows).toHaveLength(12);
  });
  it("signals an image-painted region overlapping a native scientific table",()=>{
    const doc=physicalSource([{bounds:{x:95,y:270,width:250,height:80}}]);
    const plan=prepareSelectedPdfV4XlsxExport(doc,0);
    expect(plan.reviewNotes?.join(" ")).toContain("POSSIBLE RASTER CONTINUATION");
  });
});
