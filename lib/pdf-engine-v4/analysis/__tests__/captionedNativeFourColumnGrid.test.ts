import {afterEach,describe,expect,it,vi} from "vitest";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";

import {analyzePdfV4} from "../../pipeline/analyzePdfV4";
import {readPdfDocumentV4} from "../../reader/pageReader";
import {detectVisualBlocks} from "../visualBlockDetector";
import {detectTableRegionsForPage} from "../tableRegionDetector";

const width=595;
const height=842;

async function fixture(kind:"two-grids"|"article"){
  const document=await PDFDocument.create();
  const page=document.addPage([width,height]);
  const font=await document.embedFont(StandardFonts.Helvetica);
  const bold=await document.embedFont(StandardFonts.HelveticaBold);
  const draw=(text:string,x:number,y:number,strong=false)=>
    page.drawText(text,{x,y,size:10,font:strong?bold:font,color:rgb(0,0,0)});
  draw("Kukureku sample - native tables",57,763,true);
  const drawTable=(caption:string,headings:string[],rows:string[][],captionY:number)=>{
    draw(caption,57,captionY,true);
    const xs=[66,247,338,437];
    headings.forEach((value,index)=>draw(value,xs[index],captionY-30,true));
    for(const [index,row] of rows.entries()){
      const y=captionY-61-index*31.5;
      row.forEach((value,column)=>{
        const x=column===1?321-font.widthOfTextAtSize(value,10):
          column===2?419-font.widthOfTextAtSize(value,10):xs[column];
        draw(value,x,y);
      });
    }
  };
  if(kind==="two-grids"){
    drawTable("TABLE A - Water Supply Summary",
      ["Scheme","Households","Target KLD","Status"],
      [["Damcherra","120","8.40","Active"],
       ["Khedacherra","80","5.60","Active"],
       ["Juri","60","4.20","Maintenance"],
       ["TOTAL","260","18.20","-"]],686);
    drawTable("TABLE B - Material Cost Summary",
      ["Material","Quantity","Rate INR","Amount INR"],
      [["32 mm pipe","20","150","3000"],
       ["Valve","4","250","1000"],
       ["Coupler","10","60","600"],
       ["TOTAL","34","-","4600"]],494);
    draw("Testing note: no independent certification is implied.",100,266);
  }else{
    draw("TABLE A - Explanatory Paragraph",57,686,true);
    ["The first paragraph explains the report.",
     "The second paragraph describes methods.",
     "More text follows in normal reading order.",
     "A note summarizes implications for readers.",
     "The conclusion provides further commentary."].forEach((line,i)=>
       draw(line,66,656-i*31));
  }
  const bytes=await document.save();
  return new File([new Uint8Array(bytes)],"small-native-tables.pdf",{
    type:"application/pdf"});
}

afterEach(()=>vi.unstubAllGlobals());

describe("source-anchored small four-column caption grids",()=>{
  it("exports two distinct 5-row grids with four original header cells",async()=>{
    vi.stubGlobal("window",{});
    const pdf=await fixture("two-grids");
    const result=await analyzePdfV4(pdf);
    expect(result.statistics.candidateTableRegionCount).toBe(2);
    expect(result.statistics.confirmedTableRegionCount).toBe(2);
    expect(result.statistics.logicalTableCount).toBe(2);
    const rows=result.tables.map(table=>table.rows.map(row=>
      row.cells.map(cell=>cell.text)));
    expect(rows).toEqual([
      [["Scheme","Households","Target KLD","Status"],
       ["Damcherra","120","8.40","Active"],
       ["Khedacherra","80","5.60","Active"],
       ["Juri","60","4.20","Maintenance"],
       ["TOTAL","260","18.20","-"]],
      [["Material","Quantity","Rate INR","Amount INR"],
       ["32 mm pipe","20","150","3000"],
       ["Valve","4","250","1000"],
       ["Coupler","10","60","600"],
       ["TOTAL","34","-","4600"]],
    ]);
    const usedWords=result.tables.flatMap(table=>
      table.rows.flatMap(row=>row.cells.flatMap(cell=>
        cell.words.map(word=>word.id))));
    expect(new Set(usedWords).size).toBe(usedWords.length);
  });

  it("does not invent a spreadsheet from captioned prose",async()=>{
    vi.stubGlobal("window",{});
    const document=detectVisualBlocks(await readPdfDocumentV4(
      await fixture("article")));
    const regions=detectTableRegionsForPage(document.pages[0].blocks);
    expect(regions.tableRegions.filter(region=>region.analysis.isTable)).toHaveLength(0);
    expect(regions.regions.some(region=>region.block.id.startsWith(
      "captioned-native-four-grid-"))).toBe(false);
  });
});
