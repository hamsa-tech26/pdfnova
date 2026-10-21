/**
 * Held-out twenty-PDF, fixed-confidence-grid visual detector comparison.
 * This uses only the ORIGINAL publisher PDFs and independent PubTables test
 * boxes. Model downloads do not receive source pixels; no cloud inference.
 * Do not optimize a production threshold using these held-out labels.
 */
import {pipeline} from "@huggingface/transformers";
import {PDFDocument} from "pdf-lib";
import {execFileSync} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {annotationToPdfBox,parseDetectionXml,scoreDetectionPage}
 from "../benchmarks/release112/scoreTableRegions.mjs";
const privateRoot=resolve("benchmarks/release166/private");
const manifest=JSON.parse(await readFile(join(privateRoot,"manifest.json"),"utf8"));
if(manifest.acceptedFormalV4DocumentCredit!==0||
   manifest.documents.length!==20||
   manifest.rightsAndIndependentCellReferenceStatus!=="NOT_REVIEWED")
 throw Error("This benchmark cannot grant V4 Stable qualification");
const thresholds=[0.25,0.40,0.55,0.70,0.85];
const results=thresholds.map(confidence=>({confidence,publishedBoxes:0,
  detectedBoxes:0,matchedBoxes:0,missedBoxes:0,unmatchedPredictions:0}));
const MODEL="Xenova/table-transformer-detection";
const REVISION="187ac355617c8fee3d69c00d461ecf8eb8a4a5b7";
const requestedDtype=process.env.V4_VISUAL_MODEL_DTYPE;
const dtype=requestedDtype==="fp32"?"fp32":"q8";
const detector=await pipeline("object-detection",MODEL,{
 revision:REVISION,dtype,
});
let originalPages=0;const start=Date.now();
for(const source of manifest.documents){
 const bytes=await readFile(join(privateRoot,source.id+".pdf"));
 const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
 if(pdf.getPageCount()!==source.pageCount)throw Error("Unexpected page count");
 for(const item of source.referencePages){
  const page=pdf.getPage(item.page-1);
  if(page.getRotation().angle!==0)throw Error("Rotated source: no valid transform");
  const {width,height}=page.getSize();
  const prefix=join(privateRoot,"vmodel-"+source.id+"-"+item.page);
  execFileSync("pdftoppm",[
    "-f",String(item.page),"-l",String(item.page),"-scale-to","1000",
    "-png","-singlefile",join(privateRoot,source.id+".pdf"),prefix],
    {timeout:50000,maxBuffer:1000000});
  const png=await readFile(prefix+".png");
  if(png.length<32||png.subarray(1,4).toString()!=="PNG")
    throw Error("Invalid temporary raster");
  const pixelWidth=png.readUInt32BE(16),pixelHeight=png.readUInt32BE(20);
  if(pixelWidth<300||pixelWidth>3000||pixelHeight<300||
     pixelHeight>3000)throw Error("Invalid raster viewport");
  const annotation=parseDetectionXml(await readFile(
    join(privateRoot,item.annotation),"utf8"));
  const reference=annotation.boxes.map(box=>annotationToPdfBox(box,annotation,
    {width,height}));
  const candidates=await detector(prefix+".png",{threshold:0.20});
  const boxes=candidates.filter(c=>String(c.label).toLowerCase().includes("table")&&
    Number.isFinite(c.score)&&c.score>=.20&&c.box&&
    [c.box.xmin,c.box.xmax,c.box.ymin,c.box.ymax].every(Number.isFinite)&&
    c.box.xmin>=0&&c.box.ymin>=0&&
    c.box.xmax>c.box.xmin&&c.box.ymax>c.box.ymin&&
    c.box.xmax<=pixelWidth+2&&c.box.ymax<=pixelHeight+2)
    .slice(0,20).map(c=>({score:c.score,bounds:{
      x:c.box.xmin/pixelWidth*width,
      y:(1-c.box.ymax/pixelHeight)*height,
      width:(c.box.xmax-c.box.xmin)/pixelWidth*width,
      height:(c.box.ymax-c.box.ymin)/pixelHeight*height,
    }}));
  for(const r of results){
    const score=scoreDetectionPage(reference,boxes.filter(b=>b.score>=r.confidence)
      .map(b=>b.bounds),0.5);
    r.publishedBoxes+=score.referenceCount;
    r.detectedBoxes+=score.predictionCount;
    r.matchedBoxes+=score.matchedCount;
    r.missedBoxes+=score.missedCount;
    r.unmatchedPredictions+=score.unmatchedPredictionCount;
  }
  originalPages++;
 }
 console.log(JSON.stringify({type:"VISUAL_HELDOUT_SOURCE_DOCUMENT",
   sourceId:source.id,processedAnnotatedPages:source.referencePages.length,
   cellCertificationCredit:0}));
}
const report={type:"VISUAL_HELDOUT_20_PDF_CONFIDENCE_SWEEP",
 sourceCount:manifest.documents.length,annotatedPages:originalPages,
 model:MODEL,revision:REVISION,dtype,
 input:"ORIGINAL_PDF_RASTER_LOCALLY_IN_GITHUB_CI",
 uploadedSourcePixels:false,sourceRightsConfirmed:false,
 thresholdIoU:0.5,baselineKukurekuMatched:5,baselineKukurekuPublished:34,
 baselineKukurekuUnmatched:11,thresholds:results,
 inferenceAndRenderSeconds:Math.round((Date.now()-start)/1000),
 reviewerApprovedDocuments:0,certifiedCells:0,formalV4Stable:"BLOCKED",
 caveat:"Fixed grid diagnostic only; do not tune to held-out test labels and claim general accuracy."};
const out=resolve("benchmarks/release166/reports");
await mkdir(out,{recursive:true});
await writeFile(join(out,"visual-heldout20-"+dtype+"-confidence-sweep.json"),
 JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
if(results.some(r=>r.publishedBoxes!==34)||originalPages<20)
 throw Error("Visual held-out baseline did not measure all independently published boxes");
