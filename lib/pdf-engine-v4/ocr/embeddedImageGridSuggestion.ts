import type {PdfV4OcrWord} from "./ocrRecognizer";

/** R125–126: geometric OCR table PROPOSAL only.
 * This is not an accepted table detector, cell accuracy claim or export input.
 * No auto-approval and no writes to the native PDF table extraction model.
 */
export type ImageGridProposal={
  status:"PROPOSED_FOR_MANUAL_REVIEW"|"INSUFFICIENT_EVIDENCE";
  rows:string[][];
  tsv:string;
  sourceWordCount:number;
  reason:string;
};
const refuse=(reason:string,sourceWordCount=0):ImageGridProposal=>({
  status:"INSUFFICIENT_EVIDENCE",rows:[],tsv:"",reason,sourceWordCount,
});
type W={text:string;x:number;y:number;width:number;height:number;confidence:number};
const median=(values:number[])=>{
  const v=[...values].sort((a,b)=>a-b);
  return v.length?v[Math.floor(v.length/2)]:0;
};
export function suggestEmbeddedImageGrid(
  words:readonly PdfV4OcrWord[],
  renderedWidth:number,
  renderedHeight:number,
):ImageGridProposal{
  if(!Array.isArray(words)||words.length<6||words.length>350||
    !Number.isFinite(renderedWidth)||!Number.isFinite(renderedHeight)||
    renderedWidth<1||renderedHeight<1)
    return refuse("Not enough bounded OCR geometry for a reliable tabular proposal.");
  const valid:W[]=words.flatMap(item=>{
    const b=item.bounds;
    if(!b||!item.text||item.text.length>80||item.confidence<40||
      [b.x0,b.y0,b.x1,b.y1,item.confidence].some(n=>!Number.isFinite(n))||
      b.x1<=b.x0||b.y1<=b.y0||
      b.x0<0||b.y0<0||b.x1>renderedWidth||b.y1>renderedHeight)
      return [];
    const text=item.text.trim();
    return text?[{text,x:b.x0,y:(b.y0+b.y1)/2,
      width:b.x1-b.x0,height:b.y1-b.y0,confidence:item.confidence}]:[];
  });
  if(valid.length<6)return refuse("OCR words have insufficient confidence or invalid positions.",valid.length);
  const height=median(valid.map(w=>w.height));
  if(height<3||height>renderedHeight*.2)return refuse("Text height is unstable for row grouping.",valid.length);
  const rows:W[][]=[];
  for(const word of valid.sort((a,b)=>a.y-b.y||a.x-b.x)){
    const row=rows[rows.length-1];
    if(row&&Math.abs(median(row.map(w=>w.y))-word.y)<=Math.max(6,height*.65))
      row.push(word);
    else rows.push([word]);
  }
  if(rows.length<3||rows.length>40)
    return refuse("A table proposal needs 3–40 stable text rows.",valid.length);
  const grid=rows.map(row=>{
    const sorted=row.sort((a,b)=>a.x-b.x);
    const result:{text:string;x:number;end:number}[]=[];
    for(const w of sorted){
      const prior=result[result.length-1];
      if(prior&&w.x-prior.end<=Math.max(9,height*.7)){
        prior.text+=" "+w.text;
        prior.end=Math.max(prior.end,w.x+w.width);
      }else result.push({text:w.text,x:w.x,end:w.x+w.width});
    }
    return result;
  });
  const columns=grid[0].length;
  if(columns<2||columns>6||grid.some(row=>row.length!==columns))
    return refuse("OCR rows have unequal or unsupported 2–6 column geometry.",valid.length);
  const tolerance=Math.max(10,renderedWidth*.035);
  for(let c=0;c<columns;c++){
    const starts=grid.map(row=>row[c].x);
    const anchor=median(starts);
    if(starts.some(x=>Math.abs(x-anchor)>tolerance))
      return refuse("Column starting positions are inconsistent.",valid.length);
    if(c>0){
      const other=median(grid.map(row=>row[c-1].x));
      if(anchor-other<Math.max(24,height*2))
        return refuse("Detected columns are too close to distinguish safely.",valid.length);
    }
  }
  // Reject recurring two-column article prose. A plausible numeric table
  // must have at least two distinct non-header rows with numeric evidence.
  const numericRows=grid.slice(1).filter(row=>row.some(cell=>/\d/.test(cell.text))).length;
  if(numericRows<2)return refuse("Numeric data-row evidence is insufficient; prose is not a table.",valid.length);
  const result=grid.map(row=>row.map(c=>c.text));
  const tsv=result.map(row=>row.join("\t")).join("\n");
  if(tsv.length>30000||result.some(row=>row.some(cell=>cell.length>1000)))
    return refuse("The proposed grid exceeds reviewed-cell safety limits.",valid.length);
  return {status:"PROPOSED_FOR_MANUAL_REVIEW",rows:result,tsv,
    sourceWordCount:valid.length,
    reason:"Tentative OCR row/column alignment only. Compare every proposed cell with the PDF image, edit errors and explicitly approve before Excel export."};
}
