import {describe,expect,it} from "vitest";
import {parseUserReviewedImageGrid} from "../reviewedImageTableWorkbook";
import {
  insertReviewedImageRow,removeReviewedImageRow,
  insertReviewedImageColumn,removeReviewedImageColumn,
  inspectReviewedImageGrid,
} from "../reviewedImageGridEdits";
const fixture="ID\tAmount\tNote\n00071\t=2+2\tone\n00090\t00456\ttwo";

describe("R137 user-directed reviewed OCR row controls",()=>{
  it("adds a source-entered first cell without guessing remaining row values",()=>{
    const s=insertReviewedImageRow(fixture,1,"00072");
    expect(parseUserReviewedImageGrid(s)).toEqual([
      ["ID","Amount","Note"],["00071","=2+2","one"],
      ["00072","",""],["00090","00456","two"],
    ]);
    expect(removeReviewedImageRow(s,2)).toBe(fixture);
    expect(()=>insertReviewedImageRow(fixture,1,"")).toThrow(/source image/);
    expect(()=>insertReviewedImageRow(fixture,1,"tab\tvalue")).toThrow();
    expect(()=>insertReviewedImageRow(fixture,-1,"x")).toThrow();
    expect(()=>removeReviewedImageRow(fixture,0)).toThrow();
    expect(()=>removeReviewedImageRow("A\tB\n1\t2",1)).toThrow();
  });
  it("enforces 100-row capacity",()=>{
    const full="A\tB\n"+Array.from({length:99},(_,i)=>i+"\t"+i).join("\n");
    expect(()=>insertReviewedImageRow(full,2,"new")).toThrow(/100/);
  });
});
describe("R138 explicit source-heading column editing",()=>{
  it("adds an empty data column and protects literal identifiers",()=>{
    const extended=insertReviewedImageColumn(fixture,0,"Region");
    expect(parseUserReviewedImageGrid(extended)[0]).toEqual(["ID","Region","Amount","Note"]);
    expect(parseUserReviewedImageGrid(extended)[1]).toEqual(["00071","","=2+2","one"]);
    expect(removeReviewedImageColumn(extended,1)).toBe(fixture);
    expect(()=>insertReviewedImageColumn(fixture,0,"")).toThrow(/heading/i);
    expect(()=>insertReviewedImageColumn(fixture,1,"bad\nheading")).toThrow();
    expect(()=>removeReviewedImageColumn("A\tB\n1\t2",0)).toThrow(/two reviewed columns/);
    expect(()=>removeReviewedImageColumn(fixture,4)).toThrow();
  });
  it("enforces 20-column capacity",()=>{
    const headings=Array.from({length:20},(_,i)=>"C"+i).join("\t");
    const data=Array.from({length:20},(_,i)=>String(i)).join("\t");
    expect(()=>insertReviewedImageColumn(headings+"\n"+data,0,"extra"))
      .toThrow(/20/);
  });
});
describe("R140 non-certifying reviewed-grid quality report",()=>{
  it("reveals blanks, potential formula strings, IDs with leading zeros and duplicate headers",()=>{
    const s="ID\tAmount\tamount\n00071\t=1+1\t\n00009\t2\tgood";
    const report=inspectReviewedImageGrid(s);
    expect(report).toMatchObject({rows:3,columns:3,emptyDataCells:1,
      formulaLikeCells:1,leadingZeroCells:2,duplicateHeadingCount:1});
    expect(report.warnings.join(" ")).toContain("literal text");
    expect(report.warnings.join(" ")).toContain("NOT certified");
    expect(inspectReviewedImageGrid(fixture).emptyDataCells).toBe(0);
  });
});
