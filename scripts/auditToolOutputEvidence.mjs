import fs from "node:fs";
import path from "node:path";
import { TOOL_ROUTES } from "./indexNowRoutes.mjs";

const root=process.cwd();
const matrix=JSON.parse(fs.readFileSync(path.join(root,"benchmarks/tool-output-evidence.json"),"utf8"));
if(matrix.schema!=="kukureku-output-evidence-v2"||!Array.isArray(matrix.entries)){
  throw new Error("Tool certification report schema mismatch.");
}
const expected=[...TOOL_ROUTES].sort();
const actual=matrix.entries.map(item=>item.route).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected)){
  throw new Error("Tool certification report must list every live tool exactly once.");
}
const levels=new Set(["content","structure","unit-only"]);
const verdicts=new Set(["PASS","PASS_WITH_WARNING","FAILED"]);
for(const item of matrix.entries){
  if(!levels.has(item.level)||!verdicts.has(item.verdict)||
    typeof item.file!=="string"||item.file.includes("..")||
    !fs.existsSync(path.join(root,item.file))||
    typeof item.claim!=="string"||item.claim.length<15||
    typeof item.limitations!=="string"||item.limitations.length<15||
    typeof item.qualificationScope!=="string"||item.qualificationScope.length<15){
    throw new Error("Missing evidence or limitation for "+item.route);
  }
  if(item.level!=="content" && item.verdict!=="FAILED"){
    throw new Error(item.route+" cannot be qualified without operation-specific real output evidence.");
  }
}
const summary={
  schema:matrix.schema,
  result:"SCOPED_INTERNAL_FUNCTIONAL_QUALIFICATION",
  tools:matrix.entries.length,
  coverage:Object.fromEntries([...levels].map(level=>[level,matrix.entries.filter(e=>e.level===level).length])),
  verdicts:Object.fromEntries([...verdicts].map(verdict=>[verdict,matrix.entries.filter(e=>e.verdict===verdict).length])),
  scope:matrix.certificationPolicy,
  limitations:"Per-tool claims are limited to inspected synthetic browser outputs. This is not an accreditation, OCR accuracy score, real-device audit, or a promise all documents work."
};
console.log(JSON.stringify(summary,null,2));
const complete=matrix.entries.length===expected.length &&
  matrix.entries.every(e=>e.level==="content" && e.verdict!=="FAILED");
if(process.argv.includes("--require-complete") && !complete){
  throw new Error("Internal functional qualification incomplete: unresolved output gaps or FAIL verdicts.");
}
