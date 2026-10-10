import {mkdir,writeFile,lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {privateCorpus,PRIVATE_ROOT,verifiedPrivateCaseEvidence} from "./privateGoldenLocal.mjs";
import {buildGoldenFailurePlan} from "./privateGoldenTriage.mjs";
import {scaffoldChecklist} from "./privateGoldenScaffold.mjs";
export async function privateGoldenReport(requireComplete=false){
  let manifest;
  try{manifest=await privateCorpus();}
  catch{
    const plan=scaffoldChecklist();
    if(requireComplete)process.exitCode=2;
    console.log(JSON.stringify(plan,null,2));return plan;
  }
  const evidence=await Promise.all(manifest.cases.map(verifiedPrivateCaseEvidence));
  const plan=buildGoldenFailurePlan(manifest,evidence);
  const directory=await lstat(PRIVATE_ROOT);
  if(!directory.isDirectory()||directory.isSymbolicLink())
    throw Error("PRIVATE_GOLDEN_UNSAFE_REPORT_DIRECTORY");
  const file=path.join(PRIVATE_ROOT,"remediation-report.json");
  await writeFile(file,JSON.stringify(plan,null,2)+"\n",{mode:0o600});
  if(requireComplete&&plan.status!=="PASS_SCOPED_REAL_WORLD")process.exitCode=2;
  console.log(JSON.stringify({
    schema:plan.schema,status:plan.status,realWorldCases:plan.realWorldCases,
    passed:plan.passed,failed:plan.failed,notRun:plan.notRun,
    prioritizedWork:plan.prioritizedWork,
    reportLocation:"benchmarks/golden/private/remediation-report.json",
    note:"All PDF bytes, transcriptions and annotation ground truth stay local."
  },null,2));
  return plan;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await privateGoldenReport(process.argv.includes("--require-complete"));
