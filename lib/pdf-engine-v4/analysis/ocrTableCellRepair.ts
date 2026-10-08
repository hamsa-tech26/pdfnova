import type { LogicalCell, LogicalRow, LogicalTable } from "../model/logicalTable";
import type { PdfWord } from "../model/types";

/** Reviewable, post-structure OCR debris repair.
 * Never infers unseen words or changes native-PDF text.
 * Original cell text and source words are retained for traceability.
 */
const confidence=(w:PdfWord)=>w.extractionProvenance?.confidence ?? 100;
const isOcr=(w:PdfWord)=>w.extractionProvenance?.source==="ocr-tesseract";
const isDebris=(w:PdfWord)=>{
 if(!isOcr(w)||confidence(w)>35)return false;
 const t=w.text.trim();
 return /[—―─]{2,}/u.test(t) || /^[|│_–=.]+$/u.test(t) ||
   /^(?:ES|EE|I|a)$/u.test(t);
};
function withAdjustedText(cell:LogicalCell, next:string,reason:string):LogicalCell {
 if(!next || next===cell.text)return cell;
 return {...cell,text:next,confidence:Math.min(cell.confidence,0.55),
   originalOcrText:cell.originalOcrText ?? cell.text,
   ocrAdjustmentReasons:[...(cell.ocrAdjustmentReasons ?? []),reason]};
}
const serialValue=(cell:LogicalCell|undefined)=>{
 const text=cell?.text.trim() ?? "";
 return /^\d{1,3}$/u.test(text)?Number(text):null;
};
const serialCell=(row:LogicalRow)=>row.cells.find(c=>c.columnIndex===0);
const wordsText=(words:readonly PdfWord[])=>words.map(w=>w.text.trim()).filter(Boolean).join(" ");

export function repairPdfV4TableOcrCells(table:LogicalTable):LogicalTable {
 // Do not infer that any arbitrary table contains sequential serial numbers.
 if(table.columnCount<5 || table.rows.length<7)return table;
 const withSerials=table.rows.filter(row=>{
  const cell=serialCell(row);
  return cell && serialValue(cell)!==null && cell.words.some(w=>isOcr(w)&&confidence(w)>=70);
 });
 if(withSerials.length<4 || withSerials.length<table.rows.length*0.45)return table;
 let changed=false;
 const rows=table.rows.map((row)=>{
  const cells=row.cells.map(cell=>{
   if(!cell.words.some(isOcr))return cell;
   const confidentSerial=cell.columnIndex===0 && cell.words.some(w=>
     isOcr(w) && confidence(w)>=70 && /^\d{1,3}$/u.test(w.text.trim()));
   const filtered=cell.words.filter(w=>
     !isDebris(w) &&
     !(confidentSerial && isOcr(w) && w.text.trim()==="!" && confidence(w)<70));
   if(filtered.length===cell.words.length || filtered.length===0)return cell;
   const cleaned=wordsText(filtered);
   const next=withAdjustedText(cell,cleaned,"Removed low-confidence line/border OCR artifact; original text and words retained.");
   if(next!==cell)changed=true;
   return next;
  });
  return {...row,cells};
 });
 // Repair only a low-confidence leading grid stroke that is already
 // corroborated by two adjacent high-confidence source serials.
 for(let index=1;index<rows.length-1;index++){
  const current=serialCell(rows[index]),prev=serialCell(rows[index-1]),next=serialCell(rows[index+1]);
  if(!current || !prev || !next)continue;
  const raw=current.text.trim();
  const prevNumber=serialValue(prev),nextNumber=serialValue(next);
  if(prevNumber===null ||nextNumber===null ||!/^1\d{1,2}$/u.test(raw))continue;
  const remainder=Number(raw.slice(1));
  if(prevNumber+1!==remainder ||remainder+1!==nextNumber)continue;
  const c=current.words.find(w=>w.text.trim()===raw);
  const p=prev.words.find(w=>w.text.trim()===String(prevNumber));
  const n=next.words.find(w=>w.text.trim()===String(nextNumber));
  if(!c || !p || !n || !isOcr(c) || confidence(c)>55 ||
     !isOcr(p) || !isOcr(n) || confidence(p)<70 || confidence(n)<70 ||
     c.bounds.x>=Math.min(p.bounds.x,n.bounds.x)-c.bounds.height*0.2)continue;
  const fixed=withAdjustedText(current,String(remainder),"Low-confidence leading vertical-rule stroke excluded; adjacent source serials corroborate remaining digits.");
  if(fixed===current)continue;
  rows[index]={...rows[index],cells:rows[index].cells.map(cell=>cell===current?fixed:cell)};
  changed=true;
 }
 if(!changed)return table;
 return {...table,rows:rows.map(row=>{
  const adjusted=row.cells.some(c=>c.ocrAdjustmentReasons?.length);
  return adjusted?{...row,confidence:Math.min(row.confidence,0.65)}:row;
 }),confidence:Math.min(table.confidence,0.75)};
}
