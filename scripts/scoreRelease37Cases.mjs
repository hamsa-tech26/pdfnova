/**
 * Conservative, independent comparison of V4 Inspector table output with
 * human-reviewed reference labels. Never uses expected text to repair output.
 * Tables and cells are position-matched: shifts/extras are penalised.
 */
const norm = value => String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu," ").toLowerCase();
const percent = (ok,total) => total ? 100*ok/total : null;
const key = (t,r,c) => t+":"+r+":"+c;

function assertIndex(n,label) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 10000) throw new Error("Invalid "+label+": "+n);
}
const MAX_REFERENCE_SLOTS = 100_000;

function expectedTables(reference) {
  if (!Array.isArray(reference?.tables)) throw new Error("Reference must have tables[]");
  return reference.tables.map((table,t) => {
    assertIndex(table.rowCount,"reference rowCount");
    assertIndex(table.columnCount,"reference columnCount");
    if (!Array.isArray(table.cells)) throw new Error("Reference table "+t+" needs cells[]");
    if (table.rowCount < 1 || table.columnCount < 1 || table.columnCount > 512 ||
        table.rowCount * table.columnCount > MAX_REFERENCE_SLOTS) {
      throw new Error("Reference table requires positive bounded dimensions");
    }
    const slots = new Set();
    const cells=new Map();
    for (const cell of table.cells) {
      assertIndex(cell.rowIndex,"reference rowIndex");
      assertIndex(cell.columnIndex,"reference columnIndex");
      if (cell.rowIndex >= table.rowCount || cell.columnIndex >= table.columnCount ||
          typeof cell.text !== "string") throw new Error("Reference cell is outside table geometry or has no text");
      const rowSpan=cell.rowSpan??1,columnSpan=cell.columnSpan??1;
      if (!Number.isSafeInteger(rowSpan)||!Number.isSafeInteger(columnSpan)||rowSpan<1||columnSpan<1||
          cell.rowIndex+rowSpan>table.rowCount||cell.columnIndex+columnSpan>table.columnCount) {
        throw new Error("Invalid reference merged-cell span");
      }
      const id=key(t,cell.rowIndex,cell.columnIndex);
      if(cells.has(id))throw new Error("Duplicated reference cell "+id);
      for (let r = cell.rowIndex; r < cell.rowIndex + rowSpan; r++) {
        for (let c = cell.columnIndex; c < cell.columnIndex + columnSpan; c++) {
          const slot = key(t,r,c);
          if (slots.has(slot)) throw new Error("Overlapping reference cell spans at "+slot);
          slots.add(slot);
        }
      }
      cells.set(id,{text:norm(cell.text),rowSpan,columnSpan,rowIndex:cell.rowIndex,columnIndex:cell.columnIndex,tableIndex:t});
    }
    if (slots.size !== table.rowCount * table.columnCount) {
      throw new Error("Incomplete reference: every table slot must have a reviewed cell, including blanks");
    }
    return {rowCount:table.rowCount,columnCount:table.columnCount,cells};
  });
}
function observedTables(observed) {
  if (!Array.isArray(observed?.tables)) throw new Error("Observed actual V4 Inspector JSON must have tables[]");
  return observed.tables.map((table,t)=>{
    if(!Array.isArray(table?.rows))throw new Error("Observed table missing rows[]");
    assertIndex(table.columnCount,"observed columnCount");
    const cells=new Map();
    let duplicates=0, malformed=0;
    const occupied = new Set();
    table.rows.forEach((row,r)=>{
      if(!Array.isArray(row?.cells)) { malformed++;return; }
      for(const cell of row.cells){
        const rowIndex=cell.rowIndex??r;
        const columnIndex=cell.columnIndex;
        const rowSpan=cell.rowSpan??1,columnSpan=cell.columnSpan??1;
        if(!Number.isSafeInteger(rowIndex)||rowIndex!==r||
           !Number.isSafeInteger(columnIndex)||columnIndex<0||columnIndex>=table.columnCount||
           !Number.isSafeInteger(rowSpan)||rowSpan<1||rowIndex+rowSpan>table.rows.length||
           !Number.isSafeInteger(columnSpan)||columnSpan<1||columnIndex+columnSpan>table.columnCount){malformed++;continue;}
        const id=key(t,rowIndex,columnIndex);
        if(cells.has(id)){duplicates++;continue;}
        let overlapping=false;
        for(let y=rowIndex;y<rowIndex+rowSpan;y++)for(let x=columnIndex;x<columnIndex+columnSpan;x++){
          if(occupied.has(key(t,y,x)))overlapping=true;
        }
        if(overlapping){malformed++;continue;}
        for(let y=rowIndex;y<rowIndex+rowSpan;y++)for(let x=columnIndex;x<columnIndex+columnSpan;x++){
          occupied.add(key(t,y,x));
        }
        cells.set(id,{text:norm(cell.text),rowSpan,columnSpan,rowIndex,columnIndex,tableIndex:t});
      }
    });
    return {rowCount:table.rows.length,columnCount:table.columnCount,cells,duplicates,malformed};
  });
}
export function scoreRelease37Case(reference,observed){
  const expected=expectedTables(reference),actual=observedTables(observed);
  const expectedCellMap=new Map(),actualCellMap=new Map();
  expected.forEach(x=>x.cells.forEach((v,k)=>expectedCellMap.set(k,v)));
  actual.forEach(x=>x.cells.forEach((v,k)=>actualCellMap.set(k,v)));
  const additional=[...actualCellMap.keys()].filter(k=>!expectedCellMap.has(k)).length+
    actual.reduce((n,t)=>n+t.duplicates+t.malformed,0);
  let textCorrect=0,geometryCorrect=0;
  for(const [id,e] of expectedCellMap){
    const a=actualCellMap.get(id);
    if(!a)continue;
    if(a.text===e.text)textCorrect++;
    if(a.rowSpan===e.rowSpan&&a.columnSpan===e.columnSpan)geometryCorrect++;
  }
  let rowCorrect=0;
  const rowCount=Math.max(expected.length,actual.length);
  let extraRows=0;
  for(let t=0;t<rowCount;t++){
    const e=expected[t],a=actual[t];
    if(!e){extraRows+=a?.rowCount??0;continue;}
    if(a&&a.rowCount>e.rowCount)extraRows+=a.rowCount-e.rowCount;
    for(let r=0;r<e.rowCount;r++){
      if(!a||r>=a.rowCount)continue;
      // Count row correctness only when every occupying source cell, including
      // cells anchored in a previous row by rowSpan, is represented faithfully.
      const expectedRow=[...e.cells.values()].filter(c=>c.rowIndex<=r && c.rowIndex+c.rowSpan>r);
      const actualRow=[...a.cells.values()].filter(c=>c.rowIndex<=r && c.rowIndex+c.rowSpan>r);
      if(expectedRow.length===actualRow.length&&expectedRow.every(c=>{
        const other=a.cells.get(key(t,c.rowIndex,c.columnIndex));
        return other?.text===c.text && other.rowSpan===c.rowSpan && other.columnSpan===c.columnSpan;
      }))rowCorrect++;
    }
  }
  let tableGeometryCorrect=0;
  for(let t=0;t<expected.length;t++){
    if(actual[t]?.rowCount===expected[t].rowCount&&
       actual[t]?.columnCount===expected[t].columnCount) tableGeometryCorrect++;
  }
  const extras=additional+Math.max(actual.length-expected.length,0);
  const cellTotal=expectedCellMap.size+additional;
  const rowTotal=expected.reduce((n,t)=>n+t.rowCount,0)+extraRows;
  const structureTotal=expectedCellMap.size+expected.length+extras;
  return {
    cells:{correct:textCorrect,total:cellTotal,pct:percent(textCorrect,cellTotal)},
    rows:{correct:rowCorrect,total:rowTotal,pct:percent(rowCorrect,rowTotal)},
    structure:{correct:geometryCorrect+tableGeometryCorrect,total:structureTotal,
      pct:percent(geometryCorrect+tableGeometryCorrect,structureTotal)},
    extraPredictedCells:additional,extraPredictedRows:extraRows,
    expectedTables:expected.length,observedTables:actual.length,
    actualOcrAttempted:observed?.controlledOcrResult?.attempted===true,
    ocrLanguages:[...new Set((observed?.controlledOcrResult?.pages??[]).map(p=>p.language).filter(v=>typeof v==="string"))],
  };
}
export function aggregateRelease37Scores(results){
  const totals={cells:{correct:0,total:0},rows:{correct:0,total:0},structure:{correct:0,total:0}};
  for(const result of results)for(const category of Object.keys(totals)){
    totals[category].correct+=result[category].correct;
    totals[category].total+=result[category].total;
  }
  return Object.fromEntries(Object.entries(totals).map(([name,{correct,total}])=>[name,
    {correct,total,pct:percent(correct,total)}]));
}
