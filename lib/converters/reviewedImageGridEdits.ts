import {parseUserReviewedImageGrid} from "./reviewedImageTableWorkbook";

/**
 * R137–141: explicit source-checked edits to user-entered OCR review tables.
 * Never uses OCR to invent rows, column headings or empty-cell values.
 * The page must discard its old preview/approval after EVERY edit.
 */
const validIndex=(n:number,max:number)=>
  Number.isSafeInteger(n)&&n>=0&&n<max;
const normalizeUserText=(text:string,label:string)=>{
  if(typeof text!=="string"||text.length>1000||/[\t\r\n]/.test(text))
    throw Error(label+" must be a single cell of at most 1,000 characters.");
  return text.trim();
};
function serializeVerified(rows:readonly (readonly string[])[]):string{
  const tsv=rows.map(row=>row.join("\t")).join("\n");
  parseUserReviewedImageGrid(tsv);
  return tsv;
}

/** R137: insert a data row only after a person supplies its first cell. */
export function insertReviewedImageRow(
  tsv:string,afterRow:number,firstCell:string,
):string{
  const rows=parseUserReviewedImageGrid(tsv);
  if(!validIndex(afterRow,rows.length)||rows.length>=100)
    throw Error("Choose an existing row; a reviewed grid supports at most 100 rows.");
  const seed=normalizeUserText(firstCell,"First cell");
  if(!seed)throw Error("Enter the new row's first value from the source image.");
  const created=Array(rows[0].length).fill("") as string[];
  created[0]=seed;
  const result=rows.map(row=>[...row]);
  result.splice(afterRow+1,0,created);
  return serializeVerified(result);
}
/** R137: delete a data row, never the heading or sole remaining data row. */
export function removeReviewedImageRow(tsv:string,rowIndex:number):string{
  const rows=parseUserReviewedImageGrid(tsv);
  if(!validIndex(rowIndex,rows.length)||rowIndex===0||rows.length<=2)
    throw Error("Choose a data row; keep the headings and at least one data row.");
  const result=rows.map(row=>[...row]);
  result.splice(rowIndex,1);
  return serializeVerified(result);
}

/** R138: only a person can supply an additional nonempty column heading. */
export function insertReviewedImageColumn(
  tsv:string,afterColumn:number,heading:string,
):string{
  const rows=parseUserReviewedImageGrid(tsv);
  if(!validIndex(afterColumn,rows[0].length)||rows[0].length>=20)
    throw Error("Choose an existing column; a reviewed grid supports at most 20.");
  const name=normalizeUserText(heading,"Heading");
  if(!name)throw Error("Enter a heading copied from your source image.");
  const result=rows.map((row,i)=>{
    const cells=[...row];
    cells.splice(afterColumn+1,0,i===0?name:"");
    return cells;
  });
  return serializeVerified(result);
}
export function removeReviewedImageColumn(tsv:string,columnIndex:number):string{
  const rows=parseUserReviewedImageGrid(tsv);
  if(!validIndex(columnIndex,rows[0].length)||rows[0].length<=2)
    throw Error("Keep at least two reviewed columns.");
  return serializeVerified(rows.map(row=>{
    const cells=[...row];
    cells.splice(columnIndex,1);
    return cells;
  }));
}

/** R140: descriptive, non-certifying warnings (no original PDF cell access). */
export type ReviewedGridQuality={
  rows:number;
  columns:number;
  emptyDataCells:number;
  formulaLikeCells:number;
  leadingZeroCells:number;
  duplicateHeadingCount:number;
  warnings:string[];
};
export function inspectReviewedImageGrid(tsv:string):ReviewedGridQuality{
  const rows=parseUserReviewedImageGrid(tsv);
  const cells=rows.slice(1).flat();
  const emptyDataCells=cells.filter(cell=>cell==="").length;
  const formulaLikeCells=cells.filter(cell=>/^[=+\-@]/.test(cell)).length;
  const leadingZeroCells=cells.filter(cell=>/^0\d+/.test(cell)).length;
  const normalized=rows[0].map(c=>c.trim().toLocaleLowerCase());
  const duplicateHeadingCount=normalized.length-new Set(normalized).size;
  const warnings=[
    ...(emptyDataCells?[emptyDataCells+" blank data cell(s): check the source image; blanks were not filled automatically."]:[]),
    ...(duplicateHeadingCount?[duplicateHeadingCount+" repeated heading(s): verify every column title."]:[]),
    ...(formulaLikeCells?[formulaLikeCells+" formula-like value(s) will be stored as literal text, never executed."]:[]),
    ...(leadingZeroCells?[leadingZeroCells+" leading-zero value(s) will remain literal text."]:[]),
    "All table values are user-entered or user-approved, NOT certified OCR cells. Check original row groups, merges and all text.",
  ];
  return {rows:rows.length,columns:rows[0].length,emptyDataCells,
    formulaLikeCells,leadingZeroCells,duplicateHeadingCount,warnings};
}
