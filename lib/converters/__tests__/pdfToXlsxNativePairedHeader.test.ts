import {describe,expect,it} from "vitest";
import JSZip from "jszip";
import type {LogicalTable} from "../../pdf-engine-v4/model/logicalTable";
import {preparePdfV4XlsxExport} from "../pdfToXlsxQuality";
import {createPdfXlsxWorkbook} from "../pdfToXlsx";

const labels=[
  ["Chromosome","Jonathan","","Golden Delicious","","Consensus",""],
  ["/linkage group","No. of makers","Length(cM)",
    "No. of makers","Length(cM)","No. of makers","Length(cM)"],
  ["1","70","82.0","97","75.4","159","86.5"],
];
function source(overrides?:{unknownNative?:boolean;noHeaderProvenance?:boolean}){
  const t={
    id:"native-group",pageNumber:1,columnCount:7,confidence:0.96,
    bounds:{x:40,y:500,width:540,height:140},
    extractionProvenance:{source:"native-pdf",wordCount:18,
      nativeWordCount:18,ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]},
    rows:labels.map((values,r)=>({
      id:"row-"+r,rowIndex:r,confidence:0.94,
      provenance:overrides?.noHeaderProvenance && r===0 ? undefined :
        {pageNumber:1,blockId:"native-"+r,originalRowIndex:r},
      cells:values.map((text,col)=>({
        id:"cell-"+r+"-"+col,rowIndex:r,columnIndex:col,
        text,confidence:0.94,
        bounds:{x:45+col*78,y:625-r*20,width:Math.min(66,text.length*4+4),height:10},
        extractionProvenance:{source:"native-pdf",wordCount:text?1:0,
          nativeWordCount:text?1:0,ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]},
        words:text?[{
          id:"word-"+r+"-"+col,text,pageNumber:1,
          bounds:{x:45+col*78,y:625-r*20,width:Math.min(66,text.length*4+4),height:10},
          font:{size:10},rotation:0,
          extractionProvenance:{source:overrides?.unknownNative && r===0 && col===1 ?
            "unknown" : "native-pdf",wordCount:1,nativeWordCount:1,
            ocrWordCount:0,unknownWordCount:0,pageNumbers:[1]},
        }]:[],
      })),
    })),
  } as unknown as LogicalTable;
  return {document:{pages:[{}]},
    nativePageTextExtraction:[{pageNumber:1,textExtraction:{status:"sufficient"}}],
    tables:[t]};
}
describe("Release 91 real Excel two-tier native grouped header presentation",()=>{
  it("visually merges three native parent headings, wraps and freezes both header rows, without changing source cell coordinates",async()=>{
    const src=source();
    const plan=preparePdfV4XlsxExport(src);
    expect(plan.tables[0].nativePairedHeader).toBe(true);
    expect(plan.tables[0].rows).toEqual(labels);
    expect(plan.reviewNotes?.join(" ")).toContain("visually merged B1:C1");
    const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
    const xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const styles=await zip.file("xl/styles.xml")!.async("string");
    const notes=await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(xml).toContain('<dimension ref="A1:G3"/>');
    expect(xml).toContain('<mergeCells count="3"><mergeCell ref="B1:C1"/><mergeCell ref="D1:E1"/><mergeCell ref="F1:G1"/></mergeCells>');
    expect(xml).toContain('ySplit="2" topLeftCell="A3"');
    expect(xml).toContain('<c r="B1" t="inlineStr" s="1">');
    expect(xml).toContain('<c r="C1" t="inlineStr" s="1"><is><t xml:space="preserve"></t>');
    expect(xml).toContain('<c r="C3" t="inlineStr"><is><t xml:space="preserve">82.0</t>');
    expect(xml).toContain("Golden Delicious");
    expect(styles).toContain('wrapText="1"');
    expect(styles).toContain("<b/>");
    expect(notes).toContain("NOT independent semantic verification");
    expect(xml).not.toMatch(/<f(?:\s|>)/);
    expect([...xml.matchAll(/<row r="/g)]).toHaveLength(3);
    expect(Object.keys(zip.files).filter(x=>/xl\/worksheets\/sheet\d+\.xml$/.test(x))).toHaveLength(2);
  });
  it("keeps ambiguous/unproven native grouped headers unmerged and preserves all original labels",async()=>{
    for(const opts of [{unknownNative:true},{noHeaderProvenance:true}]){
      const plan=preparePdfV4XlsxExport(source(opts));
      expect(plan.tables[0].nativePairedHeader).toBeUndefined();
      const zip=await JSZip.loadAsync(await createPdfXlsxWorkbook(plan));
      const xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      expect(xml).not.toContain("mergeCells");
      expect(xml).not.toContain('ySplit="2"');
      expect(xml).toContain("Jonathan");
      expect(xml).toContain("Golden Delicious");
      expect(xml).not.toMatch(/<f(?:\s|>)/);
    }
  });
  it("rejects forced merges without matching blank destination cells or two real heading rows",async()=>{
    await expect(createPdfXlsxWorkbook({tables:[{
      name:"not paired",nativePairedHeader:true,
      rows:[["ID","Name"],["1","Alice"]],
    }]})).rejects.toThrow(/Two-level native header/);
    await expect(createPdfXlsxWorkbook({tables:[{
      name:"overwriting group cell",nativePairedHeader:true,
      rows:[["Item","G1","FILLED","G2","","G3",""],
        ["Key","Count","Length","Count","Length","Count","Length"],
        ["1","2","3","4","5","6","7"]],
    }]})).rejects.toThrow(/Two-level native header/);
  });
});
