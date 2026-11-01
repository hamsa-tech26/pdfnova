import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {recoverNativeFbiNicsGrid,FBI_NICS_HEADERS,FBI_NICS_GROUPS} from "../nativeFbiNicsGrid";
import {analyzePdfV4} from "../../pipeline/analyzePdfV4";
import {inspectTableStructuralEvidence,isScientificReviewOnlyTable} from "../../../converters/pdfToXlsxStructuralEvidence";
import {preparePdfV4XlsxExport} from "../../../converters/pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../../../converters/pdfToXlsxSelection";
import {createPdfXlsxWorkbook} from "../../../converters/pdfToXlsx";

const xs=[47,119,151,182,215,238,271,299,336,379,413,450,493,527,
  564,606,641,678,717,754,796,830,867,910,948];
const groupXs=[336.55,446.74,548.04,661.82,750.65,840.43];
const groupWidths=[26,33,58,21,32,81];
function syntheticPage():PdfPageModel{
  let id=0;
  const word=(text:string,x:number,y:number,width=8):PdfWord=>({
    id:`fbi-test-${id++}`,text,pageNumber:1,
    bounds:{x,y,width,height:5.76},font:{size:6},rotation:0,
    extractionProvenance:{source:"native-pdf"},
  });
  const words=[word("NICS Firearm Background Checks",405,573.58),
    word("November - 2015",466,555.12)];
  FBI_NICS_GROUPS.forEach((text,i)=>words.push(
    word(text,groupXs[i],543.58,groupWidths[i])));
  FBI_NICS_HEADERS.forEach((text,i)=>words.push(
    word(text,xs[i],534.7,i===0?52:8)));
  for(let row=0;row<=55;row++){
    const y=527.02-row*7.2;
    const label=row===0?"Alabama":row===4?"California":
      row===54?"Wyoming":row===55?"Totals":`Region ${row}`;
    words.push(word(label,43,y));
    for(let col=1;col<25;col++){
      if(row<55&&(col===16||col===17))continue;
      words.push(word(String(row+col),xs[col]+4,y));
    }
  }
  return {pageNumber:1,rotation:0,width:1008,height:612,words,
    lines:[],blocks:[],textExtraction:{wordCount:words.length,
      lineCount:58,characterCount:8000,status:"sufficient",qualityScore:1}};
}

describe("source-bounded FBI NICS 25-column table",()=>{
  it("retains all original physical columns and never guesses Rentals text",()=>{
    const page=syntheticPage();
    const recovered=recoverNativeFbiNicsGrid(page);
    expect(recovered).not.toBeNull();
    const table=recovered!.table;
    expect(table.columnCount).toBe(25);
    expect(table.rows).toHaveLength(58);
    expect(recovered!.block.lines).toHaveLength(58);
    expect(table.rows[0].cells.map(c=>c.text)).toEqual([...FBI_NICS_GROUPS]);
    expect(table.rows[1].cells.map(c=>c.text)).toEqual([...FBI_NICS_HEADERS]);
    expect(table.rows.slice(2,-1).every(r=>r.cells.length===23&&
      r.cells.every(c=>c.columnIndex!==16&&c.columnIndex!==17))).toBe(true);
    expect(table.rows.at(-1)?.cells).toHaveLength(25);
    expect(table.extractionProvenance?.nativeWordCount).toBe(1321);
    expect(inspectTableStructuralEvidence(table).missingSourcePositions).toBe(129);
    expect(isScientificReviewOnlyTable(table)).toBe(true);
  });
  it("fails closed on corruption, wrong titles, mixed provenance and shifted columns",()=>{
    const variants:PdfPageModel[]=[];
    const rotated=syntheticPage();rotated.rotation=90;variants.push(rotated);
    const different=syntheticPage();different.words[0].text="Other report";variants.push(different);
    const missing=syntheticPage();missing.words.pop();variants.push(missing);
    const duplicate=syntheticPage();duplicate.words.push({
      ...duplicate.words[30],id:"duplicate-cell"});variants.push(duplicate);
    const ocr=syntheticPage();ocr.words[40].extractionProvenance={
      source:"ocr-tesseract"};variants.push(ocr);
    const shifted=syntheticPage();shifted.words[50].bounds.x+=50;variants.push(shifted);
    const changedHeader=syntheticPage();changedHeader.words[10].text="Invented";
    variants.push(changedHeader);
    for(const page of variants)expect(recoverNativeFbiNicsGrid(page)).toBeNull();
  });
});

const referencePath=process.env.KUKUREKU_FBI_REFERENCE_PATH;
describe.skipIf(!referencePath)("pinned public FBI source and independent XLSX reading",()=>{
  it("recovers 56 actual records, preserves source text and refuses unattended XLSX",async()=>{
    const bytes=await readFile(referencePath!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407");
    Object.defineProperty(globalThis,"window",{value:{},configurable:true});
    const source=await analyzePdfV4(new File([bytes],"background-checks.pdf",
      {type:"application/pdf"}));
    const index=source.tables.findIndex(t=>t.id.startsWith("native-fbi-nics-grid-"));
    expect(index).toBeGreaterThanOrEqual(0);
    const table=source.tables[index];
    expect(table.columnCount).toBe(25);
    expect(table.rows).toHaveLength(58);
    expect(table.rows.reduce((n,row)=>n+row.cells.length,0)).toBe(1321);
    expect(table.extractionProvenance?.nativeWordCount).toBe(1321);
    expect(inspectTableStructuralEvidence(table).missingSourcePositions).toBe(129);
    expect(source.candidateRegionDiagnostics?.some(d=>
      d.blockId===table.id&&d.outcome==="confirmed")).toBe(true);
    expect(table.rows[2].cells.find(c=>c.columnIndex===1)?.text).toBe("18,870");
    expect(table.rows[6].cells.find(c=>c.columnIndex===1)?.text).toBe("98 452");
    expect(table.rows[6].cells.find(c=>c.columnIndex===24)?.text).toBe("180 116");
    expect(table.rows.at(-1)?.cells.find(c=>c.columnIndex===24)?.text).toBe("2,236,457");
    expect(table.rows.slice(2,-1).every(r=>r.cells.every(c=>
      ![16,17].includes(c.columnIndex)))).toBe(true);
    expect(isScientificReviewOnlyTable(table)).toBe(true);
    expect(source.tables).toHaveLength(1);
    expect(()=>preparePdfV4XlsxExport(source)).toThrow();
    expect(()=>preparePdfV4XlsxExport({...source,tables:[table]})).toThrow();
    expect(inspectPdfV4XlsxChoices(source)[index].eligible).toBe(true);
    const selected=prepareSelectedPdfV4XlsxExport(source,index);
    expect(selected.tables[0].rows).toHaveLength(58);
    expect(selected.tables[0].rows[2][16]).toBe("");
    expect(selected.tables[0].rows[2][17]).toBe("");
    expect(selected.tables[0].rows[6][1]).toBe("98 452");
    expect(selected.tables[0].rows[57][16]).toBe("0");
    expect(selected.tables[0].rows[57][17]).toBe("0");
    expect(selected.reviewNotes?.join(" ")).toContain("FBI NICS DENSE GRID SOURCE REVIEW");
    expect(selected.reviewNotes?.filter(note=>note.length>500)).toEqual([]);
    const workbook=await createPdfXlsxWorkbook(selected);
    const checker=[
      "import io,sys",
      "from openpyxl import load_workbook",
      "book=load_workbook(io.BytesIO(sys.stdin.buffer.read()),read_only=False,data_only=False)",
      "s=next(s for s in book if s.title!='Review Notes')",
      "rows=list(s.values)",
      "assert len(rows)==58 and all(len(r)==25 for r in rows)",
      "assert rows[2][0]=='Alabama' and rows[2][1]=='18,870'",
      "assert rows[6][0]=='California' and rows[6][1]=='98 452' and rows[6][24]=='180 116'",
      "assert all(rows[i][16] in (None,'') and rows[i][17] in (None,'') for i in range(2,57))",
      "assert rows[57][0]=='Totals' and rows[57][16]=='0' and rows[57][17]=='0' and rows[57][24]=='2,236,457'",
      // A second PDF parser independently groups actual source words using
      // the published page's painted vertical-grid x boundaries and 56
      // physical y intervals; compare all 1,290 source-bearing body cells.
      "import os,pdfplumber",
      "page=pdfplumber.open(os.environ['KUKUREKU_FBI_REFERENCE_PATH']).pages[0]",
      "source=page.extract_words(x_tolerance=1,y_tolerance=2)",
      "edges=[33,111.2,145.7,180,211,235.2,265,292.4,330.3,368.2,406.2,444.1,482,520,557.9,595.8,633.7,671.7,709.6,747.5,785.5,823.4,861.3,899.3,937.2,975]",
      "verified=0",
      "for r in range(56):",
      "    top=80.4+r*7.2",
      "    cells=[[] for _ in range(25)]",
      "    for w in source:",
      "        if abs(w['top']-top)>0.85 or not (33<=w['x0'] and w['x1']<=975): continue",
      "        x=(w['x0']+w['x1'])/2",
      "        col=next((i for i in range(25) if edges[i]<=x<edges[i+1]),None)",
      "        assert col is not None,w",
      "        cells[col].append(w['text'])",
      "    for c,parts in enumerate(cells):",
      "        expected=' '.join(parts)",
      "        actual=rows[r+2][c] or ''",
      "        assert actual==expected,(r,c,actual,expected)",
      "        if parts: verified+=1",
      "assert verified==1290,verified",
      "assert all(s.cell(i,j).data_type!='f' for i in range(1,59) for j in range(1,26))",
      "notes=' '.join(str(r[0]) for r in book['Review Notes'].values)",
      "assert 'FBI NICS DENSE GRID SOURCE REVIEW' in notes",
      "print('FBI_58_ROWS_25_COLUMNS_1290_SOURCE_CELLS_PASS')",
    ].join("\n");
    expect(execFileSync("python",["-c",checker],{
      input:Buffer.from(workbook),encoding:"utf8"})).toContain(
        "FBI_58_ROWS_25_COLUMNS_1290_SOURCE_CELLS_PASS");
  });
});
