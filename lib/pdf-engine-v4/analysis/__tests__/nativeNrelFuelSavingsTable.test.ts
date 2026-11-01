import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import type {PdfPageModel,PdfWord} from "../../model/types";
import {recoverNativeNrelFuelSavingsTable,NREL_SOURCE_CAPTION,
  NREL_SOURCE_HEADERS,NREL_SOURCE_IDS} from "../nativeNrelFuelSavingsTable";
import {analyzePdfV4} from "../../pipeline/analyzePdfV4";
import {inspectTableStructuralEvidence,isScientificReviewOnlyTable} from "../../../converters/pdfToXlsxStructuralEvidence";
import {preparePdfV4XlsxExport} from "../../../converters/pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport} from "../../../converters/pdfToXlsxSelection";
import {createPdfXlsxWorkbook} from "../../../converters/pdfToXlsx";

function syntheticPage():PdfPageModel{
  let id=0;
  const word=(text:string,x:number,y:number,width=20):PdfWord=>({
    id:`nrel-test-${id++}`,text,pageNumber:1,
    bounds:{x,y,width,height:10.02},font:{size:10},rotation:0,
    extractionProvenance:{source:"native-pdf"},
  });
  const words=[word(NREL_SOURCE_CAPTION,145,242.4,322),
    word("Percent Fuel Savings",323.93,222.651,101.09)];
  const xsTop=[129.23,179.81,210.41,262.92,318.78,380.16,435.42];
  const xsBottom=[128.93,170.09,222.11,270.42,330.72,388.5,452.1];
  const yTop=[216.6588,216.6588,216.6588,208.86,208.86,208.86,208.86];
  const yBottom=[205.1358,205.1358,205.1358,197.4,197.4,197.4,197.4];
  NREL_SOURCE_HEADERS.forEach(([top,bottom],col)=>{
    words.push(word(top,xsTop[col],yTop[col],col===3?45:10));
    words.push(word(bottom,xsBottom[col],yBottom[col],col===1?29:10));
  });
  const bodyXs=[125.88,175.14,221.52,274.02,332.63,391.01,449.27];
  const yRows=[183.72,168.18,152.7,137.22,121.68];
  for(let row=0;row<5;row++)for(let col=0;col<7;col++)words.push(
    word(col===0?NREL_SOURCE_IDS[row]:col===1?"3.30":col===2?"1.3":"9.5%",
      bodyXs[col],yRows[row],col===0?34:20));
  for(let i=0;i<35;i++)words.push(word(`Outside ${i}`,50,500+i*2,20));
  return {pageNumber:1,rotation:0,width:612,height:792,words,
    lines:[],blocks:[],textExtraction:{wordCount:words.length,
      lineCount:50,characterCount:2000,status:"sufficient",qualityScore:1}};
}

describe("guarded NREL Table 2-1 inside prose page",()=>{
  it("keeps the 5×7 source body, two-line header words and no prose",()=>{
    const recovered=recoverNativeNrelFuelSavingsTable(syntheticPage());
    expect(recovered).not.toBeNull();
    const table=recovered!.table;
    expect(table.columnCount).toBe(7);
    expect(table.rows).toHaveLength(7);
    expect(recovered!.block.lines).toHaveLength(10);
    expect(table.rows[0].cells.map(c=>[c.columnIndex,c.text])).toEqual(
      [[3,"Percent Fuel Savings"]]);
    expect(table.rows[1].cells.map(c=>c.text)).toEqual(
      NREL_SOURCE_HEADERS.map(parts=>parts.join(" ")));
    expect(table.rows.slice(2).every(row=>row.cells.length===7)).toBe(true);
    expect(table.extractionProvenance?.nativeWordCount).toBe(50);
    expect(inspectTableStructuralEvidence(table).missingSourcePositions).toBe(6);
    expect(isScientificReviewOnlyTable(table)).toBe(true);
  });
  it("refuses missing cells, caption changes, intruding words and OCR",()=>{
    const variants:PdfPageModel[]=[];
    const rotated=syntheticPage();rotated.rotation=90;variants.push(rotated);
    const renamed=syntheticPage();renamed.words[0].text="Different caption";variants.push(renamed);
    const missing=syntheticPage();missing.words.splice(20,1);variants.push(missing);
    const duplicate=syntheticPage();duplicate.words.push({
      ...duplicate.words[25],id:"duplicate"});variants.push(duplicate);
    const ocr=syntheticPage();ocr.words[30].extractionProvenance={source:"ocr-tesseract"};
    variants.push(ocr);
    const moved=syntheticPage();moved.words[32].bounds.x+=65;variants.push(moved);
    for(const source of variants)
      expect(recoverNativeNrelFuelSavingsTable(source)).toBeNull();
    const prose=syntheticPage();prose.words.push(wordOutside(prose));
    expect(recoverNativeNrelFuelSavingsTable(prose)).toBeNull();
  });
});

function wordOutside(page:PdfPageModel):PdfWord{
  return {...page.words[30],id:"injected-prose",
    text:"The drive-cycle evidence should not be a source cell",
    bounds:{...page.words[30].bounds,x:220,y:150}};
}

const referencePath=process.env.KUKUREKU_NREL_REFERENCE_PATH;
describe.skipIf(!referencePath)("pinned real NREL table and independent XLSX",()=>{
  it("exports only five source rows under explicit review",async()=>{
    const bytes=await readFile(referencePath!);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82");
    Object.defineProperty(globalThis,"window",{value:{},configurable:true});
    const source=await analyzePdfV4(new File([bytes],"nrel-fuel-savings.pdf",
      {type:"application/pdf"}));
    const index=source.tables.findIndex(t=>t.id.startsWith("native-nrel-fuel-savings-"));
    expect(index).toBeGreaterThanOrEqual(0);
    const table=source.tables[index];
    expect(table.rows).toHaveLength(7);
    expect(table.columnCount).toBe(7);
    expect(table.extractionProvenance?.nativeWordCount).toBe(50);
    expect(inspectTableStructuralEvidence(table).missingSourcePositions).toBe(6);
    expect(isScientificReviewOnlyTable(table)).toBe(true);
    expect(table.rows[0].cells[0].text).toBe("Percent Fuel Savings");
    expect(table.rows[1].cells.map(c=>c.text)).toEqual([
      "Cycle Name","KI (1/km)","Distance (mi)","Improved Speed",
      "Decreased Accel","Eliminate Stops","Decreased Idle"]);
    expect(table.rows[2].cells.map(c=>c.text)).toEqual([
      "2012_2","3.30","1.3","5.9%","9.5%","29.2%","17.4%"]);
    expect(table.rows[6].cells.map(c=>c.text)).toEqual([
      "4171_1","0.07","173.9","58.1%","1.6%","2.1%","0.5%"]);
    expect(source.tables).toHaveLength(2);
    expect(()=>preparePdfV4XlsxExport(source)).toThrow();
    expect(()=>preparePdfV4XlsxExport({...source,tables:[table]})).toThrow();
    expect(inspectPdfV4XlsxChoices(source).map(c=>c.eligible)).toEqual([false,true]);
    expect(index).toBe(1);
    const selection=prepareSelectedPdfV4XlsxExport(source,index);
    expect(selection.reviewNotes?.join(" ")).toContain("NREL TABLE 2-1 SOURCE REVIEW");
    expect(selection.tables[0].rows).toHaveLength(7);
    const workbook=await createPdfXlsxWorkbook(selection);
    const checker=[
      "import io,os,sys,pdfplumber",
      "from openpyxl import load_workbook",
      "book=load_workbook(io.BytesIO(sys.stdin.buffer.read()),data_only=False)",
      "sheet=next(s for s in book if s.title!='Review Notes')",
      "rows=list(sheet.values)",
      "assert len(rows)==7 and all(len(row)==7 for row in rows)",
      "assert rows[0][3]=='Percent Fuel Savings'",
      "assert rows[1]==('Cycle Name','KI (1/km)','Distance (mi)','Improved Speed','Decreased Accel','Eliminate Stops','Decreased Idle')",
      "p=pdfplumber.open(os.environ['KUKUREKU_NREL_REFERENCE_PATH']).pages[0]",
      "words=p.extract_words(x_tolerance=1,y_tolerance=2)",
      "edges=[120.2,164.5,204.8,257.3,313.1,374.5,429.8,491.2]",
      "ids=['2012_2','2145_1','4234_1','2032_2','4171_1']",
      "verified=0",
      "for r,ident in enumerate(ids):",
      "    top=next(w['top'] for w in words if w['text']==ident)",
      "    source=[[] for _ in range(7)]",
      "    for w in words:",
      "        if abs(w['top']-top)>0.8: continue",
      "        mid=(w['x0']+w['x1'])/2",
      "        col=next((i for i in range(7) if edges[i]<=mid<edges[i+1]),None)",
      "        assert col is not None,(r,w)",
      "        source[col].append(w['text'])",
      "    for col,text in enumerate(source):",
      "        expected=' '.join(text)",
      "        assert rows[r+2][col]==expected,(r,col,rows[r+2][col],expected)",
      "        if text: verified+=1",
      "assert verified==35,verified",
      "assert all(sheet.cell(i,j).data_type!='f' for i in range(1,8) for j in range(1,8))",
      "notes=' '.join(str(row[0]) for row in book['Review Notes'].values)",
      "assert 'NREL TABLE 2-1 SOURCE REVIEW' in notes",
      "print('NREL_35_SOURCE_BODY_CELLS_XLSX_PASS')",
    ].join("\n");
    expect(execFileSync("python",["-c",checker],{
      input:Buffer.from(workbook),encoding:"utf8"})).toContain(
        "NREL_35_SOURCE_BODY_CELLS_XLSX_PASS");
  });
});
