import { describe, expect, it } from "vitest";
import { serializeTableCsv } from "../tableExport";
describe("table CSV export", () => {
  it("preserves empty cells and escapes commas, quotes and newlines", () => {
    expect(serializeTableCsv([["ID","Note","Empty"],["1",'A,"B"\nC',null]])).toBe('"ID","Note","Empty"\r\n"1","A,""B""\nC",""\r\n');
  });
  it("neutralizes spreadsheet formulas including leading whitespace", () => {
    expect(serializeTableCsv([["=1+1"," +SUM(A1:A2)","-2","@cmd","normal"]])).toBe('"\'=1+1","\' +SUM(A1:A2)","\'-2","\'@cmd","normal"\r\n');
  });
  it("rejects malformed row structures", () => {
    expect(() => serializeTableCsv([["a"],"bad"] as unknown as string[][])).toThrow();
  });
});
