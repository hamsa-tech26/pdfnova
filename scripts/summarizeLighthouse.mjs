import {readFile,writeFile,mkdir} from "node:fs/promises";
const base="benchmarks/website/reports/lighthouse";
const paths=[["/", "home"],["/merge-pdf","merge"]];
const results=[];
for(const [route,key] of paths){
  try{
    const report=JSON.parse(await readFile(base+"/"+key+".json","utf8"));
    const audits=report.audits??{};
    const metric=k=>Number.isFinite(audits[k]?.numericValue)?Math.round(audits[k].numericValue):null;
    const score=k=>Number.isFinite(report.categories?.[k]?.score)?Math.round(report.categories[k].score*100):null;
    results.push({route,
      requested:"https://kukureku.com"+route,
      finalUrl:report.finalDisplayedUrl??null,
      runtimeError:report.runtimeError?.message??null,
      scores:{performance:score("performance"),accessibility:score("accessibility"),bestPractices:score("best-practices"),seo:score("seo")},
      labMs:{fcp:metric("first-contentful-paint"),lcp:metric("largest-contentful-paint"),tbt:metric("total-blocking-time")},
      labCLS:Number.isFinite(audits["cumulative-layout-shift"]?.numericValue)?audits["cumulative-layout-shift"].numericValue:null,
      reportVersion:report.lighthouseVersion??null});
  }catch(e){results.push({route,status:"NOT_MEASURED",error:e instanceof Error?e.message:"unknown"});}
}
await mkdir(base,{recursive:true});
await writeFile(base+"/summary.json",JSON.stringify({
  scope:"PINNED_LIGHTHOUSE_MOBILE_SIMULATED_LAB_ON_CURRENT_PRODUCTION_NOT_RELEASE_BRANCH",
  note:"Lighthouse lab measurements are not CrUX or Core Web Vitals from actual visitors.",
  results,
},null,2)+"\n");
console.log(JSON.stringify(results,null,2));
