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
  // The selection layer recognizes either a table ID or its row provenance.
  // The unattended export and UI-acknowledgement gates must classify exactly
  // the same source-bounded table even if one source marker is unavailable.
  const prefixes=[
    "native-compact-grid-","native-rotated-invoice-grid-",
    "native-usda-panel-","native-fbi-nics-grid-",
    "native-nrel-fuel-savings-","native-captioned-text-grid-",
    "native-caption-header-grid-","native-captioned-short-numeric-",
  ];
  return prefixes.some(prefix=>table.id.startsWith(prefix)||
    table.rows.some(row=>row.provenance?.blockId?.startsWith(prefix)));
}
