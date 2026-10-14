import {describe,it,expect} from "vitest";
import {scoreRelease37Case,aggregateRelease37Scores} from "../../../../scripts/scoreRelease37Cases.mjs";

const ref=()=>({tables:[{rowCount:2,columnCount:2,cells:[
 {rowIndex:0,columnIndex:0,text:"Sl No"},{rowIndex:0,columnIndex:1,text:"Amount"},
 {rowIndex:1,columnIndex:0,text:"1"},{rowIndex:1,columnIndex:1,text:"₹ 500"},
]}]});
const observed=()=>({tables:[{columnCount:2,rows:[
 {cells:[{rowIndex:0,columnIndex:0,text:"Sl No"},{rowIndex:0,columnIndex:1,text:"Amount"}]},
 {cells:[{rowIndex:1,columnIndex:0,text:"1"},{rowIndex:1,columnIndex:1,text:"₹ 500"}]},
]}],controlledOcrResult:{attempted:false,pages:[]}});
describe("Release 37 independent positional and structural document scoring",()=>{
  it("scores matching text and geometry, including native-only documents",()=>{
    const x=scoreRelease37Case(ref(),observed());
    expect(x.cells.pct).toBe(100);expect(x.rows.pct).toBe(100);expect(x.structure.pct).toBe(100);
    expect(x.actualOcrAttempted).toBe(false);
  });
  it("penalizes shifted records and never aligns to the expected answer",()=>{
    const x=observed();x.tables[0].rows[1].cells[1].text="₹ 50";
    const result=scoreRelease37Case(ref(),x);
    expect(result.cells.pct).toBe(75);
    expect(result.rows.pct).toBe(50);
  });
  it("penalizes extra rows/cells instead of silently ignoring hallucinations",()=>{
    const x=observed();
    x.tables[0].rows.push({cells:[{rowIndex:2,columnIndex:0,text:"2"}]});
    const result=scoreRelease37Case(ref(),x);
    expect(result.cells.pct).toBeLessThan(100);
    expect(result.rows.pct).toBeLessThan(100);
    expect(result.structure.pct).toBeLessThan(100);
  });
  it("scores text separately from merged-cell span structure",()=>{
    const expected={tables:[{rowCount:1,columnCount:2,cells:[
      {rowIndex:0,columnIndex:0,text:"Merged header",columnSpan:2}]}]};
    const modified={tables:[{columnCount:2,rows:[{cells:[
      {rowIndex:0,columnIndex:0,text:"Merged header",columnSpan:1}]}]}]};
    const result=scoreRelease37Case(expected,modified);
    expect(result.cells.pct).toBe(100);
    expect(result.structure.pct).toBeLessThan(100);
  });
  it("fails closed for missing predicted tables",()=>{
    const x=scoreRelease37Case(ref(),{tables:[]});
    expect(x.cells.pct).toBe(0);expect(x.rows.pct).toBe(0);expect(x.structure.pct).toBe(0);
  });
  it("rejects bad gold labels and invalid duplicate/merged geometry",()=>{
    const g=ref();g.tables[0].cells.push(g.tables[0].cells[0]);
    expect(()=>scoreRelease37Case(g,observed())).toThrow(/Duplicated/);
  });
  it("reports no measured accuracy when gold has no scoring evidence",()=>{
    expect(scoreRelease37Case({tables:[]},{tables:[]}).cells.pct).toBeNull();
  });

  it("rejects partial gold annotations even if observed extraction would match them",()=>{
    const incomplete=ref();
    incomplete.tables[0].cells.pop();
    expect(()=>scoreRelease37Case(incomplete,observed())).toThrow(/Incomplete reference/);
  });
  it("requires explicit blank cells in reviewed reference tables",()=>{
    const incomplete=ref();
    incomplete.tables[0].cells[3].text="";
    expect(scoreRelease37Case(incomplete,observed()).cells.pct).toBe(75);
    incomplete.tables[0].cells.pop();
    expect(()=>scoreRelease37Case(incomplete,observed())).toThrow(/Incomplete reference/);
  });
  it("rejects overlapping reference spans and unbounded reference grids",()=>{
    const overlap=ref();
    overlap.tables[0].cells[0].columnSpan=2;
    expect(()=>scoreRelease37Case(overlap,observed())).toThrow(/Overlapping reference/);
    const huge=ref();huge.tables[0].rowCount=10000;huge.tables[0].columnCount=500;
    expect(()=>scoreRelease37Case(huge,observed())).toThrow(/bounded dimensions/);
  });
  it("a row spanning cell must be present and structurally correct in all occupied rows",()=>{
    const golden={tables:[{rowCount:2,columnCount:1,cells:[
      {rowIndex:0,columnIndex:0,rowSpan:2,text:"Merged"}]}]};
    const good={tables:[{columnCount:1,rows:[
      {cells:[{rowIndex:0,columnIndex:0,rowSpan:2,text:"Merged"}]},
      {cells:[]},
    ]}]};
    const bad={tables:[{columnCount:1,rows:[
      {cells:[{rowIndex:0,columnIndex:0,rowSpan:1,text:"Merged"}]},
      {cells:[]},
    ]}]};
    expect(scoreRelease37Case(golden,good).rows.pct).toBe(100);
    expect(scoreRelease37Case(golden,bad).rows.pct).toBe(0);
  });
  it("rejects observed spans overlapping existing cells instead of rewarding geometry",()=>{
    const bad=observed();
    bad.tables[0].rows[0].cells[0].columnSpan=2;
    expect(scoreRelease37Case(ref(),bad).structure.pct).toBeLessThan(100);
  });

  it("computes aggregate micro-averages from raw counts, not averages of percentages",()=>{
    const a=scoreRelease37Case(ref(),observed());
    const b=scoreRelease37Case(ref(),{tables:[]});
    expect(aggregateRelease37Scores([a,b]).cells.pct).toBe(50);
  });
});
