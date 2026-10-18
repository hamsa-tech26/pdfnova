import {describe,it,expect} from "vitest";
import JSZip from "jszip";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {preserveNativeWideHeaderLines} from "../nativeWideHeaderLines";
import {createPdfXlsxWorkbook} from "../pdfToXlsx";

const native=(text:string,y:number,kind:"native-pdf"|"ocr-tesseract"="native-pdf")=>({
  id:"source-"+text+"-"+y,text,pageNumber:1,
  bounds:{x:100,y,width:30,height:9},rotation:0,font:{size:9},
  extractionProvenance:{source:kind,wordCount:1,nativeWordCount:kind==="native-pdf"?1:0,
    ocrWordCount:kind==="ocr-tesseract"?1:0,unknownWordCount:0,pageNumbers:[1]},
});
function source(words= [
  native("Interval",690),native("between",690),
  native("end",677),native("of",677),native("therapy",677),
  native("(days)",664),
],label=words.map(w=>w.text).join(" ")){
  const headers=["Patient","Chemotherapy",label,"Fever","Cough",
    "Grade","RT","ChT","Response","Rechallenge","Days"];
  const rows=Array.from({length:11},(_,r)=>({
    id:"row-"+r,rowIndex:r,confidence:.94,
    provenance:{pageNumber:1,
      blockId:"dense-native-eleven-grid-1-publisher-"+r,originalRowIndex:r},
    cells:headers.map((text,c)=>({
      id:"cell-"+r+"-"+c,rowIndex:r,columnIndex:c,
      text:r===0?text:""+(r*100+c),
      words:r===0&&c===2?words:[native(text,690-r*12)],
      bounds:{x:50+c*45,y:690-r*12,width:30,height:9},confidence:.94,
      extractionProvenance:{source:"native-pdf",wordCount:1,nativeWordCount:1,
        ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]},
    })),
  }));
  const table={id:"t",pageNumber:1,columnCount:11,rows,
    bounds:{x:25,y:500,width:540,height:180},confidence:.93,
    extractionProvenance:{source:"native-pdf",wordCount:100,nativeWordCount:100,
      ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]}} as unknown as LogicalTable;
  const data=[headers,...Array.from({length:10},(_,r)=>
    headers.map((_,c)=>String((r+1)*100+c)))];
  return {table,data};
}

describe("Release 103–105 native multi-baseline wide scientific header repair",()=>{
  it("restores real physical line breaks in same column and conserves every token and data position",()=>{
    const {table,data}=source();const prior=JSON.stringify(data);
    const x=preserveNativeWideHeaderLines(table,data);
    expect(x.headerWrapped).toBe(true);
    expect(x.wrappedCells).toBe(1);
    expect(x.rows[0][2]).toBe("Interval between\nend of therapy\n(days)");
    expect(x.rows[0].filter(Boolean)).toHaveLength(11);
    expect(x.rows.slice(1)).toEqual(data.slice(1));
    expect(x.rows[0][2].replace(/\s/g,"")).toBe(data[0][2].replace(/\s/g,""));
    expect(JSON.stringify(data)).toBe(prior);
  });
  it("rejects OCR, reverse baselines, an unsupported wide table or changed source text",()=>{
    const original=source();
    for(const altered of [
      [native("Interval",690),native("between",690),native("end",690),
        native("therapy",677,"ocr-tesseract"),native("(days)",664)],
      [native("Interval",677),native("between",690),native("end",664)],
      [native("Interval",690),native("between",620),native("end",500)],
    ]){
      const t=source(altered).table;
      const x=preserveNativeWideHeaderLines(t,[...source(altered).data]);
      expect(x.headerWrapped).toBe(false);
    }
    const different=source(undefined,"DIFFERENT HEADER WORDS");
    expect(preserveNativeWideHeaderLines(different.table,different.data).headerWrapped)
      .toBe(false);
    const width=source();width.table.columnCount=10;
    expect(preserveNativeWideHeaderLines(width.table,width.data).headerWrapped).toBe(false);
    expect(preserveNativeWideHeaderLines(original.table,original.data).wrappedCells).toBe(1);
  });
  it("R104 creates true wrapped 68pt Excel native header, frozen first row with no merges or formulas",async()=>{
    const {table,data}=source();
    const repaired=preserveNativeWideHeaderLines(table,data);
    const bytes=await createPdfXlsxWorkbook({tables:[{
      name:"Publisher data",rows:repaired.rows,nativeWideMultilineHeader:true,
    }],reviewNotes:["UNVERIFIED: compare native wrapped scientific header with PDF."]});
    const zip=await JSZip.loadAsync(bytes);
    const sheet=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const styles=await zip.file("xl/styles.xml")!.async("string");
    const review=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(sheet).toContain('<dimension ref="A1:K11"/>');
    expect(sheet).toContain('<row r="1" ht="68" customHeight="1">');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2"');
    expect(sheet).toContain('r="C1" t="inlineStr" s="1"');
    expect(sheet).toContain('Interval between\nend of therapy\n(days)');
    expect(sheet).not.toContain("<mergeCells");
    expect(sheet).not.toContain("<autoFilter");
    expect(sheet).not.toMatch(/<f(?:\s|>)/);
    expect(styles).toContain('wrapText="1"');
    expect(review).toContain("UNVERIFIED");
    expect(sheet).toContain('<c r="C2" t="inlineStr"><is><t xml:space="preserve">102');
  });
  it("R105 refuses forcing wide native styles on tables without source multiline evidence",async()=>{
    for(const rows of [
      [["a","b"]],
      Array.from({length:11},()=>Array(11).fill("source")),
      Array.from({length:11},()=>Array(10).fill("source\nline")),
    ]){
      await expect(createPdfXlsxWorkbook({tables:[{
        name:"unverified",rows,nativeWideMultilineHeader:true,
      }]})).rejects.toThrow(/native wide header wrapping|Source-native wide header wrapping/);
    }
  });
});
