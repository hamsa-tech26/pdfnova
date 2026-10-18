/**
 * Explain repeated second-tier native PDF headings without editing source
 * cells, inventing merged cells, or claiming publisher geometry is certified.
 * Admitted only for the clear 1 + three pairs, seven-column layout in which
 * each pair has an explicit parent heading and repeatable subheadings.
 */
export type NativeGroupedHeaderGuide={notes:string[];columns:string[]};
function label(value:unknown):string{
  const text=String(value??"").replace(/[\x00-\x1f\x7f]/g," ").trim();
  return text.length<=80?text:text.slice(0,80)+"…";
}
export function describeNativePairedGroupHeaders(rows:readonly (readonly string[])[])
  :NativeGroupedHeaderGuide|null{
  if(rows.length<3||rows[0]?.length!==7||rows[1]?.length!==7)return null;
  const top=rows[0].map(label),lower=rows[1].map(label);
  const parentIndexes=[1,3,5];
  if(!top[0]||!lower[0]||
    parentIndexes.some(i=>!top[i]||top[i+1]!==""||!lower[i]||!lower[i+1]))
    return null;
  if(new Set(parentIndexes.map(i=>top[i].toLowerCase())).size!==3)return null;
  const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
  if(!same(lower[1],lower[3])||!same(lower[3],lower[5])||
     !same(lower[2],lower[4])||!same(lower[4],lower[6])||
     same(lower[1],lower[2]))return null;
  // Labels are only a human-readable XLSX review aid; data cells and header
  // rows are unchanged. The first column is split across two header lines.
  const descriptions=[top[0]+" "+lower[0]];
  for(const i of parentIndexes){
    descriptions.push(top[i]+" / "+lower[i]);
    descriptions.push(top[i]+" / "+lower[i+1]);
  }
  return {
    columns:descriptions,
    notes:[
      "Grouped native column heading guide (source two-level table; no Excel cell merges recreated):",
      ...descriptions.map((name,i)=>"Column "+String.fromCharCode(65+i)+": "+name),
      "These parent/subcolumn relationships are inferred from repeated native headings. "+
        "Verify the original PDF group boundaries before analysis.",
    ],
  };
}
