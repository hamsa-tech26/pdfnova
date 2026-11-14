import type {PdfLine,PdfParagraphBlock,PdfVisualBlock,PdfWord} from "../model/types";
import type {LogicalTable} from "../model/logicalTable";

/**
 * Recover small, separately captioned four-column native PDF grids whose
 * physical rows were emitted as separate visual blocks. The ordinary table
 * scorer intentionally does not certify a five-line region on numeric and
 * density evidence alone. This path requires a published caption, a native
 * header and independently repeated cell anchors; it never guesses cells.
 *
 * Numeric columns are often right-aligned, so compare their *right edges*
 * rather than their starts. The first and last columns use left anchors.
 */
const NUMBER=/^[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/u;
const CAPTION=/^table\s+(?:[a-z]|\d{1,3})\s*[-–—:.]\s*\S/i;
const MIN_ROWS=5; // header + at least four physical data rows
const MAX_ROWS=24;
const FIRST_LEFT_TOLERANCE=8;
const LAST_LEFT_TOLERANCE=8;
const NUMERIC_RIGHT_TOLERANCE=12;

export type CaptionedFourColumnGrid={
  block:PdfParagraphBlock;
  sourceRows:PdfVisualBlock[];
};

function onlyLine(block:PdfVisualBlock):PdfLine|null{
  if((block.type!=="heading"&&block.type!=="paragraph")||block.lines.length!==1)
    return null;
  return block.lines[0]??null;
}

function nativeCells(line:PdfLine):PdfWord[]|null{
  if(line.words.length!==4)return null;
  if(line.words.some(word=>word.extractionProvenance?.source!=="native-pdf"||
    !Number.isFinite(word.bounds.x)||!Number.isFinite(word.bounds.y)||
    !Number.isFinite(word.bounds.width)||word.bounds.width<=0||
    !word.text.trim()||word.text.length>55))return null;
  const cells=[...line.words].sort((a,b)=>a.bounds.x-b.bounds.x);
  if(cells.slice(1).some((cell,index)=>cell.bounds.x-cells[index].bounds.x<20))
    return null;
  return cells;
}

function isHeader(cells:PdfWord[]):boolean{
  return cells.filter(c=>/[A-Za-z]/.test(c.text)).length>=3 &&
    cells.every(c=>c.text.trim().length<=32) &&
    !NUMBER.test(cells[1].text.trim())&&!NUMBER.test(cells[2].text.trim());
}

function rowsMatch(
  header:PdfWord[], rows:{line:PdfLine;cells:PdfWord[]}[],
):boolean{
  if(rows.length<MIN_ROWS-1)return false;
  const baseline=rows[0]?.cells;
  if(!baseline)return false;
  const right=(word:PdfWord)=>word.bounds.x+word.bounds.width;
  const numericRows=rows.filter(({cells})=>
    NUMBER.test(cells[1].text.trim())&&NUMBER.test(cells[2].text.trim()));
  if(numericRows.length<3)return false;
  if(rows.some(({cells})=>
    Math.abs(cells[0].bounds.x-header[0].bounds.x)>FIRST_LEFT_TOLERANCE||
    Math.abs(cells[3].bounds.x-header[3].bounds.x)>LAST_LEFT_TOLERANCE||
    Math.abs(cells[0].bounds.x-baseline[0].bounds.x)>FIRST_LEFT_TOLERANCE||
    Math.abs(cells[3].bounds.x-baseline[3].bounds.x)>LAST_LEFT_TOLERANCE))
    return false;
  if(numericRows.some(({cells})=>
    Math.abs(right(cells[1])-right(baseline[1]))>NUMERIC_RIGHT_TOLERANCE||
    Math.abs(right(cells[2])-right(baseline[2]))>NUMERIC_RIGHT_TOLERANCE))
    return false;
  // Separate physical columns must not cross or overlap even if the text is
  // numerically plausible. This excludes tabular-looking paragraph fragments.
  return rows.every(({cells})=>cells.slice(1).every((word,index)=>
    cells[index].bounds.x+cells[index].bounds.width<=word.bounds.x+2));
}

export function findCaptionedNativeFourColumnGrids(
  blocks:readonly PdfVisualBlock[],
):CaptionedFourColumnGrid[]{
  const found:CaptionedFourColumnGrid[]=[];
  for(let index=0;index<blocks.length;index++){
    const captionBlock=blocks[index];
    const captionLine=onlyLine(captionBlock);
    if(!captionLine||!CAPTION.test(captionLine.text.trim())||
      captionLine.words.some(word=>word.extractionProvenance?.source!=="native-pdf"))
      continue;
    const headerBlock=blocks[index+1];
    const headerLine=headerBlock&&onlyLine(headerBlock);
    const headerCells=headerLine&&nativeCells(headerLine);
    if(!headerLine||!headerCells||!isHeader(headerCells)||
      captionBlock.pageNumber!==headerBlock.pageNumber)continue;
    const captionGap=captionLine.bounds.y-(headerLine.bounds.y+headerLine.bounds.height);
    if(captionGap<0||captionGap>48)continue;

    const rows:{line:PdfLine;cells:PdfWord[];block:PdfVisualBlock}[]=[];
    let previousLine=headerLine;
    for(let cursor=index+2;cursor<blocks.length&&rows.length<MAX_ROWS-1;cursor++){
      const block=blocks[cursor];
      const line=onlyLine(block);
      const cells=line&&nativeCells(line);
      if(!line||!cells||block.pageNumber!==captionBlock.pageNumber)break;
      const validValue=NUMBER.test(cells[1].text.trim())&&
        (NUMBER.test(cells[2].text.trim())||
          (/^(?:TOTAL|SUBTOTAL)$/i.test(cells[0].text.trim())&&
            cells[2].text.trim()==="-"));
      if(!validValue)break;
      const step=(previousLine.bounds.y+previousLine.bounds.height/2)-
        (line.bounds.y+line.bounds.height/2);
      if(step<12||step>42)break;
      rows.push({line,cells,block});
      previousLine=line;
    }
    if(!rowsMatch(headerCells,rows))continue;
    const sourceRows=[headerBlock,...rows.map(row=>row.block)];
    const lines=[headerLine,...rows.map(row=>row.line)];
    const words=lines.flatMap(line=>line.words);
    const minX=Math.min(...words.map(word=>word.bounds.x));
    const minY=Math.min(...words.map(word=>word.bounds.y));
    const maxX=Math.max(...words.map(word=>word.bounds.x+word.bounds.width));
    const maxY=Math.max(...words.map(word=>word.bounds.y+word.bounds.height));
    found.push({
      sourceRows,
      block:{
        id:`captioned-native-four-grid-${captionBlock.pageNumber}-${captionBlock.id}`,
        type:"paragraph",pageNumber:captionBlock.pageNumber,
        bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},
        lines,text:lines.map(line=>line.text).join(" "),
        confidence:Math.min(...sourceRows.map(block=>block.confidence)),
      },
    });
    index+=sourceRows.length;
  }
  return found;
}

/**
 * Right-aligned numeric data can move a column's detected start farther right
 * than its left-aligned header. Only repair the header of a source-backed
 * four-column grid when the builder retained *all four exact header words*.
 * Never synthesize, discard or relabel a source word to fit an expected cell.
 */
export function restoreCaptionedFourColumnHeader(
  table:LogicalTable,region:PdfVisualBlock,
):LogicalTable{
  if(!region.id.startsWith("captioned-native-four-grid-")||
    region.type!=="paragraph"||table.columnCount!==4||
    !table.rows[0]||table.rows[0].cells.length!==4)return table;
  const source=region.lines[0]&&nativeCells(region.lines[0]);
  const header=table.rows[0];
  if(!source||!header)return table;
  const assigned=header.cells.flatMap(cell=>cell.words);
  if(assigned.length!==source.length||
    new Set(assigned.map(word=>word.id)).size!==source.length||
    source.some(word=>!assigned.some(actual=>actual.id===word.id)))return table;
  const cells=header.cells.map((cell,index)=>{
    const word=source[index];
    return {...cell,text:word.text,words:[word],bounds:word.bounds,
      originalNativeText:word.text,
      extractionProvenance:{source:"native-pdf" as const,wordCount:1,
        nativeWordCount:1,ocrWordCount:0,unknownWordCount:0,
        pageNumbers:[word.pageNumber]},
    };
  });
  return {...table,rows:[{...header,cells},...table.rows.slice(1)]};
}
