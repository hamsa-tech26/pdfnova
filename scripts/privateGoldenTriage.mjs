/**
 * Release 54: generate priority-specific safe diagnostics from verified,
 * local-only status/metrics. Never include PDF text or annotations.
 */
import {assessRealWorldCoverage,CATEGORIES,REALWORLD_POLICY} from "./privateGoldenScorer.mjs";
const PRIORITIES={
  "ocr-text":{code:"OCR_TEXT_QUALITY",priority:1,
    next:"Inspect deskew, contrast/denoise, supported language models, and OCR word coverage against original scan."},
  table:{code:"TABLE_STRUCTURE_AND_CELLS",priority:1,
    next:"Inspect table boundaries, column positions, row continuation and the approved table index."},
  form:{code:"FORM_VALUE_PRESERVATION",priority:2,
    next:"Review AcroForm appearance streams, retained visible values and removal of editable fields."},
  layout:{code:"PAGE_GEOMETRY_AND_TEXT",priority:2,
    next:"Inspect rotations, page order, CropBox/MediaBox and selectable text preservation."}
};
const metricAllowlist={
 "ocr-text":["characterErrorPct","characterAccuracyPct"],
 table:["exactCellPct","exactRowPct","expectedRows","extractedRows","rowCountMatch"],
 form:["visiblePhraseRecallPct","remainingFieldCount"],
 layout:["pageCountMatch","verifiedPages","expectedPages"]
};
const safeMetrics=(category,metrics)=>{
  if(!metrics||typeof metrics!=="object"||Array.isArray(metrics))return {};
  const safe={};
  for(const field of metricAllowlist[category]??[]){
    const value=metrics[field];
    if(typeof value==="boolean")safe[field]=value;
    else if(typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100000)
      safe[field]=Math.round(value*100)/100;
  }
  return safe;
};
export function buildGoldenFailurePlan(manifest,evidence=[]){
  // Require valid independent human annotation before scoring any case.
  const raw=evidence.map(v=>({id:v.id,status:v.status}));
  const coverage=assessRealWorldCoverage(manifest,raw);
  const map=new Map(evidence.map(v=>[v.id,v]));
  const byCategory={};
  for(const category of CATEGORIES){
    const entries=manifest.cases.filter(item=>item.category===category);
    const observations=entries.map(entry=>{
      const r=map.get(entry.id);
      return {id:entry.id,status:r?.status??"NOT_RUN",
        reasonCode:typeof r?.reasonCode==="string"&&/^[A-Z0-9_]{2,64}$/.test(r.reasonCode)?
          r.reasonCode:"NOT_RUN",
        metrics:safeMetrics(category,r?.metrics)};
    });
    const failed=observations.filter(o=>o.status==="FAIL").length;
    const missing=observations.filter(o=>o.status==="NOT_RUN").length;
    const passes=observations.filter(o=>o.status==="PASS").length;
    const minimum=REALWORLD_POLICY.requiredPerCategory[category];
    byCategory[category]={
      required:minimum,annotated:entries.length,passed:passes,failed,notRun:missing,
      remainingPassingCases:Math.max(0,minimum-passes),
      priority:PRIORITIES[category].priority,
      action:failed?PRIORITIES[category].next:
        missing||passes<minimum?"Obtain and independently annotate further approved real PDFs; run their measured browser checks.":
        "Retain passing ground truth and regression evidence.",
      observations
    };
  }
  const queue=CATEGORIES.filter(category=>{
    const group=byCategory[category];return group.remainingPassingCases||group.failed;
  }).sort((a,b)=>
    (byCategory[b].failed-byCategory[a].failed)||
    (byCategory[a].priority-byCategory[b].priority)||
    a.localeCompare(b)).map(category=>({
      category,code:PRIORITIES[category].code,failed:byCategory[category].failed,
      notRun:byCategory[category].notRun,
      remainingPassingCases:byCategory[category].remainingPassingCases,
      recommendation:byCategory[category].action
    }));
  return {schema:"kukureku-golden-remediation-v1",status:coverage.status,
    realWorldCases:coverage.realWorldCases,passed:coverage.passed,
    failed:coverage.failed,notRun:coverage.notRun,
    qualification:"SCOPED_INTERNAL_ONLY",
    byCategory,prioritizedWork:queue,
    note:"Generated entirely from verified local result codes and aggregate metrics; no PDFs, OCR transcriptions or table cell values are copied."};
}
