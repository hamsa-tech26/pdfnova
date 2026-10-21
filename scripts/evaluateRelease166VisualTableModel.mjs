/**
 * Experimental CPU-only, browser-compatible visual detector feasibility.
 * NEVER used as automatic source truth or a live Kukureku PDF engine path.
 * Model weights arrive FROM Hugging Face; PDFs/pixels are never sent there.
 * Evaluates the three currently missed original-source PubTables TEST regions.
 */
import {pipeline} from "@huggingface/transformers";
import {PDFDocument} from "pdf-lib";
import {execFileSync} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage}
  from "../benchmarks/release112/scoreTableRegions.mjs";

const root=resolve("benchmarks/release112"),hidden=join(root,"private");
const output=resolve("benchmarks/release166/reports");
const sources=JSON.parse(await readFile(join(root,"sources.json"),"utf8"));
if(sources.acceptedFormalV4DocumentCredit!==0||
   sources.documents.length!==2)throw Error("Unexpected public source benchmark");
const targets=[
  {id:"PMC1064082",page:1},
  {id:"PMC1064082",page:4},
  {id:"PMC1064098",page:6},
];
// Commit/revision pin prevents model drift between public benchmarks.
const MODEL="Xenova/table-transformer-detection";
const REVISION="187ac355617c8fee3d69c00d461ecf8eb8a4a5b7";
const detector=await pipeline("object-detection",MODEL,{
  revision:REVISION,dtype:"q8",
});
await mkdir(output,{recursive:true});
let matched=0,missed=0,unmatched=0;
const diagnostics=[];
for(const target of targets){
  const source=sources.documents.find(x=>x.id===target.id);
  if(!source)throw Error("Unknown source ID");
  const sourceBytes=await readFile(join(hidden,target.id+".pdf"));
  const document=await PDFDocument.load(sourceBytes,{updateMetadata:false});
  const sourcePage=document.getPage(target.page-1);
  if(sourcePage.getRotation().angle!==0)
    throw Error("Rotated publisher source requires explicit transform");
  const {width:pdfWidth,height:pdfHeight}=sourcePage.getSize();
  const temp=join(hidden,"ml-"+target.id+"-"+target.page);
  execFileSync("pdftoppm",[
    "-f",String(target.page),"-l",String(target.page),
    "-scale-to","1000","-png","-singlefile",
    join(hidden,target.id+".pdf"),temp],
    {timeout:50000,maxBuffer:1024*1024});
  const png=await readFile(temp+".png");
  if(png.length<30||png.subarray(1,4).toString()!=="PNG")
    throw Error("Raster render unavailable");
  const imageWidth=png.readUInt32BE(16);
  const imageHeight=png.readUInt32BE(20);
  if(imageWidth<300||imageHeight<300||imageWidth>3000||
    imageHeight>3000)throw Error("Invalid rendered image dimensions");
  // File input is a local runner image; the inference provider is never called.
  const candidates=await detector(temp+".png",{threshold:0.70});
  const predictions=candidates.filter(c=>
      String(c.label).toLowerCase().includes("table")&&
      Number.isFinite(c.score)&&c.score>=0.70&&c.box&&
      [c.box.xmin,c.box.ymin,c.box.xmax,c.box.ymax].every(Number.isFinite)&&
      c.box.xmin>=0&&c.box.ymin>=0&&
      c.box.xmax>c.box.xmin&&c.box.ymax>c.box.ymin&&
      c.box.xmax<=imageWidth+2&&c.box.ymax<=imageHeight+2)
    .slice(0,10).map(c=>({
      x:c.box.xmin/imageWidth*pdfWidth,
      y:(1-c.box.ymax/imageHeight)*pdfHeight,
      width:(c.box.xmax-c.box.xmin)/imageWidth*pdfWidth,
      height:(c.box.ymax-c.box.ymin)/imageHeight*pdfHeight,
    }));
  const original=source.referencePages.find(x=>x.page===target.page);
  const xml=await readFile(join(hidden,original.annotation),"utf8");
  const annotation=parseDetectionXml(xml);
  const expected=annotation.boxes.map(x=>annotationToPdfBox(x,annotation,
    {width:pdfWidth,height:pdfHeight}));
  const metrics=scoreDetectionPage(expected,predictions,0.5);
  matched+=metrics.matchedCount;missed+=metrics.missedCount;
  unmatched+=metrics.unmatchedPredictionCount;
  const summary={id:target.id,page:target.page,
    publishedBoxes:metrics.referenceCount,
    detectedVisualTables:metrics.predictionCount,
    matchedBoxes:metrics.matchedCount,missedBoxes:metrics.missedCount,
    unmatchedPredictions:metrics.unmatchedPredictionCount,
    referenceBestIoU:metrics.referenceBestIoU};
  diagnostics.push(summary);
  console.log(JSON.stringify({type:"VISUAL_DETECTOR_SOURCE_ONLY",...summary}));
}
const report={model:MODEL,revision:REVISION,dtype:"q8",
  source:"THREE_ORIGINAL_PUBLISHED_FAILURE_REGIONS",
  testScope:"SOURCE_BOX_DIAGNOSTIC_ONLY",
  referenceOnlyAtScoringTime:true,
  thresholdConfidence:0.70,thresholdIoU:0.50,
  publishedBoxes:matched+missed,matchedBoxes:matched,
  missedBoxes:missed,unmatchedPredictions:unmatched,
  certifiedCellAccuracy:false,acceptedFormalV4Documents:0,
  privacy:"CPU local PNG inputs; model weights only external downloads",
  result:diagnostics};
await writeFile(join(output,"visual-model-source-feasibility.json"),
  JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({type:"VISUAL_DETECTOR_FEASIBILITY_SUMMARY",
  matchedBoxes:matched,missedBoxes:missed,unmatchedPredictions:unmatched,
  acceptedFormalV4Documents:0}));
