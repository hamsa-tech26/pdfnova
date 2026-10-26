import type {LogicalTable,LogicalRow} from "../pdf-engine-v4/model/logicalTable";

/** Original detector provenance only; no guesses about missing PDF values. */
export type SourceCellEvidence="source-text"|"empty-source-cell"|"no-detected-source-cell";
export function classifySourceCell(row:LogicalRow|undefined,columnIndex:number):SourceCellEvidence{
  if(!row||!Number.isSafeInteger(columnIndex)||columnIndex<0)return "no-detected-source-cell";
  const cell=row.cells.find(c=>c.columnIndex===columnIndex);
  if(!cell)return "no-detected-source-cell";
  return String(cell.text??"").length?"source-text":"empty-source-cell";
}
export type TableStructuralEvidence={
  rowCount:number;columnCount:number;
  missingSourcePositions:number;
  explicitlyEmptySourceCells:number;
  firstRowUnverifiedPositions:number;
  incompleteRows:number;
};
/**
 * R151: differentiate missing detector positions from explicit source cell
 * objects with empty text. Neither proves a blank printed PDF cell.
 * This report NEVER fills, shifts or creates a source cell.
 */
export function inspectTableStructuralEvidence(table:LogicalTable):TableStructuralEvidence{
  const rows=table.rows,cols=table.columnCount;
  if(!Number.isSafeInteger(cols)||cols<1||cols>128||rows.length>2000)
    throw Error("Invalid bounded table for source-cell evidence.");
  let missing=0,empty=0,incompleteRows=0,firstRowUnverified=0;
  for(let ri=0;ri<rows.length;ri++){
    let incomplete=false;
    for(let c=0;c<cols;c++){
      const kind=classifySourceCell(rows[ri],c);
      if(kind==="no-detected-source-cell"){missing++;incomplete=true;}
      else if(kind==="empty-source-cell"){empty++;incomplete=true;}
      if(ri===0&&kind!=="source-text")firstRowUnverified++;
    }
    if(incomplete)incompleteRows++;
  }
  return {rowCount:rows.length,columnCount:cols,
    missingSourcePositions:missing,explicitlyEmptySourceCells:empty,
    firstRowUnverifiedPositions:firstRowUnverified,incompleteRows};
}
/** A text-position based scientific grid requires explicit selection and review. */
export function isScientificReviewOnlyTable(table:LogicalTable):boolean{
  return table.rows.some(row=>{
    const id=row.provenance?.blockId??"";
    return id.startsWith("native-compact-grid-")||
      id.startsWith("native-rotated-invoice-grid-")||
      id.startsWith("native-usda-panel-")||
      id.startsWith("native-fbi-nics-grid-")||
      id.startsWith("native-nrel-fuel-savings-")||
      id.startsWith("native-captioned-text-grid-")||
      id.startsWith("native-caption-header-grid-")||
      id.startsWith("native-captioned-short-numeric-");
  });
}
