import { loadPdfJs } from "../pdf-engine-v4/reader/pdfJsLoader";
import type { PdfXlsxInput } from "./pdfToXlsx";

/**
 * A deliberately narrow native-PDF fallback for repeated 8-column tables.
 * This does not use OCR or alter the shared V4 PDF analysis engine.
 * It does not split cells on whitespace: independent positional anchors must
 * be proved by the PDF's first-page numbered column guide (1..8).
 */
export type NativeTextToken = {
  text: string;
  x: number;
  right: number;
  y: number;
};
export type NativePositionPage = {
  pageNumber: number;
  tokens: NativeTextToken[];
};
type Row = { page: number; serial: number; id: number; fields: string[] };

const MAX_PAGES = 12;
const MAX_RECORDS = 2000;
const COLUMN_COUNT = 8;
const Y_TOLERANCE = 2.8;

function groupedRows(tokens: readonly NativeTextToken[]): NativeTextToken[][] {
  const rows: NativeTextToken[][] = [];
  for (const token of [...tokens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!token.text.trim() || !Number.isFinite(token.x) ||
      !Number.isFinite(token.right) || token.right <= token.x ||
      !Number.isFinite(token.y)) continue;
    const matched = rows.find(row => Math.abs(row[0].y - token.y) <= Y_TOLERANCE);
    if (matched) matched.push(token);
    else rows.push([token]);
  }
  return rows.map(row => row.sort((a, b) => a.x - b.x));
}

function numberedGuide(rows: readonly NativeTextToken[][]): number[] | null {
  const candidates: number[][] = [];
  for (const row of rows) {
    const numeric = row.filter(t => /^[1-8]$/.test(t.text));
    if (numeric.length !== 8 || row.length !== 8) continue;
    const numbers = numeric.map(t => Number(t.text));
    if (numbers.some((n, i) => n !== i + 1)) continue;
    const centers = numeric.map(t => (t.x + t.right) / 2);
    if (centers.some((x, i) => i > 0 &&
      (x - centers[i - 1] < 28 || x - centers[i - 1] > 180))) continue;
    if (centers[7] - centers[0] < 350) continue;
    candidates.push(centers);
  }
  // More than one plausible guide is ambiguous: refuse rather than guess.
  return candidates.length === 1 ? candidates[0] : null;
}


/**
 * Source labels may be left-aligned within uneven-width columns while the
 * printed 1..8 guide is centered. Where a distinct "Block" heading ends and
 * the following "Name" (group/GP) heading begins, use the actual visible gap
 * instead of assuming the numeric header midpoint is the cell boundary.
 * No user-specific coordinates, names or templates are embedded here.
 */
function sourceColumnBorders(
  pageTokens: readonly NativeTextToken[],
  centers: readonly number[],
): number[] {
  const borders=centers.slice(0,-1).map((v,i)=>(v+centers[i+1])/2);
  const blocks=pageTokens.filter(t=>
    /^Block$/i.test(t.text) &&
    t.x>centers[1] && t.x<centers[2]+24);
  if(blocks.length!==1)return borders;
  const block=blocks[0];
  const names=pageTokens.filter(t=>
    /^(Name|Group|GP\/VC)$/i.test(t.text) &&
    t.x>block.right+4 && t.x<centers[3] &&
    t.x-block.right<65).sort((a,b)=>a.x-b.x);
  // A multi-word heading such as "Name of GP/VC" yields both Name and
  // GP/VC tokens. The leftmost *distinctly separated* label defines where
  // the next column begins; rejecting both would fall back to the midpoint
  // and misplace short left-aligned values in narrow source columns.
  if(names.length===0 ||
    (names.length>1 && names[1].x-names[0].x<18))return borders;
  const proposed=(block.right+names[0].x)/2;
  if(proposed<=centers[2]+8 || proposed>=centers[3]-15)return borders;
  borders[2]=proposed;
  return borders;
}

/**
 * Only attach meaningful headings when each of the eight field categories
 * is independently attested by first-page text ABOVE the numbered guide.
 * This is a conservative, abbreviated label set, not a transcription of
 * visually merged multi-line source headings.
 */
function sourceSupportedHeadings(
  originalTokens: readonly NativeTextToken[],
  grouped: readonly NativeTextToken[][],
  centers: readonly number[],
): string[] | null {
  const guides = grouped.filter(row =>
    row.length === 8 && row.every((t, i) => t.text === String(i + 1)));
  if (guides.length !== 1) return null;
  const guideY = guides[0][0].y;
  const header = originalTokens.filter(t =>
    t.y > guideY + 4 && t.y < guideY + 140);
  const has = (col: number, name: RegExp, radius: number) =>
    header.some(t => name.test(t.text) &&
      Math.abs(t.x - centers[col]) <= radius);
  const verified = [
    has(0, /^Sl$/i, 25) && has(0, /^No\\.?$/i, 25),
    has(1, /^District$/i, 35),
    has(2, /^Block$/i, 35),
    has(3, /^GP\\/VC$/i, 50),
    has(4, /^Habitation$/i, 65) && has(4, /^Name$/i, 65),
    has(5, /^households?$/i, 50),
    has(6, /^FHTC$/i, 45),
    has(7, /^PVTG$/i, 50),
  ];
  if (!verified.every(Boolean)) return null;
  return [
    "Sl No", "District", "Block", "GP/VC (IMIS)",
    "Habitation Name", "Households (IMIS)",
    "FHTCs Provided (IMIS)", "PVTG (Y/N)",
  ];
}

function distribute(row: readonly NativeTextToken[], borders: readonly number[]) {
  const cells: NativeTextToken[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  for (const token of row) {
    const center = (token.x + token.right) / 2;
    const col = borders.findIndex(border => center < border);
    const index = col < 0 ? COLUMN_COUNT - 1 : col;
    const left = index ? borders[index - 1] : -Infinity;
    const right = index < borders.length ? borders[index] : Infinity;
    // A word may touch a guide boundary, but must not be mostly in the
    // adjacent column. A borderline glyph never triggers forced placement.
    const overlapLeft = Math.max(0, Math.min(token.right, left) - token.x);
    const overlapRight = Math.max(0, token.right - Math.max(token.x, right));
    const outside = overlapLeft + overlapRight;
    if (outside > (token.right - token.x) * 0.40) return null;
    cells[index].push(token);
  }
  return cells.map(parts => parts
    .sort((a, b) => a.x - b.x).map(t => t.text).join(" ").trim());
}

export function recoverEightColumnRowsFromNativePositions(
  pages: readonly NativePositionPage[],
): PdfXlsxInput | null {
  if (pages.length < 2 || pages.length > MAX_PAGES ||
      pages.some((p, i) => p.pageNumber !== i + 1)) return null;
  const perPage = pages.map(p => groupedRows(p.tokens));
  const centers = numberedGuide(perPage[0]);
  if (!centers) return null;
  const verifiedHeadings = sourceSupportedHeadings(pages[0].tokens, perPage[0], centers);
  const borders = sourceColumnBorders(pages[0].tokens, centers);
  const records: Row[] = [];

  for (let p = 0; p < pages.length; p++) {
    let sawRecord = false;
    let recordsOnPage = 0;
    for (const nativeRow of perPage[p]) {
      // The multi-line source headings may span/overlap grid boundaries.
      // Detect a row counter + independent identifier before geometric
      // classification, so these headings do not trigger false errors.
      const leftTokens = nativeRow.filter(token =>
        (token.x + token.right) / 2 < (centers[0] + centers[1]) / 2);
      const recordCandidate = leftTokens.length === 2 &&
        /^\d{1,4}$/.test(leftTokens[0].text) &&
        /^\d{3,8}$/.test(leftTokens[1].text);
      if (!recordCandidate) {
        if (sawRecord) return null;
        continue;
      }
      const fields = distribute(nativeRow, borders);
      if (!fields) return null;
      const first = fields[0].match(/^(\d{1,4})\s+(\d{3,8})$/);
      if (!first) return null;
      const serial = Number(first[1]), id = Number(first[2]);
      if (fields.slice(1, 7).some(cell => !cell) ||
          !/^\d+$/.test(fields[5]) || !/^\d+$/.test(fields[6]) ||
          !/^(Y|N)?$/.test(fields[7]) ||
          serial !== records.length + 1 ||
          (records.length && id !== records[records.length - 1].id + 1)) {
        return null;
      }
      sawRecord = true;
      recordsOnPage++;
      records.push({page:p+1, serial, id, fields:[first[2], ...fields.slice(1)]});
      if (records.length > MAX_RECORDS) return null;
    }
    // A real continuation needs sufficient independently confirmed rows;
    // a suspiciously short or unaccounted page is not exportable.
    if (recordsOnPage < 8) return null;
  }

  if (records.length < 20 ||
      records.some(r => r.fields.length !== COLUMN_COUNT)) return null;
  return {
    tables:[{
      name:"Table 1",
      rows:[
        verifiedHeadings ?? Array.from({length:COLUMN_COUNT},(_,i)=>"Column "+(i+1)),
        ...records.map(r=>r.fields),
      ],
      // The parser verified that fields 6 and 7 are digit-only native
      // household/connection metrics. All other fields, especially the
      // identifier, must remain literal text (including leading zeros).
      numericColumns:[5,6],
      freezeHeader:true,
      columnWidths:[16,22,22,28,34,22,23,18],
    }],
    reviewNotes:[
      "EXTRACTION NOT VERIFIED: eight data columns were reconstructed from the PDF's numbered 1–8 source guide and native text positions. Verify all records against the source.",
      verifiedHeadings
        ? "Abbreviated column labels were recognized from all eight categories in the source header; verify full wording, dates and units against the original PDF."
        : "Original multi-line headings could not all be confirmed; Column 1–8 are review-required placeholders, not verified source labels.",
      "The separate printed row counter was excluded. Identifiers, names, and flags remain literal text; canonical safe household/connection counts export as Excel integers. Padded and unsafe numeric values remain text.",
      "Sequential source records across pages 1–"+pages.length+" were independently checked before export; the source must still be inspected.",
      "Scanned, unnumbered, incomplete and geometrically ambiguous layouts are not supported by this fallback.",
    ],
  };
}

type PdfJsNativeItem = {
  str:string;
  transform:number[];
  width:number;
  fontName?:string;
};
function isTextItem(raw:unknown): raw is PdfJsNativeItem {
  if (!raw || typeof raw !== "object") return false;
  const x=raw as Partial<PdfJsNativeItem>;
  return typeof x.str==="string" && Array.isArray(x.transform) &&
    x.transform.length>=6 && typeof x.width==="number" && x.width>0;
}

function tokenizeNativeItems(
  items: readonly unknown[],
  styles: Record<string,{fontFamily?:string}>,
  context: CanvasRenderingContext2D,
): NativeTextToken[] | null {
  const tokens: NativeTextToken[] = [];
  for (const raw of items) {
    if (!isTextItem(raw) || !raw.str.trim()) continue;
    const x=raw.transform[4],y=raw.transform[5];
    const size=Math.hypot(raw.transform[0],raw.transform[1]);
    if (!Number.isFinite(x)||!Number.isFinite(y)||
        !Number.isFinite(size)||size<4||
        !Number.isFinite(raw.width)||raw.width<=0) return null;
    const family=raw.fontName ? styles[raw.fontName]?.fontFamily : undefined;
    context.font=size+"px "+(family || "sans-serif");
    const total=context.measureText(raw.str).width;
    if (!Number.isFinite(total)||total<=0) return null;
    const scale=raw.width/total;
    // Canvas is used only to interpolate *within* the native PDF text item.
    // Large font metric disagreements cannot safely infer token positions.
    if (scale<0.40||scale>2.5) return null;
    for (const match of raw.str.matchAll(/\S+/gu)) {
      const start=match.index??0,end=start+match[0].length;
      const left=x+context.measureText(raw.str.slice(0,start)).width*scale;
      const right=x+context.measureText(raw.str.slice(0,end)).width*scale;
      if (right-left<0.5) return null;
      tokens.push({text:match[0],x:left,right,y});
    }
  }
  return tokens;
}

/** Process an existing user-selected file *only inside their browser*. */
export async function recoverEightColumnNativePdf(
  file:File,
):Promise<PdfXlsxInput|null> {
  if (typeof window==="undefined"||typeof document==="undefined") return null;
  const canvas=document.createElement("canvas");
  const context=canvas.getContext("2d");
  if (!context) return null;
  const pdfjs=await loadPdfJs();
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
  const pages:NativePositionPage[]=[];
  try {
    const doc=await task.promise;
    if (doc.numPages<2||doc.numPages>MAX_PAGES) return null;
    for (let pageNumber=1;pageNumber<=doc.numPages;pageNumber++) {
      const page=await doc.getPage(pageNumber);
      const text=await page.getTextContent();
      const styles=text.styles as Record<string,{fontFamily?:string}>;
      const tokens=tokenizeNativeItems(text.items,styles,context);
      if (!tokens || tokens.length<30) return null;
      pages.push({pageNumber,tokens});
      page.cleanup();
    }
    return recoverEightColumnRowsFromNativePositions(pages);
  } finally {
    await task.destroy();
  }
}
