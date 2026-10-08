import { describe, expect, it } from "vitest";
import { tableToCsvRows, inspectV4TableExport } from "../v4TableExport";
import type { LogicalTable } from "../../pdf-engine-v4/model/logicalTable";

describe("V4 table export adapter", () => {
  it("preserves column positions and blank cells", () => {
    const fixture = {
      columnCount:3,
      rows:[{cells:[{columnIndex:0,text:"1"},{columnIndex:2,text:"value"}]}],
    } as LogicalTable;
    expect(tableToCsvRows(fixture)).toEqual([["1","","value"]]);
  });
  it("rejects out-of-bounds column widths",()=>{
    expect(()=>tableToCsvRows({columnCount:513,rows:[]} as unknown as LogicalTable)).toThrow("512-column");
  });
  it("does not silently discard invalid indices",()=>{
    const fixture={columnCount:2,rows:[{cells:[{columnIndex:-1,text:"x"}]}]} as LogicalTable;
    expect(()=>tableToCsvRows(fixture)).toThrow("Invalid V4 cell");
  });
  it("flags a blank OCR row and a damaged serial sequence for review",()=>{
    const row=(serial:string,value:string)=>({cells:[{columnIndex:0,text:serial},{columnIndex:1,text:value}]});
    const table={columnCount:2,rows:[row("Sl No","Name"),row("1","A"),row("2","B"),row("",""),row("4","D"),row("6","F")]} as unknown as LogicalTable;
    const review=inspectV4TableExport(table);
    expect(review.needsReview).toBe(true);
    expect(review.warnings.some(v=>v.includes("blank"))).toBe(true);
    expect(review.warnings.some(v=>v.includes("gaps"))).toBe(true);
  });
  it("does not invent serial anomalies in text-first tables",()=>{
    const table={columnCount:2,rows:[{cells:[{columnIndex:0,text:"Name"},{columnIndex:1,text:"Value"}]},{cells:[{columnIndex:0,text:"Alice"},{columnIndex:1,text:"Yes"}]}]} as unknown as LogicalTable;
    expect(inspectV4TableExport(table)).toEqual({needsReview:false,warnings:[]});
  });

});
