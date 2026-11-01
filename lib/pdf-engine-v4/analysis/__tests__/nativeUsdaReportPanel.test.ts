import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {recoverNativeUsdaReportPanel,USDA_PANEL_SECTIONS} from "../nativeUsdaReportPanel";
import {analyzePdfV4} from "../../pipeline/analyzePdfV4";
import {inspectTableStructuralEvidence,isScientificReviewOnlyTable} from "../../../converters/pdfToXlsxStructuralEvidence";
import {preparePdfV4XlsxExport} from "../../../converters/pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../../../converters/pdfToXlsxSelection";
import {createPdfXlsxWorkbook} from "../../../converters/pdfToXlsx";

const sectionSizes=[6,2,3,4,1,1,1,2,5,6];
function syntheticPage():PdfPageModel{
  let id=0;
  const word=(text:string,x:number,y:number):PdfWord=>({
    id:`usda-synthetic-word-${id++}`,text,pageNumber:1,
    bounds:{x,y,width:8,height:7},font:{size:8},rotation:0,
    extractionProvenance:{source:"native-pdf"},
  });
  const words=[
    word("National Weekly Ag Energy Round-Up",17,582),
    word("Fri, Feb 24, 2017",313,582),
    word("W/E 02/24/17",185,569),word("Last Week",256,569),
    word("Year Ago",324,569),word("Internet Report Link",450,569),
  ];
  let y=557;
  for(let section=0;section<USDA_PANEL_SECTIONS.length;section++){
    words.push(word(USDA_PANEL_SECTIONS[section],17,y));
    if(section===2)words.push(word("Biomass Report",476,y));
    y-=12;
    for(let data=0;data<sectionSizes[section];data++){
      words.push(word(`Test row ${section}-${data}`,29,y),
        word("1.00",186,y),word("-",211,y),word("1.50",217,y),
        word("2.00",283,y),word("3.00",349,y),word("CME Group",490,y));
      y-=12;
    }
  }
  return {pageNumber:1,rotation:0,width:792,height:612,words,lines:[],blocks:[],
    textExtraction:{wordCount:words.length,lineCount:42,characterCount:1000,
      status:"sufficient",qualityScore:1}};
}
describe("guarded native USDA left-panel geometry",()=>{
  it("keeps four source headers, 10 section headings and 31 three-period records",()=>{
    const p=syntheticPage();
    const recovered=recoverNativeUsdaReportPanel(p);
    expect(recovered).not.toBeNull();
    expect(recovered!.table.rows).toHaveLength(42);
    expect(recovered!.table.columnCount).toBe(5);
    expect(recovered!.table.rows[0].cells.map(c=>[c.columnIndex,c.text])).toEqual([
      [1,"W/E 02/24/17"],[2,"Last Week"],[3,"Year Ago"],[4,"Internet Report Link"]]);
    expect(recovered!.table.rows.filter(row=>row.cells.length<=2)).toHaveLength(10);
    expect(recovered!.table.rows.filter(row=>row.cells.length===5)).toHaveLength(31);
    expect(recovered!.table.extractionProvenance?.nativeWordCount)
      .toBe(p.words.length-2);
    expect(isScientificReviewOnlyTable(recovered!.table)).toBe(true);
  });
  it("refuses missing, duplicate, OCR, modified source or chart-like intrusions",()=>{
    const cases:PdfPageModel[]=[];
    const rotated=syntheticPage();rotated.rotation=90;cases.push(rotated);
    const missing=syntheticPage();missing.words.splice(9,1);cases.push(missing);
    const duplicate=syntheticPage();duplicate.words.push({
      ...duplicate.words[8],id:"duplicate-source"});
    cases.push(duplicate);
    const ocr=syntheticPage();ocr.words[14].extractionProvenance={
      source:"ocr-tesseract"};cases.push(ocr);
    const changed=syntheticPage();changed.words[0].text="Different report";cases.push(changed);
    const chartInPanel=syntheticPage();chartInPanel.words.push({
      ...chartInPanel.words[6],id:"intruding-chart-tick",
      text:"2.60",bounds:{...chartInPanel.words[6].bounds,x:539}});
    cases.push(chartInPanel);
    for(const p of cases)expect(recoverNativeUsdaReportPanel(p)).toBeNull();
    const outside=syntheticPage();outside.words.push({
      ...outside.words[6],id:"chart-word-outside-panel",
      text:"2.60",bounds:{...outside.words[6].bounds,x:565}});
    expect(recoverNativeUsdaReportPanel(outside)).not.toBeNull();
  });
});

const referencePath=process.env.KUKUREKU_USDA_REFERENCE_PATH;
describe.skipIf(!referencePath)("pinned public USDA PDF reviewed workbook (opt-in)",()=>{
  it("isolates 42 real physical lines, withholds unattended export and independently reads XLSX",async()=>{
    const bytes=await readFile(referencePath!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb");
    Object.defineProperty(globalThis,"window",{value:{},configurable:true});
    const source=await analyzePdfV4(new File([bytes],"ag-energy-round-up.pdf",
      {type:"application/pdf"}));
    expect(source.tables).toHaveLength(2);
    expect(source.tables[0].rows).toHaveLength(1);
    expect(source.tables[1].rows).toHaveLength(42);
    const t=source.tables[1];
    expect(t.columnCount).toBe(5);
    expect(t.rows.reduce((n,row)=>n+row.cells.length,0)).toBe(165);
    expect(t.extractionProvenance?.source).toBe("native-pdf");
    expect(t.extractionProvenance?.nativeWordCount).toBe(269);
    expect(t.rows.flatMap(row=>row.cells).every(cell=>
      cell.words.every(w=>w.bounds.x<545&&w.bounds.y>=61&&w.bounds.y<=571)))
      .toBe(true);
    expect(inspectTableStructuralEvidence(t).missingSourcePositions).toBe(45);
    expect(inspectTableStructuralEvidence(t).explicitlyEmptySourceCells).toBe(0);
    expect(isScientificReviewOnlyTable(t)).toBe(true);
    expect(inspectPdfV4XlsxChoices(source).map(c=>c.eligible)).toEqual([false,true]);
    expect(()=>preparePdfV4XlsxExport(source)).toThrow();
    const plan=prepareSelectedPdfV4XlsxExport(source,1);
    expect(plan.tables[0].rows).toHaveLength(42);
    expect(plan.tables[0].rows[0]).toEqual([
      "","W/E 02/24/17","Last Week","Year Ago","Internet Report Link"]);
    expect(plan.tables[0].rows[2]).toEqual([
      "Iowa","1.35 - 1.42","1.38 - 1.43","1.27 - 1.35","Iowa Ethanol"]);
    expect(plan.tables[0].rows.at(-1)).toEqual([
      "NYMEX Heating Oil ($/gal)","1.6567","1.6291","1.0792","CME Group"]);
    expect(plan.reviewNotes?.join(" ")).toContain("SOURCE-BOUNDED USDA PANEL REVIEW");
    const workbook=await createPdfXlsxWorkbook(plan);
    const check=[
      "import io,sys",
      "from openpyxl import load_workbook",
      "w=load_workbook(io.BytesIO(sys.stdin.buffer.read()),read_only=False,data_only=False)",
      "s=[s for s in w if s.title!='Review Notes']",
      "assert len(s)==1,w.sheetnames",
      "rows=list(s[0].values)",
      "assert len(rows)==42 and all(len(r)==5 for r in rows),rows",
      "assert rows[0][0] in (None,'') and rows[0][1:]==('W/E 02/24/17','Last Week','Year Ago','Internet Report Link'),rows[0]",
      "assert rows[2]==('Iowa','1.35 - 1.42','1.38 - 1.43','1.27 - 1.35','Iowa Ethanol'),rows[2]",
      "assert rows[-1]==('NYMEX Heating Oil ($/gal)','1.6567','1.6291','1.0792','CME Group'),rows[-1]",
      "assert sum(1 for row in rows if row[0] in ['Ethanol ($/gal)','Nearby Futures'])==2",
      "assert not any(str(c)=='2.60' for row in rows for c in row), 'chart tick leaked'",
      "assert all(s[0].cell(i,j).data_type!='f' for i in range(1,43) for j in range(1,6))",
      "notes=' '.join(str(r[0]) for r in w['Review Notes'].values)",
      "assert 'SOURCE-BOUNDED USDA PANEL REVIEW' in notes,notes",
      "print('USDA_42_ROWS_5_COLUMNS_OPENPYXL_PASS')",
    ].join("; ");
    expect(execFileSync("python",["-c",check],{input:Buffer.from(workbook),
      encoding:"utf8"})).toContain("USDA_42_ROWS_5_COLUMNS_OPENPYXL_PASS");
  });
});
