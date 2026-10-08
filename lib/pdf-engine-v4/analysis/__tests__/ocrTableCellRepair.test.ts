import {describe,it,expect} from "vitest";
import type {PdfWord} from "../../model/types";
import type {LogicalCell,LogicalRow,LogicalTable} from "../../model/logicalTable";
import {repairPdfV4TableOcrCells} from "../ocrTableCellRepair";
const word=(text:string,confidence:number,x=40,y=0):PdfWord=>({
 id:text+"-"+x,text,pageNumber:1,bounds:{x,y,width:20,height:20},
 font:{size:12},rotation:0,extractionProvenance:{source:"ocr-tesseract",confidence},
});
const cell=(col:number,text:string,words:PdfWord[]):LogicalCell=>({
 id:"c"+col,rowIndex:0,columnIndex:col,text,words,confidence:0.9,
 bounds:{x:words[0]?.bounds.x??0,y:0,width:50,height:20},
});
const row=(serial:string,confidence=95,x=40):LogicalRow=>({
 id:"r"+serial,rowIndex:0,confidence:0.9,cells:[
 cell(0,serial,[word(serial,confidence,x)]),
 cell(1,"Scheme",[word("Scheme",90,200)]),
 cell(2,"GP",[word("GP",90,400)]),
 cell(3,"Functional",[word("Functional",90,600)]),
 cell(4,"Normal",[word("Normal",90,800)]),
 ]});
const fixture=()=>({id:"test",pageNumber:1,columnCount:5,confidence:0.96,rows:[
 row("1",96,46),row("2"),row("3"),row("4"),row("5"),row("6"),
 row("7",96,46),row("18",41,30),row("9",96,44),
 ]}) as LogicalTable;
describe("post-structure OCR table repair",()=>{
 it("corrects only low-confidence source-border serials corroborated on both sides",()=>{
  const original=fixture();const fixed=repairPdfV4TableOcrCells(original);
  expect(fixed.rows[7].cells[0].text).toBe("8");
  expect(fixed.rows[7].cells[0].originalOcrText).toBe("18");
  expect(fixed.rows[7].cells[0].words[0].text).toBe("18");
  expect(original.rows[7].cells[0].text).toBe("18");
 });
 it("drops spurious low-confidence grid artifacts but preserves real words and provenance",()=>{
  const t=fixture();
  t.rows[8].cells[1]=cell(1,"Serechandra Para ES",[
    word("Serechandra",93),word("Para",96),word("ES",22)]);
  t.rows[8].cells[2]=cell(2,"—— EE Thumsarai",[
    word("——",18),word("EE",8),word("Thumsarai",91)]);
  t.rows[8].cells[3]=cell(3,"Low pressure E————",[
    word("Low",96),word("pressure",95),word("E————",0)]);
  const fixed=repairPdfV4TableOcrCells(t);
  expect(fixed.rows[8].cells.slice(1,4).map(c=>c.text)).toEqual([
    "Serechandra Para","Thumsarai","Low pressure"]);
  expect(fixed.rows[8].cells[3].originalOcrText).toBe("Low pressure E————");
 });
 it("does not clean native PDF tables or arbitrary two-column records",()=>{
  const t=fixture();t.columnCount=2;
  expect(repairPdfV4TableOcrCells(t)).toBe(t);
  t.columnCount=5;
  t.rows[7].cells[0].words[0].extractionProvenance={source:"native-pdf"};
  expect(repairPdfV4TableOcrCells(t).rows[7].cells[0].text).toBe("18");
 });
});
