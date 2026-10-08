import { describe, expect, it } from "vitest";
import { tableToCsvRows } from "../v4TableExport";
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
});
