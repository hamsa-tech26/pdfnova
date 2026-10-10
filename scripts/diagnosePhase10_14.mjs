/**
 * Release 55: deterministic, bounded, nontextual diagnostics for four
 * PUBLIC synthetic OCR table fixtures. No gold text, extracted strings or
 * private document contents enter the report.
 */
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {norm} from "./scorePhase10_14.mjs";
import {excludePhase10_14ColumnHeader} from "./phase10_14Rows.mjs";

const validMatrix=value=>Array.isArray(value)&&value.every(row=>
  Array.isArray(row)&&row.length<=100&&row.every(cell=>typeof cell==="string"));
export function diagnoseOcrTable(expected,actual){
  if(!validMatrix(expected)||!validMatrix(actual)||expected.length>1000||actual.length>1000)
    throw Error("OCR benchmark matrix invalid");
  const maxColumns=Math.max(0,...expected.map(row=>row.length));
  const byColumn=Array.from({length:maxColumns},(_,column)=>({
    columnIndex:column,expectedCells:0,matchedCells:0,mismatchedCells:0,missingCells:0
  }));
  let matchedRows=0,missingRows=0,mismatchedRows=0,shiftedCandidates=0;
  const rowProblems=[];
  const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&
    a.every((cell,i)=>norm(cell)===norm(b[i]));
  for(let i=0;i<expected.length;i++){
    const row=expected[i],observed=actual[i];
    if(!Array.isArray(observed))missingRows++;
    else if(same(row,observed))matchedRows++;
    else mismatchedRows++;
    let mismatches=0,missing=0;
    for(let column=0;column<row.length;column++){
      const record=byColumn[column];record.expectedCells++;
      if(observed?.[column]===undefined){record.missingCells++;missing++;}
      else if(norm(observed[column])===norm(row[column]))record.matchedCells++;
      else {record.mismatchedCells++;mismatches++;}
    }
    if(mismatches||missing||!Array.isArray(observed)||observed.length!==row.length){
      const shiftObserved=[i-1,i+1].filter(j=>j>=0&&j<actual.length&&same(row,actual[j]));
      if(shiftObserved.length)shiftedCandidates++;
      rowProblems.push({rowIndex:i,expectedColumns:row.length,
        actualColumns:Array.isArray(observed)?observed.length:0,
        missingCells:missing,mismatchedCells:mismatches,adjacentShiftSuspected:shiftObserved.length>0});
    }
  }
  const mismatchCount=byColumn.reduce((n,c)=>n+c.mismatchedCells+c.missingCells,0);
  return {status:"DIAGNOSTIC_ONLY",expectedRows:expected.length,actualRows:actual.length,
    matchedRows,missingRows,mismatchedRows,
    extraRows:Math.max(0,actual.length-expected.length),
    positionalErrorCount:mismatchCount,adjacentShiftCandidates:shiftedCandidates,
    byColumn,rowProblems};
}
export function buildPhase10_14Diagnostics(manifest,results){
  if(!Array.isArray(manifest?.fixtures)||!Array.isArray(results))throw Error("Invalid OCR benchmark provenance");
  const byId=new Map(results.map(result=>[result.id,result]));
  const fixtures=manifest.fixtures.map(spec=>{
    const actual=byId.get(spec.id);
    if(!actual||!Array.isArray(actual.rows))return {id:spec.id,status:"NOT_RUN"};
    const cleaned=excludePhase10_14ColumnHeader(actual.rows).rows;
    return {id:spec.id,status:actual.ocrAttempted===true?"MEASURED":"OCR_NOT_CONFIRMED",
      ocrAttempted:actual.ocrAttempted===true,diagnosis:diagnoseOcrTable(spec.expectedRows,cleaned)};
  });
  return {schema:"phase10-14-diagnostic-v1",classification:"SYNTHETIC_ONLY",
    status:fixtures.every(f=>f.status==="MEASURED")?"MEASURED":"INCOMPLETE",
    approval:"NOT_A_RELEASE_GATE",
    fixtures,notes:"Position-specific row/column failures only. No OCR values, source texts or automatic ground-truth correction."};
}
export async function writePhase10_14Diagnostics(){
  const manifest=JSON.parse(await readFile("benchmarks/phase10_14/manifest.json","utf8"));
  let actual=[];
  try{actual=JSON.parse(await readFile("benchmarks/phase10_14/reports/actual-results.json","utf8"));}
  catch {actual=[];}
  const report=buildPhase10_14Diagnostics(manifest,actual);
  await mkdir("benchmarks/phase10_14/reports",{recursive:true});
  await writeFile("benchmarks/phase10_14/reports/release55-diagnostics.json",
    JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({schema:report.schema,status:report.status,
    fixtures:report.fixtures.map(f=>({id:f.id,status:f.status,
      errorCount:f.diagnosis?.positionalErrorCount??null,
      missingRows:f.diagnosis?.missingRows??null}))},null,2));
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await writePhase10_14Diagnostics();
