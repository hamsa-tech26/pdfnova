/**
 * Release 93: visual-only column sizing from bounded source-cell strings.
 * Does not reflow, coerce, normalize, trim or modify any exported cell value.
 * Column widths use Excel's approximate character units and are not evidence
 * of the PDF's original column geometry.
 */
export function estimatePdfTableColumnWidths(rows: readonly (readonly unknown[])[]): number[] {
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000 ||
      rows.some(row => !Array.isArray(row) || row.length > 128)) {
    throw new Error("Unable to size unsupported spreadsheet rows.");
  }
  const width = Math.max(...rows.map(row => row.length));
  if (width < 1 || width > 128) {
    throw new Error("Unable to size unsupported spreadsheet columns.");
  }
  return Array.from({length:width},(_,col)=>{
    let longest = 0;
    for(const row of rows){
      const raw=String(row[col]??"");
      const parts=raw.split(/\r\n|\r|\n/u);
      for(const part of parts){
        // A few wide Unicode glyphs need more display space than ASCII.
        // This affects only width, never the actual cell text or its type.
        const approximate=[...part].reduce((n,ch)=>
          n + (/[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u.test(ch)?2:1),0);
        longest=Math.max(longest,Math.min(53,approximate));
      }
    }
    return Math.min(55,Math.max(10,longest+2));
  });
}
