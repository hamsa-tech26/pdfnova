import fs from "node:fs";
import path from "node:path";
import {TOOL_ROUTES} from "./indexNowRoutes.mjs";

const root=process.cwd();
const matrix=JSON.parse(fs.readFileSync(path.join(root,"benchmarks","tool-output-evidence.json"),"utf8"));
if(matrix.schema!=="kukureku-output-evidence-v1" || !Array.isArray(matrix.entries)) throw new Error("Output evidence manifest schema mismatch.");
const expected=[...TOOL_ROUTES].sort();
const actual=matrix.entries.map(item=>item.route).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected)){
  throw new Error("Output evidence registry must exactly match all 30 live tool routes.");
}
const valid=new Set(["content","structure","unit-only"]);
for(const item of matrix.entries){
  if(!valid.has(item.level) || typeof item.claim!=="string" || item.claim.length<10 ||
     typeof item.file!=="string" || item.file.includes("..") ||
     !fs.existsSync(path.join(root,item.file))) {
    throw new Error("Invalid output evidence row: "+item.route);
  }
}
const totals=Object.fromEntries([...valid].map(level=>[level,matrix.entries.filter(x=>x.level===level).length]));
const report={schema:matrix.schema,total:matrix.entries.length,...totals,
  fullyCertified:false,
  note:"Tier labels are manually reviewed assertions about existing tests, not proof of fidelity across arbitrary files. Real-device, adversarial and accessibility audits remain outstanding."};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes("--require-complete") && (totals["unit-only"]>0 || totals.structure>0)) {
  throw new Error("30-tool output qualification is INCOMPLETE: structure-only and unit-only gaps remain.");
}
