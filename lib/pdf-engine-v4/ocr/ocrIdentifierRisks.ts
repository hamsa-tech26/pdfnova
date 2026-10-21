/**
 * R161: identify visually confusable exact-identifier characters without
 * guessing a correction. Only local document text is inspected. Returned
 * evidence contains positions, not identifier values, and is never telemetry.
 */
export type OcrIdentifierRisk={
  label:string;
  lineNumber:number;
  ambiguousCharacterCount:number;
  requiresSourceCheck:true;
};
const label=/\b(record\s+(?:id|number|code)|invoice\s+(?:id|number)|application\s+(?:id|number)|serial\s+(?:id|number)|reference\s*(?:id|number|code)?|facility\s+(?:id|number|code)|package\s+(?:id|number|code))\s*:\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/gi;
const confusable=/[0O1Il7T5S8B]/g;
/**
 * A mixed alpha+numeric ID is often legitimate, but OCR confusions are
 * dangerous for exact IDs. Flag a maximum of 8 ambiguous values per page.
 * No substitution (such as T -> 7) is justified from shape alone.
 */
export function inspectOcrIdentifierRisks(text:string):OcrIdentifierRisk[]{
  if(typeof text!=="string"||text.length>250000)return [];
  const result:OcrIdentifierRisk[]=[];
  const lines=text.split(/\r?\n/);
  if(lines.length>3000)return [];
  for(let i=0;i<lines.length&&result.length<8;i++){
    const line=lines[i];
    label.lastIndex=0;
    for(const match of line.matchAll(label)){
      const value=match[2];
      if(!/[A-Za-z]/.test(value)||!/[0-9]/.test(value))continue;
      const ambiguousCharacterCount=[...value.matchAll(confusable)].length;
      if(ambiguousCharacterCount===0)continue;
      result.push({label:match[1].replace(/\s+/g," ").toLowerCase(),
        lineNumber:i+1,ambiguousCharacterCount,requiresSourceCheck:true});
      if(result.length===8)break;
    }
  }
  return result;
}
