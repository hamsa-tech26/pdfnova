/**
 * Conservative, document-independent native PDF glyph disambiguation.
 *
 * Some PDFs encode the VISUAL Greek letters σ and ε with font-specific Latin
 * "s" and "e" glyph identifiers. Their ToUnicode mapping consequently
 * extracts the Latin letters. Infer only in tightly defined biological
 * scientific label expressions, not arbitrary prose, OCR or all PDF content.
 *
 * A repair is annotated with its original extracted text; callers must expose
 * an UNVERIFIED review warning. This is not a glyph-level authentication.
 */
export type NativeSymbolRecovery={
  text:string;
  reasons:string[];
};
export function inferNativeScientificSymbols(rawText:string):NativeSymbolRecovery{
  let text=rawText;
  const reasons:string[]=[];
  const signalOne=/\bfamily(\s+)s(\s+factors\b)/gi;
  const signalPair=/\bfamily(\s+)s\/anti-s(\s+factor\s+pairs\b)/gi;
  const proteo=/\be(?=-Proteobacterial\s+taxa\b)/gi;
  text=text.replace(signalOne,(_match,space1:string,space2:string)=>{
    reasons.push("Ambiguous scientific σ glyph inferred from native PDF font context.");
    return "family"+space1+"σ"+space2+"factors";
  });
  text=text.replace(signalPair,(_match,space1:string,space2:string)=>{
    reasons.push("Ambiguous σ/anti-σ pair inferred from native PDF font context.");
    return "family"+space1+"σ/anti-σ"+space2+"factor pairs";
  });
  text=text.replace(proteo,()=>{
    reasons.push("Ambiguous scientific ε glyph inferred from native PDF font context.");
    return "ε";
  });
  return {text,reasons};
}
