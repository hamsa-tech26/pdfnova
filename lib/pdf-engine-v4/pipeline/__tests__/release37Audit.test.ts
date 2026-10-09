import { describe, expect, it } from "vitest";
import { createRelease37Audit } from "../release37Audit";
import type { PdfDocumentModel, PdfPageModel } from "../../model/types";
import type { LogicalTable } from "../../model/logicalTable";
import { createPdfV4OcrDecision } from "../../ocr/ocrDecision";

function page(pageNumber: number, status: "none" | "low" | "sufficient"): PdfPageModel {
  const words = status === "none" ? [] : [{
    id: "native-" + pageNumber, text: "Preserved native source text", pageNumber,
    bounds: { x: 10, y: 10, width: 100, height: 12 }, font: { size: 12 }, rotation: 0,
    extractionProvenance: {source:"native-pdf" as const},
  }];
  return {
    pageNumber, width: 600, height: 800, words, lines: [], blocks: [],
    textExtraction: {
      wordCount: words.length, lineCount: words.length,
      characterCount: words.reduce((n,word)=>n+word.text.length,0),
      status, qualityScore: status === "sufficient" ? 1 : 0,
    },
  };
}
function document(pages: PdfPageModel[]): PdfDocumentModel {
  return { metadata: {fileName:"fixture.pdf",pageCount:pages.length},pages,confidence:1 };
}
function audit(native: PdfDocumentModel, processed: PdfDocumentModel, tables: LogicalTable[] = [], actualPages: number[] = []) {
  return createRelease37Audit({
    nativeDocument:native, analyzedDocument:processed,
    decision:createPdfV4OcrDecision(native),
    ocrResult: {
      attempted:actualPages.length>0, decisionStatus:"page-selective",
      processedPageNumbers:actualPages, pages:[],retryRegions:[],reliability:[],
    },
    tables, fileBytes:1024,elapsedMs:100,
  });
}
const check = (report:ReturnType<typeof audit>, id:string) => report.checks.find(c=>c.id===id)!;
describe("Release 37 evidence: never over-certify",()=>{
  it("preserves native word IDs on hybrid pages and scopes OCR to scanned pages",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none"),page(3,"sufficient")]);
    const result=audit(raw,raw,[],[2]);
    expect(check(result,"10.15-native-preservation").state).toBe("PASS_SCOPED");
    expect(check(result,"10.15-selective-ocr").state).toBe("PASS_SCOPED");
    expect(check(result,"10.15-scanned-insets").state).toBe("NOT_VERIFIED");
    expect(result.designation).toBe("DIAGNOSTIC_ONLY_NOT_V4_STABLE");
  });
  it("flags missing native text rather than claiming successful hybrid routing",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none")]);
    const processed=document([page(1,"none"),page(2,"none")]);
    expect(check(audit(raw,processed,[],[2]),"10.15-native-preservation").state).toBe("REVIEW_REQUIRED");
  });
  it("rejects unrequested OCR pages",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none")]);
    expect(check(audit(raw,raw,[],[1,2]),"10.15-selective-ocr").state).toBe("REVIEW_REQUIRED");
  });
  it("marks unprocessed scanned pages as review-required when OCR was attempted",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none"),page(3,"none")]);
    expect(check(audit(raw,raw,[],[2]),"10.15-selective-ocr").state).toBe("REVIEW_REQUIRED");
  });
  it("treats OCR not attempted as not verified, not successful",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none")]);
    expect(check(audit(raw,raw),"10.15-selective-ocr").state).toBe("NOT_VERIFIED");
  });
  it("retains original OCR evidence and reports correction review",()=>{
    const raw=document([page(1,"sufficient")]);
    const cell={id:"c",rowIndex:0,columnIndex:0,text:"8",originalOcrText:"18",
      ocrAdjustmentReasons:["low-confidence-border"],words:[],bounds:{x:0,y:0,width:10,height:10},confidence:0.4};
    const table:LogicalTable={id:"t",pageNumber:1,rows:[{id:"r",rowIndex:0,cells:[cell],confidence:0.5}],
      columnCount:1,bounds:{x:0,y:0,width:10,height:10},confidence:0.5};
    const result=audit(raw,raw,[table]);
    expect(result.correctedCellCount).toBe(1);
    expect(check(result,"10.16-ocr-corrections").state).toBe("REVIEW_REQUIRED");
    expect(check(result,"10.20-stable-freeze").state).toBe("NOT_VERIFIED");
  });
  it("flags duplicated column indices as a complex-table review problem",()=>{
    const raw=document([page(1,"sufficient")]);
    const makeCell=(id:string)=>({id,rowIndex:0,columnIndex:0,text:"data",words:[],bounds:{x:0,y:0,width:10,height:10},confidence:1});
    const table:LogicalTable={id:"t",pageNumber:1,columnCount:2,confidence:1,bounds:{x:0,y:0,width:20,height:20},
      rows:[{id:"r",rowIndex:0,confidence:1,cells:[makeCell("a"),makeCell("b")]}]};
    expect(check(audit(raw,raw,[table]),"10.16-complex-table-structure").state).toBe("REVIEW_REQUIRED");
  });
  it("flags embedded raster paint operations on a native-text page without erasing its text",()=>{
    const raw=document([page(1,"sufficient"),page(2,"none")]);
    raw.pages[0].nativeRasterImagePaintCount=2;
    const result=audit(raw,raw,[],[2]);
    expect(check(result,"10.15-scanned-insets").state).toBe("REVIEW_REQUIRED");
    expect(check(result,"10.15-scanned-insets").detail).toContain("page(s): 1");
    expect(check(result,"10.15-native-preservation").state).toBe("PASS_SCOPED");
  });
  it("does not certify the absence of scanned insets when no image evidence is found",()=>{
    const raw=document([page(1,"sufficient")]);
    raw.pages[0].nativeRasterImagePaintCount=0;
    expect(check(audit(raw,raw),"10.15-scanned-insets").state).toBe("NOT_VERIFIED");
  });

  it("never claims Hindi/Bengali OCR or performance certification from runtime only",()=>{
    const raw=document([page(1,"sufficient")]);
    raw.pages[0].words[0].text="বাংলা हिन्दी";
    const result=audit(raw,raw);
    expect(check(result,"10.18-multilingual-ocr").detail).toContain("Bengali");
    expect(check(result,"10.18-multilingual-ocr").state).toBe("NOT_VERIFIED");
    expect(check(result,"10.19-browser-performance").state).toBe("NOT_VERIFIED");
  });
});
