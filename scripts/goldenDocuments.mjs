import { PDFDocument, PDFName, PDFDict, StandardFonts, rgb, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIR=path.resolve("test-fixtures/golden");
const REPORT_DIR=path.resolve("benchmarks/golden/reports");
const DATE=new Date("2026-10-10T00:00:00.000Z");
const normalize=value=>String(value??"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
function check(test,msg){if(!test)throw new Error(msg);}
function metadata(doc,title){
  doc.setTitle(title);doc.setAuthor("Kukureku Synthetic QA");
  doc.setCreator("Golden Generator");doc.setProducer("Golden Generator");
  doc.setCreationDate(DATE);doc.setModificationDate(DATE);
}
async function layout(){
  const doc=await PDFDocument.create();metadata(doc,"Golden Layout Qualification");
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const a=doc.addPage([600,780]);
  for(const [i,text] of ["GOLDEN REPORT 2026","ITEM A-101","ITEM B-202","ITEM C-303"].entries())
    a.drawText(text,{x:40,y:700-i*35,font,size:16});
  a.drawLine({start:{x:36,y:570},end:{x:560,y:570},thickness:1,color:rgb(0,0,0)});
  const b=doc.addPage([640,820]);b.setRotation(degrees(90));b.setCropBox(24,30,580,740);
  for(const [i,text] of ["FIELD NOTES","PIPELINE NORTH","PRESSURE NORMAL"].entries())
    b.drawText(text,{x:50,y:670-i*40,font,size:14});
  return new Uint8Array(await doc.save({useObjectStreams:false}));
}
async function form(){
  const doc=await PDFDocument.create();metadata(doc,"Golden Filled Form Qualification");
  const page=doc.addPage([612,792]);const font=await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("SYNTHETIC FORM - NO PERSONAL DATA",{x:36,y:740,font,size:15});
  const f=doc.getForm();
  const name=f.createTextField("qa.full_name");
  name.addToPage(page,{x:48,y:625,width:300,height:36});name.setText("EXAMPLE ALPHA");
  const accepted=f.createCheckBox("qa.accepted");
  accepted.addToPage(page,{x:48,y:550,width:20,height:20});accepted.check();
  return new Uint8Array(await doc.save({useObjectStreams:false}));
}
function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type,"ascii"),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
const GLYPHS={
G:["01110","10000","10000","10111","10001","10001","01110"],
O:["01110","10001","10001","10001","10001","10001","01110"],
L:["10000","10000","10000","10000","10000","10000","11111"],
D:["11110","10001","10001","10001","10001","10001","11110"],
E:["11111","10000","10000","11110","10000","10000","11111"],
N:["10001","11001","10101","10011","10001","10001","10001"],
S:["01111","10000","10000","01110","00001","00001","11110"],
C:["01111","10000","10000","10000","10000","10000","01111"],
A:["01110","10001","10001","11111","10001","10001","10001"],
"1":["00100","01100","00100","00100","00100","00100","01110"],
"2":["01110","10001","00001","00010","00100","01000","11111"],
"3":["11110","00001","00001","01110","00001","00001","11110"],
" ":["00000","00000","00000","00000","00000","00000","00000"]
};
function scannedPng(){
  const width=900,height=190,scale=8,pixels=Buffer.alloc(width*height*4,255);
  let xOffset=45;
  for(const char of "GOLDEN SCAN 123"){
    const glyph=GLYPHS[char];check(glyph,"Missing glyph");
    for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyph[y][x]==="1")
      for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
        const off=((45+y*scale+dy)*width+xOffset+x*scale+dx)*4;
        pixels[off]=16;pixels[off+1]=16;pixels[off+2]=16;
      }
    xOffset+=6*scale;
  }
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++)pixels.copy(raw,y*(1+width*4)+1,y*width*4,(y+1)*width*4);
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);
}
async function scan(){
  const doc=await PDFDocument.create();metadata(doc,"Golden Raster Scan Qualification");
  const page=doc.addPage([612,792]);const png=await doc.embedPng(scannedPng());
  page.drawImage(png,{x:28,y:530,width:556,height:190});
  return new Uint8Array(await doc.save({useObjectStreams:false}));
}
const builders={layout,form,scan};
export async function verifyGolden(bytes,spec){
  const e=spec.expected,pdf=await PDFDocument.load(bytes,{updateMetadata:false});
  check(pdf.getPageCount()===e.pages,spec.id+" wrong page count");
  for(const [i,p] of pdf.getPages().entries()){
    const g=e.geometry[i];
    check(Math.abs(p.getWidth()-g.width)<0.01&&Math.abs(p.getHeight()-g.height)<0.01&&p.getRotation().angle===g.rotation,spec.id+" page geometry changed");
    if(g.crop){const box=p.getCropBox();check(Object.entries(g.crop).every(([key,value])=>Math.abs(box[key]-value)<0.01),spec.id+" crop mismatch");}
  }
  if(e.title)check(pdf.getTitle()===e.title,spec.id+" title mismatch");
  if(e.fields){const f=pdf.getForm();check(f.getTextField("qa.full_name").getText()===e.fields["qa.full_name"],"Field text mismatch");check(f.getCheckBox("qa.accepted").isChecked()===e.fields["qa.accepted"],"Checkbox mismatch");}
  const task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:true,isEvalSupported:false});
  const view=await task.promise,texts=[];
  try {for(let i=1;i<=view.numPages;i++){const p=await view.getPage(i),content=await p.getTextContent();texts.push(content.items.map(item=>String(item.str??"")));p.cleanup();}}
  finally{await task.destroy();}
  if(e.textPerPage)for(const [i,phrases] of e.textPerPage.entries())
    for(const phrase of phrases)check(normalize(texts[i].join(" ")).includes(normalize(phrase)),spec.id+" missing phrase "+phrase);
  if(e.selectableTextItems!==undefined)check(texts.every(t=>t.length===e.selectableTextItems),spec.id+" unexpectedly has selectable text");
  if(e.imageXObjectsMin){const resources=pdf.getPage(0).node.Resources(),ref=resources?.get(PDFName.of("XObject"));const count=ref?pdf.context.lookup(ref,PDFDict)?.keys().length??0:0;check(count>=e.imageXObjectsMin,spec.id+" missing raster image");}
  return {id:spec.id,type:spec.type,status:"PASS",pages:e.pages,sha256:createHash("sha256").update(bytes).digest("hex"),selectableItems:texts.map(t=>t.length),ocrStatus:e.ocrStatus??"NOT_APPLICABLE"};
}
export async function generateGoldenCorpus(){
  const m=JSON.parse(await readFile("benchmarks/golden/manifest.json","utf8"));
  check(m.schema==="kukureku-golden-document-v1"&&m.classification==="SYNTHETIC_ONLY"&&m.realWorldEvaluated===0,"Unexpected golden provenance");
  check(Array.isArray(m.cases)&&m.cases.length===3,"Expected exactly three synthetic fixtures");
  await mkdir(SOURCE_DIR,{recursive:true});const cases=[],ids=new Set();
  for(const spec of m.cases){
    check(builders[spec.id]&&spec.file==="golden-"+spec.id+".pdf"&&!ids.has(spec.id),"Unrecognized or duplicate golden fixture");
    ids.add(spec.id);
    const bytes=await builders[spec.id]();
    cases.push(await verifyGolden(bytes,spec));
    await writeFile(path.join(SOURCE_DIR,spec.file),bytes);
  }
  const report={schema:"kukureku-golden-evidence-v1",classification:"SYNTHETIC_ONLY",status:"PASS_SYNTHETIC_SOURCE_INVARIANTS",
    syntheticCases:cases.length,syntheticPassed:cases.length,realWorldDocumentsEvaluated:0,ocrAccuracy:"NOT_MEASURED",
    privacy:"No user files consumed; report contains hashes of generated synthetic PDFs only.",fixtures:cases};
  await mkdir(path.dirname(path.resolve("benchmarks/golden/reports/latest.json")),{recursive:true});
  await writeFile("benchmarks/golden/reports/latest.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await generateGoldenCorpus();
