/**
 * Release 53: safe, local-only real-world document intake preflight.
 * Source files, expected text and annotations are never printed or uploaded.
 * Passing preflight is NOT an accuracy result; it only permits measurement.
 */
import {PDFDocument,PDFDict,PDFName} from "pdf-lib";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {privateCorpus,readPrivatePdf} from "./privateGoldenLocal.mjs";
import {CATEGORIES,REALWORLD_POLICY} from "./privateGoldenScorer.mjs";

const result=(status,reasonCode,pages=0)=>({status,reasonCode,pages});
const blocked=reasonCode=>result("BLOCKED",reasonCode);

export async function inspectPrivatePdfStructure(entry,bytes){
  let pdf;
  try {
    pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  }catch {
    return blocked("UNSUPPORTED_OR_UNREADABLE_PDF");
  }
  const count=pdf.getPageCount();
  if(count<1||count>150)return blocked("UNSUPPORTED_PAGE_COUNT");
  if(entry.category==="form"&&pdf.getForm().getFields().length===0)
    return blocked("NO_INTERACTIVE_ACROFORM_FIELDS");
  if(entry.category==="layout"&&count!==entry.expected.pageCount)
    return blocked("SOURCE_PAGE_COUNT_MISMATCH");

  if(entry.category==="ocr-text"){
    // In this benchmark category, selectable source text is a confound:
    // a TXT export may be valid without actually performing OCR.
    let task;
    try{
      task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,
        useSystemFonts:true,isEvalSupported:false});
      const view=await task.promise;
      let selectable=0;
      for(let n=1;n<=view.numPages;n++){
        const page=await view.getPage(n),content=await page.getTextContent();
        selectable+=content.items.filter(item=>typeof item.str==="string"&&item.str.trim()).length;
        page.cleanup();
      }
      if(selectable>0)return blocked("SOURCE_ALREADY_HAS_SELECTABLE_TEXT");
    }catch{return blocked("SOURCE_TEXT_AUDIT_FAILED");}
    finally{if(task)await task.destroy();}
    // Every OCR sample must contain at least one rendered page image.
    const images=pdf.getPages().reduce((total,page)=>{
      const ref=page.node.Resources()?.get(PDFName.of("XObject"));
      const objects=ref?pdf.context.lookup(ref,PDFDict):null;
      return total+(objects?objects.keys().length:0);
    },0);
    if(images===0)return blocked("NO_IMAGE_CONTENT_FOUND");
  }
  return result("READY","SOURCE_STRUCTURALLY_VALID",count);
}

export async function preflightPrivateCorpus(requireReady=false){
  let manifest;
  try{manifest=await privateCorpus();}
  catch{
    const summary={schema:"kukureku-private-intake-v1",status:"NOT_RUN",
      documents:0,ready:0,blocked:0,realWorldAccuracy:"NOT_MEASURED",
      note:"No approved local real-document corpus was found."};
    console.log(JSON.stringify(summary,null,2));
    if(requireReady)process.exitCode=2;
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
