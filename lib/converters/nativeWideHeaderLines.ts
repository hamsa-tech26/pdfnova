import type {LogicalTable} from "../pdf-engine-v4/model/logicalTable";

/**
 * R103: repair a real ambiguity in source-native wide-table extraction:
 * V4 combines multiple PDF header baselines into one logical row and loses
 * physical line breaks. Restore ONLY those line breaks, in the same column,
 * with the same ordered word text. Never synthesize words or parent labels,
 * join unrelated cells, change body values or hide failed source evidence.
 */
export function preserveNativeWideHeaderLines(
  table:LogicalTable,
  rows:string[][],
):{rows:string[][];headerWrapped:boolean;wrappedCells:number}{
  const first=table.rows[0];
  if(table.columnCount!==11 || table.rows.length<11 ||
    !first?.provenance?.blockId?.startsWith("dense-native-eleven-grid-") ||
    !Array.isArray(rows[0]) || rows[0].length!==11)return {
      rows,headerWrapped:false,wrappedCells:0,
    };
  const result=[...rows[0]];
  let wrappedCells=0;
  for(const cell of first.cells){
    if(!Number.isInteger(cell.columnIndex)||cell.columnIndex<0||
      cell.columnIndex>=11||!Array.isArray(cell.words)||
      cell.words.length<2 || !cell.text.trim())continue;
    if(cell.extractionProvenance?.source!=="native-pdf"||
      cell.words.some(word=>word.extractionProvenance?.source!=="native-pdf"||
        !Number.isFinite(word.bounds?.y)||!Number.isFinite(word.bounds?.x)||
        !Number.isFinite(word.bounds?.height)||word.bounds.height<=0))continue;
    // The exact existing cell value must consist ONLY of this cell's words.
    // If other reconstruction (Greek glyph, inferred punctuation, etc.) has
    // already changed it, do not overwrite that verified/reviewable text.
    const words=cell.words;
    const flat=words.map(word=>word.text).join(" ");
    const old=String(rows[0][cell.columnIndex]??"");
    // Only replace the exact joining spaces at physical line boundaries.
    // Compatibility normalization (e.g. ㎎/mg, Ω/Ω) or whitespace folding
    // cannot authorize overwriting an already distinct source-cell value.
    if(flat!==old)continue;
    const heights=words.map(word=>word.bounds.height);
    const typical=Math.max(2,Math.min(7,
      [...heights].sort((a,b)=>a-b)[Math.floor(heights.length/2)]*0.48));
    const segments:string[]=[];
    let current=words[0].text;
    let lineY=words[0].bounds.y;
    let meaningfulBreaks=0;
    let valid=true;
    for(let i=1;i<words.length;i++){
      const word=words[i];
      const delta=Math.abs(lineY-word.bounds.y);
      if(delta>typical){
        // A real PDF header has orderly descending physical baselines; a
        // reversal, huge gap or inconsistent text order is not safe to reflow.
        if(word.bounds.y>=lineY || delta>34){valid=false;break;}
        segments.push(current);current=word.text;
        meaningfulBreaks++;lineY=word.bounds.y;
      }else current+=" "+word.text;
    }
    if(!valid||meaningfulBreaks===0)continue;
    segments.push(current);
    const multiline=segments.join("\n");
    result[cell.columnIndex]=multiline;
    wrappedCells++;
  }
  if(!wrappedCells)return {rows,headerWrapped:false,wrappedCells:0};
  return {rows:[result,...rows.slice(1)],headerWrapped:true,wrappedCells};
}
