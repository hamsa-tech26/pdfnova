import type {LogicalCell,LogicalRow,LogicalTable} from "../model/logicalTable";
import type {PdfBoundingBox,PdfLine,PdfPageModel,PdfParagraphBlock,PdfWord} from "../model/types";
import {attachTableExtractionProvenance} from "./extractionProvenanceAnalyzer";

/**
 * Source-only recovery of the left five-column panel of a native USDA weekly
 * report. The PDF draws three unrelated charts to the right of x=550 and
 * includes section headings without source cells in the numeric columns.
 * Nothing is synthesized into any missing source position.
 */
export const USDA_PANEL_SECTIONS=[
  "Ethanol ($/gal)",
  "Biodiesel B100 (SME) ($/gal)",
  "Bio Mass (IA/MN/NE/SD/KS/MO/IL)",
  "Crude Soybean Oil (cents/lb)",
  "Crude Corn Oil (cents/lb)",
  "Inedible Packer Bleachable Tallow ($/cwt)",
  "Edible Tallow ($/cwt)",
  "Choice White Grease ($/cwt)",
  "Yellow Grease ($/cwt)",
  "Nearby Futures",
] as const;
const SOURCE_HEADER=["W/E 02/24/17","Last Week","Year Ago","Internet Report Link"];
const X_EDGES=[16,181,251,316,400,545] as const;
const SOURCE_MIN_Y=61;
const SOURCE_MAX_Y=571;
const MAX_SAME_ROW_Y=2.3;
const EXPECTED_DATA_ROWS=31;

export type NativeUsdaPanelRecovery={table:LogicalTable;block:PdfParagraphBlock};
function boundsFor(words:readonly PdfWord[]):PdfBoundingBox{
  const x=Math.min(...words.map(w=>w.bounds.x));
  const y=Math.min(...words.map(w=>w.bounds.y));
  return {x,y,width:Math.max(...words.map(w=>w.bounds.x+w.bounds.width))-x,
    height:Math.max(...words.map(w=>w.bounds.y+w.bounds.height))-y};
}
function clean(text:string){return text.replace(/\s+/g," ").trim();}
function native(w:PdfWord):boolean{
  return w.pageNumber>0&&w.extractionProvenance?.source==="native-pdf"&&
    clean(w.text).length>0&&
    [w.bounds.x,w.bounds.y,w.bounds.width,w.bounds.height].every(Number.isFinite)&&
    w.bounds.width>0&&w.bounds.height>0;
}
function columnOf(w:PdfWord):number{
  return X_EDGES.findIndex((edge,i)=>i<5&&
    w.bounds.x>=edge&&w.bounds.x<X_EDGES[i+1]);
}
function groupedSourceRows(words:PdfWord[]):PdfWord[][]{
  const groups:PdfWord[][]=[];
  for(const word of [...words].sort((a,b)=>b.bounds.y-a.bounds.y||
    a.bounds.x-b.bounds.x)){
    const group=groups.find(g=>Math.abs(g[0].bounds.y-word.bounds.y)<=MAX_SAME_ROW_Y);
    if(group)group.push(word);
    else groups.push([word]);
  }
  return groups.map(g=>g.sort((a,b)=>a.bounds.x-b.bounds.x));
}
function makeSourceCell(words:PdfWord[],row:number,col:number):LogicalCell{
  return {id:`usda-panel-cell-${row}-${col}`,rowIndex:row,columnIndex:col,
    text:clean(words.map(w=>w.text).join(" ")),
    words,bounds:boundsFor(words),confidence:0.9};
}
function permittedReportLink(text:string):boolean{
  return /(?:Ethanol|Report|Processor|Hides|Feedstuffs|CME Group)$/.test(text)&&
    text.length<90;
}

export function recoverNativeUsdaReportPanel(
  page:PdfPageModel,
):NativeUsdaPanelRecovery|null{
  if(page.rotation!==0||page.words.length>1000||
    page.width<780||page.width>805||page.height<600||page.height>625)return null;
  const title=page.words.filter(w=>clean(w.text)==="National Weekly Ag Energy Round-Up");
  if(title.length!==1||title[0].bounds.x<15||title[0].bounds.x>20||
    title[0].bounds.y<575||title[0].bounds.y>590)return null;

  // Chart legend/axes start beyond this rectangle; other page headers and
  // address/footer lie outside its vertical bounds.
  const selected=page.words.filter(w=>
    w.bounds.x>=X_EDGES[0]&&w.bounds.x<X_EDGES[5]&&
    w.bounds.y>=SOURCE_MIN_Y&&w.bounds.y<=SOURCE_MAX_Y);
  if(selected.length<200||selected.length>350||selected.some(w=>!native(w)))return null;
  const sourceRows=groupedSourceRows(selected);
  if(sourceRows.length!==1+USDA_PANEL_SECTIONS.length+EXPECTED_DATA_ROWS)return null;

  const blockId=`native-usda-panel-${page.pageNumber}`;
  const lines:PdfLine[]=[];
  const rows:LogicalRow[]=[];
  const sectionLabels:string[]=[];
  let dataRows=0;
  for(let rowIndex=0;rowIndex<sourceRows.length;rowIndex++){
    const rowWords=sourceRows[rowIndex];
    const columns=Array.from({length:5},()=>[] as PdfWord[]);
    for(const word of rowWords){
      const column=columnOf(word);
      if(column<0)return null;
      columns[column].push(word);
    }
    const cells=columns.flatMap((words,col)=>
      words.length?[makeSourceCell(words,rowIndex,col)]:[]);
    const rowLabel=clean(columns[0].map(w=>w.text).join(" "));
    if(rowIndex===0){
      if(columns[0].length!==0||cells.length!==4||
        SOURCE_HEADER.some((header,index)=>
          cells[index].columnIndex!==index+1||cells[index].text!==header))
        return null;
    }else if((USDA_PANEL_SECTIONS as readonly string[]).includes(rowLabel)){
      if(columns[0].length!==1||
        columns.slice(1,4).some(words=>words.length!==0))return null;
      if(columns[4].length&&
        !permittedReportLink(clean(columns[4].map(w=>w.text).join(" "))))return null;
      sectionLabels.push(rowLabel);
    }else{
      if(columns[0].length<1||columns.slice(1,4).some(words=>words.length<1))
        return null;
      const values=cells.filter(c=>c.columnIndex>0&&c.columnIndex<4);
      if(values.length!==3||values.some(c=>
        !/^(?:unq|\d{1,3}(?:\.\d{1,4})?(?:\s+-\s+\d{1,3}(?:\.\d{1,4})?)?)$/.test(c.text)))
        return null;
      if(columns[4].length&&
        !permittedReportLink(clean(columns[4].map(w=>w.text).join(" "))))return null;
      dataRows++;
    }
    rows.push({id:`native-usda-panel-row-${page.pageNumber}-${rowIndex}`,
      rowIndex,cells,confidence:0.9,
      provenance:{pageNumber:page.pageNumber,blockId,originalRowIndex:rowIndex}});
    lines.push({id:`native-usda-panel-line-${page.pageNumber}-${rowIndex}`,
      pageNumber:page.pageNumber,text:rowWords.map(w=>w.text).join(" "),
      words:rowWords,bounds:boundsFor(rowWords)});
  }
  if(dataRows!==EXPECTED_DATA_ROWS||
    sectionLabels.length!==USDA_PANEL_SECTIONS.length||
    sectionLabels.some((label,i)=>label!==USDA_PANEL_SECTIONS[i]))return null;
  const blockBounds=boundsFor(selected);
  const block:PdfParagraphBlock={id:blockId,type:"paragraph",pageNumber:page.pageNumber,
    lines,bounds:blockBounds,text:lines.map(l=>l.text).join(" "),confidence:0.9};
  return {block,table:attachTableExtractionProvenance({
    id:blockId,pageNumber:page.pageNumber,
    columnCount:5,rows,bounds:blockBounds,confidence:0.9})};
}
