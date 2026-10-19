import type {PdfXlsxInput} from "./pdfToXlsx";
import type {EmbeddedImageOcrReview} from "../pdf-engine-v4/ocr/embeddedImageReviewOcr";

/**
 * R123: manual review boundary for OCR imagery.
 * NEVER convert a Tesseract transcript to cells automatically.
 * Users must actively enter/review a tab-separated grid and confirm it.
 */
export type ReviewedImageTableInput={
  review:EmbeddedImageOcrReview;
  tsv:string;
  confirmed:boolean;
  documentPageCount:number;
};
export function parseUserReviewedImageGrid(tsv:string):string[][]{
  if(typeof tsv!=="string"||tsv.length>30000)
    throw Error("Reviewed table exceeds the 30,000-character limit.");
  // Preserve edge empty cells: .trim() would erase a leading or trailing tab.
  const lines=tsv.replace(/\r\n?/g,"\n").replace(/^[ \n]+|[ \n]+$/g,"").split("\n");
  if(lines.length<2||lines.length>100)
    throw Error("Enter 2–100 tab-separated rows, including headings.");
  if(lines.some(line=>line.length===0))
    throw Error("Blank rows cannot be silently omitted.");
  const rows=lines.map(line=>line.split("\t").map(cell=>cell.trim()));
  const cols=rows[0]?.length??0;
  if(cols<2||cols>20||rows.some(row=>row.length!==cols))
    throw Error("Every reviewed row must have the same 2–20 tab-separated columns.");
  if(rows.some(row=>row.some(cell=>cell.length>1000)))
    throw Error("One reviewed cell exceeds the 1,000-character limit.");
  if(rows[0].some(cell=>!cell))
    throw Error("Enter a nonempty heading for every reviewed column.");
  if(rows.slice(1).some(row=>row.every(cell=>!cell)))
    throw Error("Empty reviewed data rows are not allowed.");
  return rows;
}
/**
 * R129: user-initiated correction of one explicitly reviewed OCR cell.
 * Rebuild and revalidate the entire table, never alter native PDF tables.
 * The caller MUST invalidate any previous preview and confirmation.
 */
export function updateUserReviewedImageCell(
  tsv:string,rowIndex:number,columnIndex:number,newValue:string,
):string{
  const rows=parseUserReviewedImageGrid(tsv);
  if(!Number.isSafeInteger(rowIndex)||rowIndex<0||rowIndex>=rows.length||
    !Number.isSafeInteger(columnIndex)||columnIndex<0||columnIndex>=rows[0].length)
    throw Error("Choose a cell inside the reviewed image table.");
  if(typeof newValue!=="string"||newValue.length>1000||/[\t\r\n]/.test(newValue))
    throw Error("A cell must contain at most 1,000 characters without tabs or line breaks.");
  const updated=rows.map(row=>[...row]);
  updated[rowIndex][columnIndex]=newValue.trim();
  const revisedTsv=updated.map(row=>row.join("\t")).join("\n");
  // This rejects erased column headings, empty data rows, or malformed grids.
  parseUserReviewedImageGrid(revisedTsv);
  return revisedTsv;
}
export function prepareUserReviewedImageXlsx(input:ReviewedImageTableInput):PdfXlsxInput{
  if(!input.confirmed)
    throw Error("Confirm that you checked the image and every edited table cell before exporting.");
  const {review,documentPageCount}=input;
  if(!Number.isInteger(documentPageCount)||documentPageCount<1||documentPageCount>25||
    !Number.isInteger(review.pageNumber)||review.pageNumber<1||
    review.pageNumber>documentPageCount||
    review.status!=="TEXT_REVIEW_ONLY"||
    !Number.isFinite(review.confidence)||review.confidence<45||
    review.wordCount<2||
    !review.sourceBounds||Object.values(review.sourceBounds).some(
      n=>typeof n!=="number"||!Number.isFinite(n))||
    review.sourceBounds.width<=0||review.sourceBounds.height<=0)
    throw Error("No suitable source image OCR review is available for export.");
  const rows=parseUserReviewedImageGrid(input.tsv);
  const {x,y,width,height}=review.sourceBounds;
  return {
    tables:[{name:"User-Reviewed Image Table",rows}],
    reviewNotes:[
      "USER-REVIEWED IMAGE OCR — not an automated PDF table detection.",
      "The person exporting explicitly reviewed and edited the displayed tab-separated cell matrix.",
      "SOURCE: PDF page "+review.pageNumber+" of "+documentPageCount+
        "; image bounds (PDF points): x="+x.toFixed(1)+", y="+y.toFixed(1)+
        ", width="+width.toFixed(1)+", height="+height.toFixed(1)+".",
      "Tesseract source-review confidence "+Math.round(review.confidence)+
        "%; "+review.wordCount+" OCR words. These are not cell-level accuracy guarantees.",
      "Values, column assignments and headings come from user-reviewed input. "+
        "No OCR words were inserted into source-native logical tables.",
      "Formula-like content and identifiers are stored as literal text. "+
        "Check the exported worksheet against the source image.",
    ],
  };
}
