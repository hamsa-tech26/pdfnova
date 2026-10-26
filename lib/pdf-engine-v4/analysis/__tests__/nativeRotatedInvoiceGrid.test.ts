import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import JSZip from "jszip";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {recoverNativeRotatedInvoiceGrid,ROTATED_INVOICE_HEADERS} from "../nativeRotatedInvoiceGrid";
import {analyzePdfV4} from "../../pipeline/analyzePdfV4";
import {isScientificReviewOnlyTable,inspectTableStructuralEvidence} from "../../../converters/pdfToXlsxStructuralEvidence";
import {preparePdfV4XlsxExport} from "../../../converters/pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../../../converters/pdfToXlsxSelection";
import {createPdfXlsxWorkbook} from "../../../converters/pdfToXlsx";

const body=[
  ["0085648100305","CENTRAL KMA","LILYS 40% SLTD ALMND CHOC","637","$ 0.61","$ 388.57","0.0000"],
  ["0085648100380","CENTRAL KMA","LILYS DRK CHC CRMLZD SLTD","688","$ 0.61","$ 419.68","0.0000"],
  ["0085648100303","CENTRAL KMA","LILYS ALMND 55% DARK CHOC","560","$ 0.61","$ 341.60","0.0000"],
  ["0085648100300","CENTRAL KMA","LILYS 55% DARK CHOC BAR","415","$ 0.61","$ 253.15","0.0000"],
];
const expected=[ [...ROTATED_INVOICE_HEADERS],
  ...body.map(values=>["",...values,""])];

function samplePage():PdfPageModel{
  let index=0;
  const word=(text:string,x:number,y:number):PdfWord=>({
    id:"source-"+index++,text,pageNumber:1,
    bounds:{x,y,width:8,height:8},
    font:{size:8},rotation:90,
    extractionProvenance:{source:"native-pdf"},
  });
  const headX=43.64;
  const headerYs=[28,78,166,253,445,523,602,694,754];
  const dataYs=[78,166,253,445,523,602,694];
  const words=[
    ...ROTATED_INVOICE_HEADERS.map((value,i)=>word(value,headX,headerYs[i])),
    ...body.flatMap((values,row)=>values.map((value,col)=>
      word(value,59.6+row*15.94,dataYs[col]))),
  ];
  return {pageNumber:1,rotation:90,width:842,height:595,words,lines:[],blocks:[],
    textExtraction:{wordCount:words.length,lineCount:0,characterCount:1000,
      status:"sufficient",qualityScore:1}};
}

describe("guarded native 90-degree invoice recovery",()=>{
  it("preserves exactly 9 header positions and 7 observed cells per physical data row",()=>{
    const recovered=recoverNativeRotatedInvoiceGrid(samplePage());
    expect(recovered).not.toBeNull();
    expect(recovered!.table.columnCount).toBe(9);
    expect(recovered!.table.rows.map(row=>row.cells.map(cell=>cell.columnIndex))).toEqual([
      [0,1,2,3,4,5,6,7,8],
      [1,2,3,4,5,6,7],
      [1,2,3,4,5,6,7],
      [1,2,3,4,5,6,7],
      [1,2,3,4,5,6,7],
    ]);
    expect(recovered!.table.rows.map(row=>row.cells.map(cell=>cell.text))).toEqual([
      [...ROTATED_INVOICE_HEADERS],...body,
    ]);
    expect(recovered!.table.extractionProvenance?.source).toBe("native-pdf");
    expect(recovered!.table.rows.flatMap(row=>row.cells).every(cell=>
      cell.words.every(w=>w.extractionProvenance?.sourceBounds!==undefined))).toBe(true);
    expect(isScientificReviewOnlyTable(recovered!.table)).toBe(true);
  });

  it("refuses rotated, missing, extra, non-native or ambiguous source evidence",()=>{
    const cases:PdfPageModel[]=[];
    const unrotated=samplePage();unrotated.rotation=0;cases.push(unrotated);
    const missing=samplePage();missing.words.pop();cases.push(missing);
    const extra=samplePage();extra.words.push({...extra.words[10],id:"duplicate-word"});
    cases.push(extra);
    const ocr=samplePage();ocr.words[10].extractionProvenance={source:"ocr-tesseract"};
    cases.push(ocr);
    const displaced=samplePage();displaced.words[14].bounds.y+=60;cases.push(displaced);
    const duplicateHeader=samplePage();
    duplicateHeader.words[1].text=duplicateHeader.words[0].text;cases.push(duplicateHeader);
    const invalidMoney=samplePage();invalidMoney.words[14].text="=HYPERLINK(\"bad\")";
    cases.push(invalidMoney);
    for(const page of cases)expect(recoverNativeRotatedInvoiceGrid(page)).toBeNull();
  });
});

const invoicePath=process.env.KUKUREKU_INVOICE_REFERENCE_PATH;
describe.skipIf(!invoicePath)("source-pinned real rotated invoice: guarded end-to-end",()=>{
  it("recovers original 5 x 9 source rows, withholds unattended XLSX and downloads review-selected workbook",async()=>{
    const bytes=await readFile(invoicePath!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "0b5accf5702d12b9a58eba9f4d11295c9e268c8c6333b4cd4ac07e46768b023b");
    Object.defineProperty(globalThis,"window",{value:{},configurable:true});
    const file=new File([bytes],"issue-140-example.pdf",{type:"application/pdf"});
    const analyzed=await analyzePdfV4(file);
    expect(analyzed.document.pages[0].rotation).toBe(90);
    expect(analyzed.tables).toHaveLength(1);
    // A separate unresolved generic candidate must remain visible as
    // incomplete; source-guarded recovery does not erase other diagnostics.
    expect(analyzed.analysisOutcome).toBe("incomplete-analysis");
    expect(analyzed.candidateRegionDiagnostics.some(d=>d.outcome==="pending")).toBe(true);
    expect(analyzed.statistics.confirmedTableRegionCount).toBe(1);
    expect(analyzed.statistics.detectedRowCount).toBe(5);
    expect(analyzed.statistics.detectedColumnCount).toBe(9);
    const table=analyzed.tables[0];
    expect(table.rows.map(row=>row.cells.map(cell=>cell.text))).toEqual([
      [...ROTATED_INVOICE_HEADERS],...body]);
    expect(table.rows.flatMap(row=>row.cells)).toHaveLength(37);
    expect(table.extractionProvenance?.nativeWordCount).toBe(37);
    expect(isScientificReviewOnlyTable(table)).toBe(true);
    const sourcePositions=inspectTableStructuralEvidence(table);
    expect(sourcePositions.missingSourcePositions).toBe(8);
    expect(sourcePositions.explicitlyEmptySourceCells).toBe(0);
    expect(() => preparePdfV4XlsxExport(analyzed)).toThrow(
      "Only unverified new grid candidates were detected");
    const choices=inspectPdfV4XlsxChoices(analyzed);
    expect(choices).toHaveLength(1);
    expect(choices[0].eligible).toBe(true);
    expect(choices[0].reason).toContain("REVIEW ONLY");
    const plan=prepareSelectedPdfV4XlsxExport(analyzed,0);
    expect(plan.tables[0].rows).toEqual(expected);
    expect(plan.reviewNotes?.join(" ")).toContain("ROTATED INVOICE SOURCE REVIEW");
    expect(plan.reviewNotes?.join(" ")).toContain("not independently verified empties");
    const downloaded=await createPdfXlsxWorkbook(plan);
    const zip=await JSZip.loadAsync(downloaded);
    const sheet=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet).toContain('<dimension ref="A1:I5"/>');
    expect(sheet).toContain("0085648100305");
    expect(sheet).toContain("0085648100300");
    expect(sheet).not.toContain("<f>");
    expect(sheet).not.toContain("Associated claims");
    expect(sheet).not.toContain("Supporting documents");
    expect(sheet).not.toContain("Approval history");
    // An independent implementation must read the real workbook cells:
    // neither the workbook writer nor its XML serializer supplies the oracle.
    const python=[
      "import io,sys",
      "from openpyxl import load_workbook",
      "w=load_workbook(io.BytesIO(sys.stdin.buffer.read()),read_only=False,data_only=False)",
      "s=[s for s in w if s.title!='Review Notes']",
      "assert len(s)==1,w.sheetnames",
      "r=list(s[0].values)",
      "assert len(r)==5 and all(len(row)==9 for row in r),r",
      "assert r[0]==('Line no','UPC code','Location','Item Description','Item Quantity','Bill Amount','Accrued Amount','Handling Rate','PO number'),r[0]",
      "assert [row[1] for row in r[1:]]==['0085648100305','0085648100380','0085648100303','0085648100300'],r",
      "assert [row[3] for row in r[1:]]==['LILYS 40% SLTD ALMND CHOC','LILYS DRK CHC CRMLZD SLTD','LILYS ALMND 55% DARK CHOC','LILYS 55% DARK CHOC BAR'],r",
      "assert [row[6] for row in r[1:]]==['$ 388.57','$ 419.68','$ 341.60','$ 253.15'],r",
      "assert all((row[0] is None or row[0]=='') and (row[8] is None or row[8]=='') for row in r[1:]),r",
      "assert all(s[0].cell(i,j).data_type!='f' for i in range(1,6) for j in range(1,10)), 'formula injection'",
      "notes=' '.join(str(row[0]) for row in w['Review Notes'].values)",
      "assert 'ROTATED INVOICE SOURCE REVIEW' in notes,notes",
      "print('TASK137_OPENPYXL_37_SOURCE_CELLS_PASS')",
    ].join("; ");
    expect(execFileSync("python",["-c",python],{
      input:Buffer.from(downloaded),encoding:"utf8",
    })).toContain("TASK137_OPENPYXL_37_SOURCE_CELLS_PASS");
  });
});
