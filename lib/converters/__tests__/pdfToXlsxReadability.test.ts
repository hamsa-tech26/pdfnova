import {describe,expect,it} from "vitest";
import {estimatePdfTableColumnWidths} from "../pdfToXlsxReadability";

describe("Release 93 visual widths: no content mutations or Excel limit bypass",()=>{
  it("sizes normal text and caps unusually long cells without truncating source",()=>{
    const rows=[["Name","Serial","Notes"],["A","000001","A".repeat(600)]];
    const before=JSON.stringify(rows);
    expect(estimatePdfTableColumnWidths(rows)).toEqual([10,10,55]);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[1][2]).toHaveLength(600);
  });
  it("respects Unicode width and per-line bounds",()=>{
    expect(estimatePdfTableColumnWidths([
      ["Region","Remarks"],["বাংলা","first line\nsecond line"],
      ["日本語","end"],
    ])).toEqual([10,13]);
  });
  it("fails closed on excessive row or column input",()=>{
    expect(()=>estimatePdfTableColumnWidths([])).toThrow(/unsupported/);
    expect(()=>estimatePdfTableColumnWidths([Array(129).fill("x")])).toThrow(/unsupported/);
    expect(()=>estimatePdfTableColumnWidths(Array.from({length:2001},()=>["x"]))).toThrow(/unsupported/);
  });
});
