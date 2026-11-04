/**
 * Release 53: safe, local-only real-world document intake preflight.
 * Source files, expected text and annotations are never printed or uploaded.
 * Passing preflight is NOT an accuracy result; it only permits measurement.
 */
import {PDFDocument,PDFDict,PDFName} from "pdf-lib";
import {getDocument,OPS} from "pdfjs-dist/legacy/build/pdf.mjs";
import {fileURLToPath} from "node:url";
import {lstat} from "node:fs/promises";
import path from "node:path";
import {privateCorpus,readPrivatePdf,PRIVATE_ROOT} from "./privateGoldenLocal.mjs";
import {CATEGORIES,REALWORLD_POLICY} from "./privateGoldenScorer.mjs";

const result=(status,reasonCode,pages=0)=>({status,reasonCode,pages});
const blocked=reasonCode=>result("BLOCKED",reasonCode);
// Resource dictionaries can contain unused images (or non-image XObjects).
// Count image *paint operations* in the rendered page instead. Stencil masks
// alone do not establish that a document contains scanned raster content.
const RASTER_PAINT_OPS=new Set([
  OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintJpegXObject,
  OPS.paintImageXObjectRepeat
].filter(Number.isInteger));

async function auditPageContent(bytes,category){
  const task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,
    useSystemFonts:true,isEvalSupported:false});
  try{
    const doc=await task.promise;
    let anyRaster=false,allPagesRaster=true,anyText=false;
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n);
      try{
        const content=await page.getTextContent();
        const hasText=content.items.some(item=>typeof item.str==="string"&&item.str.trim());
        anyText ||=hasText;
        const operations=await page.getOperatorList();
        if(operations.fnArray.length>300000)throw Error("SOURCE_OPERATOR_LIMIT");
        const hasRaster=operations.fnArray.some(op=>RASTER_PAINT_OPS.has(op));
        anyRaster ||=hasRaster;
        allPagesRaster &&=hasRaster;
      }finally{page.cleanup();}
    }
    if(category==="ocr-text"){
      if(anyText)return blocked("SOURCE_ALREADY_HAS_SELECTABLE_TEXT");
      if(!anyRaster)return blocked("NO_IMAGE_CONTENT_FOUND");
      if(!allPagesRaster)return blocked("RASTER_PAGE_MISSING");
    }else if(!anyText&&!anyRaster){
      return blocked("SOURCE_TABLE_CONTENT_NOT_FOUND");
    }
    return null;
  }finally{await task.destroy();}
}

function hasPageAttachedFormWidget(pdf){
  const fields=pdf.getForm().getFields();
  if(!fields.length)return false;
  const widgets=new Set(fields.flatMap(field=>field.acroField.getWidgets().map(widget=>widget.dict)));
  return pdf.getPages().some(page=>page.node.Annots()?.asArray().some(ref=>{
    const annotation=pdf.context.lookup(ref,PDFDict);
    return annotation.get(PDFName.of("Subtype"))?.toString()==="/Widget"&&widgets.has(annotation);
  }));
}

export async function inspectPrivatePdfStructure(entry,bytes){
  let pdf;
  try {
    pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  }catch {
    return blocked("UNSUPPORTED_OR_UNREADABLE_PDF");
  }
  const count=pdf.getPageCount();
  if(count<1||count>150)return blocked("UNSUPPORTED_PAGE_COUNT");
  if(entry.category==="form"&&!hasPageAttachedFormWidget(pdf))
    return blocked("NO_INTERACTIVE_ACROFORM_FIELDS");
  if(entry.category==="layout"&&count!==entry.expected.pageCount)
    return blocked("SOURCE_PAGE_COUNT_MISMATCH");

  if(entry.category==="ocr-text"||entry.category==="table"){
    // A source with a PDF image resource but no actual paint would previously
    // pass. The real-document benchmark must reject that false qualification.
    try{
      const sourceAudit=await auditPageContent(bytes,entry.category);
      if(sourceAudit)return sourceAudit;
    }catch{return blocked("SOURCE_CONTENT_AUDIT_FAILED");}
  }
  return result("READY","SOURCE_STRUCTURALLY_VALID",count);
}

export async function preflightPrivateCorpus(requireReady=false){
  let manifest;
  try{manifest=await privateCorpus();}
  catch{
    let folderExists=true;
    try{await lstat(PRIVATE_ROOT);}
    catch(error){folderExists=error?.code!=="ENOENT";}
    // Invalid/private-in-progress data is a BLOCKER, not equivalent to an
    // absent corpus. No filenames, annotations, or PDF text appear here.
    const summary={schema:"kukureku-private-intake-v1",status:folderExists?"BLOCKED_INTAKE":"NOT_RUN",
      documents:0,ready:0,blocked:0,realWorldAccuracy:"NOT_MEASURED",
      reasonCode:folderExists?"INVALID_OR_INCOMPLETE_PRIVATE_CORPUS":"NO_PRIVATE_CORPUS",
      note:folderExists?"Local private intake is invalid or incomplete.":
        "No approved local real-document corpus was found."};
    console.log(JSON.stringify(summary,null,2));
    if(requireReady||folderExists)process.exitCode=2;
    return summary;
  }
  const perCategory=Object.fromEntries(CATEGORIES.map(category=>[category,{
    required:REALWORLD_POLICY.requiredPerCategory[category],reviewed:0,ready:0,blocked:0
  }]));
  const reasonCodes={};
  let ready=0,blockedCount=0;
  for(const entry of manifest.cases){
    perCategory[entry.category].reviewed++;
    let outcome;
    try{
      const bytes=await readPrivatePdf(entry);
      outcome=await inspectPrivatePdfStructure(entry,bytes);
    }catch{outcome=blocked("SOURCE_MISSING_OR_HASH_MISMATCH");}
    if(outcome.status==="READY"){ready++;perCategory[entry.category].ready++;}
    else{blockedCount++;perCategory[entry.category].blocked++;
      reasonCodes[outcome.reasonCode]=(reasonCodes[outcome.reasonCode]??0)+1;}
  }
  const diversity=Object.values(perCategory).every(x=>x.ready>=x.required);
  const status=diversity&&blockedCount===0?"READY_FOR_LOCAL_MEASUREMENT":"BLOCKED_INTAKE";
  const summary={schema:"kukureku-private-intake-v1",status,
    documents:manifest.cases.length,ready,blocked:blockedCount,
    perCategory,reasonCodes,realWorldAccuracy:"NOT_MEASURED",
    note:"Readiness is only a local file and annotation preflight, never a measured or certified OCR result."};
  console.log(JSON.stringify(summary,null,2));
  if(requireReady&&status!=="READY_FOR_LOCAL_MEASUREMENT")process.exitCode=2;
  return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await preflightPrivateCorpus(process.argv.includes("--require-ready"));
